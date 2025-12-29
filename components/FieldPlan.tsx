
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { FieldTable, Worker } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';

interface FieldPlanProps {
    projectId: number;
    onTableClick?: (table: FieldTable) => void;
}

const FieldPlan: React.FC<FieldPlanProps> = ({ projectId, onTableClick }) => {
    const { t } = useI18n();
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed'>('all');

    // Load tables and workers
    const tables = useLiveQuery(
        () => db.fieldTables.where('projectId').equals(projectId).toArray(),
        [projectId]
    );

    const workers = useLiveQuery(() => db.workers.toArray());

    // Filter tables
    const filteredTables = useMemo(() => {
        if (!tables) return [];
        if (selectedFilter === 'all') return tables;
        return tables.filter(t => t.status === selectedFilter);
    }, [tables, selectedFilter]);

    // Statistics
    const stats = useMemo(() => {
        if (!tables) return { total: 0, pending: 0, completed: 0 };
        return {
            total: tables.length,
            pending: tables.filter(t => t.status === 'pending').length,
            completed: tables.filter(t => t.status === 'completed').length,
        };
    }, [tables]);

    // Get worker by ID
    const getWorker = (workerId: number) => {
        return workers?.find(w => w.id === workerId);
    };

    if (!tables || tables.length === 0) {
        return (
            <div className="p-8 text-center border-2 border-dashed border-white/10 rounded-3xl bg-black/20">
                <div className="text-6xl mb-4 opacity-20">📐</div>
                <p className="text-gray-500 font-bold uppercase text-sm tracking-widest">
                    {t('no_tables_in_project') || 'Žádné stoly v projektu'}
                </p>
                <p className="text-gray-600 text-xs mt-2">
                    {t('add_tables_in_project_settings') || 'Přidejte stoly v nastavení projektu'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with stats */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                        <span className="text-4xl">📐</span>
                        {t('field_plan') || 'Plán pole'}
                    </h2>
                    <p className="text-gray-500 text-sm font-bold mt-1">
                        {stats.total} {t('tables_total') || 'stolů celkem'}
                    </p>
                </div>

                {/* Stats badges */}
                <div className="flex gap-3">
                    <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                        <div className="text-yellow-500 font-black text-2xl">{stats.pending}</div>
                        <div className="text-yellow-500/60 text-[10px] uppercase tracking-widest font-bold">
                            {t('pending') || 'Čeká'}
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <div className="text-green-500 font-black text-2xl">{stats.completed}</div>
                        <div className="text-green-500/60 text-[10px] uppercase tracking-widest font-bold">
                            {t('completed') || 'Hotovo'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2 bg-black/20 p-2 rounded-2xl">
                {[
                    { id: 'all', label: t('all') || 'Vše', count: stats.total },
                    { id: 'pending', label: t('pending') || 'Čeká', count: stats.pending },
                    { id: 'completed', label: t('completed') || 'Hotovo', count: stats.completed },
                ].map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setSelectedFilter(filter.id as any)}
                        className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${selectedFilter === filter.id
                                ? 'bg-white/10 text-white shadow-inner'
                                : 'text-gray-500 hover:bg-white/5'
                            }`}
                    >
                        {filter.label} ({filter.count})
                    </button>
                ))}
            </div>

            {/* Main card - Field plan grid */}
            <div className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Card header */}
                <div className="p-6 border-b border-white/5 bg-black/20">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">
                            {t('tables_grid') || 'Mřížka stolů'}
                        </h3>
                        <div className="text-sm text-gray-400 font-bold">
                            {filteredTables.length} / {stats.total}
                        </div>
                    </div>
                </div>

                {/* Tables grid */}
                <div className="p-6">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
                        {filteredTables.map(table => {
                            const isCompleted = table.status === 'completed';
                            const completedWorker = isCompleted && table.completedBy
                                ? getWorker(table.completedBy)
                                : null;

                            const color = completedWorker
                                ? getWorkerColor(completedWorker.id!, completedWorker.color, workers)
                                : '#f59e0b'; // Yellow for pending

                            const assignedWorkers = table.assignedWorkers
                                ?.map(id => getWorker(id))
                                .filter(Boolean) as Worker[] | undefined;

                            return (
                                <button
                                    key={table.id}
                                    onClick={() => onTableClick?.(table)}
                                    className="relative group aspect-square rounded-2xl transition-all duration-300 hover:scale-110 active:scale-95 overflow-hidden"
                                    style={{
                                        backgroundColor: color,
                                        borderWidth: '2px',
                                        borderColor: color,
                                        boxShadow: isCompleted
                                            ? `0 0 20px ${color}40, 0 4px 12px rgba(0,0,0,0.3)`
                                            : '0 4px 12px rgba(0,0,0,0.2)',
                                    }}
                                >
                                    {/* Table number */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center p-2">
                                        <span className="text-white font-black text-sm md:text-base leading-tight text-center drop-shadow-lg">
                                            {table.tableId}
                                        </span>

                                        {/* Worker initials */}
                                        {isCompleted && completedWorker && (
                                            <span className="text-white/80 font-bold text-[10px] mt-1 drop-shadow">
                                                {getInitials(completedWorker.name)}
                                            </span>
                                        )}

                                        {/* Assigned workers dots */}
                                        {assignedWorkers && assignedWorkers.length > 0 && (
                                            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                                                {assignedWorkers.slice(0, 2).map(worker => {
                                                    const workerColor = getWorkerColor(worker.id!, worker.color, workers);
                                                    return (
                                                        <div
                                                            key={worker.id}
                                                            className="w-3 h-3 rounded-full border border-white/50"
                                                            style={{ backgroundColor: workerColor }}
                                                            title={worker.name}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover overlay */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

                                    {/* Glow effect for completed */}
                                    {isCompleted && (
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{
                                                background: `radial-gradient(circle at center, ${color}40 0%, transparent 70%)`,
                                            }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Empty state for filtered view */}
                    {filteredTables.length === 0 && (
                        <div className="py-12 text-center">
                            <div className="text-4xl mb-3 opacity-20">🔍</div>
                            <p className="text-gray-500 font-bold uppercase text-sm tracking-widest">
                                {t('no_tables_match_filter') || 'Žádné stoly nevyhovují filtru'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Workers legend */}
            {workers && workers.length > 0 && (
                <div className="bg-black/20 backdrop-blur-xl rounded-2xl border border-white/5 p-6">
                    <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                        {t('workers_legend') || 'Legenda pracovníků'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {workers.map(worker => {
                            const color = getWorkerColor(worker.id!, worker.color, workers);
                            const completedCount = tables.filter(t => t.completedBy === worker.id).length;

                            return (
                                <div
                                    key={worker.id}
                                    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white/20"
                                        style={{ backgroundColor: color }}
                                    >
                                        {getInitials(worker.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white font-bold text-sm truncate">
                                            {worker.name}
                                        </div>
                                        <div className="text-gray-500 text-xs font-bold">
                                            {completedCount} {t('tables') || 'stolů'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FieldPlan;
