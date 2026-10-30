import React from 'react';
import { Activity, Plus, RefreshCw, BellRing } from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'admit'
  | 'doctors'
  | 'dispatch'
  | 'history'
  | 'analytics'
  | 'settings';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onQuickDispatch: () => void;
  isDispatching: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onQuickDispatch,
  isDispatching,
  autoRefresh,
  onToggleAutoRefresh,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'dashboard', label: 'Live Queue' },
    { id: 'admit', label: 'Admit Patient' },
    { id: 'dispatch', label: 'Triage Dispatch' },
    { id: 'doctors', label: 'Physicians' },
    { id: 'history', label: 'Registry' },
    { id: 'analytics', label: 'Data & Benchmarks' },
    { id: 'settings', label: 'Settings & DS Docs' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block">
                AIIMS Emergency Triage Hospital
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-tight block -mt-0.5">
                Apex Casualty & Trauma Centre · Min-Heap Engine
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Live Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onToggleAutoRefresh}
              title={autoRefresh ? 'Auto-refresh active (every 3s)' : 'Auto-refresh paused'}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                autoRefresh
                  ? 'border-blue-200 bg-blue-50/50 text-blue-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
              <span className="hidden sm:inline text-xs">{autoRefresh ? 'Live' : 'Paused'}</span>
            </button>

            <button
              onClick={onQuickDispatch}
              disabled={isDispatching}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Call Next Patient</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto pb-2 -mt-1 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
