
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Project, Worker, FieldTable } from '../types';
import BackButton from './BackButton';

// Power constants for different table types (in kWp)
const TABLE_POWER = {
    small: 0.5,   // 0.5 kWp
    medium: 1.0,  // 1.0 kWp
    large: 1.5    // 1.5 kWp
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="p-4 bg-black/80 backdrop-blur-md rounded-xl border border-white/20 shadow-lg">
                <p className="label font-bold text-white mb-2">{`${label}`}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.fill || pld.stroke }} className="text-sm">
                        {`${pld.name}: ${pld.value.toFixed(2)} ${pld.unit || ''}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const StatsPage: React.FC = () => {
    const { t } = useI18n();
    const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');

    const projects = useLiveQuery(() => db.projects.toArray());
    const workers = useLiveQuery(() => db.workers.toArray());
    const allFieldTables = useLiveQuery(() =>
        selectedProjectId
            ? db.fieldTables.where('projectId').equals(selectedProjectId).toArray()
            : []
        , [selectedProjectId]);

    const selectedProject = useMemo(() =>
        projects?.find(p => p.id === selectedProjectId),
        [projects, selectedProjectId]
    );

    // Calculate statistics
    const stats = useMemo(() => {
        if (!allFieldTables || !workers) {
            return null;
        }

        // Total kWp calculation
        const totalKWp = allFieldTables.reduce((sum, table) => {
            return sum + TABLE_POWER[table.tableType];
        }, 0);

        const completedTables = allFieldTables.filter(t => t.status === 'completed');
        const installedKWp = completedTables.reduce((sum, table) => {
            return sum + TABLE_POWER[table.tableType];
        }, 0);

        // Status distribution
        const pendingCount = allFieldTables.filter(t => t.status === 'pending').length;
        const completedCount = completedTables.length;

        const statusData = [
            { name: 'Hotovo', value: completedCount, color: '#10b981' },
            { name: 'Plán', value: pendingCount, color: '#6b7280' }
        ];

        // Worker performance (tables + kWp)
        const workerPerformance: { [key: string]: { tables: number; kWp: number; color: string } } = {};

        workers.forEach(w => {
            workerPerformance[w.name] = {
                tables: 0,
                kWp: 0,
                color: w.color || '#3b82f6'
            };
        });

        completedTables.forEach(table => {
            if (table.assignedWorkers && table.assignedWorkers.length > 0) {
                table.assignedWorkers.forEach(workerId => {
                    const worker = workers.find(w => w.id === workerId);
                    if (worker) {
                        workerPerformance[worker.name].tables += 1;
                        workerPerformance[worker.name].kWp += TABLE_POWER[table.tableType];
                    }
                });
            }
        });

        const workerPerfData = Object.entries(workerPerformance)
            .map(([name, data]) => ({ name, ...data }))
            .filter(d => d.tables > 0)
            .sort((a, b) => b.kWp - a.kWp);

        // Daily progress (last 30 days)
        const dailyProgress: { [key: string]: number } = {};
        const today = new Date();

        // Initialize last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyProgress[dateStr] = 0;
        }

        // Calculate cumulative kWp per day
        completedTables.forEach(table => {
            if (table.completedAt) {
                const dateStr = new Date(table.completedAt).toISOString().split('T')[0];
                if (dailyProgress.hasOwnProperty(dateStr)) {
                    dailyProgress[dateStr] += TABLE_POWER[table.tableType];
                }
            }
        });

        // Convert to cumulative
        let cumulative = 0;
        const dailyProgressData = Object.entries(dailyProgress).map(([date, kWp]) => {
            cumulative += kWp;
            return {
                date: new Date(date).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' }),
                kWp: cumulative
            };
        });

        // Active team count (workers who completed at least one table)
        const activeWorkers = new Set<number>();
        completedTables.forEach(table => {
            if (table.assignedWorkers) {
                table.assignedWorkers.forEach(wId => activeWorkers.add(wId));
            }
        });

        // Average kWp per day (only counting days with work)
        const daysWithWork = Object.values(dailyProgress).filter(kWp => kWp > 0).length;
        const avgKWpPerDay = daysWithWork > 0 ? installedKWp / daysWithWork : 0;

        // Work type progress (K-P-C) - simulated for now
        // In real scenario, you'd track construction, paneling, cabling separately
        const workTypeProgress = {
            construction: (completedCount / allFieldTables.length) * 100 || 0,
            paneling: (completedCount / allFieldTables.length) * 85 || 0, // Simulated
            cabling: (completedCount / allFieldTables.length) * 70 || 0  // Simulated
        };

        return {
            totalKWp,
            installedKWp,
            statusData,
            workerPerfData,
            dailyProgressData,
            activeTeamCount: activeWorkers.size,
            avgKWpPerDay,
            workTypeProgress,
            totalTables: allFieldTables.length,
            completedCount,
            pendingCount
        };
    }, [allFieldTables, workers]);

    return (
        <div className="space-y-10 md:space-y-16 pb-32">
            <div className="md:hidden">
                <BackButton />
            </div>

            {/* Header Section */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div className="space-y-4">
                    <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl" style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}>
                        {t('statistics')}<span className="text-cyan-500">.</span>
                    </h1>
                    <p className="text-slate-400 font-bold tracking-tight max-w-2xl border-l-4 border-cyan-500 pl-4 py-1 uppercase" style={{ fontSize: 'clamp(14px, 4vw, 18px)' }}>
                        {t('statistics_dashboard_desc') || "Analýza výkonu a technologického postupu."}
                    </p>
                </div>

                <div className="w-full lg:w-96 relative group">
                    <div className="absolute inset-0 bg-cyan-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                        className="relative w-full p-5 bg-white/5 text-white border border-white/10 rounded-[2rem] focus:ring-2 focus:ring-cyan-500 focus:outline-none text-lg font-black uppercase tracking-widest backdrop-blur-3xl appearance-none cursor-pointer [&>option]:bg-slate-900 transition-all shadow-xl"
                    >
                        <option value="" disabled>{t('select_project') || "Vyberte projekt"}</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </header>

            {selectedProjectId && stats ? (
                <div className="space-y-12 animate-fade-in">
                    {/* KPI Cards: Premium Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                        {/* Total Installed kWp */}
                        <div className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/10 hover:scale-[1.02]">
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('total_installed') || "Instalováno celkem"}</h3>
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-white tracking-tighter italic">
                                            {stats.installedKWp.toFixed(1)}
                                        </span>
                                        <span className="text-xl font-black text-emerald-500 tracking-widest uppercase">kWp</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">
                                        {t('target') || "Cíl"}: <span className="text-white">{stats.totalKWp.toFixed(1)} kWp</span>
                                    </p>
                                </div>
                                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-600 to-green-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${(stats.installedKWp / stats.totalKWp) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Active Team */}
                        <div className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/10 hover:scale-[1.02]">
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('active_team') || "Aktivní tým"}</h3>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white tracking-tighter italic">
                                        {stats.activeTeamCount}
                                    </span>
                                    <span className="text-xl font-black text-blue-400 tracking-widest uppercase">{t('workers')}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter">?</div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        {stats.completedCount} {t('tables_completed') || "dokončených stolů"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Average per Day */}
                        <div className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/10 hover:scale-[1.02]">
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-purple-500/20 rounded-2xl text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{t('average_daily') || "Průměr za den"}</h3>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white tracking-tighter italic">
                                        {stats.avgKWpPerDay.toFixed(1)}
                                    </span>
                                    <span className="text-xl font-black text-purple-400 tracking-widest uppercase">kWp/d</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">
                                    {t('daily_performance_avg') || "Průměrná efektivita dne"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-10">
                        {/* Daily Progress - Line Chart */}
                        <div className="xl:col-span-2 group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.08]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('daily_progress')}</h2>
                                    </div>
                                    <p className="text-white font-bold opacity-60 text-xs ml-3.5 italic uppercase tracking-wider">{t('last_30_days') || "Posledních 30 dní vývoje"}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-black/20 px-4 py-2 rounded-xl border border-white/5">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Status:</span>
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none animate-pulse">{t('live_tracking') || "Live Tracking"}</span>
                                </div>
                            </div>

                            {stats.dailyProgressData.length > 0 ? (
                                <div className="relative h-[400px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stats.dailyProgressData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                            <defs>
                                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                                unit="kWp"
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(16,185,129,0.2)', strokeWidth: 2 }} />
                                            <Line
                                                type="monotone"
                                                dataKey="kWp"
                                                stroke="#10b981"
                                                strokeWidth={4}
                                                dot={{ fill: '#10b981', strokeWidth: 2, r: 6, stroke: '#0f172a' }}
                                                activeDot={{ r: 8, fill: '#fff', stroke: '#10b981', strokeWidth: 4 }}
                                                fill="url(#lineGradient)"
                                                animationDuration={2000}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[350px] flex items-center justify-center opacity-40 italic font-bold text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>

                        {/* Worker Performance - Bar Chart */}
                        <div className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.08]">
                            <div className="space-y-1 mb-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('worker_performance')}</h2>
                                </div>
                                <p className="text-white font-bold opacity-60 text-xs ml-3.5 italic uppercase tracking-wider">{t('top_workers_desc') || "Nejvýkonnější pracovníci podle kWp"}</p>
                            </div>

                            {stats.workerPerfData.length > 0 ? (
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.workerPerfData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar
                                                yAxisId="left"
                                                dataKey="tables"
                                                name={t('tables') || "Stoly"}
                                                fill="#3b82f6"
                                                radius={[8, 8, 0, 0]}
                                                barSize={30}
                                            />
                                            <Bar
                                                yAxisId="right"
                                                dataKey="kWp"
                                                name="kWp"
                                                fill="#10b981"
                                                radius={[8, 8, 0, 0]}
                                                barSize={30}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center opacity-40 italic font-bold text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>

                        {/* Status Distribution - Pie Chart */}
                        <div className="group relative overflow-hidden p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.08]">
                            <div className="space-y-1 mb-10">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
                                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">{t('status_distribution')}</h2>
                                </div>
                                <p className="text-white font-bold opacity-60 text-xs ml-3.5 italic uppercase tracking-wider">{t('overall_completion_status') || "Celkový stav dokončení projektu"}</p>
                            </div>

                            {stats.totalTables > 0 ? (
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.statusData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={120}
                                                innerRadius={80}
                                                paddingAngle={8}
                                                dataKey="value"
                                                animationDuration={1500}
                                            >
                                                {stats.statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center opacity-40 italic font-bold text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>
                    </div>

                    {/* Work Type Progress Bars: Premium Tile */}
                    <div className="group relative overflow-hidden p-10 bg-white/5 backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.08]">
                        <div className="space-y-1 mb-12">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                                <h2 className="text-sm md:text-md font-black text-slate-500 uppercase tracking-[0.3em]">{t('work_type_progress')}</h2>
                            </div>
                            <p className="text-white font-bold opacity-60 text-xs ml-4 italic uppercase tracking-wider">{t('technological_milestones') || "Technologické milníky (Konstrukce / Panely / Kabely)"}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            {/* Construction (Konstrukce) */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Konstrukce (K)</span>
                                    <span className="text-xl font-black italic text-blue-400">{stats.workTypeProgress.construction.toFixed(0)}%</span>
                                </div>
                                <div className="h-4 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                                        style={{ width: `${stats.workTypeProgress.construction}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Paneling (Panely) */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Panely (P)</span>
                                    <span className="text-xl font-black italic text-purple-400">{stats.workTypeProgress.paneling.toFixed(0)}%</span>
                                </div>
                                <div className="h-4 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(168,85,247,0.3)]"
                                        style={{ width: `${stats.workTypeProgress.paneling}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Cabling (Kabely) */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kabely (C)</span>
                                    <span className="text-xl font-black italic text-amber-400">{stats.workTypeProgress.cabling.toFixed(0)}%</span>
                                </div>
                                <div className="h-4 bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                                        style={{ width: `${stats.workTypeProgress.cabling}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center p-16 bg-black/20 backdrop-blur-xl rounded-3xl border border-white/10">
                    <span className="text-6xl mb-4 block">📊</span>
                    <p className="text-2xl text-gray-300 font-semibold">Vyberte projekt pro zobrazení statistik</p>
                    <p className="text-gray-400 mt-2">Grafy a KPI se zobrazí po výběru projektu</p>
                </div>
            )}
        </div>
    );
};

export default StatsPage;
