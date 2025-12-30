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

const ActionTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
  desc?: string;
}> = ({ icon, label, onClick, color, desc }) => (
  <button
    onClick={onClick}
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

      </section>

      {isLoggingWork && (
        <TimeRecordForm onClose={() => setIsLoggingWork(false)} />
      )}
    </div>
  );
};

export default Dashboard;