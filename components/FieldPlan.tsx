
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { soundService } from '../services/soundService';
import type { FieldTable, Worker } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';

// --- Subcomponent for Table Item to handle Double Tap / Long Press ---
const TableItem: React.FC<{
    table: FieldTable;
    color: string;
    isCompleted: boolean;
    completedWorker: Worker | null | undefined;
    assignedWorkers: Worker[] | undefined;
    workers: Worker[] | undefined;
    workers: Worker[] | undefined;
    onClick?: (table: FieldTable) => void;
    onLongPress?: (table: FieldTable) => void;
}> = ({ table, color, isCompleted, completedWorker, assignedWorkers, workers, onClick, onLongPress }) => {

    // Double Tap detection
    const [lastTap, setLastTap] = React.useState<number>(0);

    const handleTouchEnd = (e: React.TouchEvent) => {
        // Prevent default zoom if multiple taps
        // e.preventDefault(); // Careful, this might block scrolling
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 300;

        if (now - lastTap < DOUBLE_TAP_DELAY) {
            // DOUBLE TAP detected
            onClick?.(table);
        }
        setLastTap(now);
    };

    const handleClick = () => {
        // Simple click only if not long pressed
        if (!longPressTriggered.current) {
            soundService.playClick();
            onClick?.(table);
        }
    }

    // Long Press Logic
    const timerRef = React.useRef<any>(null);
    const longPressTriggered = React.useRef(false);

    const startPress = () => {
        longPressTriggered.current = false;
        timerRef.current = setTimeout(() => {
            longPressTriggered.current = true;
            soundService.playClick();  // Haptic feedback sound
            if (navigator.vibrate) navigator.vibrate(50); // Haptic vibration
            onLongPress?.(table);
        }, 500); // 500ms long press
    };

    const cancelPress = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            onTouchStart={startPress}
            onTouchEnd={() => { cancelPress(); handleTouchEnd({} as any); }}
            onTouchMove={cancelPress}
            onMouseDown={startPress}
            onMouseUp={cancelPress}
            onMouseLeave={cancelPress}
            onContextMenu={(e) => e.preventDefault()} // Disable default browser menu
            className="relative group aspect-square rounded-2xl transition-all duration-200 active:scale-95 overflow-hidden touch-manipulation"
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
                <span className="text-white font-black text-xl md:text-base leading-tight text-center drop-shadow-lg">
                    {table.tableId}
                </span>

                {/* Worker initials */}
                {isCompleted && completedWorker && (
                    <span className="text-white/80 font-bold text-xs mt-1 drop-shadow">
                        {getInitials(completedWorker.name)}
                    </span>
                )}

                {/* Assigned workers dots */}
                {assignedWorkers && assignedWorkers.length > 0 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {assignedWorkers.slice(0, 2).map(worker => {
                            const workerColor = getWorkerColor(worker.id!, worker.color, workers || []);
                            return (
                                <div
                                    key={worker.id}
                                    className="w-3 h-3 rounded-full border border-white/50 shadow-sm"
                                    style={{ backgroundColor: workerColor }}
                                    title={worker.name}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Hover/Active overlay */}
            <div className="absolute inset-0 bg-black/0 active:bg-black/20 hover:bg-black/10 transition-colors" />

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
    )
}

interface FieldPlanProps {
    projectId: number;
    onTableClick?: (table: FieldTable) => void;
    onToggleStatus?: (table: FieldTable) => void;
}

const ContextMenu: React.FC<{
    table: FieldTable;
    onClose: () => void;
    onAction: (action: 'complete' | 'pending' | 'detail') => void;
    t: (key: string) => string;
}> = ({ table, onClose, onAction, t }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center animate-fade-in" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div
                className="relative w-full sm:w-80 bg-slate-900 border-t sm:border border-white/20 p-6 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col gap-3 animate-slide-up sm:animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-4">
                    <h3 className="text-xl font-black text-white uppercase italic">Stůl {table.tableId}</h3>
                    <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {table.status === 'completed' ? 'Dokončeno' : 'Čeká'}
                    </div>
                </div>

                <button
                    onClick={() => onAction(table.status === 'completed' ? 'pending' : 'complete')}
                    className={`p-4 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all ${table.status === 'completed'
                            ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                            : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                        }`}
                >
                    {table.status === 'completed' ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                            Vrátit k realizaci
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                            Označit jako hotové
                        </>
                    )}
                </button>

                <button
                    onClick={() => onAction('detail')}
                    className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-3 transition-all"
                >
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Zobrazit detail
                </button>

                <button
                    onClick={onClose}
                    className="p-4 mt-2 bg-black/40 text-slate-500 rounded-xl font-bold uppercase tracking-widest text-xs hover:text-white transition-all"
                >
                    Zrušit
                </button>
            </div>
        </div>
    );
};

const FieldPlan: React.FC<FieldPlanProps> = ({ projectId, onTableClick }) => {
    const { t } = useI18n();
    const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [contextMenuTable, setContextMenuTable] = useState<FieldTable | null>(null);

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

            {/* Filter buttons - Mobile Scrollable Pills */}
            <div className="flex gap-2 bg-black/20 p-2 rounded-2xl overflow-x-auto touch-manipulation no-scrollbar">
                {[
                    { id: 'all', label: t('all') || 'Vše', count: stats.total },
                    { id: 'pending', label: t('pending') || 'Čeká', count: stats.pending },
                    { id: 'completed', label: t('completed') || 'Hotovo', count: stats.completed },
                ].map(filter => (
                    <button
                        key={filter.id}
                        onClick={() => setSelectedFilter(filter.id as any)}
                        className={`flex-none py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap ${selectedFilter === filter.id
                            ? 'bg-white/10 text-white shadow-inner border border-white/20'
                            : 'text-gray-500 hover:bg-white/5 border border-transparent'
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

                {/* Tables grid - Responsive (Mobile: 2 cols, Tablet: 4, Desktop: 8+) */}
                <div className="p-4 md:p-6">
                    <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-3 gap-y-4">
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
                                <TableItem
                                    key={table.id}
                                    table={table}
                                    color={color}
                                    isCompleted={isCompleted}
                                    completedWorker={completedWorker}
                                    assignedWorkers={assignedWorkers}
                                    assignedWorkers={assignedWorkers}
                                    onClick={onTableClick}
                                    onLongPress={setContextMenuTable}
                                    workers={workers} // Pass workers for color lookup
                                />
                            );
                        })}
                    </div>
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

            {/* Workers legend */}
            {
                workers && workers.length > 0 && (
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
                )
            }

            {/* Context Menu */}
            {contextMenuTable && (
                <ContextMenu
                    table={contextMenuTable}
                    onClose={() => setContextMenuTable(null)}
                    t={t}
                    onAction={async (action) => {
                        setContextMenuTable(null);
                        if (action === 'detail') {
                            onTableClick?.(contextMenuTable);
                        } else if (action === 'complete') {
                            // Quick Complete (Assign to me logic could be added here, currently just completes)
                            // We need current user worker ID logic here ideally, but for now we set status.
                            // Assuming we might need to fetch user in FieldPlan props or context.
                            // Let's just update status for now.
                            await db.fieldTables.update(contextMenuTable.id!, {
                                status: 'completed',
                                completedAt: new Date()
                                // completedBy: currentUser?.workerId // We don't have this here yet easily without prop drilling or hook
                            });
                            // Sync handled by other components or Auto-sync mechanism if present? 
                            // FieldPlans usually sync on save. Realtime sync needs to be triggered.
                            soundService.playSuccess();
                        } else if (action === 'pending') {
                            await db.fieldTables.update(contextMenuTable.id!, {
                                status: 'pending',
                                completedAt: undefined,
                                completedBy: undefined
                            });
                        }
                    }}
                />
            )}
        </div >
    );
};

export default FieldPlan;
