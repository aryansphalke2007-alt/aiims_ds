import { MinHeap } from './data_structures/MinHeap.js';
import { FifoQueue } from './data_structures/FifoQueue.js';
import { db } from './db/database.js';

export interface PatientRecord {
  id: number;
  name: string;
  age: number;
  gender: string;
  complaint: string;
  severity: number; // 1 to 5 (ESI)
  arrival_time: number; // epoch ms
  status: 'waiting' | 'in_treatment' | 'done' | 'cancelled';
  assigned_doctor_id: number | null;
  start_time: number | null;
  finish_time: number | null;
  wait_minutes: number | null;
  service_minutes: number | null;
}

export interface QueuePatientView extends PatientRecord {
  effectivePriority: number;
  currentWaitMinutes: number;
  timeInvariantKey: number;
  promotedLevels?: number;
}

export type TriagePolicy = 'fcfs' | 'strict_priority' | 'priority_linear_aging' | 'priority_threshold_aging';

export class TriageManager {
  private minHeap: MinHeap<PatientRecord>;
  private fifoQueue: FifoQueue<PatientRecord>;
  private activePolicy: TriagePolicy = 'priority_linear_aging';
  private alpha: number = 0.05; // aging rate per minute
  private thresholdMinutes: number = 30; // threshold T for promotion

  constructor() {
    this.loadSettings();
    this.minHeap = new MinHeap<PatientRecord>((a, b) => this.comparePatients(a, b));
    this.fifoQueue = new FifoQueue<PatientRecord>();
    this.rebuildFromDb();
  }

  public loadSettings() {
    try {
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      for (const row of rows) {
        if (row.key === 'active_policy') this.activePolicy = row.value as TriagePolicy;
        if (row.key === 'alpha') this.alpha = parseFloat(row.value) || 0.05;
        if (row.key === 'threshold_minutes') this.thresholdMinutes = parseFloat(row.value) || 30;
      }
    } catch (e) {
      console.warn('Could not load settings from DB yet:', e);
    }
  }

  public updateSettings(policy: TriagePolicy, alpha: number, thresholdMinutes: number) {
    this.activePolicy = policy;
    this.alpha = alpha;
    this.thresholdMinutes = thresholdMinutes;

    const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    upsert.run('active_policy', policy);
    upsert.run('alpha', alpha.toString());
    upsert.run('threshold_minutes', thresholdMinutes.toString());

    // Rebuild the in-memory queue to reflect new policy order
    this.rebuildFromDb();
  }

  public getSettings() {
    return {
      activePolicy: this.activePolicy,
      alpha: this.alpha,
      thresholdMinutes: this.thresholdMinutes,
    };
  }

  /**
   * Core comparator implementing priority logic.
   * Lower value = served first.
   */
  public comparePatients(a: PatientRecord, b: PatientRecord, referenceNow: number = Date.now()): number {
    if (this.activePolicy === 'fcfs') {
      // 1. FCFS: Ordered purely by arrival time
      if (a.arrival_time !== b.arrival_time) {
        return a.arrival_time - b.arrival_time;
      }
      return a.id - b.id;
    }

    if (this.activePolicy === 'strict_priority') {
      // 2. Strict Priority: Severity first, then earlier arrival
      if (a.severity !== b.severity) {
        return a.severity - b.severity;
      }
      if (a.arrival_time !== b.arrival_time) {
        return a.arrival_time - b.arrival_time;
      }
      return a.id - b.id;
    }

    if (this.activePolicy === 'priority_linear_aging') {
      // 3. Priority + Linear Aging
      // Time-Invariant Key Trick:
      // P_eff = severity - alpha * (now - arrival_time_in_minutes)
      //       = (severity + alpha * arrival_time_in_minutes) - alpha * now
      // Since (- alpha * now) is identical across all patients at any instant,
      // the relative order is strictly determined by:
      // key = severity + alpha * (arrival_time / 60000)
      const keyA = a.severity + this.alpha * (a.arrival_time / 60000);
      const keyB = b.severity + this.alpha * (b.arrival_time / 60000);
      
      const diff = keyA - keyB;
      if (Math.abs(diff) > 1e-9) {
        return diff;
      }
      if (a.arrival_time !== b.arrival_time) {
        return a.arrival_time - b.arrival_time;
      }
      return a.id - b.id;
    }

    if (this.activePolicy === 'priority_threshold_aging') {
      // 4. Priority + Threshold Aging
      // Promote one level (e.g. 5->4->3->2->1) after each T minutes of wait
      const waitA = Math.max(0, (referenceNow - a.arrival_time) / 60000);
      const waitB = Math.max(0, (referenceNow - b.arrival_time) / 60000);
      const promotionsA = Math.floor(waitA / this.thresholdMinutes);
      const promotionsB = Math.floor(waitB / this.thresholdMinutes);

      const effA = Math.max(1, a.severity - promotionsA);
      const effB = Math.max(1, b.severity - promotionsB);

      if (effA !== effB) {
        return effA - effB;
      }
      if (a.arrival_time !== b.arrival_time) {
        return a.arrival_time - b.arrival_time;
      }
      return a.id - b.id;
    }

    return a.id - b.id;
  }

