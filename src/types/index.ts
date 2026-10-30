export type SeverityLevel = 1 | 2 | 3 | 4 | 5;

export type PatientStatus = 'waiting' | 'in_treatment' | 'done' | 'cancelled';

export type DoctorStatus = 'available' | 'busy' | 'off_duty';

export type TriagePolicy = 'fcfs' | 'strict_priority' | 'priority_linear_aging' | 'priority_threshold_aging';

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  complaint: string;
  severity: SeverityLevel;
  arrival_time: number;
  status: PatientStatus;
  assigned_doctor_id: number | null;
  start_time: number | null;
  finish_time: number | null;
  wait_minutes: number | null;
  service_minutes: number | null;
}

export interface ClinicalTest {
  id: string;
  name: string;
  category: string;
  status: 'suggested' | 'done';
  suggestedAt: string;
  completedAt?: string;
  result?: string;
  doctorName?: string;
}

export interface DiagnosticReport {
  id: string;
  title: string;
  department: string;
  date: string;
  findings: string;
  normalRange?: string;
  conclusion: string;
  status: 'Final Verified' | 'Preliminary';
}

export interface PrescriptionItem {
  id: string;
  medicine: string;
  dosage: string;
  route: string;
  frequency: string;
  instructions: string;
  prescribedBy: string;
  date: string;
}

export interface PatientMedicalRecord {
  patient_id: number;
  blood_group: string;
  blood_pressure: string;
  heart_rate: number;
  spo2: number;
  temperature: number;
  respiratory_rate: number;
  allergies: string;
  past_history: string;
  doctor_notes: string;
  tests: ClinicalTest[];
  reports: DiagnosticReport[];
  prescriptions: PrescriptionItem[];
}

export interface QueuePatient extends Patient {
  effectivePriority: number;
  currentWaitMinutes: number;
  timeInvariantKey: number;
  promotedLevels?: number;
}

export interface Doctor {
  id: number;
  name: string;
  specialization: string;
  status: DoctorStatus;
  current_patient_id: number | null;
  current_patient_name?: string;
  current_patient_severity?: SeverityLevel;
  current_patient_complaint?: string;
}

export interface SystemSettings {
  activePolicy: TriagePolicy;
  alpha: number;
  thresholdMinutes: number;
}

export interface LiveMetrics {
  patients: {
    waiting_count: number;
    treatment_count: number;
    done_count: number;
    total_patients: number;
  };
  doctors: {
    available_docs: number;
    busy_docs: number;
    off_duty_docs: number;
    total_doctors: number;
  };
  averageWaitMinutes: number;
  maxWaitMinutes: number;
  waitBySeverity: {
    severity: number;
    count: number;
    avg_wait_minutes: number;
    max_wait_minutes: number;
  }[];
  activePolicy: TriagePolicy;
}

export interface AcuitySimMetrics {
  count: number;
  meanWait: number;
  medianWait: number;
  p95Wait: number;
  p99Wait: number;
  maxWait: number;
}

export interface SingleSimRun {
  policy: TriagePolicy;
  alpha: number;
  thresholdMinutes: number;
  seed: number;
  totalPatients: number;
  completedPatients: number;
  averageWait: number;
  maxWait: number;
  utilization: number;
  starvationPercent: number;
  fairnessRatio: number;
  bySeverity: Record<number, AcuitySimMetrics>;
  queueLengthOverTime: { time: number; length: number }[];
  waitTimesCDF: { wait: number; percentile: number }[];
}

export interface AggregatedSimResult {
  policy: TriagePolicy;
  replicationsCount: number;
  meanAverageWait: number;
  ci95AverageWait: [number, number];
  meanMaxWait: number;
  meanUtilization: number;
  meanStarvationPercent: number;
  bySeverity: Record<number, { meanWait: number; p95Wait: number; maxWait: number }>;
  sampleRun: SingleSimRun;
}

export interface SavedSimulationRun {
  id: number;
  policy: string;
  alpha: number;
  arrival_rate: number;
  num_doctors: number;
  seed: number;
  duration: number;
  created_at: string;
  results: AggregatedSimResult | Record<TriagePolicy, AggregatedSimResult>;
}

export interface BenchmarkPoint {
  n: number;
  heapPushTimeMs: number;
  heapPopTimeMs: number;
  heapTotalTimeMs: number;
  listPushTimeMs: number;
  listPopTimeMs: number;
  listTotalTimeMs: number;
  speedupFactor: number;
}

export interface BenchmarkReport {
  timestamp: string;
  testSizes: number[];
  results: BenchmarkPoint[];
  theoreticalComplexity: {
    heap: string;
    linearScan: string;
  };
}
