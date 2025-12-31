
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import TimeRecordForm from './TimeRecordForm';
import Leaderboard from './Leaderboard';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

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

const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
}> = ({ label, value, icon, color, trend }) => (
  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-6 rounded-[2rem] relative overflow-hidden group shadow-xl transition-all hover:scale-[1.02]">
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 ${color}`}></div>
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-white group-hover:scale-110 transition-transform">
        {icon}
      </div>
      {trend && (
        <span className="text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-lg uppercase tracking-tight">
          {trend}
        </span>
      )}
    </div>
    <p className="text-3xl font-black text-white italic tracking-tighter mb-1">{value}</p>
    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</p>
  </div>
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
  const stats = useLiveQuery(async () => {
    const projects = await db.projects.toArray();
    const tables = await db.fieldTables.toArray();
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedTablesToday = tables.filter(t => {
      if (!t.completedAt) return false;
      const compDate = new Date(t.completedAt).toDateString();
      const today = new Date().toDateString();
      return compDate === today;
    }).length;

    // Generate mini chart data for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateStr = d.toDateString();
      const count = tables.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === dateStr).length;
      return { name: d.toLocaleDateString('cs-CZ', { weekday: 'short' }), count };
    });

    return { activeProjects, completedTablesToday, last7Days, totalTables: tables.length, completedTables: tables.filter(t => t.status === 'completed').length };
  }, [], { activeProjects: 0, completedTablesToday: 0, last7Days: [], totalTables: 0, completedTables: 0 });

  return (
    <div className="space-y-8 pb-32 animate-fade-in relative">

      {/* Pull to refresh UI */}
      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isRefreshing ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-10 scale-90 pointer-events-none'}`}>
        <div className="bg-indigo-600/90 backdrop-blur-xl text-white rounded-full p-4 shadow-[0_10px_40px_rgba(79,70,229,0.4)] border border-indigo-400/20">
          <RedoIcon className="w-6 h-6 animate-spin" />
        </div>
      </div>

      <header className="flex flex-col md:flex-row justify-between items-end gap-6 pt-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="h-0.5 w-8 bg-indigo-500 rounded-full"></span>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Dashboard Overview</span>
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
            Vítejte, {user?.username || 'Marty'}<span className="text-indigo-500">!</span>
          </h1>
        </div>

        <button
          onClick={() => setIsLoggingWork(true)}
          className="group relative px-8 py-4 bg-indigo-600 rounded-2xl font-black text-white uppercase tracking-widest shadow-[0_10px_30px_-5px_rgba(79,70,229,0.5)] active:scale-95 transition-all overflow-hidden"
        >
          <div className="relative z-10 flex items-center gap-3">
            <ClockIcon className="w-5 h-5" />
            Zapsat Práci
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
        </button>
      </header>

      {/* KPI Section */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard label="Aktivní Projekty" value={stats.activeProjects} icon={<ProjectsIcon className="w-6 h-6" />} color="bg-blue-500" />
        <KPICard label="Dnešní Pokrok" value={stats.completedTablesToday} icon={<ChartBarIcon className="w-6 h-6" />} color="bg-emerald-500" trend="+12%" />
        <KPICard label="Celková Hotovost" value={`${Math.round((stats.completedTables / (stats.totalTables || 1)) * 100)}%`} icon={<CalendarIcon className="w-6 h-6" />} color="bg-amber-500" />
        <div className="hidden lg:block">
          <KPICard label="Pracovníci" value={user?.role === 'admin' ? '8 +' : 'Tým A'} icon={<WorkersIcon className="w-6 h-6" />} color="bg-indigo-500" />
        </div>
      </section>

      {/* Charts & Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Activity */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tight">Týdenní Aktivita</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Počet dokončených stolů</p>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[9px] font-black text-white uppercase">Live</span>
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.last7Days}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                  itemStyle={{ color: '#fff', fontSize: 12, fontWeight: 900 }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#6366f1"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em] px-2 mb-2">Rychlé Odkazy</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <button
              onClick={() => navigate('/field-plans')}
              className="flex items-center gap-4 p-5 bg-gradient-to-r from-slate-900/40 to-slate-800/20 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all group group shadow-lg"
            >
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform"><MapIcon className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-tight">{t('plan')}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Interactive Maps</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/attendance')}
              className="flex items-center gap-4 p-5 bg-gradient-to-r from-slate-900/40 to-slate-800/20 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all group shadow-lg"
            >
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 group-hover:scale-110 transition-transform"><CalendarIcon className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-tight">{t('attendance')}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">History Log</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/stats')}
              className="flex items-center gap-4 p-5 bg-gradient-to-r from-slate-900/40 to-slate-800/20 rounded-2xl border border-white/5 hover:border-blue-500/30 transition-all group shadow-lg"
            >
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 group-hover:scale-110 transition-transform"><ChartBarIcon className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-tight">Stats</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detailed Analytics</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-4 p-5 bg-gradient-to-r from-slate-900/40 to-slate-800/20 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-all group shadow-lg"
            >
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform"><ProjectsIcon className="w-6 h-6" /></div>
              <div className="text-left">
                <p className="text-xs font-black text-white uppercase tracking-tight">{t('projects')}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Overview</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Leaderboard Section (Visible on all but small mobiles) */}
      <div className="mt-8">
        <Leaderboard />
      </div>

      {/* Work Entry Modal */}
      {isLoggingWork && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl animate-fade-in"
            onClick={() => setIsLoggingWork(false)}
          ></div>
          <div className="w-full max-w-lg bg-[#0f172a] rounded-[2.5rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden max-h-[90vh] flex flex-col relative animate-slide-up z-10">
            <div className="p-6 border-b border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-white italic uppercase tracking-tight">Zapsat Práci</h2>
              <button onClick={() => setIsLoggingWork(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar flex-1 p-6">
              <TimeRecordForm onClose={() => setIsLoggingWork(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