  /**
   * Rebuilds in-memory data structures from all patients with status = 'waiting' in DB.
   * Invoked on startup and policy changes.
   */
  public rebuildFromDb() {
    const waitingPatients = db.prepare(
      "SELECT * FROM patients WHERE status = 'waiting' ORDER BY arrival_time ASC"
    ).all() as PatientRecord[];

    // Rebuild Heap
    this.minHeap = MinHeap.buildHeap(waitingPatients, (a, b) => this.comparePatients(a, b));

    // Rebuild FIFO
    this.fifoQueue = new FifoQueue<PatientRecord>();
    for (const p of waitingPatients) {
      this.fifoQueue.enqueue(p);
    }
  }

  /**
   * Adds a new patient: saves to database and pushes into the active queue.
   */
  public addPatient(data: {
    name: string;
    age: number;
    gender: string;
    complaint: string;
    severity: number;
    arrival_time?: number;
  }): PatientRecord {
    const arrivalTime = data.arrival_time || Date.now();
    const stmt = db.prepare(`
      INSERT INTO patients (name, age, gender, complaint, severity, arrival_time, status)
      VALUES (?, ?, ?, ?, ?, ?, 'waiting')
    `);
    const info = stmt.run(data.name, data.age, data.gender, data.complaint, data.severity, arrivalTime);
    const newId = Number(info.lastInsertRowid);

    // Initialize default medical record in SQLite
    const defaultBp = data.severity <= 2 ? '140/90 mmHg' : '120/80 mmHg';
    const defaultHr = data.severity <= 2 ? 102 : 78;
    const defaultSpo2 = data.severity === 1 ? 88 : 98;
    const initialTests = [
      {
        id: `T-${Date.now().toString().slice(-4)}`,
        name: data.severity <= 2 ? '12-Lead Emergency ECG & Cardiac Enzymes' : 'Complete Blood Count (CBC) with ESR',
        category: data.severity <= 2 ? 'Cardiology' : 'Pathology',
        status: 'suggested',
        suggestedAt: 'Just now',
        result: 'Pending specimen collection and processing',
        doctorName: 'Attending Casualty Medical Officer'
      }
    ];

    db.prepare(`
      INSERT OR IGNORE INTO patient_medical_records 
      (patient_id, blood_group, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, allergies, past_history, tests_json, reports_json, prescriptions_json, doctor_notes)
      VALUES (?, 'B+', ?, ?, ?, 98.6, 18, 'No known drug allergies (NKDA)', 'Triage intake evaluation in progress.', ?, '[]', '[]', 'Patient admitted to emergency department triage.')
    `).run(newId, defaultBp, defaultHr, defaultSpo2, JSON.stringify(initialTests));

    const record: PatientRecord = {
      id: newId,
      name: data.name,
      age: data.age,
      gender: data.gender,
      complaint: data.complaint,
      severity: data.severity,
      arrival_time: arrivalTime,
      status: 'waiting',
      assigned_doctor_id: null,
      start_time: null,
      finish_time: null,
      wait_minutes: null,
      service_minutes: null,
    };

    // Push into active structures
    this.minHeap.push(record);
    this.fifoQueue.enqueue(record);

    return record;
  }

  /**
   * Returns the current live queue ordered by priority (who will be served next).
   */
  public getLiveQueue(now: number = Date.now()): QueuePatientView[] {
    let sortedList: PatientRecord[] = [];

    if (this.activePolicy === 'fcfs') {
      sortedList = this.fifoQueue.toArray();
    } else if (this.activePolicy === 'priority_threshold_aging') {
      // For threshold aging, instantaneous sorting with current timestamp
      const allWaiting = this.minHeap.toArray();
      sortedList = allWaiting.sort((a, b) => this.comparePatients(a, b, now));
    } else {
      // For strict_priority and priority_linear_aging, heap's toSortedArray is exact!
      sortedList = this.minHeap.toSortedArray();
    }

    return sortedList.map((p) => {
      const waitMinutes = Math.max(0, (now - p.arrival_time) / 60000);
      let effectivePriority = p.severity;
      let promotedLevels = 0;

      if (this.activePolicy === 'fcfs') {
        effectivePriority = 1; // Pure arrival order
      } else if (this.activePolicy === 'strict_priority') {
        effectivePriority = p.severity;
      } else if (this.activePolicy === 'priority_linear_aging') {
        effectivePriority = Math.max(0.5, p.severity - this.alpha * waitMinutes);
      } else if (this.activePolicy === 'priority_threshold_aging') {
        promotedLevels = Math.floor(waitMinutes / this.thresholdMinutes);
        effectivePriority = Math.max(1, p.severity - promotedLevels);
      }

      const invariantKey = p.severity + this.alpha * (p.arrival_time / 60000);

      return {
        ...p,
        effectivePriority: Number(effectivePriority.toFixed(2)),
        currentWaitMinutes: Number(waitMinutes.toFixed(1)),
        timeInvariantKey: Number(invariantKey.toFixed(4)),
        promotedLevels,
      };
    });
  }

