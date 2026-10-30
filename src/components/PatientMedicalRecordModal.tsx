import React, { useState, useEffect } from 'react';
import {
  Patient,
  Doctor,
  PatientMedicalRecord,
  ClinicalTest,
  DiagnosticReport,
  PrescriptionItem,
} from '../types';
import { SeverityBadge } from './SeverityBadge';
import { api } from '../services/api';
import {
  X,
  FileText,
  Activity,
  Heart,
  Droplet,
  Thermometer,
  Wind,
  AlertTriangle,
  FlaskConical,
  CheckCircle2,
  Clock,
  Pill,
  Plus,
  Stethoscope,
  Save,
  Check,
  ClipboardList,
} from 'lucide-react';

interface PatientMedicalRecordModalProps {
  patientId: number | null;
  onClose: () => void;
  onPatientUpdated?: () => void;
}

export const PatientMedicalRecordModal: React.FC<PatientMedicalRecordModalProps> = ({
  patientId,
  onClose,
  onPatientUpdated,
}) => {
  const [data, setData] = useState<{
    patient: Patient & { assignedDoctor?: Doctor | null };
    medicalRecord: PatientMedicalRecord;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tests' | 'reports' | 'prescriptions' | 'notes' | 'vitals'>('tests');

  // Form states
  const [testFilter, setTestFilter] = useState<'all' | 'suggested' | 'done'>('all');
  const [showAddTest, setShowAddTest] = useState(false);
  const [newTestName, setNewTestName] = useState('');
  const [newTestCategory, setNewTestCategory] = useState('Diagnostic Pathology');
  const [newTestStatus, setNewTestStatus] = useState<'suggested' | 'done'>('suggested');
  const [newTestResult, setNewTestResult] = useState('');

  const [completingTestId, setCompletingTestId] = useState<string | null>(null);
  const [completeTestResult, setCompleteTestResult] = useState('');

  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [newMedicine, setNewMedicine] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newRoute, setNewRoute] = useState('Oral');
  const [newFrequency, setNewFrequency] = useState('OD');
  const [newInstructions, setNewInstructions] = useState('');

  const [showAddReport, setShowAddReport] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportDept, setNewReportDept] = useState('Radiology / Lab');
  const [newReportFindings, setNewReportFindings] = useState('');
  const [newReportConclusion, setNewReportConclusion] = useState('');

  const [doctorNotes, setDoctorNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadRecord = async () => {
    if (!patientId) return;
    setIsLoading(true);
    try {
      const res = await api.getMedicalRecord(patientId);
      setData(res);
      setDoctorNotes(res.medicalRecord.doctor_notes || '');
    } catch (err: any) {
      console.error('Failed to load patient record:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadRecord();
    }
  }, [patientId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !newTestName.trim()) return;
    try {
      const res = await api.addTest(patientId, {
        name: newTestName.trim(),
        category: newTestCategory,
        status: newTestStatus,
        result: newTestResult.trim(),
        doctorName: data?.patient?.assignedDoctor?.name || 'Casualty Medical Officer',
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              medicalRecord: {
                ...prev.medicalRecord,
                tests: res.tests,
              },
            }
          : null
      );
      setNewTestName('');
      setNewTestResult('');
      setShowAddTest(false);
      showToast('Clinical test added successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to add test');
    }
  };

  const handleMarkTestDone = async (testId: string) => {
    if (!patientId) return;
    try {
      const res = await api.updateTestStatus(patientId, testId, {
        status: 'done',
        result: completeTestResult.trim() || 'Normal / Verified without acute pathology',
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              medicalRecord: {
                ...prev.medicalRecord,
                tests: res.tests,
              },
            }
          : null
      );
      setCompletingTestId(null);
      setCompleteTestResult('');
      showToast('Test marked as completed with results!');
    } catch (err: any) {
      alert(err.message || 'Failed to update test');
    }
  };

  const handleAddPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !newMedicine.trim()) return;
    try {
      const res = await api.addPrescription(patientId, {
        medicine: newMedicine.trim(),
        dosage: newDosage.trim(),
        route: newRoute,
        frequency: newFrequency,
        instructions: newInstructions.trim(),
        prescribedBy: data?.patient?.assignedDoctor?.name || 'Dr. Rajeshwar Sharma',
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              medicalRecord: {
                ...prev.medicalRecord,
                prescriptions: res.prescriptions,
              },
            }
          : null
      );
      setNewMedicine('');
      setNewDosage('');
      setNewInstructions('');
      setShowAddPrescription(false);
      showToast('Prescription order added!');
    } catch (err: any) {
      alert(err.message || 'Failed to add prescription');
    }
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !newReportTitle.trim()) return;
    try {
      const res = await api.addReport(patientId, {
        title: newReportTitle.trim(),
        department: newReportDept,
        findings: newReportFindings.trim(),
        conclusion: newReportConclusion.trim(),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              medicalRecord: {
                ...prev.medicalRecord,
                reports: res.reports,
              },
            }
          : null
      );
      setNewReportTitle('');
      setNewReportFindings('');
      setNewReportConclusion('');
      setShowAddReport(false);
      showToast('Diagnostic report saved!');
    } catch (err: any) {
      alert(err.message || 'Failed to save report');
    }
  };

  const handleSaveNotes = async () => {
    if (!patientId) return;
    setIsSavingNotes(true);
    try {
      await api.updateMedicalRecord(patientId, {
        doctor_notes: doctorNotes,
      });
      showToast('Doctor notes saved permanently to SQLite!');
    } catch (err: any) {
      alert(err.message || 'Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (!patientId) return null;

  const filteredTests =
    data?.medicalRecord?.tests?.filter((t) => {
      if (testFilter === 'all') return true;
      return t.status === testFilter;
    }) || [];

  const suggestedCount = data?.medicalRecord?.tests?.filter((t) => t.status === 'suggested').length || 0;
  const doneCount = data?.medicalRecord?.tests?.filter((t) => t.status === 'done').length || 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">
                  {data?.patient?.name || 'Loading Patient...'}
                </h3>
                {data?.patient?.severity && (
                  <SeverityBadge severity={data.patient.severity} size="sm" />
                )}
                <span className="font-mono text-xs text-slate-400">
                  #{data?.patient?.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                {data?.patient?.age}y · {data?.patient?.gender} · Blood Group: {data?.medicalRecord?.blood_group || 'Unknown'} · Status:{' '}
                <span className="uppercase text-blue-400 font-semibold">{data?.patient?.status}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {toastMessage && (
              <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded animate-pulse">
                {toastMessage}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <Activity className="w-8 h-8 animate-spin mx-auto text-blue-600" />
            <p className="text-xs">Loading complete clinical electronic medical record from SQLite...</p>
          </div>
        ) : (
          <>
            {/* Top Vitals & Clinical Summary Strip */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 shrink-0">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">BP</span>
                    <span className="font-mono font-bold text-slate-800">{data?.medicalRecord?.blood_pressure || '120/80'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Activity className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">PULSE</span>
                    <span className="font-mono font-bold text-slate-800">{data?.medicalRecord?.heart_rate || 76} bpm</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Wind className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">SpO2</span>
                    <span className="font-mono font-bold text-slate-800">{data?.medicalRecord?.spo2 || 98}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Thermometer className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">TEMP</span>
                    <span className="font-mono font-bold text-slate-800">{data?.medicalRecord?.temperature || 98.6}°F</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-mono">PHYSICIAN</span>
                    <span className="font-medium text-slate-800 truncate block">
                      {data?.patient?.assignedDoctor?.name?.split(',')[0] || 'Dr. Rajeshwar Sharma'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Allergies & Chief Complaint Alert */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Complaint:</span>
                  <span className="text-slate-900 font-medium">{data?.patient?.complaint}</span>
                </div>
                {data?.medicalRecord?.allergies && data.medicalRecord.allergies !== 'No Known Drug Allergies (NKDA)' && (
                  <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Allergies: {data.medicalRecord.allergies}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-2 shrink-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('tests')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'tests'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Clinical Tests</span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {suggestedCount} pend / {doneCount} done
                </span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'reports'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Diagnostic Reports</span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {data?.medicalRecord?.reports?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('prescriptions')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'prescriptions'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                <span>Prescriptions & Rx</span>
                <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  {data?.medicalRecord?.prescriptions?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`py-3 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'notes'
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Clinical Notes & History</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* TAB 1: TESTS (SUGGESTED / DONE) */}
              {activeTab === 'tests' && (
                <div className="space-y-4">
                  {/* Action and Filter Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-md text-xs">
                      <button
                        onClick={() => setTestFilter('all')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          testFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        All Tests ({data?.medicalRecord?.tests?.length || 0})
                      </button>
                      <button
                        onClick={() => setTestFilter('suggested')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          testFilter === 'suggested' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Suggested / Pending ({suggestedCount})
                      </button>
                      <button
                        onClick={() => setTestFilter('done')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                          testFilter === 'done' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        Completed / Done ({doneCount})
                      </button>
                    </div>

                    <button
                      onClick={() => setShowAddTest(!showAddTest)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Order Clinical Test</span>
                    </button>
                  </div>

                  {/* Add Test Drawer / Form */}
                  {showAddTest && (
                    <form
                      onSubmit={handleAddTest}
                      className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 space-y-3 text-xs"
                    >
                      <div className="font-bold text-blue-900">Order / Suggest Diagnostic Test</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-medium text-slate-700">Test Name</label>
                          <input
                            type="text"
                            required
                            value={newTestName}
                            onChange={(e) => setNewTestName(e.target.value)}
                            placeholder="e.g. 12-Lead ECG / Serum Troponin / USG Abdomen / CBC"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Category</label>
                          <select
                            value={newTestCategory}
                            onChange={(e) => setNewTestCategory(e.target.value)}
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          >
                            <option value="Cardiology">Cardiology</option>
                            <option value="Diagnostic Pathology">Diagnostic Pathology</option>
                            <option value="Biochemistry">Biochemistry</option>
                            <option value="Radiology & Imaging">Radiology & Imaging</option>
                            <option value="Microbiology">Microbiology</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Initial Status</label>
                          <div className="flex items-center gap-3 mt-1">
                            <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                checked={newTestStatus === 'suggested'}
                                onChange={() => setNewTestStatus('suggested')}
                              />
                              <span>Suggested (Pending)</span>
                            </label>
                            <label className="flex items-center gap-1 text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                checked={newTestStatus === 'done'}
                                onChange={() => setNewTestStatus('done')}
                              />
                              <span>Done (Completed with result)</span>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Result / Clinical Findings (if done)</label>
                          <input
                            type="text"
                            value={newTestResult}
                            onChange={(e) => setNewTestResult(e.target.value)}
                            placeholder="e.g. Elevated at 4.2 ng/mL or Fracture confirmed"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddTest(false)}
                          className="px-3 py-1 border rounded bg-white text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1 bg-blue-600 text-white font-semibold rounded"
                        >
                          Add to Patient Record
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Tests List */}
                  {filteredTests.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No clinical tests found in this category.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredTests.map((test) => {
                        const isDone = test.status === 'done';
                        const isCompleting = completingTestId === test.id;

                        return (
                          <div
                            key={test.id}
                            className={`p-3.5 rounded-lg border transition-all ${
                              isDone
                                ? 'bg-white border-slate-200'
                                : 'bg-amber-50/30 border-amber-200 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  {isDone ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" />
                                      DONE
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                      <Clock className="w-3 h-3" />
                                      SUGGESTED / PENDING
                                    </span>
                                  )}
                                  <span className="text-xs font-bold text-slate-900">{test.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">· {test.category}</span>
                                </div>

                                <div className="text-xs text-slate-700 pl-1 font-mono">
                                  <span className="font-semibold text-slate-500">Result / Finding: </span>
                                  <span className={isDone ? 'text-slate-900 font-medium' : 'text-amber-800 italic'}>
                                    {test.result || 'Awaiting lab processing'}
                                  </span>
                                </div>

                                <div className="text-[10px] text-slate-400 pl-1 flex items-center gap-3">
                                  <span>Suggested: {test.suggestedAt}</span>
                                  {test.completedAt && <span>· Completed: {test.completedAt}</span>}
                                  {test.doctorName && <span>· By: {test.doctorName}</span>}
                                </div>
                              </div>

                              {!isDone && !isCompleting && (
                                <button
                                  onClick={() => {
                                    setCompletingTestId(test.id);
                                    setCompleteTestResult('');
                                  }}
                                  className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shrink-0"
                                >
                                  Mark Done & Enter Result
                                </button>
                              )}
                            </div>

                            {/* Complete test inline input */}
                            {isCompleting && (
                              <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                                <label className="text-xs font-semibold text-slate-700 block">
                                  Enter Lab / Diagnostic Result for {test.name}:
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={completeTestResult}
                                    onChange={(e) => setCompleteTestResult(e.target.value)}
                                    placeholder="e.g. Normal sinus rhythm / Value: 5.4 mg/dL / No acute lesion"
                                    className="flex-1 px-2.5 py-1.5 border rounded text-xs bg-white"
                                  />
                                  <button
                                    onClick={() => handleMarkTestDone(test.id)}
                                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700"
                                  >
                                    Save Result
                                  </button>
                                  <button
                                    onClick={() => setCompletingTestId(null)}
                                    className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: DIAGNOSTIC REPORTS */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Diagnostic Reports & Formal Investigations</h4>
                      <p className="text-[11px] text-slate-500">Pathology, Radiology, Ultrasound, and ECG documentation</p>
                    </div>

                    <button
                      onClick={() => setShowAddReport(!showAddReport)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Diagnostic Report</span>
                    </button>
                  </div>

                  {showAddReport && (
                    <form
                      onSubmit={handleAddReport}
                      className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 space-y-3 text-xs"
                    >
                      <div className="font-bold text-blue-900">Record Formal Investigation Report</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Report Title</label>
                          <input
                            type="text"
                            required
                            value={newReportTitle}
                            onChange={(e) => setNewReportTitle(e.target.value)}
                            placeholder="e.g. Emergency 12-Lead ECG / Chest X-Ray PA View"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Department</label>
                          <input
                            type="text"
                            value={newReportDept}
                            onChange={(e) => setNewReportDept(e.target.value)}
                            placeholder="e.g. Radiology / Clinical Biochemistry"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Findings & Measurements</label>
                        <textarea
                          rows={2}
                          required
                          value={newReportFindings}
                          onChange={(e) => setNewReportFindings(e.target.value)}
                          placeholder="Describe objective clinical findings, elevations, or fractures..."
                          className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Conclusion / Impression</label>
                        <input
                          type="text"
                          required
                          value={newReportConclusion}
                          onChange={(e) => setNewReportConclusion(e.target.value)}
                          placeholder="e.g. Acute STEMI / Stable fracture"
                          className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddReport(false)}
                          className="px-3 py-1 border rounded bg-white text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1 bg-blue-600 text-white font-semibold rounded"
                        >
                          Save Report
                        </button>
                      </div>
                    </form>
                  )}

                  {data?.medicalRecord?.reports?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No signed diagnostic reports filed yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data?.medicalRecord?.reports?.map((rep) => (
                        <div key={rep.id} className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                                <span>{rep.title}</span>
                                <span className="font-mono text-[10px] text-slate-400">· {rep.department}</span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                Verified Date: {rep.date}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {rep.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-100 font-mono text-[11px] leading-relaxed">
                            <span className="font-bold text-slate-800">Findings: </span>
                            {rep.findings}
                          </div>

                          <div className="text-xs font-semibold text-blue-900 pt-1">
                            <span>Impression: </span>
                            <span className="text-slate-900">{rep.conclusion}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: PRESCRIPTIONS */}
              {activeTab === 'prescriptions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Doctor Prescriptions & Medication Chart</h4>
                      <p className="text-[11px] text-slate-500">Emergency drug orders, dosages, routes, and frequencies</p>
                    </div>

                    <button
                      onClick={() => setShowAddPrescription(!showAddPrescription)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Prescription</span>
                    </button>
                  </div>

                  {showAddPrescription && (
                    <form
                      onSubmit={handleAddPrescription}
                      className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 space-y-3 text-xs"
                    >
                      <div className="font-bold text-blue-900">Prescribe Medication</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-medium text-slate-700">Drug Name & Generic</label>
                          <input
                            type="text"
                            required
                            value={newMedicine}
                            onChange={(e) => setNewMedicine(e.target.value)}
                            placeholder="e.g. Tab Ticagrelor / Inj Tramadol / Tab Dolo 650"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Dosage</label>
                          <input
                            type="text"
                            required
                            value={newDosage}
                            onChange={(e) => setNewDosage(e.target.value)}
                            placeholder="e.g. 180 mg / 1 g in 100ml NS"
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Route</label>
                          <select
                            value={newRoute}
                            onChange={(e) => setNewRoute(e.target.value)}
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          >
                            <option value="Oral">Oral</option>
                            <option value="IV Bolus">IV Bolus (Intravenous)</option>
                            <option value="IV Infusion">IV Infusion</option>
                            <option value="Subcutaneous">Subcutaneous (SC)</option>
                            <option value="Intramuscular">Intramuscular (IM)</option>
                            <option value="Sublingual">Sublingual</option>
                            <option value="Inhalation / Nebulization">Inhalation / Nebulization</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="font-medium text-slate-700">Frequency</label>
                          <select
                            value={newFrequency}
                            onChange={(e) => setNewFrequency(e.target.value)}
                            className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                          >
                            <option value="STAT (Immediately)">STAT (Immediately)</option>
                            <option value="OD (Once daily)">OD (Once daily)</option>
                            <option value="BD (Twice daily)">BD (Twice daily)</option>
                            <option value="TDS (Thrice daily)">TDS (Thrice daily)</option>
                            <option value="Q6H (Every 6 hours)">Q6H (Every 6 hours)</option>
                            <option value="SOS (As needed)">SOS (As needed)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-medium text-slate-700">Clinical Instructions</label>
                        <input
                          type="text"
                          value={newInstructions}
                          onChange={(e) => setNewInstructions(e.target.value)}
                          placeholder="e.g. Administer after food / Crush via NG tube / Infuse over 20 mins"
                          className="w-full px-2.5 py-1.5 border rounded bg-white text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddPrescription(false)}
                          className="px-3 py-1 border rounded bg-white text-slate-600"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1 bg-blue-600 text-white font-semibold rounded"
                        >
                          Add to Prescription
                        </button>
                      </div>
                    </form>
                  )}

                  {data?.medicalRecord?.prescriptions?.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No prescriptions active for this patient.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Medication</th>
                            <th className="py-2 px-3">Dosage</th>
                            <th className="py-2 px-3">Route</th>
                            <th className="py-2 px-3">Frequency</th>
                            <th className="py-2 px-3">Instructions</th>
                            <th className="py-2 px-3">Doctor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data?.medicalRecord?.prescriptions?.map((rx) => (
                            <tr key={rx.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-900">{rx.medicine}</td>
                              <td className="py-2.5 px-3 text-slate-700">{rx.dosage}</td>
                              <td className="py-2.5 px-3 text-slate-600">{rx.route}</td>
                              <td className="py-2.5 px-3 font-semibold text-blue-700">{rx.frequency}</td>
                              <td className="py-2.5 px-3 text-slate-600 font-sans text-xs">{rx.instructions}</td>
                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">{rx.prescribedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: CLINICAL NOTES & PAST MEDICAL HISTORY */}
              {activeTab === 'notes' && (
                <div className="space-y-4 text-xs">
                  {/* Past History */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-blue-600" />
                      <span>Past Medical & Surgical History</span>
                    </h4>
                    <p className="text-slate-700 leading-relaxed font-mono text-[11px]">
                      {data?.medicalRecord?.past_history || 'No recorded prior chronic illnesses.'}
                    </p>
                  </div>

                  {/* Doctor's Notes Textarea */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-blue-600" />
                        <span>Attending Physician Clinical Notes & Plan</span>
                      </h4>
                      <button
                        onClick={handleSaveNotes}
                        disabled={isSavingNotes}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingNotes ? 'Saving...' : 'Save Notes to SQLite'}</span>
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      placeholder="Enter emergency physician evaluation, progression notes, operative plan, and discharge instructions..."
                      className="w-full p-3 rounded-lg border border-slate-200 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer Bar */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500 font-mono">
          <span>AIIMS Central Emergency Triage System · SQLite EMR Record</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-md transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
