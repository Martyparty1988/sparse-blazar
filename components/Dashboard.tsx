
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
import WorkersIcon from './icons/WorkersIcon';
import RedoIcon from './icons/RedoIcon';
import { soundService } from '../services/soundService';
import usePullToRefresh from '../hooks/usePullToRefresh';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../contexts/ToastContext';

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
    className={`flex flex-col items-start p-6 rounded-2xl bg-slate-900/40 backdrop-blur-xl transition-all group hover:scale-[1.03] active:scale-95 border border-white/5 shadow-2xl relative overflow-hidden h-full min-h-[160px] touch-manipulation`}
  >
    <div className={`absolute top-0 left-0 w-full h-1.5 opacity-50 ${color}`}></div>
    <div className="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 transition-opacity scale-150 rotate-12">
      {icon}
    </div>
    {badge && (
      <div className="absolute top-4 right-4 bg-indigo-500 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg z-10">
        {badge}
      </div>
    )}
    <div className={`mb-4 p-3 rounded-xl bg-white/5 text-white group-hover:bg-white/10 transition-all ring-1 ring-white/10`}>
      {icon}
    </div>
    <h3 className="text-md font-black uppercase italic tracking-tighter text-white mb-2 leading-none">{label}</h3>
    {desc && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-left leading-tight group-hover:text-slate-300 transition-colors">{desc}</p>}
  </button>
);

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isLoggingWork, setIsLoggingWork] = useState(false);

  const handleDataRefresh = async () => {
    try {
      await firebaseService.synchronize();
      showToast('Data byla obnovena', 'success');
    } catch (error) {
      console.error("Failed to refresh data:", error);
      showToast('Nepodařilo se obnovit data', 'error');
    }
  };

  const { isRefreshing } = usePullToRefresh({ onRefresh: handleDataRefresh });

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
    <div className="space-y-6 md:space-y-8 pb-32 animate-fade-in mx-auto">

      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isRefreshing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
        <div className="bg-indigo-600 text-white rounded-full p-2 shadow-lg">
          <RedoIcon className="w-5 h-5 animate-spin" />
        </div>
      </div>

      <header className="pt-2 md:pt-8 mb-2">
        <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
          Vítejte, {user?.name}!
        </h1>
        <p className="text-slate-400 text-sm">Zde je přehled vašeho dnešního dne.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <button
            onClick={() => {
              soundService.playClick();
              setIsLoggingWork(true);
            }}
            className="w-full h-full relative group overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 shadow-[0_10px_40px_-10px_rgba(79,70,229,0.5)] active:scale-[0.98] transition-all border border-indigo-400/20 touch-manipulation"
          >
            <div className="absolute -right-8 -bottom-8 opacity-20 rotate-12 scale-150 text-black mix-blend-overlay">
              <ClockIcon className="w-40 h-40" />
            </div>
            <div className="relative z-10 flex flex-col items-start gap-2">
              <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter leading-none mb-1 drop-shadow-lg">Zapsat Práci</h2>
              <p className="text-indigo-100 text-xs font-bold uppercase tracking-wide opacity-90">Log your daily progress</p>
            </div>
          </button>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><ChartBarIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>
          <p className={`text-4xl font-black text-emerald-400 mb-1 group-hover:scale-110 transition-transform origin-left ${installedTodayCount === 0 ? 'opacity-30' : 'opacity-100'}`}>
            {installedTodayCount}
          </p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('installed_today')}</p>
        </div>
        <div className="bg-slate-900/40 backdrop-blur-xl p-5 rounded-2xl border border-white/5 relative overflow-hidden group shadow-lg">
          <div className="absolute right-0 top-0 opacity-5 p-4"><ClockIcon className="w-16 h-16 -rotate-12 translate-x-4 -translate-y-4" /></div>
          <p className={`text-4xl font-black text-indigo-400 mb-1 group-hover:scale-110 transition-transform origin-left ${activeSessionsCount === 0 ? 'opacity-30' : 'opacity-100'}`}>
            {activeSessionsCount}
          </p>
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">{t('on_shift')}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <ActionTile icon={<MapIcon />} label={t('plan')} desc="FIELD MAP" onClick={() => navigate('/field-plans')} color="bg-cyan-500" />
        <ActionTile icon={<CalendarIcon />} label={t('attendance')} desc="HISTORY" onClick={() => navigate('/attendance')} color="bg-amber-500" />
        <ActionTile icon={<ChartBarIcon />} label="Stats" desc="ANALYTICS" onClick={() => navigate('/stats')} color="bg-blue-500" />
        <ActionTile icon={<ProjectsIcon />} label={t('projects')} desc="MANAGEMENT" onClick={() => navigate('/projects')} color="bg-emerald-500" />
      </section>

      <div className="block md:hidden">
        <Leaderboard />
      </div>

      {isLoggingWork && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in user-select-none">
          <div className="w-full max-w-lg bg-[#0f172a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col relative animate-slide-up sm:animate-none">
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
