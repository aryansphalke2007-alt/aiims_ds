import React, { useState, useEffect } from 'react';
import {
  TriagePolicy,
  SavedSimulationRun,
  AggregatedSimResult,
} from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  Play,
  RotateCcw,
  Layers,
  Sparkles,
  BarChart3,
  Calendar,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Award,
  Zap,
} from 'lucide-react';

interface SimulatorViewProps {
  onRunSimulation: (params: any) => Promise<any>;
  fetchPastRuns: () => Promise<SavedSimulationRun[]>;
  onDeleteRun: (id: number) => Promise<void>;
  onNavigateToAnalytics?: () => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  onRunSimulation,
  fetchPastRuns,
  onDeleteRun,
  onNavigateToAnalytics,
}) => {
  const [policy, setPolicy] = useState<TriagePolicy>('priority_linear_aging');
  const [alpha, setAlpha] = useState(0.05);
  const [thresholdMinutes, setThresholdMinutes] = useState(30);
  const [arrivalRate, setArrivalRate] = useState(12);
  const [numDoctors, setNumDoctors] = useState(3);
  const [durationHours, setDurationHours] = useState(24);
  const [seed, setSeed] = useState(42);
  const [replications, setReplications] = useState(10);
  const [starvationThreshold, setStarvationThreshold] = useState(120);

  // ESI distribution weights
  const [distP1, setDistP1] = useState(5);
  const [distP2, setDistP2] = useState(15);
  const [distP3, setDistP3] = useState(40);
  const [distP4, setDistP4] = useState(30);
  const [distP5, setDistP5] = useState(10);

  const [isRunning, setIsRunning] = useState(false);
  const [activeResults, setActiveResults] = useState<any | null>(null);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [pastRuns, setPastRuns] = useState<SavedSimulationRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  const loadPastRuns = async () => {
    setIsLoadingRuns(true);
    try {
      const runs = await fetchPastRuns();
      setPastRuns(runs);
    } finally {
      setIsLoadingRuns(false);
    }
  };

  useEffect(() => {
    loadPastRuns();
  }, []);

  const handleRun = async (compareAll: boolean = false) => {
    setIsRunning(true);
    setIsComparisonMode(compareAll);
    try {
      const sum = distP1 + distP2 + distP3 + distP4 + distP5 || 100;
      const normalizedDist = [
        distP1 / sum,
        distP2 / sum,
        distP3 / sum,
        distP4 / sum,
        distP5 / sum,
      ];

      const res = await onRunSimulation({
        policy: compareAll ? undefined : policy,
        compare_all: compareAll,
        alpha,
        thresholdMinutes,
        arrival_rate: arrivalRate,
        num_doctors: numDoctors,
        duration: durationHours,
        seed,
        replications,
        starvation_threshold: starvationThreshold,
        severity_distribution: normalizedDist,
      });

      setActiveResults(res.results);
      await loadPastRuns();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const policyTitles: Record<string, string> = {
    fcfs: 'First-Come-First-Served (FCFS)',
    strict_priority: 'Strict Acuity Priority',
    priority_linear_aging: 'Priority + Linear Aging',
    priority_threshold_aging: 'Priority + Threshold Aging',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <span>Discrete-Event Monte Carlo Simulator</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Executes stochastic Poisson patient arrival streams against doctors using scratch-built Event and Triage Min-Heaps.
          Supports multi-replication confidence intervals and controlled identical-seed policy comparisons.
        </p>
      </div>

      {/* Simulator Control Card */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Triage Policy</label>
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value as TriagePolicy)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="fcfs">First-Come-First-Served (FIFO)</option>
              <option value="strict_priority">Strict Priority (No Aging)</option>
              <option value="priority_linear_aging">Priority + Linear Aging</option>
              <option value="priority_threshold_aging">Priority + Threshold Aging</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Aging Rate (α): <span className="font-mono text-blue-600 font-bold">{alpha}</span> / min
            </label>
            <input
              type="range"
              min="0.005"
              max="0.20"
              step="0.005"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.005 (Slow)</span>
              <span>0.20 (Fast)</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Threshold T (Minutes)</label>
            <input
              type="number"
              min="5"
              max="180"
              value={thresholdMinutes}
              onChange={(e) => setThresholdMinutes(parseInt(e.target.value, 10) || 30)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Arrival Rate (λ)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="50"
                value={arrivalRate}
                onChange={(e) => setArrivalRate(parseInt(e.target.value, 10) || 12)}
                className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <span className="text-xs text-slate-500 whitespace-nowrap">pts / hr</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Number of Doctors (c)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={numDoctors}
              onChange={(e) => setNumDoctors(parseInt(e.target.value, 10) || 3)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Duration (Hours)</label>
            <input
              type="number"
              min="1"
              max="168"
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value, 10) || 24)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">RNG Seed (Reproducible)</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Replications (95% CI)</label>
            <input
              type="number"
              min="1"
              max="30"
              value={replications}
              onChange={(e) => setReplications(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Severity distribution weights */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-700 font-semibold">
            <span>Severity Distribution % (ESI 1 to 5):</span>
            <span className="font-mono text-slate-500 text-[11px]">
              Sum: {distP1 + distP2 + distP3 + distP4 + distP5}%
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-[10px] text-rose-600 font-bold block">ESI 1 (Critical)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={distP1}
                onChange={(e) => setDistP1(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-amber-600 font-bold block">ESI 2 (Emergent)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={distP2}
                onChange={(e) => setDistP2(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-yellow-600 font-bold block">ESI 3 (Urgent)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={distP3}
                onChange={(e) => setDistP3(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-emerald-600 font-bold block">ESI 4 (Less)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={distP4}
                onChange={(e) => setDistP4(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-sky-600 font-bold block">ESI 5 (Non-urg)</span>
              <input
                type="number"
                min="0"
                max="100"
                value={distP5}
                onChange={(e) => setDistP5(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs border rounded"
              />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-mono">
            {replications > 1 ? `Monte Carlo: ${replications} replications with 95% CI` : 'Single simulation run'}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleRun(true)}
              disabled={isRunning}
              className="px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Compare All 4 Policies (Same Seed)</span>
            </button>

            <button
              onClick={() => handleRun(false)}
              disabled={isRunning}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isRunning ? 'Simulating Events...' : 'Run Simulation'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Results Display */}
      {activeResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Simulation Results</span>
              {isComparisonMode && (
                <span className="text-xs font-normal text-slate-500">(4-Policy Comparative Matrix)</span>
              )}
            </h3>

            {onNavigateToAnalytics && (
              <button
                onClick={onNavigateToAnalytics}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>View Analytics Charts</span>
                <span>→</span>
              </button>
            )}
          </div>

          {isComparisonMode ? (
            /* Comparison Grid Across All 4 Policies */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.keys(activeResults).map((polKey) => {
                const res: AggregatedSimResult = activeResults[polKey];
                return (
                  <div
                    key={polKey}
                    className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-2xs"
                  >
                    <div className="border-b border-slate-100 pb-2">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {policyTitles[polKey] || polKey}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {res.replicationsCount} replications
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">Mean Wait:</span>
                        <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                          {res.meanAverageWait} min
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline text-[11px] text-slate-400 font-mono">
                        <span>95% CI:</span>
                        <span>
                          [{res.ci95AverageWait[0]}, {res.ci95AverageWait[1]}]
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">Max Wait:</span>
                        <span className="font-mono font-semibold text-slate-800 tabular-nums">
                          {res.meanMaxWait} min
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">Doctor Util:</span>
                        <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                          {(res.meanUtilization * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-slate-500">Starvation (%):</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            res.meanStarvationPercent > 10 ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {res.meanStarvationPercent}%
                        </span>
                      </div>
                    </div>

                    {/* Acuity Breakdown table */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-mono">
                        Mean Wait by ESI:
                      </div>
                      <div className="space-y-1 text-[11px] font-mono">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <div key={s} className="flex justify-between items-center">
                            <span className="text-slate-500">ESI {s}:</span>
                            <span className="font-semibold text-slate-800">
                              {res.bySeverity[s]?.meanWait ?? 0}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Single Policy Result Card */
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    {policyTitles[activeResults.policy] || activeResults.policy}
                  </h4>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    {activeResults.replicationsCount} replications · Seed {seed} · {numDoctors} Doctors · λ ={' '}
                    {arrivalRate}/hr
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Mean Wait Time:</div>
                  <div className="text-2xl font-bold font-mono text-blue-700 tabular-nums">
                    {activeResults.meanAverageWait} <span className="text-sm font-normal text-slate-500">min</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    95% CI: [{activeResults.ci95AverageWait[0]} – {activeResults.ci95AverageWait[1]}] min
                  </div>
                </div>
              </div>

              {/* Metrics strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">Max Patient Wait</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {activeResults.meanMaxWait} min
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">Doctor Utilization</span>
                  <span className="text-lg font-bold font-mono text-emerald-700 tabular-nums">
                    {(activeResults.meanUtilization * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">Starvation Risk (ESI 4-5)</span>
                  <span
                    className={`text-lg font-bold font-mono tabular-nums ${
                      activeResults.meanStarvationPercent > 10 ? 'text-rose-600' : 'text-slate-900'
                    }`}
                  >
                    {activeResults.meanStarvationPercent}%
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-500 block">Sample Run Patients</span>
                  <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                    {activeResults.sampleRun?.totalPatients || 0}
                  </span>
                </div>
              </div>

              {/* Wait by ESI table */}
              <div className="pt-2">
                <h5 className="text-xs font-bold text-slate-700 mb-2">Performance by Severity Level (ESI 1..5)</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                      <tr>
                        <th className="py-2 px-3">Acuity</th>
                        <th className="py-2 px-3 text-right">Mean Wait</th>
                        <th className="py-2 px-3 text-right">95th Percentile</th>
                        <th className="py-2 px-3 text-right">Max Wait</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <tr key={s}>
                          <td className="py-2 px-3">
                            <SeverityBadge severity={s as any} size="sm" />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800 tabular-nums">
                            {activeResults.bySeverity[s]?.meanWait ?? 0} min
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                            {activeResults.bySeverity[s]?.p95Wait ?? 0} min
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600 tabular-nums">
                            {activeResults.bySeverity[s]?.maxWait ?? 0} min
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Past Saved Simulations */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Historical Simulation Runs in SQLite</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {pastRuns.length} recorded run{pastRuns.length === 1 ? '' : 's'}
          </span>
        </div>

        {pastRuns.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            No simulations have been run yet. Configure parameters above and launch a simulation.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Policy</th>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3 text-right">Doctors</th>
                  <th className="py-2 px-3 text-right">Arrival Rate</th>
                  <th className="py-2 px-3 text-right">Alpha</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pastRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-600">#{run.id}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {run.policy === 'compare_all' ? 'All 4 Policies Comparison' : policyTitles[run.policy] || run.policy}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{run.num_doctors}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{run.arrival_rate}/hr</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{run.alpha}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setActiveResults(run.results);
                            setIsComparisonMode(run.policy === 'compare_all');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          View
                        </button>
                        <button
                          onClick={() => onDeleteRun(run.id).then(loadPastRuns)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
