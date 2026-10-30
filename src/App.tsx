/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { AddPatientView } from './components/AddPatientView';
import { DoctorsView } from './components/DoctorsView';
import { DispatchView } from './components/DispatchView';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { PatientMedicalRecordModal } from './components/PatientMedicalRecordModal';
import { api } from './services/api';
import {
  QueuePatient,
  Doctor,
  LiveMetrics,
  SystemSettings,
} from './types';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Central data loader for live queue, doctors, and metrics
  const refreshLiveData = useCallback(async () => {
    try {
      const [queueRes, doctorsRes, metricsRes, settingsRes] = await Promise.all([
        api.getQueue(),
        api.getDoctors(),
        api.getMetrics(),
        api.getSettings(),
      ]);

      setQueue(queueRes.queue);
      setDoctors(doctorsRes);
      setMetrics(metricsRes);
      setSettings(settingsRes);
    } catch (err: any) {
      console.error('Failed to refresh triage data:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    refreshLiveData().finally(() => setIsLoading(false));
  }, [refreshLiveData]);

  // Auto-refresh interval (every 3 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refreshLiveData();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshLiveData]);

  // Handlers
  const handleDispatchNext = async (doctorId?: number) => {
    setIsDispatching(true);
    try {
      const res = await api.dispatchNext(doctorId);
      showToast(res.message, 'success');
      await refreshLiveData();
    } catch (err: any) {
      showToast(err.message || 'Dispatch failed', 'error');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCompleteTreatment = async (patientId: number) => {
    try {
      const res = await api.completeTreatment(patientId);
      showToast(res.message, 'success');
      await refreshLiveData();
    } catch (err: any) {
      showToast(err.message || 'Failed to complete treatment', 'error');
    }
  };

  const handleAddPatient = async (patientData: any) => {
    const res = await api.addPatient(patientData);
    showToast(`Patient ${res.patient.name} admitted & pushed into Min-Heap`, 'success');
    await refreshLiveData();
  };

  const handleAddDoctor = async (doctorData: { name: string; specialization: string }) => {
    const res = await api.addDoctor(doctorData);
    showToast(`Physician ${res.doctor.name} registered`, 'success');
    await refreshLiveData();
  };

  const handleUpdateDoctorStatus = async (id: number, status: 'available' | 'off_duty') => {
    const res = await api.updateDoctorStatus(id, status);
    showToast(`Doctor status updated to ${status}`, 'info');
    await refreshLiveData();
  };

  const handleDeleteDoctor = async (id: number) => {
    const res = await api.deleteDoctor(id);
    showToast(res.message, 'info');
    await refreshLiveData();
  };

  const handleDeletePatient = async (id: number) => {
    const res = await api.deletePatient(id);
    showToast(res.message, 'info');
    await refreshLiveData();
  };

  const handleUpdateSettings = async (newSettings: any) => {
    const res = await api.updateSettings(newSettings);
    setSettings(res.settings);
    showToast('Policy updated and queue re-heapified!', 'success');
    await refreshLiveData();
  };

  const handleResetSeedData = async () => {
    const res = await api.seedDatabase();
    showToast(res.message, 'success');
    await refreshLiveData();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onQuickDispatch={() => handleDispatchNext()}
        isDispatching={isDispatching}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
      />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            queue={queue}
            doctors={doctors}
            metrics={metrics}
            settings={settings}
            onDispatchNext={handleDispatchNext}
            onCompleteTreatment={handleCompleteTreatment}
            onNavigateToAdmit={() => setActiveTab('admit')}
            onSelectPatient={setSelectedPatientId}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'admit' && (
          <AddPatientView
            onSubmitPatient={handleAddPatient}
            onPatientAdded={() => {
              refreshLiveData();
              setActiveTab('dashboard');
            }}
          />
        )}

        {activeTab === 'dispatch' && (
          <DispatchView
            queue={queue}
            doctors={doctors}
            settings={settings}
            onDispatchNext={handleDispatchNext}
            onCompleteTreatment={handleCompleteTreatment}
            onSelectPatient={setSelectedPatientId}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'doctors' && (
          <DoctorsView
            doctors={doctors}
            onAddDoctor={handleAddDoctor}
            onUpdateStatus={handleUpdateDoctorStatus}
            onDeleteDoctor={handleDeleteDoctor}
            onCompleteTreatment={handleCompleteTreatment}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            fetchPatients={api.getPatients}
            onRefresh={refreshLiveData}
            onDeletePatient={handleDeletePatient}
            onSelectPatient={setSelectedPatientId}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView onRunBenchmark={api.getBenchmark} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetSeedData={handleResetSeedData}
          />
        )}
      </main>

      {/* Patient Medical Dossier & History Modal */}
      {selectedPatientId !== null && (
        <PatientMedicalRecordModal
          patientId={selectedPatientId}
          onClose={() => setSelectedPatientId(null)}
          onPatientUpdated={refreshLiveData}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm p-4 rounded-lg bg-slate-900 text-white shadow-xl flex items-center justify-between gap-3 text-xs border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
