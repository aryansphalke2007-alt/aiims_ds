import React from 'react';
import { QueuePatient, Doctor, LiveMetrics, SystemSettings } from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  Clock,
  UserCheck,
  Users,
  Stethoscope,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  FileText,
} from 'lucide-react';

interface DashboardViewProps {
  queue: QueuePatient[];
  doctors: Doctor[];
  metrics: LiveMetrics | null;
  settings: SystemSettings | null;
  onDispatchNext: (doctorId?: number) => void;
  onCompleteTreatment: (patientId: number) => void;
  onNavigateToAdmit: () => void;
  onSelectPatient: (patientId: number) => void;
  isLoading: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  queue,
  doctors,
  metrics,
  settings,
  onDispatchNext,
  onCompleteTreatment,
  onNavigateToAdmit,
  onSelectPatient,
  isLoading,
}) => {
  const nextPatient = queue.length > 0 ? queue[0] : null;
  const availableDoctors = doctors.filter((d) => d.status === 'available');
  const busyDoctors = doctors.filter((d) => d.status === 'busy');

  const policyLabels: Record<string, string> = {
    fcfs: 'First-Come-First-Served (FIFO)',
    strict_priority: 'Strict Acuity Priority (No Aging)',
    priority_linear_aging: `Priority + Linear Aging (α = ${settings?.alpha || 0.05}/min)`,
    priority_threshold_aging: `Priority + Threshold Aging (T = ${settings?.thresholdMinutes || 30}m)`,
  };

  return (
    <div className="space-y-6">
      {/* Policy Kicker Banner */}
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-semibold text-slate-900">Active Triage Policy:</span>
          <span className="font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
            {policyLabels[settings?.activePolicy || 'priority_linear_aging']}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            Backed by In-Memory Binary Min-Heap synchronized with SQLite.
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 font-mono">
          <span>Heap invariant key:</span>
          <span className="text-slate-900 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
            K = Severity + α · t_arr
          </span>
        </div>
      </div>

      {/* KPI Counters Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Waiting in Queue</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {metrics?.patients.waiting_count ?? queue.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pending doctor evaluation</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Currently In Treatment</span>
            <Stethoscope className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {metrics?.patients.treatment_count ?? busyDoctors.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {availableDoctors.length} doctor{availableDoctors.length === 1 ? '' : 's'} available
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Average Wait Time</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {metrics?.averageWaitMinutes ?? 0} <span className="text-sm font-normal text-slate-500">min</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Max wait: {metrics?.maxWaitMinutes ?? 0} min
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Completed Discharges</span>
            <UserCheck className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-slate-900 tabular-nums">
            {metrics?.patients.done_count ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Stored permanently in SQLite</p>
        </div>
      </div>

      {/* Main Grid: Live Queue & Doctor Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Queue (2 cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Active Triage Queue</span>
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ({queue.length} patient{queue.length === 1 ? '' : 's'})
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Extracted from the root of the Min-Heap. Lowest effective priority value is served next.
              </p>
            </div>
            <button
              onClick={onNavigateToAdmit}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>+ Admit Patient</span>
            </button>
          </div>

          {/* Next in Line Callout */}
          {nextPatient && (
            <div className="bg-gradient-to-r from-blue-50/80 via-white to-blue-50/30 rounded-lg border border-blue-200 p-4 shadow-2xs">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded">
                      ROOT OF HEAP · NEXT SERVED
                    </span>
                    <SeverityBadge severity={nextPatient.severity} />
                  </div>
                  <button
                    onClick={() => onSelectPatient(nextPatient.id)}
                    className="text-left group block"
                  >
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                      <span>{nextPatient.name}</span>
                      <FileText className="w-3.5 h-3.5 text-blue-600 opacity-80" />
                    </h3>
                  </button>
                  <p className="text-xs text-slate-700">{nextPatient.complaint}</p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">Effective Priority:</div>
                  <div className="text-xl font-bold font-mono text-blue-700 tabular-nums">
                    {nextPatient.effectivePriority}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Wait: <span className="font-semibold text-slate-900">{nextPatient.currentWaitMinutes}m</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectPatient(nextPatient.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors shadow-2xs flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>View Medical History, Tests & Rx</span>
                  </button>
                  <span className="text-slate-400">·</span>
                  <div className="text-slate-500 font-mono text-[11px]">
                    Key: <span className="text-slate-700 font-medium">{nextPatient.timeInvariantKey}</span>
                  </div>
                </div>

                <button
                  onClick={() => onDispatchNext()}
                  disabled={availableDoctors.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Assign to {availableDoctors[0]?.name?.split(',')[0] || 'Doctor'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Queue List Table */}
          {queue.length === 0 ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-900">Queue is Clear</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No patients are currently waiting in the emergency triage queue. Admit a patient or run the simulation
                to generate patient streams.
              </p>
              <button
                onClick={onNavigateToAdmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Admit First Patient
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Pos</th>
                      <th className="py-2.5 px-3">Patient</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Complaint</th>
                      <th className="py-2.5 px-3 text-right">Elapsed Wait</th>
                      <th className="py-2.5 px-3 text-right">Effective Prio</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.map((patient, index) => {
                      const isNext = index === 0;
                      return (
                        <tr
                          key={patient.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isNext ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-slate-600 tabular-nums">
                            #{index + 1}
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => onSelectPatient(patient.id)}
                              className="text-left group block cursor-pointer"
                              title="Click to view full Medical History, Tests & Prescriptions"
                            >
                              <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                                <span>{patient.name}</span>
                                <FileText className="w-3 h-3 text-slate-400 group-hover:text-blue-600 opacity-70" />
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {patient.age}y · {patient.gender} · ID #{patient.id}
                              </div>
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <SeverityBadge severity={patient.severity} />
                          </td>
                          <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={patient.complaint}>
                            {patient.complaint}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-700 tabular-nums">
                            {patient.currentWaitMinutes} min
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] tabular-nums">
                              {patient.effectivePriority}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => onDispatchNext()}
                              disabled={availableDoctors.length === 0}
                              title={
                                availableDoctors.length === 0
                                  ? 'All doctors currently busy'
                                  : 'Assign to available doctor'
                              }
                              className="text-blue-600 hover:text-blue-800 font-semibold text-xs disabled:opacity-30 disabled:hover:text-blue-600"
                            >
                              Dispatch
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Doctor Stations & Active Treatments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span>Physician Roster</span>
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {availableDoctors.length} / {doctors.length} available
            </span>
          </div>

          <div className="space-y-3">
            {doctors.map((doctor) => {
              const isAvailable = doctor.status === 'available';
              const isBusy = doctor.status === 'busy';
              const isOffDuty = doctor.status === 'off_duty';

              return (
                <div
                  key={doctor.id}
                  className={`bg-white rounded-lg border p-4 transition-all ${
                    isBusy
                      ? 'border-amber-200 shadow-2xs'
                      : isAvailable
                      ? 'border-emerald-200'
                      : 'border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900">{doctor.name}</div>
                      <div className="text-xs text-slate-500">{doctor.specialization}</div>
                    </div>
                    <div>
                      {isAvailable && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Available
                        </span>
                      )}
                      {isBusy && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          In Treatment
                        </span>
                      )}
                      {isOffDuty && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                          Off Duty
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Patient Card if Busy */}
                  {isBusy && doctor.current_patient_id && (
                    <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50/60 rounded p-2.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-slate-500">Current Patient:</span>
                        {doctor.current_patient_severity && (
                          <SeverityBadge severity={doctor.current_patient_severity} size="sm" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-slate-900">{doctor.current_patient_name}</div>
                        <button
                          onClick={() => onSelectPatient(doctor.current_patient_id!)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>History & Rx</span>
                        </button>
                      </div>
                      <div className="text-slate-600 text-[11px] truncate">{doctor.current_patient_complaint}</div>

                      <button
                        onClick={() => onCompleteTreatment(doctor.current_patient_id!)}
                        className="w-full mt-2 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Discharge / Complete Treatment</span>
                      </button>
                    </div>
                  )}

                  {/* Available state callout */}
                  {isAvailable && queue.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onDispatchNext(doctor.id)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <span>Assign Next Patient</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
