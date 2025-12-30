
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
        <div className="space-y-8">
            <div className="md:hidden">
                <BackButton />
            </div>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-5xl font-bold text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)]">
                    📊 Statistiky a Grafy
                </h1>
                <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                    className="w-full md:w-auto max-w-sm p-4 bg-black/20 text-white border border-white/20 rounded-xl focus:ring-blue-400 focus:border-blue-400 text-lg [&>option]:bg-gray-800"
                >
                    <option value="" disabled>Vyberte projekt</option>
                    {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>

            {selectedProjectId && stats ? (
                <div className="space-y-8">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Installed kWp */}
                        <div className="relative overflow-hidden p-8 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 backdrop-blur-2xl rounded-3xl border border-emerald-400/20 shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl"></div>
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-4xl">⚡</span>
                                    <h3 className="text-xl font-bold text-emerald-100">Instalováno celkem</h3>
                                </div>
                                <p className="text-5xl font-extrabold text-white mb-1">
                                    {stats.installedKWp.toFixed(2)} <span className="text-3xl text-emerald-300">kWp</span>
                                </p>
                                <p className="text-sm text-emerald-200/80">
                                    z {stats.totalKWp.toFixed(2)} kWp celkem
                                </p>
                                <div className="mt-4 h-2 bg-black/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                                        style={{ width: `${(stats.installedKWp / stats.totalKWp) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {/* Active Team */}
                        <div className="relative overflow-hidden p-8 bg-gradient-to-br from-blue-500/20 to-blue-600/10 backdrop-blur-2xl rounded-3xl border border-blue-400/20 shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl"></div>
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-4xl">👥</span>
                                    <h3 className="text-xl font-bold text-blue-100">Aktivní tým</h3>
                                </div>
                                <p className="text-5xl font-extrabold text-white mb-1">
                                    {stats.activeTeamCount} <span className="text-3xl text-blue-300">pracovníků</span>
                                </p>
                                <p className="text-sm text-blue-200/80">
                                    {stats.completedCount} dokončených stolů
                                </p>
                            </div>
                        </div>

                        {/* Average per Day */}
                        <div className="relative overflow-hidden p-8 bg-gradient-to-br from-purple-500/20 to-purple-600/10 backdrop-blur-2xl rounded-3xl border border-purple-400/20 shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl"></div>
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-4xl">📈</span>
                                    <h3 className="text-xl font-bold text-purple-100">Průměr za den</h3>
                                </div>
                                <p className="text-5xl font-extrabold text-white mb-1">
                                    {stats.avgKWpPerDay.toFixed(2)} <span className="text-3xl text-purple-300">kWp/den</span>
                                </p>
                                <p className="text-sm text-purple-200/80">
                                    Průměrný denní výkon
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Daily Progress - Line Chart */}
                        <div className="xl:col-span-2 p-8 bg-black/20 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-3xl">📊</span>
                                <h2 className="text-3xl font-bold text-white">Denní pokrok</h2>
                            </div>
                            {stats.dailyProgressData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={350}>
                                    <LineChart data={stats.dailyProgressData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                        <defs>
                                            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            label={{ value: 'kWp', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Line
                                            type="monotone"
                                            dataKey="kWp"
                                            stroke="#10b981"
                                            strokeWidth={3}
                                            dot={{ fill: '#10b981', r: 4 }}
                                            activeDot={{ r: 6 }}
                                            fill="url(#lineGradient)"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-300 py-12 text-lg">Žádná data k zobrazení</p>
                            )}
                        </div>

                        {/* Worker Performance - Bar Chart */}
                        <div className="p-8 bg-black/20 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-3xl">🏆</span>
                                <h2 className="text-3xl font-bold text-white">Výkon pracovníků</h2>
                            </div>
                            {stats.workerPerfData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={stats.workerPerfData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            angle={-45}
                                            textAnchor="end"
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            label={{ value: 'Stoly', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#9ca3af"
                                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                                            label={{ value: 'kWp', angle: 90, position: 'insideRight', fill: '#9ca3af' }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar
                                            yAxisId="left"
                                            dataKey="tables"
                                            name="Stoly"
                                            fill="#3b82f6"
                                            radius={[6, 6, 0, 0]}
                                        />
                                        <Bar
                                            yAxisId="right"
                                            dataKey="kWp"
                                            name="kWp"
                                            fill="#10b981"
                                            radius={[6, 6, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-300 py-12 text-lg">Žádná data k zobrazení</p>
                            )}
                        </div>

                        {/* Status Distribution - Pie Chart */}
                        <div className="p-8 bg-black/20 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-lg">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-3xl">🎯</span>
                                <h2 className="text-3xl font-bold text-white">Rozdělení stavů</h2>
                            </div>
                            {stats.totalTables > 0 ? (
                                <ResponsiveContainer width="100%" height={400}>
                                    <PieChart>
                                        <Pie
                                            data={stats.statusData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={140}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {stats.statusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-gray-300 py-12 text-lg">Žádná data k zobrazení</p>
                            )}
                        </div>
                    </div>

                    {/* Work Type Progress Bars */}
                    <div className="p-8 bg-black/20 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-lg">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-3xl">🔧</span>
                            <h2 className="text-3xl font-bold text-white">Pokrok podle typu práce</h2>
                        </div>
                        <div className="space-y-6">
                            {/* Construction (Konstrukce) */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-lg font-semibold text-white flex items-center gap-2">
                                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                                        Konstrukce (K)
                                    </span>
                                    <span className="text-lg font-bold text-blue-400">
                                        {stats.workTypeProgress.construction.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-6 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 flex items-center justify-end pr-3"
                                        style={{ width: `${stats.workTypeProgress.construction}%` }}
                                    >
                                        {stats.workTypeProgress.construction > 10 && (
                                            <span className="text-xs font-bold text-white">
                                                {stats.workTypeProgress.construction.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Paneling (Panely) */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-lg font-semibold text-white flex items-center gap-2">
                                        <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                                        Panely (P)
                                    </span>
                                    <span className="text-lg font-bold text-purple-400">
                                        {stats.workTypeProgress.paneling.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-6 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500 flex items-center justify-end pr-3"
                                        style={{ width: `${stats.workTypeProgress.paneling}%` }}
                                    >
                                        {stats.workTypeProgress.paneling > 10 && (
                                            <span className="text-xs font-bold text-white">
                                                {stats.workTypeProgress.paneling.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Cabling (Kabely) */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-lg font-semibold text-white flex items-center gap-2">
                                        <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                                        Kabely (C)
                                    </span>
                                    <span className="text-lg font-bold text-amber-400">
                                        {stats.workTypeProgress.cabling.toFixed(1)}%
                                    </span>
                                </div>
                                <div className="h-6 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-500 flex items-center justify-end pr-3"
                                        style={{ width: `${stats.workTypeProgress.cabling}%` }}
                                    >
                                        {stats.workTypeProgress.cabling > 10 && (
                                            <span className="text-xs font-bold text-white">
                                                {stats.workTypeProgress.cabling.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
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
