import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import TimeRecordForm from './TimeRecordForm';

// Icons
import ProjectsIcon from './icons/ProjectsIcon';
import ClockIcon from './icons/ClockIcon';
import MapIcon from './icons/MapIcon';
import CalendarIcon from './icons/CalendarIcon';
import PlusIcon from './icons/PlusIcon';
import BrainIcon from './icons/BrainIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import WrenchIcon from './icons/WrenchIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import SettingsIcon from './icons/SettingsIcon';
import ChatIcon from './icons/ChatIcon';
import WorkersIcon from './icons/WorkersIcon';
import { soundService } from '../services/soundService';

const ActionTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
  desc?: string;
}> = ({ icon, label, onClick, color, desc }) => (
  <button
    onClick={() => {
      soundService.playClick();
      onClick();
    }}
    className={`flex flex-col items-start p-7 md:p-6 rounded-[2.5rem] glass-card transition-all group hover:scale-[1.02] active:scale-95 border-l-8 ${color} shadow-2xl relative overflow-hidden h-full min-h-[180px] md:min-h-[160px] touch-manipulation`}
  >
    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
      {icon}
    </div>
    <div className="mb-4 p-4 md:p-3 rounded-2xl bg-white/5 text-white group-hover:bg-white group-hover:text-black transition-all">
      {icon}
    </div>
    <h3 className="text-xl md:text-lg font-black uppercase italic tracking-tighter text-white mb-2">{label}</h3>
    {desc && <p className="text-sm md:text-xs text-slate-400 font-bold tracking-tight text-left leading-relaxed">{desc}</p>}
  </button>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  const activeProjectsCount = useLiveQuery(() => db.projects.where('status').equals('active').count(), [], 0) ?? 0;
  const activeSessions = useLiveQuery(() => db.attendanceSessions.toArray(), [], []);
  const workersCount = useLiveQuery(() => db.workers.count(), [], 0) ?? 0;

  const activeSessionsCount = activeSessions?.length || 0;

  return (
    <div className="space-y-8 md:space-y-10 pb-32 animate-fade-in">
      <header className="relative pt-6 md:pt-8 px-2">
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white tracking-tighter italic leading-none mb-4 md:mb-3">
          MST<span className="text-[var(--color-accent)]">.</span>LAUNCHER
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 md:px-3 md:py-1 bg-green-500/20 rounded-full border border-green-500/30">
            <span className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs md:text-[10px] font-black uppercase tracking-widest text-green-400">ONLINE</span>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs md:text-[10px]">
            {user?.username} • Admin Panel Ready
          </p>
        </div>
      </header>

      {/* Active Shift Banner */}
      {activeSessions.some(s => s.workerId === user?.workerId) && (
        <div className="mx-2 p-6 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-[2rem] shadow-xl animate-pulse-slow flex items-center justify-between group cursor-pointer" onClick={() => navigate('/attendance')}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white">
              <ClockIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-tighter text-lg leading-tight">Máš aktivní směnu!</p>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Nezapomeň se na konci dne odhlásit.</p>
            </div>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-white font-black text-[10px] uppercase tracking-widest group-hover:bg-white group-hover:text-indigo-600 transition-all">
            Check-out →
          </div>
        </div>
      )}

      {/* Main Grid Actions - Mobile First: 1 column, MD+: 2 columns, LG: 4 columns */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6 px-2">
        <ActionTile
          icon={<ClockIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('log_work')}
          desc={t('work_log_desc')}
          onClick={() => setIsLoggingWork(true)}
          color="border-indigo-500"
        />
        <ActionTile
          icon={<MapIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('plan')}
          desc={t('plan_desc')}
          onClick={() => navigate('/field-plans')}
          color="border-cyan-500"
        />
        <ActionTile
          icon={<CalendarIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('attendance')}
          desc={t('attendance_desc')}
          onClick={() => navigate('/attendance')}
          color="border-amber-500"
        />
        <ActionTile
          icon={<ProjectsIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('projects')}
          desc={t('projects_desc')}
          onClick={() => navigate('/projects')}
          color="border-emerald-500"
        />
        <ActionTile
          icon={<WrenchIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('tools')}
          desc={t('tools_desc')}
          onClick={() => navigate('/tools')}
          color="border-slate-500"
        />
        <ActionTile
          icon={<ChatIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label="Team Chat"
          desc={t('chat_desc') || "Komunikace týmu"}
          onClick={() => navigate('/chat')}
          color="border-indigo-500"
        />
        <ActionTile
          icon={<WorkersIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('workers') || "Tým"}
          desc={t('workers_desc') || "Správa pracovníků"}
          onClick={() => navigate('/workers')}
          color="border-pink-500"
        />
        <ActionTile
          icon={<ChartBarIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('statistics')}
          desc={t('statistics_dashboard_desc')}
          onClick={() => navigate('/stats')}
          color="border-purple-500"
        />
        <ActionTile
          icon={<DocumentTextIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('daily_report')}
          desc={t('daily_reports_desc')}
          onClick={() => navigate('/daily-reports')}
          color="border-orange-500"
        />
        <ActionTile
          icon={<SettingsIcon className="w-8 h-8 md:w-7 md:h-7" />}
          label={t('settings')} // Ensure i18n key exists or fallback
          desc={t('settings_desc') || 'Konfigurace aplikace'}
          onClick={() => navigate('/settings')}
          color="border-gray-500"
        />
        <ActionTile
          icon={<svg className="w-8 h-8 md:w-7 md:h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label={t('payroll') || "Finance"}
          desc={t('payroll_desc') || "Odměny a výplaty"}
          onClick={() => navigate('/payroll')}
          color="border-indigo-600"
        />
      </section>

      {/* Analytics Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2">
        <div className="lg:col-span-2 glass-card rounded-[3rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
            <ChartBarIcon className="w-48 h-48" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-8 italic flex items-center gap-3">
            <ChartBarIcon className="w-6 h-6 text-[var(--color-accent)]" />
            Aktuální Stav
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <p className="text-5xl font-black text-white">{activeProjectsCount}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktivní Projekty</p>
            </div>
            <div className="space-y-1">
              <p className="text-5xl font-black text-[var(--color-accent)]">{workersCount}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tým Pracovníků</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <p className="text-5xl font-black text-indigo-400">{activeSessionsCount}</p>
                {activeSessionsCount > 0 && (
                  <span className="flex h-3 w-3 relative mt-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Právě na směně</p>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-[3rem] p-8 flex flex-col justify-center bg-gradient-to-br from-indigo-600/20 to-transparent border border-white/5 group cursor-pointer" onClick={() => navigate('/payroll')}>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Moje Odměna (Tento týden)</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-5xl font-black text-white group-hover:scale-110 transition-transform origin-left">
              {/* This is a placeholder/mock value since calculation is complex for deep dashboard, 
                  but we'll show something dynamic if possible or just the link */}
              💰 Detail
            </h3>
          </div>
          <p className="text-slate-500 text-xs font-bold mt-4 uppercase tracking-widest">Klikni pro přehled →</p>
        </div>

      </section>

      {isLoggingWork && (
        <TimeRecordForm onClose={() => setIsLoggingWork(false)} />
      )}
    </div>
  );
};

export default Dashboard;