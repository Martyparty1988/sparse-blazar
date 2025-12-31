import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import TimeRecordForm from './TimeRecordForm';
import SyncStatusIndicator from './SyncStatusIndicator';
import Leaderboard from './Leaderboard';

// Icons
import ProjectsIcon from './icons/ProjectsIcon';
import ClockIcon from './icons/ClockIcon';
import MapIcon from './icons/MapIcon';
import CalendarIcon from './icons/CalendarIcon';
import PlusIcon from './icons/PlusIcon';
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
  badge?: string | number;
}> = ({ icon, label, onClick, color, desc, badge }) => (
  <button
    onClick={() => {
      soundService.playClick();
      onClick();
    }}
    className={`flex flex-col items-start p-6 rounded-[2.5rem] bg-slate-900/40 backdrop-blur-xl transition-all group hover:scale-[1.03] active:scale-95 border border-white/5 shadow-2xl relative overflow-hidden h-full min-h-[160px] touch-manipulation`}
  >
    {/* Decorative Accent */}
    <div className={`absolute top-0 left-0 w-full h-1.5 opacity-50 ${color}`}></div>

    <div className="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 transition-opacity scale-150 rotate-12">
      {icon}
    </div>

    {badge && (
      <div className="absolute top-4 right-4 bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg z-10 animate-bounce">
        {badge}
      </div>
    )}

    <div className={`mb-4 p-3 rounded-2xl bg-white/5 text-white group-hover:bg-white group-hover:text-black transition-all ring-1 ring-white/10`}>
      {icon}
    </div>
    <h3 className="text-lg font-black uppercase italic tracking-tighter text-white mb-2 leading-none">{label}</h3>
    {desc && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-left leading-tight group-hover:text-slate-300 transition-colors">{desc}</p>}
  </button>
);

const Dashboard: React.FC = () => {
  const { user, currentUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  // Data Queries
  const activeProjectsCount = useLiveQuery(() => db.projects.where('status').equals('active').count(), [], 0) ?? 0;
  const activeSessions = useLiveQuery(() => db.attendanceSessions.toArray(), [], []);
  const workersCount = useLiveQuery(() => db.workers.count(), [], 0) ?? 0;
  const toolsCount = useLiveQuery(() => db.tools.count(), [], 0) ?? 0;
  const pendingTasksCount = useLiveQuery(() => db.projectTasks.filter(t => !t.completionDate).count(), [], 0) ?? 0;
  const installedTodayCount = useLiveQuery(() =>
    db.fieldTables
      .where('status').equals('completed')
      .filter(t => {
        if (!t.completedAt) return false;
        const compDate = new Date(t.completedAt).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        return compDate === today;
      })
      .count(),
    [], 0) ?? 0;

  const activeSessionsCount = activeSessions?.length || 0;

  return (
    <div className="space-y-8 pb-32 animate-fade-in max-w-7xl mx-auto px-4 md:px-0">

      {/* Dynamic Header & Command Strip */}
      <header className="pt-6 md:pt-12 mb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <SyncStatusIndicator />
            <div className="h-4 w-px bg-white/10"></div>
            <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
            Dashboard
          </h1>
        </div>
      </header>

      {/* Prominent CTA for Mobile */}
      <section className="md:hidden">
        <button
          onClick={() => setIsLoggingWork(true)}
          className="w-full relative group overflow-hidden rounded-[2rem] bg-indigo-600 p-8 shadow-2xl shadow-indigo-900/50 active:scale-[0.98] transition-all"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 to-transparent opacity-50"></div>
          <div className="absolute -right-6 -bottom-6 opacity-20 rotate-12 scale-150 text-black">
            <ClockIcon className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col items-start">
            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest text-white mb-3 shadow-sm border border-white/10">Quick Action</span>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none mb-1">Zapsat Práci</h2>
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wide opacity-80">Log your daily progress</p>
          </div>
        </button>
      </section>

      {/* Hero Analytics - 2 Column Grid for Mobile */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-10 p-4"><ProjectsIcon className="w-12 h-12 rotate-12" /></div>
          <p className="text-4xl font-black text-white mb-1 group-hover:scale-110 transition-transform origin-left">{activeProjectsCount}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('active_projects')}</p>
          <div className="w-8 h-1 bg-indigo-500/50 rounded-full mt-3"></div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-10 p-4"><ClockIcon className="w-12 h-12 rotate-12" /></div>
          <div className="flex items-baseline gap-1">
            <p className="text-4xl font-black text-indigo-400 mb-1 group-hover:scale-110 transition-transform origin-left">{activeSessionsCount}</p>
            {activeSessionsCount > 0 && <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>}
          </div>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('on_shift')}</p>
          <div className="w-8 h-1 bg-indigo-500/50 rounded-full mt-3"></div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-10 p-4 text-emerald-500"><ChartBarIcon className="w-12 h-12 rotate-12" /></div>
          <p className="text-4xl font-black text-emerald-400 mb-1 group-hover:scale-110 transition-transform origin-left">
            {installedTodayCount}
          </p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('installed_today')}</p>
          <div className="w-8 h-1 bg-emerald-500/50 rounded-full mt-3"></div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-10 p-4"><WorkersIcon className="w-12 h-12 rotate-12" /></div>
          <p className="text-4xl font-black text-slate-200 mb-1 group-hover:scale-110 transition-transform origin-left">{workersCount}</p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('team_size')}</p>
          <div className="w-8 h-1 bg-slate-500/50 rounded-full mt-3"></div>
        </div>
      </section>

      {/* Main Grid Actions - Tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <ActionTile
          icon={<ProjectsIcon className="w-8 h-8" />}
          label={t('projects')}
          desc="MANAGEMENT"
          onClick={() => navigate('/projects')}
          color="bg-emerald-500"
          badge={activeProjectsCount > 0 ? activeProjectsCount : undefined}
        />
        <ActionTile
          icon={<MapIcon className="w-8 h-8" />}
          label={t('plan')}
          desc="FIELD MAP"
          onClick={() => navigate('/field-plans')}
          color="bg-cyan-500"
        />
        <ActionTile
          icon={<CalendarIcon className="w-8 h-8" />}
          label={t('attendance')}
          desc="HISTORY"
          onClick={() => navigate('/attendance')}
          color="bg-amber-500"
          badge={activeSessionsCount > 0 ? activeSessionsCount : undefined}
        />
        <ActionTile
          icon={<ChatIcon className="w-8 h-8" />}
          label="Chat"
          desc="TEAM"
          onClick={() => navigate('/chat')}
          color="bg-pink-500"
        />
        <ActionTile
          icon={<ChartBarIcon className="w-8 h-8" />}
          label="Stats"
          desc="ANALYTICS"
          onClick={() => navigate('/stats')}
          color="bg-blue-500"
        />
        <ActionTile
          icon={<SettingsIcon className="w-8 h-8" />}
          label={t('settings')}
          desc="SYSTEM"
          onClick={() => navigate('/settings')}
          color="bg-slate-500"
        />
      </section>

      {/* Desktop Only: Leaderboard */}
      <div className="hidden md:block">
        <Leaderboard />
      </div>

      {isLoggingWork && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in user-select-none">
          <div className="w-full max-w-lg bg-[#0f172a] rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative animate-slide-up sm:animate-none">
            <button onClick={() => setIsLoggingWork(false)} className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white z-50">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="overflow-y-auto custom-scrollbar flex-1">
              <TimeRecordForm onClose={() => setIsLoggingWork(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;