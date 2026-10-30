import React, { useState, useEffect } from 'react';
import { Patient, SeverityLevel } from '../types';
import { SeverityBadge } from './SeverityBadge';
import {
  FileText,
  Search,
  Download,
  Filter,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';

interface HistoryViewProps {
  onRefresh: () => void;
  onDeletePatient: (id: number) => Promise<void>;
  onSelectPatient: (patientId: number) => void;
  fetchPatients: (filters?: {
    status?: string;
    severity?: string;
    search?: string;
  }) => Promise<Patient[]>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onRefresh,
  onDeletePatient,
  onSelectPatient,
  fetchPatients,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPatients({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
      });
      setPatients(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, severityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(`Are you sure you want to permanently remove patient record #${id}?`)) return;
    setDeletingId(id);
    try {
      await onDeletePatient(id);
      await loadData();
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    if (patients.length === 0) return;
    const headers = [
      'ID',
      'Name',
      'Age',
      'Gender',
      'Severity',
      'Complaint',
      'Status',
      'Arrival Time',
      'Wait Minutes',
      'Service Minutes',
    ];
    const rows = patients.map((p) => [
      p.id,
      `"${p.name.replace(/"/g, '""')}"`,
      p.age,
      p.gender,
      p.severity,
      `"${p.complaint.replace(/"/g, '""')}"`,
      p.status,
      new Date(p.arrival_time).toISOString(),
      p.wait_minutes ?? '',
      p.service_minutes ?? '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `triage_patient_registry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Persistent Patient Registry (SQLite Database)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Permanent historical audit trail of all emergency admissions, triage classifications, wait durations, and clinical discharges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={patients.length === 0}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            title="Refresh Table"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name or clinical complaint..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Statuses</option>
              <option value="waiting">Waiting</option>
              <option value="in_treatment">In Treatment</option>
              <option value="done">Completed / Done</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All ESI Levels</option>
              <option value="1">ESI 1 - Resuscitation</option>
              <option value="2">ESI 2 - Emergent</option>
              <option value="3">ESI 3 - Urgent</option>
              <option value="4">ESI 4 - Less Urgent</option>
              <option value="5">ESI 5 - Non-Urgent</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </form>
      </div>

      {/* Registry Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Patient</th>
                <th className="py-2.5 px-3">Acuity</th>
                <th className="py-2.5 px-3">Complaint</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Arrival</th>
                <th className="py-2.5 px-3 text-right">Wait Time</th>
                <th className="py-2.5 px-3 text-right">Service Time</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No matching patient records found in SQLite database.
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-500 tabular-nums">
                        #{p.id}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => onSelectPatient(p.id)}
                          className="text-left group block cursor-pointer"
                          title="Click to view full Medical History, Tests, Reports & Prescriptions"
                        >
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                            <span>{p.name}</span>
                            <FileText className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.age}y · {p.gender}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <SeverityBadge severity={p.severity} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-slate-700 max-w-xs truncate" title={p.complaint}>
                        {p.complaint}
                      </td>
                      <td className="py-3 px-3">
                        {p.status === 'waiting' && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                            WAITING
                          </span>
                        )}
                        {p.status === 'in_treatment' && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            IN TREATMENT
                          </span>
                        )}
                        {p.status === 'done' && (
                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            COMPLETED
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {new Date(p.arrival_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                        {p.wait_minutes !== null ? `${p.wait_minutes} min` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                        {p.service_minutes !== null ? `${p.service_minutes} min` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onSelectPatient(p.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                            title="View Medical History & Tests"
                          >
                            Medical History
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={deletingId === p.id}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded"
                            title="Delete from SQLite"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
