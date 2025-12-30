
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { soundService } from '../services/soundService';
import type { FieldTable, Worker, ProjectTask } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';

// --- Improved Table Item ---
const TableItem = React.memo<{
    table: FieldTable;
    zoom: number;
    completedWorker: Worker | null | undefined;
    assignedWorkers: Worker[] | undefined;
    workers: Worker[];
    isSelected: boolean;
    tasks: ProjectTask[];
    onToggle: (e: React.MouseEvent, id: string) => void;
    onContextMenu: (e: React.MouseEvent, table: FieldTable) => void;
}>(({ table, zoom, completedWorker, assignedWorkers, workers, isSelected, tasks, onToggle, onContextMenu }) => {

    const getStatusColor = () => {
        if (table.status === 'defect') return '#e11d48'; // Rose
        if (table.status === 'completed') {
            return completedWorker ? getWorkerColor(completedWorker.id!, completedWorker.color, workers) : '#10b981';
        }
        if (table.assignedWorkers && table.assignedWorkers.length > 0) return '#f59e0b'; // Amber (In progress)
        return '#475569'; // Slate (Pending)
    };

    const color = getStatusColor();
    const isCompleted = table.status === 'completed';
    const isPendingAssigned = !isCompleted && table.assignedWorkers && table.assignedWorkers.length > 0;
    const isDefect = table.status === 'defect';

    // Scale things based on zoom (0.2 to 2.0)
    const padding = Math.max(2, 8 * zoom);
    const fontSize = Math.max(8, 16 * zoom);
    const workerSize = Math.max(8, 14 * zoom);
    const dotSize = Math.max(4, 8 * zoom);

    return (
        <div
            onClick={(e) => onToggle(e, table.id!.toString())}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(e, table);
            }}
            className={`relative flex flex-col items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer select-none group touch-manipulation
                ${isSelected ? 'ring-4 ring-white ring-offset-4 ring-offset-slate-950 z-20 scale-105 shadow-2xl' : 'hover:scale-[1.02]'}
            `}
            style={{
                width: 100 * zoom,
                height: 100 * zoom,
                backgroundColor: isCompleted || isPendingAssigned || isDefect ? `${color}20` : 'rgba(255,255,255,0.03)',
                borderColor: isSelected ? '#fff' : `${color}${isCompleted || isPendingAssigned || isDefect ? '80' : '30'}`,
                borderWidth: isSelected ? '3px' : '2px',
                boxShadow: isCompleted ? `0 0 15px ${color}30` : 'none',
            }}
        >
            {/* Background Icon/Symbol */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                {isCompleted ? (
                    <svg style={{ width: 60 * zoom, height: 60 * zoom }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ) : isDefect ? (
                    <svg style={{ width: 60 * zoom, height: 60 * zoom }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                ) : null}
            </div>

            {/* Selection Checkmark */}
            {isSelected && (
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center shadow-lg border border-indigo-100 z-30">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </div>
            )}

            {/* Main Info */}
            <div className={`flex flex-col items-center gap-0.5 z-10`} style={{ padding }}>
                <span className="font-black text-white leading-none whitespace-nowrap drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize }}>
                    {table.tableId}
                </span>

                {isCompleted && completedWorker && zoom > 0.4 && (
                    <div className="bg-black/40 px-2 py-0.5 rounded-full mt-1 border border-white/10">
                        <span className="text-white font-bold uppercase tracking-tighter" style={{ fontSize: workerSize * 0.8 }}>
                            {getInitials(completedWorker.name)}
                        </span>
                    </div>
                )}

                {isPendingAssigned && !isCompleted && zoom > 0.4 && (
                    <div className="flex -space-x-2 mt-1">
                        {assignedWorkers?.slice(0, 2).map((w, idx) => (
                            <div
                                key={w.id}
                                className="rounded-full border border-slate-900 flex items-center justify-center text-white font-black"
                                style={{
                                    width: workerSize * 1.5,
                                    height: workerSize * 1.5,
                                    backgroundColor: getWorkerColor(w.id!, w.color, workers),
                                    fontSize: workerSize * 0.7,
                                    zIndex: 2 - idx
                                }}
                            >
                                {getInitials(w.name)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Progress / Task Dots */}
            {zoom > 0.3 && tasks.length > 0 && (
                <div className="absolute bottom-2 flex gap-1 px-1">
                    {tasks.map((task, i) => (
                        <div
                            key={i}
                            className={`rounded-full border border-white/20`}
                            style={{
                                width: dotSize,
                                height: dotSize,
                                backgroundColor: task.completionDate ? '#10b981' : (task.taskType === 'panels' ? '#3b82f6' : '#f59e0b')
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Selection/Hover overlay */}
            <div className={`absolute inset-0 rounded-2xl transition-opacity duration-200 ${isSelected ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 bg-white/5'}`} />
        </div>
    );
});

// --- Enhanced Context Menu ---
const ContextMenu: React.FC<{
    table: FieldTable;
    x: number;
    y: number;
    workers: Worker[];
    onClose: () => void;
    onAction: (action: string, data?: any) => void;
}> = ({ table, x, y, workers, onClose, onAction }) => {
    return (
        <div className="fixed inset-0 z-[1000]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
            <div
                className="absolute bg-slate-900 border border-white/20 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] py-3 min-w-[200px] animate-scale-in"
                style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 300) }}
                onClick={e => e.stopPropagation()}
            >
                <div className="px-4 py-2 border-b border-white/10 mb-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Akce pro stůl</p>
                    <p className="text-lg font-black text-white italic"># {table.tableId}</p>
                </div>

                <div className="space-y-1 px-2">
                    <button onClick={() => onAction('detail')} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 text-slate-300 hover:text-white rounded-lg transition-all font-bold text-sm">
                        <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Zobrazit detail
                    </button>

                    <button
                        onClick={() => onAction(table.status === 'completed' ? 'pending' : 'complete')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-bold text-sm ${table.status === 'completed' ? 'text-amber-400 hover:bg-amber-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M5 13l4 4L19 7" /></svg>
                        {table.status === 'completed' ? 'Vrátit k realizaci' : 'Označit jako hotové'}
                    </button>

                    <button
                        onClick={() => onAction('defect')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-bold text-sm text-rose-400 hover:bg-rose-400/10`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Nahlásit závadu
                    </button>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 px-2 space-y-1">
                    <p className="px-3 py-1 text-[8px] font-black text-slate-600 uppercase tracking-widest">Přiřadit pracovníka</p>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        {workers.map(w => (
                            <button
                                key={w.id}
                                onClick={() => onAction('assign', w.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-all font-bold text-xs"
                            >
                                <div className="w-4 h-4 rounded shadow-sm" style={{ backgroundColor: getWorkerColor(w.id!, w.color, workers) }} />
                                {w.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main FieldPlan Component ---
const FieldPlan: React.FC<{ projectId: number, onTableClick?: (table: FieldTable) => void }> = ({ projectId, onTableClick }) => {
    const { t } = useI18n();
    const { user } = useAuth();

    // Data Queries
    const tables = useLiveQuery(() => db.fieldTables.where('projectId').equals(projectId).toArray(), [projectId]);
    const workers = useLiveQuery(() => db.workers.toArray());
    const tasks = useLiveQuery(() => db.projectTasks.where('projectId').equals(projectId).toArray(), [projectId]);

    // UI State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterWorker, setFilterWorker] = useState<number | 'all'>('all');
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ table: FieldTable, x: number, y: number } | null>(null);

    // Zoom/Pan State
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Filtered Tables logic
    const filteredTables = useMemo(() => {
        if (!tables) return [];
        return tables.filter(t => {
            if (filterStatus !== 'all' && t.status !== filterStatus) return false;
            if (filterWorker !== 'all') {
                if (filterStatus === 'completed' && t.completedBy !== filterWorker) return false;
                if (filterStatus !== 'completed' && !t.assignedWorkers?.includes(filterWorker as number)) return false;
            }
            return true;
        });
    }, [tables, filterStatus, filterWorker]);

    // Statistics
    const stats = useMemo(() => {
        if (!tables) return { total: 0, completed: 0, pending: 0, defect: 0, inProgress: 0 };
        return {
            total: tables.length,
            completed: tables.filter(t => t.status === 'completed').length,
            pending: tables.filter(t => t.status === 'pending' && (!t.assignedWorkers || t.assignedWorkers.length === 0)).length,
            inProgress: tables.filter(t => t.status === 'pending' && t.assignedWorkers && t.assignedWorkers.length > 0).length,
            defect: tables.filter(t => t.status === 'defect').length,
        };
    }, [tables]);

    // Handlers
    const handleToggleSelect = useCallback((e: React.MouseEvent, id: string) => {
        const newSelected = new Set(selectedIds);

        if (e.shiftKey && lastSelectedId && tables) {
            // Find range
            const tableList = filteredTables;
            const idx1 = tableList.findIndex(t => t.id!.toString() === lastSelectedId);
            const idx2 = tableList.findIndex(t => t.id!.toString() === id);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                for (let i = start; i <= end; i++) {
                    newSelected.add(tableList[i].id!.toString());
                }
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (newSelected.has(id)) newSelected.delete(id);
            else newSelected.add(id);
        } else {
            // Single select toggle or clear
            if (newSelected.has(id) && newSelected.size === 1) newSelected.clear();
            else {
                newSelected.clear();
                newSelected.add(id);
            }
        }

        setSelectedIds(newSelected);
        setLastSelectedId(id);
        setShowRightSidebar(newSelected.size > 0);
        soundService.playClick();
    }, [selectedIds, lastSelectedId, filteredTables, tables]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
                setShowRightSidebar(false);
            }
            if (selectedIds.size > 0) {
                if (e.key === 'c') handleBulkAction('complete');
                if (e.key === 'p') handleBulkAction('pending');
                if (e.key === 'd') handleBulkAction('defect');
                if (e.key === 'Delete') handleBulkAction('pending');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedIds]);

    // Zoom/Pan Handlers
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => Math.max(0.2, Math.min(3, prev * delta)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 && (e.target as HTMLElement).classList.contains('canvas-area')) {
            isDragging.current = true;
            startPos.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
            containerRef.current!.style.cursor = 'grabbing';
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current) return;
        setOffset({
            x: e.clientX - startPos.current.x,
            y: e.clientY - startPos.current.y
        });
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        if (containerRef.current) containerRef.current.style.cursor = 'default';
    };

    const handleBulkAction = async (action: string, data?: any) => {
        const ids = Array.from(selectedIds).map(Number);
        if (ids.length === 0) return;

        try {
            const updates: any = {};
            if (action === 'complete') {
                updates.status = 'completed';
                updates.completedAt = new Date();
                updates.completedBy = user?.workerId || 0;
            } else if (action === 'pending') {
                updates.status = 'pending';
                updates.completedAt = undefined;
                updates.completedBy = undefined;
                updates.assignedWorkers = [];
            } else if (action === 'defect') {
                updates.status = 'defect';
                updates.completedAt = undefined;
                updates.completedBy = undefined;
            } else if (action === 'assign') {
                const currentTables = tables?.filter(t => ids.includes(t.id!)) || [];
                for (const t of currentTables) {
                    const existing = t.assignedWorkers || [];
                    const newAssigned = existing.includes(data) ? existing.filter(id => id !== data) : [...existing, data].slice(-2);
                    await db.fieldTables.update(t.id!, { assignedWorkers: newAssigned });
                }
                soundService.playSuccess();
                return;
            }

            for (const id of ids) {
                await db.fieldTables.update(id, updates);
            }

            if (firebaseService.isReady) {
                const recordsToSync = tables?.filter(t => ids.includes(t.id!)).map(t => ({
                    ...t,
                    ...updates,
                    id: `${t.projectId}_${t.tableId}`
                })) || [];
                firebaseService.upsertRecords('fieldTables', recordsToSync).catch(console.error);
            }

            soundService.playSuccess();
        } catch (err) {
            console.error('Bulk action failed', err);
        }
    };

    return (
        <div className="fixed inset-0 top-24 bottom-0 flex overflow-hidden bg-slate-950 font-sans">
            <aside className={`transition-all duration-300 h-full border-r border-white/5 bg-slate-900/50 backdrop-blur-xl shrink-0 flex flex-col ${showLeftSidebar ? 'w-80' : 'w-0 overflow-hidden'}`}>
                <div className="p-8 grow space-y-10 custom-scrollbar overflow-y-auto">
                    <header>
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">FIELD<span className="text-indigo-500">.</span>PLAN</h2>
                        <div className="h-1 w-20 bg-gradient-to-r from-indigo-500 to-transparent rounded-full" />
                    </header>
                    <section className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Celkem</p><p className="text-2xl font-black text-white leading-none">{stats.total}</p></div>
                        <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20"><p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Hotovo</p><p className="text-2xl font-black text-white leading-none">{stats.completed}</p></div>
                        <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20"><p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">V procesu</p><p className="text-2xl font-black text-white leading-none">{stats.inProgress}</p></div>
                        <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20"><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Závady</p><p className="text-2xl font-black text-white leading-none">{stats.defect}</p></div>
                    </section>
                    <section className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Filtr Stavu</label>
                            <div className="flex flex-wrap gap-2">
                                {['all', 'pending', 'completed', 'defect'].map(s => (
                                    <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterStatus === s ? 'bg-white text-black border-white' : 'bg-black/20 text-slate-400 border-white/5 hover:border-white/20'}`}>{s === 'all' ? 'Vše' : s === 'pending' ? 'Čeká' : s === 'completed' ? 'Hotovo' : 'Závady'}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 ml-1">Filtr Pracovníka</label>
                            <select value={filterWorker} onChange={e => setFilterWorker(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="w-full bg-black/40 border border-white/10 p-4 rounded-2xl text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/40">
                                <option value="all">Všichni pracovníci</option>
                                {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    </section>
                </div>
                <div className="p-8 border-t border-white/5 bg-black/20">
                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Ovládání</p>
                    <p className="text-[10px] font-bold text-slate-500 mt-2">Ctrl + Kolečko: Zoom</p>
                    <p className="text-[10px] font-bold text-slate-500">Shift + Click: Výběr rozsahu</p>
                </div>
            </aside>
            <main ref={containerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} className="canvas-area flex-1 relative bg-[radial-gradient(circle_at_50%_40%,_#1e293b_0%,_#020617_100%)] overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: `${50 * zoom}px ${50 * zoom}px`, transform: `translate(${offset.x % (50 * zoom)}px, ${offset.y % (50 * zoom)}px)` }} />
                <div className="absolute p-20 pointer-events-none" style={{ transform: `translate(${offset.x}px, ${offset.y}px)`, display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${100 * zoom}px, 1fr))`, width: '3000px', gap: `${15 * zoom}px`, transition: isDragging.current ? 'none' : 'transform 0.1s ease-out' }}>
                    {filteredTables.map(table => (
                        <div key={table.id} className="pointer-events-auto">
                            <TableItem table={table} zoom={zoom} workers={workers || []} isSelected={selectedIds.has(table.id!.toString())} completedWorker={table.status === 'completed' ? workers?.find(w => w.id === table.completedBy) : null} assignedWorkers={table.assignedWorkers?.map(id => workers?.find(w => w.id === id)).filter(Boolean) as Worker[]} tasks={tasks?.filter(t => t.tableIds?.includes(table.tableId)) || []} onToggle={handleToggleSelect} onContextMenu={(e, t) => setContextMenu({ table: t, x: e.clientX, y: e.clientY })} />
                        </div>
                    ))}
                </div>
                <button onClick={() => setShowLeftSidebar(!showLeftSidebar)} className="absolute left-6 top-6 w-12 h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-white shadow-2xl hover:bg-slate-800 transition-all z-50"><svg className={`w-6 h-6 transition-transform ${showLeftSidebar ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg></button>
                <div className="absolute right-6 top-6 px-4 py-2 bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest z-50">Zoom: {Math.round(zoom * 100)}%</div>
                {contextMenu && <ContextMenu table={contextMenu.table} x={contextMenu.x} y={contextMenu.y} workers={workers || []} onClose={() => setContextMenu(null)} onAction={(action, data) => { setContextMenu(null); if (action === 'detail') onTableClick?.(contextMenu.table); else if (action === 'assign') { setSelectedIds(new Set([contextMenu.table.id!.toString()])); handleBulkAction('assign', data); } else { setSelectedIds(new Set([contextMenu.table.id!.toString()])); handleBulkAction(action); } }} />}
            </main>
            <aside className={`transition-all duration-300 h-full border-l border-white/5 bg-slate-900/80 backdrop-blur-3xl shrink-0 flex flex-col ${showRightSidebar ? 'w-80' : 'w-0 overflow-hidden'}`}>
                <div className="p-8 grow space-y-10 overflow-y-auto custom-scrollbar">
                    <header><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">VÝBĚR</p><h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">{selectedIds.size} <span className="text-indigo-500">X</span></h2><button onClick={() => { setSelectedIds(new Set()); setShowRightSidebar(false); }} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-4 hover:text-white transition-all">Zrušit výběr</button></header>
                    <nav className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Hromadné akce</label>
                        <button onClick={() => handleBulkAction('complete')} className="w-full p-6 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-3xl transition-all font-black uppercase tracking-widest text-xs flex items-center justify-between"><span>Označit hotovo</span><kbd className="px-2 py-1 bg-black/20 rounded text-[10px] opacity-50">C</kbd></button>
                        <button onClick={() => handleBulkAction('pending')} className="w-full p-6 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 rounded-3xl transition-all font-black uppercase tracking-widest text-xs flex items-center justify-between"><span>Resetovat stav</span><kbd className="px-2 py-1 bg-black/20 rounded text-[10px] opacity-50">DEL</kbd></button>
                    </nav>
                    <section className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Přiřadit tým ({selectedIds.size})</label>
                        <div className="grid grid-cols-1 gap-2">
                            {workers?.map(w => (
                                <button key={w.id} onClick={() => handleBulkAction('assign', w.id)} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-[10px] border border-white/20 shadow-md group-hover:scale-110 transition-transform" style={{ backgroundColor: getWorkerColor(w.id!, w.color, workers || []) }}>{getInitials(w.name)}</div>
                                    <div className="flex-1 text-left"><p className="text-white font-bold text-sm tracking-tight">{w.name}</p></div>
                                    <div className="bg-white/5 px-2 py-1 rounded text-[8px] font-black text-slate-500">PŘIŘADIT</div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
                <div className="p-8 border-t border-white/5 bg-black/20">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500"><span>Výkon týmu</span><span className="text-white">{Math.round((stats.completed / (stats.total || 1)) * 100)}%</span></div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }} /></div>
                </div>
            </aside>
        </div>
    );
};

export default FieldPlan;
