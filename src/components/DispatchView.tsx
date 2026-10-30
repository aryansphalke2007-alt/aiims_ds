import React, { useState } from 'react';
import { QueuePatient, Doctor, SystemSettings } from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  BellRing,
  CheckCircle2,
  Stethoscope,
  ArrowRight,
  Layers,
  Calculator,
  Info,
  Clock,
  Sparkles,
  Zap,
  FileText,
} from 'lucide-react';

interface DispatchViewProps {
  queue: QueuePatient[];
  doctors: Doctor[];
  settings: SystemSettings | null;
  onDispatchNext: (doctorId?: number) => Promise<void>;
  onCompleteTreatment: (patientId: number) => Promise<void>;
  onSelectPatient: (patientId: number) => void;
  isLoading: boolean;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  queue,
  doctors,
  settings,
  onDispatchNext,
  onCompleteTreatment,
  onSelectPatient,
  isLoading,
}) => {
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('auto');
  const [isCalling, setIsCalling] = useState(false);
  const [completingId, setCompletingId] = useState<number | null>(null);

  const nextPatient = queue.length > 0 ? queue[0] : null;
  const availableDoctors = doctors.filter((d) => d.status === 'available');
  const busyDoctors = doctors.filter((d) => d.status === 'busy');

  const handleDispatch = async () => {
    setIsCalling(true);
    try {
      const docId = selectedDoctorId === 'auto' ? undefined : parseInt(selectedDoctorId, 10);
      await onDispatchNext(docId);
    } finally {
      setIsCalling(false);
    }
  };

  const handleComplete = async (patientId: number) => {
    setCompletingId(patientId);
    try {
      await onCompleteTreatment(patientId);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <BellRing className="w-5 h-5 text-blue-600" />
          <span>Triage Dispatch Control Center</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Perform manual patient-to-physician handoffs, observe the Binary Min-Heap root extraction, and finalize clinical
          discharges.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Next Patient at Root of Heap */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Next Patient (Heap Root)</h3>
            </div>
            <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-semibold">
              O(log n) Extract-Min
            </span>
          </div>

          {nextPatient ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500">QUEUE POSITION #1</span>
                  <SeverityBadge severity={nextPatient.severity} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-slate-900">{nextPatient.name}</div>
                  <button
                    onClick={() => onSelectPatient(nextPatient.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50 flex items-center gap-1 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Medical History & Tests</span>
                  </button>
                </div>
                <div className="text-xs text-slate-600">{nextPatient.complaint}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500 pt-1 font-mono">
                  <span>Age: {nextPatient.age}</span>
                  <span>·</span>
                  <span>Gender: {nextPatient.gender}</span>
                  <span>·</span>
                  <span>Waiting: {nextPatient.currentWaitMinutes} mins</span>
                </div>
              </div>

              {/* Mathematical Proof Box */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-blue-900">
                  <Calculator className="w-4 h-4 text-blue-600" />
                  <span>Why is this patient served first?</span>
                </div>
                <div className="text-slate-700 space-y-1 text-[11px] font-mono leading-relaxed">
                  <div>
                    • Raw Clinical Severity (S):{' '}
                    <span className="font-bold text-slate-900">{nextPatient.severity}</span>
                  </div>
                  <div>
                    • Elapsed Wait Time (W):{' '}
                    <span className="font-bold text-slate-900">{nextPatient.currentWaitMinutes} mins</span>
                  </div>
                  <div>
                    • Dynamic Effective Priority:{' '}
                    <span className="font-bold text-blue-700">
                      P_eff = S - α·W = {nextPatient.effectivePriority}
                    </span>
                  </div>
                  <div>
                    • Time-Invariant Heap Key:{' '}
                    <span className="font-bold text-slate-900">
                      K = S + α·t_arr = {nextPatient.timeInvariantKey}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dispatch Controls */}
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Assign to Physician:</label>
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="auto">
                      ⚡ Auto: First Available ({availableDoctors[0]?.name || 'No doctors free'})
                    </option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id} disabled={d.status !== 'available'}>
                        {d.name} ({d.specialization}) - {d.status === 'available' ? 'Available' : d.status}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleDispatch}
                  disabled={isCalling || availableDoctors.length === 0}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <BellRing className="w-4 h-4" />
                  <span>
                    {isCalling
                      ? 'Dispatching from Heap...'
                      : availableDoctors.length === 0
                      ? 'All Doctors Busy'
                      : 'Call & Dispatch Next Patient'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium">No patients waiting in queue</p>
            </div>
          )}
        </div>

        {/* Right: Active In-Treatment Patients (Mark Complete) */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">Active Treatments</h3>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {busyDoctors.length} in care
            </span>
          </div>

          {busyDoctors.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Info className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-medium">No physicians are currently occupied</p>
              <p className="text-[11px] text-slate-400">
                When you dispatch patients from the queue, their active treatment sessions will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {busyDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-lg border border-amber-200 bg-amber-50/20 space-y-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-900">{doc.name}</div>
                      <div className="text-[11px] text-slate-500">{doc.specialization}</div>
                    </div>
                    {doc.current_patient_severity && (
                      <SeverityBadge severity={doc.current_patient_severity} size="sm" />
                    )}
                  </div>

                  <div className="text-xs text-slate-700 bg-white p-2.5 rounded border border-amber-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{doc.current_patient_name}</span>
                      <button
                        onClick={() => onSelectPatient(doc.current_patient_id!)}
                        className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Medical Record & Rx</span>
                      </button>
                    </div>
                    <div className="text-slate-500 text-[11px] truncate">{doc.current_patient_complaint}</div>
                  </div>

                  <button
                    onClick={() => handleComplete(doc.current_patient_id!)}
                    disabled={completingId === doc.current_patient_id}
                    className="w-full py-1.5 px-3 text-xs font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/80 rounded border border-emerald-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {completingId === doc.current_patient_id
                        ? 'Recording Completion...'
                        : 'Mark Treatment Complete & Discharge'}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
