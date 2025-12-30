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

  const activeSessionsCount = activeSessions?.length || 0;

  // AI Insights Logic
  const aiInsight = useMemo(() => {
    const hours = new Date().getHours();
    let greeting = t('ai_greeting', { name: currentUser?.name || user?.username || 'Admin' }).replace('{name}', currentUser?.name || user?.username || 'Admin');

    // Custom logic for summary
    let summary = t('ai_summary_fine');
    if (pendingTasksCount > 10) summary = t('ai_summary_issue');

    return { greeting, summary };
  }, [currentUser, user, t, pendingTasksCount]);

  // Mock Weather (In real app, fetch from OpenWeatherMap)
  const weather = {
    temp: '22°C',
    condition: t('condition_sunny'),
    icon: <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M16.243 17.657l.707.707M7.757 7.757l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-32 animate-fade-in max-w-7xl mx-auto px-4">

      {/* Dynamic Header & Command Strip */}
      <header className="pt-8 md:pt-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter italic leading-none flex items-baseline gap-2">
              MST<span className="text-indigo-500">.</span>CORE
            </h1>
            <div className="flex items-center gap-4 flex-wrap">
              <SyncStatusIndicator />
              <div className="h-4 w-px bg-white/10 hidden sm:block"></div>
              <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px]">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>

          {/* AI & Weather Quick Glance */}
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-4 gap-6 shadow-2xl items-center">
              <div className="flex items-center gap-4 pr-6 border-r border-white/10">
                <div className="p-3 bg-amber-500/10 rounded-2xl animate-pulse">
                  {weather.icon}
                </div>
                <div>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('weather')}</p>
                  <p className="text-xl font-black text-white italic">{weather.temp} <span className="text-[10px] text-slate-500 not-italic ml-1">{weather.condition}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/chat')}>
                <div className="p-3 bg-indigo-500/10 rounded-2xl group-hover:bg-indigo-500 group-hover:text-white transition-all text-indigo-400">
                  <BrainIcon className="w-8 h-8" />
                </div>
                <div className="max-w-[200px] hidden sm:block">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t('ai_mistr')}</p>
                  <p className="text-[11px] font-bold text-slate-300 leading-tight line-clamp-2">{aiInsight.greeting}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Analytics & Intelligence */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Stats Panel */}
        <div className="lg:col-span-8 bg-gradient-to-br from-indigo-600/10 to-transparent backdrop-blur-3xl rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group">
          <div className="absolute -bottom-20 -right-20 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity scale-150 rotate-12">
            <ChartBarIcon className="w-96 h-96" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                System Performance
              </h2>
              <button onClick={() => navigate('/stats')} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
                Detailní report →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
              <div className="space-y-2">
                <p className="text-6xl font-black text-white transition-transform hover:scale-110 origin-left cursor-default">{activeProjectsCount}</p>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('active_projects')}</p>
                  <div className="w-12 h-1 bg-indigo-500/30 rounded-full"></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-6xl font-black text-indigo-400 transition-transform hover:scale-110 origin-left cursor-default">{activeSessionsCount}</p>
                  {activeSessionsCount > 0 && <span className="w-3 h-3 bg-indigo-400 rounded-full animate-ping"></span>}
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('on_shift')}</p>
                  <div className="w-12 h-1 bg-indigo-400/30 rounded-full"></div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-6xl font-black text-emerald-400 transition-transform hover:scale-110 origin-left cursor-default">
                  {useLiveQuery(() => db.fieldTables.where('status').equals('completed').filter(t => t.completedAt && new Date(t.completedAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).count()) || 0}
                </p>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('installed_today')}</p>
                  <div className="w-12 h-1 bg-emerald-500/30 rounded-full"></div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-6xl font-black text-slate-200 transition-transform hover:scale-110 origin-left cursor-default">{workersCount}</p>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('team_size')}</p>
                  <div className="w-12 h-1 bg-slate-500/30 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Sidebar */}
        <div className="lg:col-span-4">
          <Leaderboard />
        </div>
      </section>

      {/* Main Grid Actions */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <ActionTile
          icon={<ClockIcon className="w-8 h-8" />}
          label={t('log_work')}
          desc={t('work_log_desc')}
          onClick={() => setIsLoggingWork(true)}
          color="bg-indigo-500"
        />
        <ActionTile
          icon={<ProjectsIcon className="w-8 h-8" />}
          label={t('projects')}
          desc={t('projects_desc')}
          onClick={() => navigate('/projects')}
          color="bg-emerald-500"
          badge={activeProjectsCount > 0 ? activeProjectsCount : undefined}
        />
        <ActionTile
          icon={<MapIcon className="w-8 h-8" />}
          label={t('plan')}
          desc={t('plan_desc')}
          onClick={() => navigate('/field-plans')}
          color="bg-cyan-500"
        />
        <ActionTile
          icon={<CalendarIcon className="w-8 h-8" />}
          label={t('attendance')}
          desc={t('attendance_desc')}
          onClick={() => navigate('/attendance')}
          color="bg-amber-500"
          badge={activeSessionsCount > 0 ? activeSessionsCount : undefined}
        />
        <ActionTile
          icon={<WrenchIcon className="w-8 h-8" />}
          label={t('tools')}
          desc={t('tools_desc')}
          onClick={() => navigate('/tools')}
          color="bg-slate-500"
          badge={toolsCount}
        />
        <ActionTile
          icon={<ChartBarIcon className="w-8 h-8" />}
          label={t('statistics')}
          desc={t('statistics_dashboard_desc')}
          onClick={() => navigate('/stats')}
          color="bg-purple-500"
        />
        <ActionTile
          icon={<DocumentTextIcon className="w-8 h-8" />}
          label={t('daily_report')}
          desc={t('daily_reports_desc')}
          onClick={() => navigate('/daily-reports')}
          color="bg-orange-500"
        />
        <ActionTile
          icon={<SettingsIcon className="w-8 h-8" />}
          label={t('settings')}
          desc={t('settings_desc')}
          onClick={() => navigate('/settings')}
          color="bg-gray-500"
        />
      </section>

      {/* Quick Access Floating Shift Banner (Mobile only) */}
      {activeSessions.some(s => s.workerId === currentUser?.workerId) && (
        <div className="fixed bottom-24 left-4 right-4 z-50 p-6 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-3xl shadow-2xl flex items-center justify-between group cursor-pointer animate-fade-in-up" onClick={() => navigate('/attendance')}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white">
              <ClockIcon className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <p className="text-white font-black uppercase tracking-tighter text-sm">Shift is Active</p>
              <p className="text-white/60 text-[8px] font-bold uppercase tracking-[0.2em]">Logged in as {currentUser?.name}</p>
            </div>
          </div>
          <p className="text-white font-black text-xs">GO TO SHIFT →</p>
        </div>
      )}

      {isLoggingWork && (
        <TimeRecordForm onClose={() => setIsLoggingWork(false)} />
      )}
    </div>
  );
};

export default Dashboard;