import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import TimeRecordForm from './TimeRecordForm';

import Leaderboard from './Leaderboard';

// Icons
import ProjectsIcon from './icons/ProjectsIcon';
import ClockIcon from './icons/ClockIcon';
import MapIcon from './icons/MapIcon';
import CalendarIcon from './icons/CalendarIcon';
import ChartBarIcon from './icons/ChartBarIcon';
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
    className={`flex flex-col items-start p-6 rounded-[2rem] bg-slate-900/40 backdrop-blur-xl transition-all group hover:scale-[1.03] active:scale-95 border border-white/5 shadow-2xl relative overflow-hidden h-full min-h-[140px] touch-manipulation`}
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
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  // Data Queries
  const activeProjectsCount = useLiveQuery(() => db.projects.where('status').equals('active').count(), [], 0) ?? 0;
  const activeSessions = useLiveQuery(() => db.attendanceSessions.toArray(), [], []);
  const workersCount = useLiveQuery(() => db.workers.count(), [], 0) ?? 0;
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
    <div className="space-y-6 md:space-y-8 pb-32 animate-fade-in max-w-[100vw] overflow-x-hidden mx-auto">

      {/* Dynamic Header & Command Strip */}
      <header className="pt-2 md:pt-12 mb-2 px-2">
        <div className="flex flex-col gap-2">

          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase pl-1">
            Dashboard
          </h1>
        </div>
      </header>

      {/* Prominent CTA - Quick Action */}
      <section className="px-2 md:px-0">
        <button
          onClick={() => setIsLoggingWork(true)}
          className="w-full relative group overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] active:scale-[0.98] transition-all border border-indigo-400/20"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-50"></div>
          <div className="absolute -right-8 -bottom-8 opacity-20 rotate-12 scale-150 text-black mix-blend-overlay">
            <ClockIcon className="w-40 h-40" />
          </div>

          <div className="relative z-10 flex flex-col items-start gap-4">
            <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Quick Action</span>
            </div>
            <div>
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-2 drop-shadow-lg">Zapsat Práci</h2>
              <p className="text-indigo-100 text-sm font-bold uppercase tracking-wide opacity-90">Log your daily progress</p>
            </div>
          </div>
        </button>
      </section>

      {/* Metrics Grid (2x2) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-2 md:px-0">
        {/* Active Projects */}
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><ProjectsIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>

          <div className="relative z-10">
            <p className={`text-4xl font-black text-white mb-1 group-hover:scale-110 transition-transform origin-left ${activeProjectsCount === 0 ? 'opacity-30' : 'opacity-100'}`}>
              {activeProjectsCount}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('active_projects')}</p>
          </div>
        </div>

        {/* On Shift */}
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><ClockIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-1">
              <p className={`text-4xl font-black text-indigo-400 mb-1 group-hover:scale-110 transition-transform origin-left ${activeSessionsCount === 0 ? 'opacity-30' : 'opacity-100'}`}>
                {activeSessionsCount}
              </p>
              {activeSessionsCount > 0 && <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>}
            </div>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('on_shift')}</p>
          </div>
        </div>

        {/* Installed Today */}
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><ChartBarIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>
          <div className="relative z-10">
            <p className={`text-4xl font-black text-emerald-400 mb-1 group-hover:scale-110 transition-transform origin-left ${installedTodayCount === 0 ? 'opacity-30' : 'opacity-100'}`}>
              {installedTodayCount}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('installed_today')}</p>
          </div>
        </div>

        {/* Team Size - Always prominent */}
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><WorkersIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>
          <div className="relative z-10">
            <p className="text-4xl font-black text-slate-200 mb-1 group-hover:scale-110 transition-transform origin-left text-shadow-sm">{workersCount}</p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('team_size')}</p>
          </div>
        </div>
      </section>

      {/* Secondary Actions Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 px-2 md:px-0">
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
        {/* Stats - Visible on Mobile too for quick access */}
        <ActionTile
          icon={<ChartBarIcon className="w-8 h-8" />}
          label="Stats"
          desc="ANALYTICS"
          onClick={() => navigate('/stats')}
          color="bg-blue-500"
        />

        {/* Desktop Only Extra Tiles */}
        <div className="hidden md:block h-full">
          <ActionTile
            icon={<ProjectsIcon className="w-8 h-8" />}
            label={t('projects')}
            desc="MANAGEMENT"
            onClick={() => navigate('/projects')}
            color="bg-emerald-500"
            badge={activeProjectsCount > 0 ? activeProjectsCount : undefined}
          />
        </div>
      </section>

      {/* Desktop Only: Leaderboard below */}
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