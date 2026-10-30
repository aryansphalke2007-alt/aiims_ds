import { Router, Request, Response } from 'express';
import { db, seedInitialData } from '../db/database.js';
import { triageManager, PatientRecord, TriagePolicy } from '../triageManager.js';
import { simulator, SimParams } from '../simulator/discreteEventSim.js';
import { runBenchmark } from '../simulator/benchmark.js';

export const apiRouter = Router();

// ==========================================
// PATIENT ENDPOINTS
// ==========================================

// POST /api/patients -> add patient (saved to DB + pushed into heap)
apiRouter.post('/patients', (req: Request, res: Response): any => {
  try {
    const { name, age, gender, complaint, severity } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Patient name is required.' });
    }
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 130) {
      return res.status(400).json({ error: 'Valid patient age between 0 and 130 is required.' });
    }
    if (!gender || typeof gender !== 'string') {
      return res.status(400).json({ error: 'Gender is required.' });
    }
    if (!complaint || typeof complaint !== 'string' || complaint.trim() === '') {
      return res.status(400).json({ error: 'Chief complaint is required.' });
    }
    const parsedSeverity = parseInt(severity, 10);
    if (isNaN(parsedSeverity) || parsedSeverity < 1 || parsedSeverity > 5) {
      return res.status(400).json({ error: 'Severity must be an ESI level between 1 (Critical) and 5 (Non-urgent).' });
    }

    const patient = triageManager.addPatient({
      name: name.trim(),
      age: parsedAge,
      gender: gender.trim(),
      complaint: complaint.trim(),
      severity: parsedSeverity,
      arrival_time: req.body.arrival_time ? Number(req.body.arrival_time) : Date.now(),
    });

    return res.status(201).json({
      message: 'Patient admitted successfully and enqueued.',
      patient,
    });
  } catch (error: any) {
    console.error('Error adding patient:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/patients -> list all patients (filter by status, severity, date, search)
apiRouter.get('/patients', (req: Request, res: Response): any => {
  try {
    const { status, severity, search, limit } = req.query;

    let query = 'SELECT * FROM patients WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (severity && severity !== 'all') {
      query += ' AND severity = ?';
      params.push(Number(severity));
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ' AND (name LIKE ? OR complaint LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    query += ' ORDER BY arrival_time DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }

    const patients = db.prepare(query).all(...params);
    return res.json({ patients });
  } catch (error: any) {
    console.error('Error listing patients:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// GET /api/patients/:id -> patient details
apiRouter.get('/patients/:id', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
    if (!patient) {
      return res.status(404).json({ error: `Patient with ID ${id} not found.` });
    }
    return res.json({ patient });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/patients/:id/medical-record -> complete clinical dossier
apiRouter.get('/patients/:id/medical-record', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id) as any;
    if (!patient) {
      return res.status(404).json({ error: `Patient with ID ${id} not found.` });
    }

    let record = db.prepare('SELECT * FROM patient_medical_records WHERE patient_id = ?').get(id) as any;
    if (!record) {
      // Auto-create default record if missing
      db.prepare(`
        INSERT INTO patient_medical_records (patient_id, blood_group, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, allergies, past_history, tests_json, reports_json, prescriptions_json, doctor_notes)
        VALUES (?, 'B+', '120/80 mmHg', 76, 98, 98.6, 16, 'No known drug allergies (NKDA)', 'Casualty intake notes recorded.', '[]', '[]', '[]', 'Patient triage examination.')
      `).run(id);
      record = db.prepare('SELECT * FROM patient_medical_records WHERE patient_id = ?').get(id) as any;
    }

    const doctor = patient.assigned_doctor_id
      ? db.prepare('SELECT id, name, specialization FROM doctors WHERE id = ?').get(patient.assigned_doctor_id)
      : null;

    return res.json({
      patient: {
        ...patient,
        assignedDoctor: doctor,
      },
      medicalRecord: {
        ...record,
        tests: JSON.parse(record.tests_json || '[]'),
        reports: JSON.parse(record.reports_json || '[]'),
        prescriptions: JSON.parse(record.prescriptions_json || '[]'),
        tests_json: undefined,
        reports_json: undefined,
        prescriptions_json: undefined,
      },
    });
  } catch (error: any) {
    console.error('Error fetching medical record:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/patients/:id/medical-record -> update vitals, allergies, history, notes
apiRouter.put('/patients/:id/medical-record', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      blood_group,
      blood_pressure,
      heart_rate,
      spo2,
      temperature,
      respiratory_rate,
      allergies,
      past_history,
      doctor_notes,
    } = req.body;

    const patient = db.prepare('SELECT id FROM patients WHERE id = ?').get(id);
    if (!patient) {
      return res.status(404).json({ error: `Patient with ID ${id} not found.` });
    }

    db.prepare(`
      INSERT INTO patient_medical_records (patient_id, blood_group, blood_pressure, heart_rate, spo2, temperature, respiratory_rate, allergies, past_history, doctor_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(patient_id) DO UPDATE SET
        blood_group = COALESCE(excluded.blood_group, blood_group),
        blood_pressure = COALESCE(excluded.blood_pressure, blood_pressure),
        heart_rate = COALESCE(excluded.heart_rate, heart_rate),
        spo2 = COALESCE(excluded.spo2, spo2),
        temperature = COALESCE(excluded.temperature, temperature),
        respiratory_rate = COALESCE(excluded.respiratory_rate, respiratory_rate),
        allergies = COALESCE(excluded.allergies, allergies),
        past_history = COALESCE(excluded.past_history, past_history),
        doctor_notes = COALESCE(excluded.doctor_notes, doctor_notes)
    `).run(
      id,
      blood_group,
      blood_pressure,
      heart_rate ? Number(heart_rate) : null,
      spo2 ? Number(spo2) : null,
      temperature ? Number(temperature) : null,
      respiratory_rate ? Number(respiratory_rate) : null,
      allergies,
      past_history,
      doctor_notes
    );

    return res.json({ message: 'Medical record updated successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/patients/:id/tests -> add a suggested or completed test
apiRouter.post('/patients/:id/tests', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, category, status, result, doctorName } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Test name is required.' });
    }

    const record = db.prepare('SELECT tests_json FROM patient_medical_records WHERE patient_id = ?').get(id) as any;
    const tests = record ? JSON.parse(record.tests_json || '[]') : [];

    const newTest = {
      id: `T-${Date.now().toString().slice(-5)}`,
      name: name.trim(),
      category: category || 'Diagnostic Pathology',
      status: status || 'suggested',
      suggestedAt: 'Just now',
      completedAt: status === 'done' ? 'Just now' : undefined,
      result: result ? result.trim() : (status === 'done' ? 'Normal / Awaiting formal sign-off' : 'Pending sample/slot'),
      doctorName: doctorName || 'Attending Physician',
    };

    tests.unshift(newTest);

    db.prepare('UPDATE patient_medical_records SET tests_json = ? WHERE patient_id = ?').run(
      JSON.stringify(tests),
      id
    );

    return res.status(201).json({ message: 'Clinical test ordered/recorded.', test: newTest, tests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/patients/:id/tests/:testId -> mark test as done and save result
apiRouter.patch('/patients/:id/tests/:testId', (req: Request, res: Response): any => {
  try {
    const patientId = parseInt(req.params.id, 10);
    const testId = req.params.testId;
    const { result, status } = req.body;

    const record = db.prepare('SELECT tests_json FROM patient_medical_records WHERE patient_id = ?').get(patientId) as any;
    if (!record) return res.status(404).json({ error: 'Record not found.' });

    const tests = JSON.parse(record.tests_json || '[]');
    const target = tests.find((t: any) => t.id === testId);
    if (!target) return res.status(404).json({ error: 'Test not found.' });

    target.status = status || 'done';
    target.completedAt = 'Just now';
    if (result) target.result = result;

    db.prepare('UPDATE patient_medical_records SET tests_json = ? WHERE patient_id = ?').run(
      JSON.stringify(tests),
      patientId
    );

    return res.json({ message: 'Test status updated.', test: target, tests });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/patients/:id/prescriptions -> add new prescription
apiRouter.post('/patients/:id/prescriptions', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const { medicine, dosage, route, frequency, instructions, prescribedBy } = req.body;

    if (!medicine || typeof medicine !== 'string') {
      return res.status(400).json({ error: 'Medication name is required.' });
    }

    const record = db.prepare('SELECT prescriptions_json FROM patient_medical_records WHERE patient_id = ?').get(id) as any;
    const prescriptions = record ? JSON.parse(record.prescriptions_json || '[]') : [];

    const newPrescription = {
      id: `P-${Date.now().toString().slice(-5)}`,
      medicine: medicine.trim(),
      dosage: dosage ? dosage.trim() : 'Standard dose',
      route: route || 'Oral',
      frequency: frequency || 'OD',
      instructions: instructions ? instructions.trim() : 'Take as directed',
      prescribedBy: prescribedBy || 'Attending Physician',
      date: 'Today',
    };

    prescriptions.unshift(newPrescription);

    db.prepare('UPDATE patient_medical_records SET prescriptions_json = ? WHERE patient_id = ?').run(
      JSON.stringify(prescriptions),
      id
    );

    return res.status(201).json({ message: 'Prescription added.', prescription: newPrescription, prescriptions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/patients/:id/reports -> add diagnostic lab/radiology report
apiRouter.post('/patients/:id/reports', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, department, findings, normalRange, conclusion } = req.body;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Report title is required.' });
    }

    const record = db.prepare('SELECT reports_json FROM patient_medical_records WHERE patient_id = ?').get(id) as any;
    const reports = record ? JSON.parse(record.reports_json || '[]') : [];

    const newReport = {
      id: `R-${Date.now().toString().slice(-5)}`,
      title: title.trim(),
      department: department || 'Diagnostic Services',
      date: 'Today',
      findings: findings || 'Normal study',
      normalRange: normalRange || 'Within physiological limits',
      conclusion: conclusion || 'No acute abnormalities detected',
      status: 'Final Verified',
    };

    reports.unshift(newReport);

    db.prepare('UPDATE patient_medical_records SET reports_json = ? WHERE patient_id = ?').run(
      JSON.stringify(reports),
      id
    );

    return res.status(201).json({ message: 'Diagnostic report saved.', report: newReport, reports });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCTOR ENDPOINTS
// ==========================================

// POST /api/doctors -> add doctor
apiRouter.post('/doctors', (req: Request, res: Response): any => {
  try {
    const { name, specialization } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Doctor name is required.' });
    }
    const spec = specialization && typeof specialization === 'string' && specialization.trim() !== ''
      ? specialization.trim()
      : 'General Emergency Physician';

    const info = db.prepare(`
      INSERT INTO doctors (name, specialization, status, current_patient_id)
      VALUES (?, ?, 'available', NULL)
    `).run(name.trim(), spec);

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(Number(info.lastInsertRowid));
    return res.status(201).json({ message: 'Doctor registered successfully.', doctor });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/doctors -> list doctors
apiRouter.get('/doctors', (_req: Request, res: Response): any => {
  try {
    const doctors = db.prepare(`
      SELECT d.*, p.name as current_patient_name, p.severity as current_patient_severity, p.complaint as current_patient_complaint
      FROM doctors d
      LEFT JOIN patients p ON d.current_patient_id = p.id
      ORDER BY d.id ASC
    `).all();
    return res.json({ doctors });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/doctors/:id -> change status (available / off_duty)
apiRouter.patch('/doctors/:id', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    if (!['available', 'off_duty', 'busy'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'available', 'off_duty', or 'busy'." });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as any;
    if (!doctor) {
      return res.status(404).json({ error: `Doctor with ID ${id} not found.` });
    }

    if (status === 'off_duty' && doctor.current_patient_id) {
      return res.status(400).json({ error: 'Cannot take doctor off duty while actively treating a patient.' });
    }

    db.prepare('UPDATE doctors SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id);
    return res.json({ message: 'Doctor status updated.', doctor: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/doctors/:id -> delete doctor
apiRouter.delete('/doctors/:id', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(id) as any;
    if (!doctor) {
      return res.status(404).json({ error: `Doctor with ID ${id} not found.` });
    }
    if (doctor.current_patient_id) {
      return res.status(400).json({ error: 'Cannot remove doctor while currently treating a patient. Complete treatment first.' });
    }
    db.prepare('DELETE FROM doctors WHERE id = ?').run(id);
    return res.json({ message: `Doctor ${id} removed successfully.` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// QUEUE & DISPATCH ENDPOINTS
// ==========================================

// GET /api/queue -> current queue in served order with effective priority
apiRouter.get('/queue', (_req: Request, res: Response): any => {
  try {
    const queue = triageManager.getLiveQueue();
    const settings = triageManager.getSettings();
    const nextPatient = queue.length > 0 ? queue[0] : null;

    return res.json({
      queue,
      queueLength: queue.length,
      nextPatient,
      settings,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/dispatch -> assign next patient from heap to a free doctor
apiRouter.post('/dispatch', (req: Request, res: Response): any => {
  try {
    const doctorId = req.body.doctorId ? Number(req.body.doctorId) : undefined;
    const result = triageManager.dispatchNext(doctorId);

    if (!result) {
      return res.status(400).json({
        error: 'Unable to dispatch: either no patients are currently waiting, or no doctors are available.',
      });
    }

    return res.json({
      message: `Patient ${result.patient.name} successfully assigned to ${result.doctor.name}.`,
      patient: result.patient,
      doctor: result.doctor,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/complete/:patientId -> mark treatment finished, free doctor, record wait/service
apiRouter.post('/complete/:patientId', (req: Request, res: Response): any => {
  try {
    const patientId = parseInt(req.params.patientId, 10);
    const result = triageManager.completeTreatment(patientId);

    if (!result) {
      return res.status(400).json({
        error: `Patient ${patientId} is not currently marked as 'in_treatment'.`,
      });
    }

    return res.json({
      message: `Treatment completed for patient ${result.patient.name}. Doctor is now available.`,
      patient: result.patient,
      doctor: result.doctor,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SETTINGS ENDPOINTS
// ==========================================

// GET /api/settings
apiRouter.get('/settings', (_req: Request, res: Response): any => {
  try {
    const settings = triageManager.getSettings();
    return res.json({ settings });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/settings
apiRouter.put('/settings', (req: Request, res: Response): any => {
  try {
    const { activePolicy, alpha, thresholdMinutes } = req.body;
    const validPolicies: TriagePolicy[] = [
      'fcfs',
      'strict_priority',
      'priority_linear_aging',
      'priority_threshold_aging',
    ];

    if (activePolicy && !validPolicies.includes(activePolicy)) {
      return res.status(400).json({
        error: `Invalid policy. Must be one of: ${validPolicies.join(', ')}`,
      });
    }

    const currentSettings = triageManager.getSettings();
    const newPolicy = activePolicy || currentSettings.activePolicy;
    const newAlpha = alpha !== undefined ? parseFloat(alpha) : currentSettings.alpha;
    const newThreshold = thresholdMinutes !== undefined ? parseFloat(thresholdMinutes) : currentSettings.thresholdMinutes;

    if (newAlpha < 0 || newAlpha > 1) {
      return res.status(400).json({ error: 'Alpha must be between 0.00 and 1.00.' });
    }
    if (newThreshold <= 0) {
      return res.status(400).json({ error: 'Threshold minutes must be greater than 0.' });
    }

    triageManager.updateSettings(newPolicy, newAlpha, newThreshold);

    return res.json({
      message: 'Settings updated and queue re-prioritized successfully.',
      settings: triageManager.getSettings(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SIMULATION ENDPOINTS
// ==========================================

// POST /api/simulate -> run discrete-event simulation with parameters
apiRouter.post('/simulate', (req: Request, res: Response): any => {
  try {
    const {
      policy,
      alpha,
      arrival_rate,
      num_doctors,
      duration,
      seed,
      severity_distribution,
      compare_all,
      replications,
      starvation_threshold,
    } = req.body;

    const arrivalRatePerHour = parseFloat(arrival_rate) || 12;
    const numDoctors = parseInt(num_doctors, 10) || 3;
    const durationHours = parseFloat(duration) || 24;
    const randomSeed = seed !== undefined ? parseInt(seed, 10) : 42;
    const alphaVal = alpha !== undefined ? parseFloat(alpha) : 0.05;
    const reps = replications ? parseInt(replications, 10) : 1;
    const starveThreshold = starvation_threshold ? parseFloat(starvation_threshold) : 120;

    let dist = [0.05, 0.15, 0.40, 0.30, 0.10];
    if (Array.isArray(severity_distribution) && severity_distribution.length === 5) {
      const sum = severity_distribution.reduce((a: number, b: number) => a + Number(b), 0);
      dist = severity_distribution.map((v: number) => Number(v) / (sum || 1));
    }

    let resultPayload: any;

    if (compare_all) {
      resultPayload = simulator.compareAllPolicies({
        arrivalRatePerHour,
        numDoctors,
        durationHours,
        seed: randomSeed,
        alpha: alphaVal,
        severityDistribution: dist,
        replications: reps,
        starvationThresholdMinutes: starveThreshold,
      });

      // Save comparison to database
      const insertRun = db.prepare(`
        INSERT INTO simulation_runs (policy, alpha, arrival_rate, num_doctors, seed, duration, created_at, results_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertRun.run(
        'compare_all',
        alphaVal,
        arrivalRatePerHour,
        numDoctors,
        randomSeed,
        durationHours,
        new Date().toISOString(),
        JSON.stringify(resultPayload)
      );
    } else {
      const selectedPolicy: any = policy || 'priority_linear_aging';
      const simParams: SimParams = {
        policy: selectedPolicy,
        alpha: alphaVal,
        arrivalRatePerHour,
        numDoctors,
        durationHours,
        seed: randomSeed,
        severityDistribution: dist,
        replications: reps,
        starvationThresholdMinutes: starveThreshold,
      };

      resultPayload = simulator.runReplications(simParams);

      // Save run to DB
      const insertRun = db.prepare(`
        INSERT INTO simulation_runs (policy, alpha, arrival_rate, num_doctors, seed, duration, created_at, results_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertRun.run(
        selectedPolicy,
        alphaVal,
        arrivalRatePerHour,
        numDoctors,
        randomSeed,
        durationHours,
        new Date().toISOString(),
        JSON.stringify(resultPayload)
      );
    }

    return res.status(200).json({
      message: 'Simulation completed successfully and saved.',
      results: resultPayload,
    });
  } catch (error: any) {
    console.error('Simulation error:', error);
    return res.status(500).json({ error: error.message || 'Simulation failed' });
  }
});

// GET /api/simulations -> list past simulation runs
apiRouter.get('/simulations', (_req: Request, res: Response): any => {
  try {
    const runs = db.prepare(`
      SELECT id, policy, alpha, arrival_rate, num_doctors, seed, duration, created_at, results_json
      FROM simulation_runs
      ORDER BY id DESC
      LIMIT 20
    `).all().map((r: any) => ({
      ...r,
      results: JSON.parse(r.results_json),
      results_json: undefined,
    }));
    return res.json({ runs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/simulations/:id -> delete a simulation run
apiRouter.delete('/simulations/:id', (req: Request, res: Response): any => {
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM simulation_runs WHERE id = ?').run(id);
    return res.json({ message: `Simulation run ${id} deleted.` });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// METRICS & BENCHMARK ENDPOINTS
// ==========================================

// GET /api/metrics -> live operational metrics for real patients
apiRouter.get('/metrics', (_req: Request, res: Response): any => {
  try {
    const counts = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_count,
        COUNT(CASE WHEN status = 'in_treatment' THEN 1 END) as treatment_count,
        COUNT(CASE WHEN status = 'done' THEN 1 END) as done_count,
        COUNT(*) as total_patients
      FROM patients
    `).get() as any;

    const doctorCounts = db.prepare(`
      SELECT 
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_docs,
        COUNT(CASE WHEN status = 'busy' THEN 1 END) as busy_docs,
        COUNT(CASE WHEN status = 'off_duty' THEN 1 END) as off_duty_docs,
        COUNT(*) as total_doctors
      FROM doctors
    `).get() as any;

    const waitStats = db.prepare(`
      SELECT 
        AVG(wait_minutes) as avg_wait,
        MAX(wait_minutes) as max_wait
      FROM patients
      WHERE wait_minutes IS NOT NULL
    `).get() as any;

    const waitBySeverity = db.prepare(`
      SELECT 
        severity,
        COUNT(*) as count,
        ROUND(AVG(COALESCE(wait_minutes, (strftime('%s','now')*1000 - arrival_time)/60000.0)), 1) as avg_wait_minutes,
        ROUND(MAX(COALESCE(wait_minutes, (strftime('%s','now')*1000 - arrival_time)/60000.0)), 1) as max_wait_minutes
      FROM patients
      GROUP BY severity
      ORDER BY severity ASC
    `).all();

    return res.json({
      patients: counts,
      doctors: doctorCounts,
      averageWaitMinutes: waitStats.avg_wait ? Number(waitStats.avg_wait.toFixed(1)) : 0,
      maxWaitMinutes: waitStats.max_wait ? Number(waitStats.max_wait.toFixed(1)) : 0,
      waitBySeverity,
      activePolicy: triageManager.getSettings().activePolicy,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/benchmark -> runtime comparison of heap vs list-scan for n = 100..10000
apiRouter.get('/benchmark', (req: Request, res: Response): any => {
  try {
    let sizes: number[] | undefined;
    if (req.query.sizes) {
      sizes = (req.query.sizes as string).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
    }
    const report = runBenchmark(sizes);
    return res.json({ report });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/seed -> reset and reseed demo data
apiRouter.post('/seed', (_req: Request, res: Response): any => {
  try {
    db.exec(`
      DELETE FROM patients;
      DELETE FROM doctors;
    `);
    seedInitialData();
    triageManager.rebuildFromDb();
    return res.json({ message: 'Database reset and seeded with 10 Indian sample patients and 3 AIIMS physicians.' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});
