
import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    XAxis,
    YAxis,
    Tooltip,
    BarChart,
    Bar
} from 'recharts';
import BackButton from './BackButton';
import ClockIcon from './icons/ClockIcon';
import MapIcon from './icons/MapIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import ProjectsIcon from './icons/ProjectsIcon';

const TABLE_POWER = 19.6; // kWp per string/table unit

const WorkerDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useI18n();
    const { user } = useAuth();
    const navigate = useNavigate();
    const workerId = Number(id);

    const worker = useLiveQuery(() => db.workers.get(workerId), [workerId]);
    const records = useLiveQuery(() => db.records.where('workerId').equals(workerId).toArray(), [workerId]);
    const tasks = useLiveQuery(() => db.projectTasks.where('assignedWorkerId').equals(workerId).toArray(), [workerId]);
    const tables = useLiveQuery(() => db.fieldTables.toArray()); // We need all to filter by completion and possibly worker participation
    const projects = useLiveQuery(() => db.projects.toArray());

    const stats = useMemo(() => {
        if (!worker || !records || !tables || !projects) return null;

        const pMap = new Map(projects.map(p => [p.id, p]));

        // Calculate Total Hours
        let totalHours = 0;
        records.forEach(r => {
            const dur = (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000;
            totalHours += dur;
        });

        // Calculate Total kWp (from completed tables assigned to this worker's projects)
        // Note: Our current schema doesn't strictly link a table completion to a SPECIFIC worker 
        // if multiple workers are on a project, but we can approximate or use task-based logic if available.
        // For now, let's look at tasks and manual time records that mention tables.

        const workerTasks = tasks || [];
        const taskEarnings = workerTasks.reduce((sum, task) => sum + task.price, 0);
        const hourlyEarnings = totalHours * worker.hourlyRate;

        // Performance over time (last 30 days)
        const last30Days = Array.from({ length: 30 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (29 - i));
            const dateStr = d.toDateString();

            const dayHours = records
                .filter(r => new Date(r.startTime).toDateString() === dateStr)
                .reduce((sum, r) => sum + (new Date(r.endTime).getTime() - new Date(r.startTime).getTime()) / 3600000, 0);

            return {
                date: d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
                hours: Number(dayHours.toFixed(2)),
                fullDate: dateStr
            };
        });

        return {
            totalHours,
            hourlyEarnings,
            taskEarnings,
            totalEarnings: hourlyEarnings + taskEarnings,
            efficiency: totalHours > 0 ? (hourlyEarnings + taskEarnings) / totalHours : 0,
            chartData: last30Days
        };
    }, [worker, records, tasks, tables, projects]);

    if (!worker) return <div className="p-20 text-center text-white/50 uppercase font-black tracking-widest animate-pulse">Načítám profil...</div>;

    return (
        <div className="space-y-12 pb-32 animate-page-enter">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div className="flex items-center gap-6">
                    <BackButton />
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Profil pracovníka</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white italic tracking-tighter uppercase leading-none">
                            {worker.name}<span className="text-indigo-500 font-normal">.</span>
                        </h1>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-end">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Hodinová sazba</span>
                        <span className="text-xl font-black text-white italic">€{worker.hourlyRate.toFixed(2)}</span>
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <ClockIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('hours_worked')}</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">{stats?.totalHours.toFixed(1)}h</p>
                    </div>
                </div>

                <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <ChartBarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('earnings')}</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">€{stats?.totalEarnings.toLocaleString()}</p>
                    </div>
                </div>

                <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                        <ChartBarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{t('efficiency')}</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">€{stats?.efficiency.toFixed(2)}<span className="text-xs">/h</span></p>
                    </div>
                </div>

                <div className="glass-dark p-8 rounded-[2.5rem] border border-white/5 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <ProjectsIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Projekty</p>
                        <p className="text-4xl font-black text-white italic tracking-tighter">{worker.projectIds?.length || 0}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Performance Chart */}
                <div className="lg:col-span-2 glass-dark rounded-[3rem] p-10 border border-white/5 space-y-8">
                    <div className="flex justify-between items-center">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Pracovní vytížení</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Posledních 30 dní (Hodin/den)</p>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.chartData}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                    interval={2}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="#6366f1"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorHours)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Rates Card */}
                <div className="glass-dark rounded-[3rem] p-10 border border-white/5 space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                        <ChartBarIcon className="w-40 h-40" />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Sazebník</h3>
                    <div className="space-y-6 relative z-10">
                        <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cena / Panel</span>
                            <span className="text-xl font-black text-indigo-400 italic">€{worker.panelPrice}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cena / String</span>
                            <span className="text-xl font-black text-indigo-400 italic">€{worker.stringPrice}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cena / Metr</span>
                            <span className="text-xl font-black text-indigo-400 italic">€{worker.meterPrice}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-dark rounded-[3rem] p-10 border border-white/5 space-y-8">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Poslední aktivita</h3>
                <div className="space-y-4">
                    {records?.slice(-5).reverse().map((record, i) => (
                        <div key={record.id} className="flex items-center gap-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-all">
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <ClockIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-white italic uppercase">{record.description}</p>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    {new Date(record.startTime).toLocaleDateString()} • {new Date(record.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(record.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-white italic tracking-tighter">
                                    {((new Date(record.endTime).getTime() - new Date(record.startTime).getTime()) / 3600000).toFixed(1)}h
                                </p>
                            </div>
                        </div>
                    ))}
                    {!records?.length && <p className="text-center py-10 text-slate-600 font-bold uppercase tracking-widest text-xs">Žádné záznamy o práci</p>}
                </div>
            </div>
        </div>
    );
};

export default WorkerDetail;
