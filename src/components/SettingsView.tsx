import React, { useState } from 'react';
import { SystemSettings, TriagePolicy } from '../types';
import {
  Settings,
  Sliders,
  Database,
  RotateCcw,
  BookOpen,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Code,
} from 'lucide-react';

interface SettingsViewProps {
  settings: SystemSettings | null;
  onUpdateSettings: (settings: {
    activePolicy?: TriagePolicy;
    alpha?: number;
    thresholdMinutes?: number;
  }) => Promise<void>;
  onResetSeedData: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSeedData,
}) => {
  const [activePolicy, setActivePolicy] = useState<TriagePolicy>(
    settings?.activePolicy || 'priority_linear_aging'
  );
  const [alpha, setAlpha] = useState(settings?.alpha ?? 0.05);
  const [thresholdMinutes, setThresholdMinutes] = useState(settings?.thresholdMinutes ?? 30);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await onUpdateSettings({
        activePolicy,
        alpha,
        thresholdMinutes,
      });
      setStatusMsg({
        type: 'success',
        text: 'Policy settings updated and in-memory queue re-heapified successfully!',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('This will wipe all active patients and reset SQLite with 10 Indian sample patients and 3 AIIMS emergency physicians. Continue?')) {
      return;
    }
    setIsResetting(true);
    setStatusMsg(null);
    try {
      await onResetSeedData();
      setStatusMsg({
        type: 'success',
        text: 'SQLite database reset and seeded with 10 Indian sample patients and 3 AIIMS physicians!',
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Reset failed' });
    } finally {
      setIsResetting(false);
    }
  };

  const policies: {
    id: TriagePolicy;
    title: string;
    tag: string;
    desc: string;
    formula: string;
  }[] = [
    {
      id: 'fcfs',
      title: 'First-Come-First-Served (FCFS)',
      tag: 'FIFO Queue',
      desc: 'Patients are prioritized strictly by order of arrival. Clinical severity is not factored.',
      formula: 'Comparator: arrival_time_A < arrival_time_B',
    },
    {
      id: 'strict_priority',
      title: 'Strict Priority (No Aging)',
      tag: 'Min-Heap O(log n)',
      desc: 'Lower ESI severity always precedes higher. Lower-priority patients risk starvation during high volume.',
      formula: 'Comparator: severity_A < severity_B, tie-breaker: arrival_time',
    },
    {
      id: 'priority_linear_aging',
      title: 'Priority + Linear Aging',
      tag: 'Time-Invariant Key Min-Heap',
      desc: 'Priority increases continuously over time. Prevent low-acuity starvation using static heap keys without re-sorting.',
      formula: 'Key = Severity + α · arrival_time (P_eff = Severity - α · Wait)',
    },
    {
      id: 'priority_threshold_aging',
      title: 'Priority + Threshold Aging',
      tag: 'Step-Promotion Heap',
      desc: 'Promotes patient acuity by one ESI grade every T minutes of waiting time.',
      formula: 'P_eff = max(1, Severity - ⌊Wait / T⌋)',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <span>System Settings & Data Structures Architecture</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Adjust active queue policies, configure aging rates, and inspect the algorithmic time complexity proofs.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Policy Selection Form */}
      <form onSubmit={handleSave} className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Sliders className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Active Live Triage Queue Policy</h3>
        </div>

        {/* Policy Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {policies.map((p) => {
            const isSelected = activePolicy === p.id;
            return (
              <label
                key={p.id}
                onClick={() => setActivePolicy(p.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{p.title}</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {p.tag}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{p.desc}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100/80 font-mono text-[10px] text-slate-500">
                  {p.formula}
                </div>
              </label>
            );
          })}
        </div>

        {/* Dynamic Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Linear Aging Rate (α):</span>
              <span className="font-mono text-blue-600 font-bold">{alpha} / min</span>
            </label>
            <input
              type="number"
              step="0.005"
              min="0.001"
              max="0.5"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value) || 0.05)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[11px] text-slate-400">
              ESI value decreases by α every minute spent waiting. Higher α prevents low-priority starvation.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Threshold T (Minutes)</label>
            <input
              type="number"
              min="5"
              max="180"
              value={thresholdMinutes}
              onChange={(e) => setThresholdMinutes(parseInt(e.target.value, 10) || 30)}
              className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <p className="text-[11px] text-slate-400">
              For Threshold Aging: Promotes patient 1 acuity grade for every T minutes in waiting room.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
          >
            {isSaving ? 'Applying Policy...' : 'Save & Re-Heapify Queue'}
          </button>
        </div>
      </form>

      {/* Database Management & Demo Seed */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Database Storage & Demo Reset</h3>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
            SQLite (data/triage.db)
          </span>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed">
          The application uses a persistent file-backed SQLite database storing all patient records, doctor rosters,
          and simulation histories. When the backend initializes or restarts, it rebuilds the in-memory Binary Min-Heap
          directly from SQLite rows where <code className="font-mono text-slate-900 bg-slate-100 px-1 rounded">status = 'waiting'</code>.
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-500">
            Reset triage state with 10 Indian clinical sample cases (ESI 1 through 5) and 3 AIIMS emergency physicians.
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset & Seed Demo Data</span>
          </button>
        </div>
      </div>

      {/* Data Structures Project Technical Documentation */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Data Structures Project Reference</h3>
        </div>

        {/* Math proof */}
        <div className="space-y-2 text-xs text-slate-700">
          <h4 className="font-bold text-slate-900 text-sm">
            1. The Time-Invariant Heap Key Mathematical Proof
          </h4>
          <p className="leading-relaxed">
            In standard linear aging priority queues, the instantaneous effective priority is defined as:
          </p>
          <div className="p-3 bg-slate-50 border rounded font-mono text-[11px] text-slate-800">
            P_eff(t) = Severity - α · (t - t_arr)
          </div>
          <p className="leading-relaxed">
            If computed naively, as the wall-clock time <code className="font-mono">t</code> increases, every patient's priority shifts,
            demanding an expensive <code className="font-mono">O(n)</code> re-heapify on every tick.
          </p>
          <p className="leading-relaxed">
            However, when comparing any two patients <code className="font-mono">A</code> and <code className="font-mono">B</code>:
          </p>
          <div className="p-3 bg-slate-50 border rounded font-mono text-[11px] text-slate-800 space-y-1">
            <div>P_eff,A(t) &lt; P_eff,B(t)</div>
            <div>⟺ Sev_A - α(t - t_arr,A) &lt; Sev_B - α(t - t_arr,B)</div>
            <div>⟺ Sev_A - α·t + α·t_arr,A &lt; Sev_B - α·t + α·t_arr,B</div>
            <div>⟺ Sev_A + α·t_arr,A &lt; Sev_B + α·t_arr,B  [Adding α·t to both sides]</div>
          </div>
          <p className="leading-relaxed">
            Hence, we define the static key: <strong className="text-slate-900">Key = Severity + α · t_arr</strong>.
            Because this key is completely invariant with respect to time, the Binary Min-Heap maintains the exact priority ordering
            permanently without any re-sorting!
          </p>
        </div>

        {/* Complexity Table */}
        <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
          <h4 className="font-bold text-slate-900 text-sm">2. Algorithmic Time & Space Complexity</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-3">Data Structure</th>
                  <th className="py-2 px-3">Insert (Push)</th>
                  <th className="py-2 px-3">Extract (Pop)</th>
                  <th className="py-2 px-3">Peek</th>
                  <th className="py-2 px-3">Build</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-900">Binary Min-Heap</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(log n)</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(log n)</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(1)</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(n) Floyd's</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-900">FIFO Queue (FCFS)</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(1)</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(1) amortized</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(1)</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">O(n)</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-bold text-slate-900">Linear Scan Queue</td>
                  <td className="py-2.5 px-3 text-emerald-600 font-semibold">O(1)</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">O(n) scan+splice</td>
                  <td className="py-2.5 px-3 text-rose-600 font-semibold">O(n) scan</td>
                  <td className="py-2.5 px-3 text-slate-500 font-semibold">O(1)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
