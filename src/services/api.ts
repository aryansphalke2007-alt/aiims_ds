import {
  Patient,
  QueuePatient,
  Doctor,
  SystemSettings,
  LiveMetrics,
  SavedSimulationRun,
  PatientMedicalRecord,
  ClinicalTest,
  DiagnosticReport,
  PrescriptionItem,
  TriagePolicy,
  BenchmarkReport,
} from '../types';

const BASE_URL = '/api';

export const api = {
  // Patients
  async getPatients(filters?: { status?: string; severity?: string; search?: string; limit?: number }): Promise<Patient[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const res = await fetch(`${BASE_URL}/patients?${params.toString()}`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch patients');
    const data = await res.json();
    return data.patients;
  },

  async addPatient(patient: {
    name: string;
    age: number;
    gender: string;
    complaint: string;
    severity: number;
    arrival_time?: number;
  }): Promise<{ message: string; patient: Patient }> {
    const res = await fetch(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to add patient');
    return res.json();
  },

  async deletePatient(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/patients/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete patient');
    return res.json();
  },

  // Medical Record & History (Tests, Reports, Prescriptions)
  async getMedicalRecord(patientId: number): Promise<{
    patient: Patient & { assignedDoctor?: Doctor | null };
    medicalRecord: PatientMedicalRecord;
  }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/medical-record`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch medical record');
    return res.json();
  },

  async updateMedicalRecord(patientId: number, data: Partial<PatientMedicalRecord>): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/medical-record`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update medical record');
    return res.json();
  },

  async addTest(patientId: number, test: {
    name: string;
    category?: string;
    status: 'suggested' | 'done';
    result?: string;
    doctorName?: string;
  }): Promise<{ message: string; test: ClinicalTest; tests: ClinicalTest[] }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/tests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to order/add test');
    return res.json();
  },

  async updateTestStatus(patientId: number, testId: string, data: { status: 'suggested' | 'done'; result?: string }): Promise<{ message: string; test: ClinicalTest; tests: ClinicalTest[] }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/tests/${testId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update test');
    return res.json();
  },

  async addPrescription(patientId: number, prescription: {
    medicine: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    instructions?: string;
    prescribedBy?: string;
  }): Promise<{ message: string; prescription: PrescriptionItem; prescriptions: PrescriptionItem[] }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescription),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to add prescription');
    return res.json();
  },

  async addReport(patientId: number, report: {
    title: string;
    department?: string;
    findings?: string;
    normalRange?: string;
    conclusion?: string;
  }): Promise<{ message: string; report: DiagnosticReport; reports: DiagnosticReport[] }> {
    const res = await fetch(`${BASE_URL}/patients/${patientId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save diagnostic report');
    return res.json();
  },

  // Doctors
  async getDoctors(): Promise<Doctor[]> {
    const res = await fetch(`${BASE_URL}/doctors`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch doctors');
    const data = await res.json();
    return data.doctors;
  },

  async addDoctor(data: { name: string; specialization: string }): Promise<{ doctor: Doctor }> {
    const res = await fetch(`${BASE_URL}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to add doctor');
    return res.json();
  },

  async updateDoctorStatus(id: number, status: 'available' | 'off_duty'): Promise<{ doctor: Doctor }> {
    const res = await fetch(`${BASE_URL}/doctors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update doctor');
    return res.json();
  },

  async deleteDoctor(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/doctors/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete doctor');
    return res.json();
  },

  // Queue & Dispatch
  async getQueue(): Promise<{
    queue: QueuePatient[];
    queueLength: number;
    nextPatient: QueuePatient | null;
    settings: SystemSettings;
    timestamp: number;
  }> {
    const res = await fetch(`${BASE_URL}/queue`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch queue');
    return res.json();
  },

  async dispatchNext(doctorId?: number): Promise<{
    message: string;
    patient: Patient;
    doctor: Doctor;
  }> {
    const res = await fetch(`${BASE_URL}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to dispatch next patient');
    return res.json();
  },

  async completeTreatment(patientId: number): Promise<{
    message: string;
    patient: Patient;
    doctor: Doctor;
  }> {
    const res = await fetch(`${BASE_URL}/complete/${patientId}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to complete treatment');
    return res.json();
  },

  // Settings
  async getSettings(): Promise<SystemSettings> {
    const res = await fetch(`${BASE_URL}/settings`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch settings');
    const data = await res.json();
    return data.settings;
  },

  async updateSettings(settings: {
    activePolicy?: TriagePolicy;
    alpha?: number;
    thresholdMinutes?: number;
  }): Promise<{ settings: SystemSettings }> {
    const res = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update settings');
    return res.json();
  },

  // Metrics
  async getMetrics(): Promise<LiveMetrics> {
    const res = await fetch(`${BASE_URL}/metrics`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch metrics');
    return res.json();
  },

  // Simulation
  async runSimulation(payload: {
    policy?: TriagePolicy;
    alpha?: number;
    arrival_rate?: number;
    num_doctors?: number;
    duration?: number;
    seed?: number;
    severity_distribution?: number[];
    compare_all?: boolean;
    replications?: number;
    starvation_threshold?: number;
  }): Promise<{ message: string; results: any }> {
    const res = await fetch(`${BASE_URL}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to run simulation');
    return res.json();
  },

  async getSimulations(): Promise<SavedSimulationRun[]> {
    const res = await fetch(`${BASE_URL}/simulations`);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch past simulations');
    const data = await res.json();
    return data.runs;
  },

  async deleteSimulation(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/simulations/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete simulation');
    return res.json();
  },

  // Benchmark
  async getBenchmark(sizes?: number[]): Promise<BenchmarkReport> {
    const url = sizes ? `${BASE_URL}/benchmark?sizes=${sizes.join(',')}` : `${BASE_URL}/benchmark`;
    const res = await fetch(url);
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to run benchmark');
    const data = await res.json();
    return data.report;
  },

  // Seed / Reset
  async seedDatabase(): Promise<{ message: string }> {
    const res = await fetch(`${BASE_URL}/seed`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to seed database');
    return res.json();
  },
};
