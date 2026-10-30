import React, { useState } from 'react';
import { SeverityLevel } from '../types';
import { SeverityBadge, severityConfig } from './SeverityBadge';
import { UserPlus, Sparkles, Check, AlertCircle } from 'lucide-react';

interface AddPatientViewProps {
  onPatientAdded: () => void;
  onSubmitPatient: (patient: {
    name: string;
    age: number;
    gender: string;
    complaint: string;
    severity: number;
    arrival_time?: number;
  }) => Promise<void>;
}

export const AddPatientView: React.FC<AddPatientViewProps> = ({
  onPatientAdded,
  onSubmitPatient,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Female');
  const [complaint, setComplaint] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>(3);
  const [arrivedMinutesAgo, setArrivedMinutesAgo] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const presets: {
    name: string;
    age: number;
    gender: string;
    complaint: string;
    severity: SeverityLevel;
    label: string;
  }[] = [
    {
      label: 'Cardiac Arrest',
      name: 'Rajendra Prasad Sharma',
      age: 64,
      gender: 'Male',
      complaint: 'Sudden collapse, unresponsive, ventricular fibrillation',
      severity: 1,
    },
    {
      label: 'Acute Stroke',
      name: 'Sushila Devi',
      age: 72,
      gender: 'Female',
      complaint: 'Right-sided facial droop, slurred speech, onset 40 min ago',
      severity: 2,
    },
    {
      label: 'Severe Asthma / SpO2 89%',
      name: 'Devendra Singh Chauhan',
      age: 26,
      gender: 'Male',
      complaint: 'Severe wheezing, accessory muscle use, tachypnea',
      severity: 2,
    },
    {
      label: 'Suspected Appendicitis',
      name: 'Pooja Deshmukh',
      age: 22,
      gender: 'Female',
      complaint: 'Right lower quadrant abdominal rebound pain, fever 38.6C',
      severity: 3,
    },
    {
      label: 'Wrist Fracture',
      name: 'Aditya Kulkarni',
      age: 34,
      gender: 'Male',
      complaint: 'Deformed distal radius after two-wheeler skid, neurovascular intact',
      severity: 4,
    },
    {
      label: 'Minor Rash / Rx Refill',
      name: 'Lata Narayanan',
      age: 58,
      gender: 'Female',
      complaint: 'Mild contact dermatitis rash on forearm, requests topical ointment refill',
      severity: 5,
    },
  ];

  const applyPreset = (p: (typeof presets)[0]) => {
    setName(p.name);
    setAge(p.age.toString());
    setGender(p.gender);
    setComplaint(p.complaint);
    setSeverity(p.severity);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter a patient full name.');
      return;
    }
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 125) {
      setErrorMsg('Please enter a valid age between 0 and 125.');
      return;
    }
    if (!complaint.trim()) {
      setErrorMsg('Please enter the patient chief clinical complaint.');
      return;
    }

    setIsSubmitting(true);
    try {
      const offsetMins = parseFloat(arrivedMinutesAgo) || 0;
      const arrivalTime = Date.now() - offsetMins * 60 * 1000;

      await onSubmitPatient({
        name: name.trim(),
        age: parsedAge,
        gender,
        complaint: complaint.trim(),
        severity,
        arrival_time: arrivalTime,
      });

      setSuccessMsg(`Patient "${name.trim()}" enqueued into Min-Heap and saved to SQLite.`);
      // Reset form
      setName('');
      setAge('');
      setComplaint('');
      setArrivedMinutesAgo('0');
      setSeverity(3);
      onPatientAdded();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to admit patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-600" />
          <span>Patient Admission & Clinical Triage</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Admitting a patient records their presentation into SQLite and immediately pushes them into the active
          in-memory Binary Min-Heap triage queue.
        </p>
      </div>

      {/* Quick Clinical Presets */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Clinical Case Presets (Click to load):</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-slate-700 flex items-center gap-1.5"
            >
              <span className="font-mono text-[10px] font-bold px-1 rounded bg-slate-200/60">
                ESI {preset.severity}
              </span>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        {errorMsg && (
          <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Patient Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aryan Phalke / Rajesh Kumar"
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Age</label>
            <input
              type="number"
              required
              min="0"
              max="125"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other / Non-binary</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Arrival Time Offset (Testing Aging)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="720"
                value={arrivedMinutesAgo}
                onChange={(e) => setArrivedMinutesAgo(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">min ago</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Set {'>'} 0 to test how dynamic aging promotes longer-waiting patients in the heap.
            </p>
          </div>
        </div>

        {/* Severity Selection (ESI 1 to 5) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Emergency Severity Index (ESI) Level
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
            {([1, 2, 3, 4, 5] as SeverityLevel[]).map((level) => {
              const cfg = severityConfig[level];
              const isSelected = severity === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverity(level)}
                  className={`p-3 text-left rounded-lg border transition-all ${
                    isSelected
                      ? `${cfg.bg} ${cfg.border} ring-2 ring-blue-500/40 shadow-xs`
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-mono text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <div className="text-xs font-bold text-slate-900">{cfg.name}</div>
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{cfg.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chief Complaint */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Chief Clinical Complaint / Symptoms</label>
          <textarea
            required
            rows={3}
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            placeholder="Describe clinical presentation, vital signs, injury mechanism, or primary symptoms..."
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isSubmitting ? 'Admitting & Enqueuing...' : 'Admit & Enqueue Patient'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
