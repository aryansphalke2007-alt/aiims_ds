import React, { useState } from 'react';
import { Doctor } from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  Stethoscope,
  UserPlus,
  Power,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface DoctorsViewProps {
  doctors: Doctor[];
  onAddDoctor: (data: { name: string; specialization: string }) => Promise<void>;
  onUpdateStatus: (id: number, status: 'available' | 'off_duty') => Promise<void>;
  onDeleteDoctor: (id: number) => Promise<void>;
  onCompleteTreatment: (patientId: number) => Promise<void>;
}

export const DoctorsView: React.FC<DoctorsViewProps> = ({
  doctors,
  onAddDoctor,
  onUpdateStatus,
  onDeleteDoctor,
  onCompleteTreatment,
}) => {
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('Emergency Medicine');
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Doctor name is required.');
      return;
    }
    setErrorMsg(null);
    setIsAdding(true);
    try {
      await onAddDoctor({ name: name.trim(), specialization });
      setName('');
      setSpecialization('Emergency Medicine');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add doctor');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-blue-600" />
            <span>Emergency Physician Staffing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage active doctor servers in the M/M/c queuing system. Toggle availability, view active clinical handoffs,
            and provision new staff.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Doctor Form */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <UserPlus className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Register Physician</h3>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Physician Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Siddharth Verma, MD"
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Specialization</label>
              <select
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                <option value="Emergency Medicine & Trauma">Emergency Medicine & Trauma</option>
                <option value="Critical Care & Resuscitation">Critical Care & Resuscitation</option>
                <option value="Pediatric Emergency Medicine">Pediatric Emergency Medicine</option>
                <option value="Cardiovascular Emergency">Cardiovascular Emergency</option>
                <option value="General Emergency Physician">General Emergency Physician</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2 px-4 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isAdding ? 'Adding Physician...' : 'Add Physician to Roster'}</span>
            </button>
          </form>
        </div>

        {/* Right: Doctor Cards Grid */}
        <div className="lg:col-span-2 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {doctors.map((doc) => {
              const isAvailable = doc.status === 'available';
              const isBusy = doc.status === 'busy';
              const isOffDuty = doc.status === 'off_duty';

              return (
                <div
                  key={doc.id}
                  className={`bg-white rounded-lg border p-4 space-y-3 transition-all ${
                    isBusy
                      ? 'border-amber-200'
                      : isAvailable
                      ? 'border-emerald-200'
                      : 'border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                      <p className="text-xs text-slate-500">{doc.specialization}</p>
                    </div>

                    <div>
                      {isAvailable && (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          AVAILABLE
                        </span>
                      )}
                      {isBusy && (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          TREATING PATIENT
                        </span>
                      )}
                      {isOffDuty && (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          OFF DUTY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Patient Details */}
                  {isBusy && doc.current_patient_id && (
                    <div className="p-3 rounded bg-amber-50/40 border border-amber-100 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-amber-900">Current Patient:</span>
                        {doc.current_patient_severity && (
                          <SeverityBadge severity={doc.current_patient_severity} size="sm" />
                        )}
                      </div>
                      <div className="font-semibold text-slate-900">{doc.current_patient_name}</div>
                      <div className="text-[11px] text-slate-600 line-clamp-2">{doc.current_patient_complaint}</div>

                      <button
                        onClick={() => onCompleteTreatment(doc.current_patient_id!)}
                        className="w-full mt-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200"
                      >
                        Complete Treatment
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    {!isBusy ? (
                      <button
                        onClick={() =>
                          onUpdateStatus(doc.id, isAvailable ? 'off_duty' : 'available')
                        }
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{isAvailable ? 'Set Off Duty' : 'Set Available'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Occupied in treatment</span>
                    )}

                    {!isBusy && (
                      <button
                        onClick={() => onDeleteDoctor(doc.id)}
                        className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1"
                        title="Remove doctor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
