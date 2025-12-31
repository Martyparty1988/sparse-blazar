
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
// Based on 1 string = 19.6 kWp (0.0196 MWp)
const TABLE_POWER = {
    small: 19.6,   // 1 string
    medium: 29.4,  // 1.5 strings
    large: 39.2    // 2 strings
};

// String constants for different table types (for payment)
const TABLE_STRINGS = {
    small: 1,     // 1 string
    medium: 1.5,  // 1.5 strings
    large: 2      // 2 strings
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

        // Total Strings calculation (for payment)
        const totalStrings = allFieldTables.reduce((sum, table) => {
            return sum + TABLE_STRINGS[table.tableType];
        }, 0);

        const installedStrings = completedTables.reduce((sum, table) => {
            return sum + TABLE_STRINGS[table.tableType];
        }, 0);

        // Status distribution
        const pendingCount = allFieldTables.filter(t => t.status === 'pending').length;
        const completedCount = completedTables.length;

        const statusData = [
            { name: 'Hotovo', value: completedCount, color: '#10b981' },
            { name: 'Plán', value: pendingCount, color: '#6b7280' }
        ];

        // Financials (Earnings & Cost)
        let totalCost = 0;

        const workerPerformance: Record<string, { tables: number; kWp: number; earnings: number; color: string }> = {};

        workers.forEach(w => {
            if (w.name) {
                workerPerformance[w.name] = {
                    tables: 0,
                    kWp: 0,
                    earnings: 0,
                    color: w.color || '#3b82f6'
                };
            }
        });

        completedTables.forEach(table => {
            if (table.assignedWorkers && table.assignedWorkers.length > 0) {
                const stringsInTable = TABLE_STRINGS[table.tableType];
                const workerCount = table.assignedWorkers.length;

                // Split logic: If multiple workers, split the string count credit?
                // Or does each get paid full?
                // Usually for "Worker Price", it's piecework. If price is defined per worker, 
                // it implies "I get X for doing Y". If I start sharing Y, I get X/2.
                // We will use SPLIT logic for financial conservative estimates.
                const stringsPerWorker = stringsInTable / workerCount;
                const kwpPerWorker = TABLE_POWER[table.tableType] / workerCount;

                table.assignedWorkers.forEach(workerId => {
                    const worker = workers.find(w => w.id === workerId);
                    if (worker && worker.name && workerPerformance[worker.name]) {
                        workerPerformance[worker.name].tables += (1 / workerCount); // Fractional table count
                        workerPerformance[worker.name].kWp += kwpPerWorker; // Fractional kWp

                        const earnings = stringsPerWorker * (worker.stringPrice || 0);
                        workerPerformance[worker.name].earnings += earnings;
                        totalCost += earnings;
                    }
                });
            }
        });

        const workerPerfData = Object.entries(workerPerformance)
            .map(([name, data]) => ({ name, ...data }))
            .filter(d => d.tables > 0)
            .sort((a, b) => b.earnings - a.earnings); // Sort by earnings now? Or keep kWp? Let's sort by Earnings for the boss.

        // ... existing daily progress code ...

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
            pendingCount,
            totalStrings,
            installedStrings,
            totalCost
        };
    }, [allFieldTables, workers]);

    return (
        <div className="space-y-12 md:space-y-20 pb-32 animate-in fade-in duration-700">
            <div className="md:hidden">
                <BackButton />
            </div>

            {/* Header Section */}
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-10 pt-8 px-4 md:px-0">
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <span className="h-1.5 w-16 bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.6)]"></span>
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.5em]">{t('analytics') || 'Analytics'}</span>
                    </div>
                    <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter uppercase italic leading-[0.7] drop-shadow-2xl" style={{ fontSize: 'clamp(4rem, 12vw, 8rem)' }}>
                        {t('statistics')}<span className="text-cyan-500 font-normal">.</span>
                    </h1>
                    <p className="text-slate-400 font-bold tracking-tight max-w-2xl border-l-4 border-cyan-500/50 pl-6 py-2 uppercase italic bg-cyan-500/5 pr-10 rounded-r-2xl" style={{ fontSize: 'clamp(14px, 4vw, 18px)' }}>
                        {t('statistics_dashboard_desc') || "Analýza výkonu a technologického postupu v reálném čase."}
                    </p>
                </div>

                <div className="w-full lg:w-[450px] relative group">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                        className="relative w-full p-6 bg-black/40 text-white border border-white/10 rounded-[2.5rem] focus:ring-4 focus:ring-cyan-500/20 focus:outline-none text-xl font-black uppercase tracking-widest backdrop-blur-3xl appearance-none cursor-pointer [&>option]:bg-slate-900 transition-all shadow-2xl group-hover:border-cyan-500/50"
                    >
                        <option value="" disabled className="text-slate-500">{t('select_project') || "Vyberte projekt"}</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-cyan-500 group-hover:scale-125 transition-transform">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </header>

            {selectedProjectId && stats ? (
                <div className="space-y-16 px-4 md:px-0">
                    {/* KPI Cards: Premium Tiles */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                        {/* Total Installed kWp */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05] hover:scale-[1.03] hover:shadow-cyan-500/10">
                            <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-[80px] group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all transform group-hover:rotate-12">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t('total_installed') || "Instalováno celkem"}</h3>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-white tracking-tighter italic leading-none">
                                            {stats.installedKWp.toFixed(1)}
                                        </span>
                                        <span className="text-2xl font-black text-emerald-500 tracking-widest uppercase">kWp</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                                        {t('target') || "Cíl"}: <span className="text-white">{stats.totalKWp.toFixed(1)} kWp</span>
                                    </p>
                                </div>
                                <div className="h-3 w-full bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-600 to-green-400 transition-all duration-1500 ease-out shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                        style={{ width: `${(stats.installedKWp / (stats.totalKWp || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Total Cost (Financials) */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05] hover:scale-[1.03] hover:shadow-yellow-500/10">
                            <div className="absolute -top-16 -right-16 w-56 h-56 bg-yellow-500/10 rounded-full blur-[80px] group-hover:bg-yellow-500/20 transition-all duration-700"></div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-400 group-hover:bg-yellow-500 group-hover:text-white transition-all transform group-hover:rotate-12">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t('total_cost') || "Náklady práce"}</h3>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-white tracking-tighter italic leading-none">
                                            {stats.totalCost.toFixed(0)}
                                        </span>
                                        <span className="text-2xl font-black text-yellow-500 tracking-widest uppercase">€</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                                        {t('string_rate') || "Dle sazby za string"}
                                    </p>
                                </div>
                                <div className="h-1 w-12 bg-yellow-500/50 rounded-full"></div>
                            </div>
                        </div>

                        {/* Total Strings */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05] hover:scale-[1.03] hover:shadow-amber-500/10">
                            <div className="absolute -top-16 -right-16 w-56 h-56 bg-amber-500/10 rounded-full blur-[80px] group-hover:bg-amber-500/20 transition-all duration-700"></div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all transform group-hover:rotate-12">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t('total_strings') || "Celkem stringů"}</h3>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-white tracking-tighter italic leading-none">
                                            {stats.installedStrings.toFixed(1)}
                                        </span>
                                        <span className="text-2xl font-black text-amber-500 tracking-widest uppercase">STR</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                                        {t('target') || "Cíl"}: <span className="text-white">{stats.totalStrings.toFixed(1)} STR</span>
                                    </p>
                                </div>
                                <div className="h-3 w-full bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-1500 ease-out shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                                        style={{ width: `${(stats.installedStrings / (stats.totalStrings || 1)) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Active Team */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05] hover:scale-[1.03] hover:shadow-blue-500/10">
                            <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-500/10 rounded-full blur-[80px] group-hover:bg-blue-500/20 transition-all duration-700"></div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all transform group-hover:rotate-12">
                                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                    </div>
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">{t('active_team') || "Aktivní tým"}</h3>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-6xl font-black text-white tracking-tighter italic leading-none">
                                            {stats.activeTeamCount}
                                        </span>
                                        <span className="text-2xl font-black text-blue-500 tracking-widest uppercase">{t('workers')}</span>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">
                                        {stats.completedCount} DOKONČENÝCH STOLŮ
                                    </p>
                                </div>
                                <div className="h-1 w-12 bg-blue-500/50 rounded-full"></div>
                            </div>
                        </div>

                    </div>



                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                        {/* Daily Progress - Line Chart */}
                        <div className="xl:col-span-2 group relative overflow-hidden p-10 glass-dark rounded-[3.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05]">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]"></div>
                                        <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.4em]">{t('daily_progress')}</h2>
                                    </div>
                                    <p className="text-white font-bold opacity-60 text-xs ml-5 italic uppercase tracking-widest">{t('last_30_days') || "Kumulativní výkon v KwP"}</p>
                                </div>
                                <div className="flex items-center gap-4 bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/20">
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none animate-pulse">{t('live_tracking') || "Live Tracking"}</span>
                                </div>
                            </div>

                            {stats.dailyProgressData.length > 0 ? (
                                <div className="relative h-[450px] w-full mt-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={stats.dailyProgressData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                            <defs>
                                                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={20}
                                            />
                                            <YAxis
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dx={-10}
                                                unit="kWp"
                                            />
                                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(16,185,129,0.2)', strokeWidth: 2 }} />
                                            <Line
                                                type="monotone"
                                                dataKey="kWp"
                                                stroke="#10b981"
                                                strokeWidth={5}
                                                dot={{ fill: '#10b981', strokeWidth: 3, r: 6, stroke: '#020617' }}
                                                activeDot={{ r: 10, fill: '#fff', stroke: '#10b981', strokeWidth: 5 }}
                                                fill="url(#lineGradient)"
                                                animationDuration={2500}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[350px] flex items-center justify-center opacity-40 italic font-black text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>

                        {/* Worker Performance - Bar Chart */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05]">
                            <div className="space-y-2 mb-12">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]"></div>
                                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.4em]">{t('worker_performance')}</h2>
                                </div>
                                <p className="text-white font-bold opacity-60 text-xs ml-5 italic uppercase tracking-widest">{t('top_workers_desc') || "Srovnání výkonu a výdělků"}</p>
                            </div>

                            {stats.workerPerfData.length > 0 ? (
                                <div className="h-[450px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats.workerPerfData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                                            <XAxis
                                                dataKey="name"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dy={20}
                                            />
                                            <YAxis
                                                yAxisId="left"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dx={-10}
                                            />
                                            <YAxis
                                                yAxisId="right"
                                                orientation="right"
                                                stroke="#475569"
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }}
                                                axisLine={false}
                                                tickLine={false}
                                                dx={10}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar
                                                yAxisId="left"
                                                dataKey="tables"
                                                name={t('tables') || "Stoly"}
                                                fill="#3b82f6"
                                                radius={[12, 12, 0, 0]}
                                                barSize={24}
                                            />
                                            <Bar
                                                yAxisId="right"
                                                dataKey="kWp"
                                                name="kWp"
                                                fill="#10b981"
                                                radius={[12, 12, 0, 0]}
                                                barSize={24}
                                            />
                                            <Bar
                                                yAxisId="right"
                                                dataKey="earnings"
                                                name="€"
                                                fill="#fbbf24"
                                                radius={[12, 12, 0, 0]}
                                                barSize={24}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center opacity-40 italic font-black text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>

                        {/* Status Distribution - Pie Chart */}
                        <div className="group relative overflow-hidden p-10 glass-dark rounded-[3.5rem] border border-white/5 shadow-2xl transition-all hover:bg-white/[0.05]">
                            <div className="space-y-2 mb-12">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)]"></div>
                                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.4em]">{t('status_distribution')}</h2>
                                </div>
                                <p className="text-white font-bold opacity-60 text-xs ml-5 italic uppercase tracking-widest">{t('overall_completion_status') || "Celkový progres projektu"}</p>
                            </div>

                            {stats.totalTables > 0 ? (
                                <div className="h-[450px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={stats.statusData}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={140}
                                                innerRadius={100}
                                                paddingAngle={10}
                                                dataKey="value"
                                                animationDuration={2000}
                                            >
                                                {stats.statusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(255,255,255,0.05)" strokeWidth={2} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="h-[400px] flex items-center justify-center opacity-40 italic font-black text-slate-500 uppercase tracking-widest">{t('no_data')}</div>
                            )}
                        </div>
                    </div>

                    {/* Work Type Progress Bars: Premium Tile */}
                    <div className="group relative overflow-hidden p-12 glass-dark rounded-[4rem] border border-white/5 shadow-3xl transition-all hover:bg-white/[0.05]">
                        <div className="space-y-2 mb-16">
                            <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.6)]"></div>
                                <h2 className="text-md font-black text-slate-500 uppercase tracking-[0.5em]">{t('work_type_progress')}</h2>
                            </div>
                            <p className="text-white font-bold opacity-60 text-xs ml-6 italic uppercase tracking-widest">{t('technological_milestones') || "Technologické milníky realizace"}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                            {/* Construction (Konstrukce) */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-end px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Konstrukce (K)</span>
                                    <span className="text-3xl font-black italic text-blue-400 leading-none">{stats.workTypeProgress.construction.toFixed(0)}%</span>
                                </div>
                                <div className="h-6 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/10 p-1">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-2000 ease-out shadow-[0_0_25px_rgba(59,130,246,0.4)]"
                                        style={{ width: `${stats.workTypeProgress.construction}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Paneling (Panely) */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-end px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Panely (P)</span>
                                    <span className="text-3xl font-black italic text-purple-400 leading-none">{stats.workTypeProgress.paneling.toFixed(0)}%</span>
                                </div>
                                <div className="h-6 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/10 p-1">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-2000 ease-out shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                                        style={{ width: `${stats.workTypeProgress.paneling}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Cabling (Kabely) */}
                            <div className="space-y-6">
                                <div className="flex justify-between items-end px-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Kabely (C)</span>
                                    <span className="text-3xl font-black italic text-amber-400 leading-none">{stats.workTypeProgress.cabling.toFixed(0)}%</span>
                                </div>
                                <div className="h-6 bg-black/60 rounded-full overflow-hidden shadow-inner border border-white/10 p-1">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-2000 ease-out shadow-[0_0_25px_rgba(245,158,11,0.4)]"
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
            )
            }
        </div >
    );
};

export default StatsPage;