  /**
   * Peeks the next patient in queue.
   */
  public peekNextPatient(): PatientRecord | undefined {
    if (this.activePolicy === 'fcfs') {
      return this.fifoQueue.peek();
    }
    if (this.activePolicy === 'priority_threshold_aging') {
      const queue = this.getLiveQueue();
      return queue.length > 0 ? queue[0] : undefined;
    }
    return this.minHeap.peek();
  }

  /**
   * Dispatches the next patient to an available doctor.
   * Removes patient from heap, sets status to 'in_treatment', marks doctor busy.
   */
  public dispatchNext(doctorId?: number): { patient: PatientRecord; doctor: any } | null {
    // Find available doctor
    let doctor: any = null;
    if (doctorId) {
      doctor = db.prepare("SELECT * FROM doctors WHERE id = ? AND status = 'available'").get(doctorId);
    } else {
      doctor = db.prepare("SELECT * FROM doctors WHERE status = 'available' LIMIT 1").get();
    }

    if (!doctor) {
      return null;
    }

    let nextPatient: PatientRecord | undefined;

    if (this.activePolicy === 'fcfs') {
      nextPatient = this.fifoQueue.dequeue();
      if (nextPatient) {
        this.minHeap.removeWhere((p) => p.id === nextPatient!.id);
      }
    } else if (this.activePolicy === 'priority_threshold_aging') {
      const queue = this.getLiveQueue();
      if (queue.length > 0) {
        nextPatient = queue[0];
        this.minHeap.removeWhere((p) => p.id === nextPatient!.id);
        this.fifoQueue.removeWhere((p) => p.id === nextPatient!.id);
      }
    } else {
      nextPatient = this.minHeap.pop();
      if (nextPatient) {
        this.fifoQueue.removeWhere((p) => p.id === nextPatient!.id);
      }
    }

    if (!nextPatient) {
      return null;
    }

    const now = Date.now();
    const waitMinutes = Number(((now - nextPatient.arrival_time) / 60000).toFixed(1));

    // Update DB
    db.prepare(`
      UPDATE patients
      SET status = 'in_treatment', assigned_doctor_id = ?, start_time = ?, wait_minutes = ?
      WHERE id = ?
    `).run(doctor.id, now, waitMinutes, nextPatient.id);

    db.prepare(`
      UPDATE doctors
      SET status = 'busy', current_patient_id = ?
      WHERE id = ?
    `).run(nextPatient.id, doctor.id);

    nextPatient.status = 'in_treatment';
    nextPatient.assigned_doctor_id = doctor.id;
    nextPatient.start_time = now;
    nextPatient.wait_minutes = waitMinutes;

    doctor.status = 'busy';
    doctor.current_patient_id = nextPatient.id;

    return { patient: nextPatient, doctor };
  }

  /**
   * Completes a patient's treatment.
   * Frees doctor, sets patient status to 'done', calculates service minutes.
   */
  public completeTreatment(patientId: number): { patient: PatientRecord; doctor: any } | null {
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as PatientRecord | undefined;
    if (!patient || patient.status !== 'in_treatment') {
      return null;
    }

    const now = Date.now();
    const startTime = patient.start_time || now;
    const serviceMinutes = Number(Math.max(1, (now - startTime) / 60000).toFixed(1));

    db.prepare(`
      UPDATE patients
      SET status = 'done', finish_time = ?, service_minutes = ?
      WHERE id = ?
    `).run(now, serviceMinutes, patient.id);

    let doctor: any = null;
    if (patient.assigned_doctor_id) {
      db.prepare(`
        UPDATE doctors
        SET status = 'available', current_patient_id = NULL
        WHERE id = ?
      `).run(patient.assigned_doctor_id);

      doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(patient.assigned_doctor_id);
    }

    patient.status = 'done';
    patient.finish_time = now;
    patient.service_minutes = serviceMinutes;

    return { patient, doctor };
  }

  /**
   * Cancels or removes a patient.
   */
  public removePatient(patientId: number): boolean {
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as PatientRecord | undefined;
    if (!patient) return false;

    // Remove from in-memory queues if waiting
    if (patient.status === 'waiting') {
      this.minHeap.removeWhere((p) => p.id === patientId);
      this.fifoQueue.removeWhere((p) => p.id === patientId);
    } else if (patient.status === 'in_treatment' && patient.assigned_doctor_id) {
      // Free doctor
      db.prepare(`
        UPDATE doctors
        SET status = 'available', current_patient_id = NULL
        WHERE id = ?
      `).run(patient.assigned_doctor_id);
    }

    db.prepare('DELETE FROM patients WHERE id = ?').run(patientId);
    return true;
  }
}

export const triageManager = new TriageManager();
