
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { soundService } from '../services/soundService';
import type { FieldTable, Worker, ProjectTask } from '../types';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import TimeRecordForm from './TimeRecordForm'; // NEW

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
    const { t } = useI18n();

    const getStatusTheme = () => {
        if (table.status === 'defect') return { color: '#fb7185', glow: 'shadow-[0_0_30px_rgba(251,113,133,0.4)]', bg: 'bg-rose-500/20 backdrop-blur-md' };
        if (table.status === 'completed') {
            // "Green = Hotovo" requested, but we also want worker ID if possible.
            // Compromise: Main bar is Green, badge shows worker color.
            const c = '#10b981'; // Emerald-500
            return { color: c, glow: `shadow-[0_0_30px_${c}50]`, bg: 'bg-emerald-500/20 backdrop-blur-md' };
        }
        if (table.assignedWorkers && table.assignedWorkers.length > 0) return { color: '#f59e0b', glow: 'shadow-[0_0_30px_rgba(245,158,11,0.4)]', bg: 'bg-amber-500/20 backdrop-blur-md' };
        return { color: '#94a3b8', glow: 'shadow-none', bg: 'bg-white/5 hover:bg-white/10' };
    };

    const theme = getStatusTheme();
    const isCompleted = table.status === 'completed';
    const isPendingAssigned = !isCompleted && table.assignedWorkers && table.assignedWorkers.length > 0;
    const isDefect = table.status === 'defect';

    const fontSize = Math.max(8, 20 * zoom); // Slightly larger font
    const workerSize = Math.max(12, 24 * zoom);

    return (
        <div
            onClick={(e) => onToggle(e, table.id!.toString())}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(e, table);
            }}
            className={`relative flex flex-col items-center justify-center rounded-[1rem] transition-all duration-300 cursor-pointer select-none group touch-manipulation border
                ${isSelected ? 'scale-110 z-20 brightness-125 border-white shadow-[0_0_40px_rgba(255,255,255,0.3)]' : 'hover:scale-[1.05] border-white/10'}
                ${theme.glow} ${theme.bg}
            `}
            style={{
                width: 100 * zoom,
                height: 100 * zoom,
                borderColor: isSelected ? '#fff' : undefined,
            }}
        >
            {/* Glossy Overlay */}
            <div className="absolute inset-0 rounded-[1rem] bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            {/* Status Indicator Bar */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-b-full opacity-80 shadow-[0_2px_10px_currentColor]" style={{ backgroundColor: theme.color, width: 30 * zoom }} />

            <div className={`flex flex-col items-center gap-1 z-10 p-2`}>
                <span className="font-black text-white italic tracking-tighter leading-none whitespace-nowrap drop-shadow-2xl" style={{ fontSize }}>
                    {table.tableId}
                </span>

                {isCompleted && completedWorker && zoom > 0.4 && (
                    <div className="flex items-center justify-center rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500 relative"
                        style={{ width: workerSize, height: workerSize, backgroundColor: getWorkerColor(completedWorker.id!, completedWorker.color, workers) }}>
                        <span className="text-white font-black uppercase relative z-10" style={{ fontSize: workerSize * 0.5 }}>
                            {getInitials(completedWorker.name)}
                        </span>
                    </div>
                )}

                {isPendingAssigned && !isCompleted && zoom > 0.4 && (
                    <div className="flex -space-x-3 mt-1 animate-pulse">
                        {assignedWorkers?.slice(0, 2).map((w, idx) => (
                            <div
                                key={w.id}
                                className="rounded-2xl border border-black/50 flex items-center justify-center text-white font-black shadow-xl"
                                style={{
                                    width: workerSize,
                                    height: workerSize,
                                    backgroundColor: getWorkerColor(w.id!, w.color, workers),
                                    fontSize: workerSize * 0.45,
                                    zIndex: 2 - idx
                                }}
                            >
                                {getInitials(w.name)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Task Progress Bar (Simple) */}
            {tasks.length > 0 && zoom > 0.3 && (
                <div className="absolute bottom-3 left-2 right-2 h-1 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <div className="h-full bg-indigo-400 shadow-[0_0_10px_currentColor]"
                        style={{ width: `${(tasks.filter(t => !!t.completionDate).length / tasks.length) * 100}%` }} />
                </div>
            )}

            {/* Defect Icon */}
            {isDefect && (
                <div className="absolute -top-2 -right-2 animate-bounce bg-white rounded-full p-0.5 shadow-lg">
                    <svg className="w-5 h-5 text-rose-600 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" /></svg>
                </div>
            )}
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
                className="absolute glass-dark rounded-[2.5rem] py-6 min-w-[260px] animate-in fade-in zoom-in-95 duration-200 border border-white/10"
                style={{ left: Math.min(x, window.innerWidth - 280), top: Math.min(y, window.innerHeight - 450) }}
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-white/5 mb-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Rychlé akce</p>
                    <p className="text-xl font-black text-white italic tracking-tighter uppercase"># {table.tableId}</p>
                </div>

                <div className="space-y-1 px-2">
                    <button onClick={() => onAction('detail')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 text-slate-300 hover:text-white rounded-2xl transition-all group">
                        <span className="font-black uppercase tracking-widest text-[10px]">Detail stolu</span>
                        <svg className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </button>

                    <button
                        onClick={() => onAction(table.status === 'completed' ? 'pending' : 'complete')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group ${table.status === 'completed' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`}
                    >
                        <span className="font-black uppercase tracking-widest text-[10px]">{table.status === 'completed' ? 'Vrátit k realizaci' : 'Označit hotovo'}</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </button>

                    <button
                        onClick={() => onAction('defect')}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group text-rose-500 hover:bg-rose-500/10`}
                    >
                        <span className="font-black uppercase tracking-widest text-[10px]">Nahlásit závadu</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </button>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="px-6 py-1 text-[9px] font-black text-slate-600 uppercase tracking-widest mb-2">Přiřadit pracovníka</p>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar px-2 space-y-1">
                        {workers.map(w => (
                            <button
                                key={w.id}
                                onClick={() => onAction('assign', w.id)}
                                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl transition-all font-black uppercase text-[9px] tracking-tight"
                            >
                                <div className="w-3 h-3 rounded shadow-sm border border-white/10" style={{ backgroundColor: getWorkerColor(w.id!, w.color, workers) }} />
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
    const [showWorkLogForm, setShowWorkLogForm] = useState(false); // NEW
    const [showDefectModal, setShowDefectModal] = useState(false); // NEW
    const [defectNotes, setDefectNotes] = useState(''); // NEW
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterWorker, setFilterWorker] = useState<number | 'all'>('all');
    const [showLeftSidebar, setShowLeftSidebar] = useState(true);
    const [showRightSidebar, setShowRightSidebar] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ table: FieldTable, x: number, y: number } | null>(null);
    const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
    const [isInitializing, setIsInitializing] = useState(false);
    const [activeTool, setActiveTool] = useState<'cursor' | 'complete' | 'defect' | 'pending'>('cursor');
    const [searchQuery, setSearchQuery] = useState('');

    // Zoom/Pan State
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Refs for performance/stability
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const lastSelectedIdRef = useRef<string | null>(null);
    const filteredTablesRef = useRef<FieldTable[]>([]);

    // Memoized Calculations
    const filteredTables = useMemo(() => {
        if (!tables) return [];
        return tables.filter(t => {
            if (filterStatus !== 'all' && t.status !== filterStatus) return false;
            if (filterWorker !== 'all') {
                if (filterStatus === 'completed' && t.completedBy !== filterWorker) return false;
                if (filterStatus !== 'completed' && !t.assignedWorkers?.includes(filterWorker as number)) return false;
            }
            if (searchQuery && !t.tableId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [tables, filterStatus, filterWorker, searchQuery]);

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

    useEffect(() => {
        filteredTablesRef.current = filteredTables;
    }, [filteredTables]);

    const handleContextMenu = useCallback((e: React.MouseEvent, table: FieldTable) => {
        setContextMenu({ table, x: e.clientX, y: e.clientY });
    }, []);

    const handleBulkAction = useCallback(async (action: string, data?: any) => {
        const ids = Array.from(selectedIdsRef.current).map(Number);
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
                updates.defectNotes = data || '';
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
    }, [tables, user?.workerId]);

    const handleToggleSelect = useCallback((e: React.MouseEvent | undefined, id: string) => {
        if (activeTool !== 'cursor') {
            const table = tables?.find(t => t.id!.toString() === id);
            if (!table) return;

            if (activeTool === 'defect') {
                const updates = { status: 'defect' as const, defectNotes: '' };
                db.fieldTables.update(table.id!, updates);
                if (firebaseService.isReady) {
                    firebaseService.upsertRecords('fieldTables', [{
                        ...table,
                        ...updates,
                        id: `${table.projectId}_${table.tableId}`
                    }]).catch(console.error);
                }
                soundService.playError();
                return;
            }

            let updates: any = {};
            if (activeTool === 'complete') {
                updates.status = 'completed';
                updates.completedAt = new Date();
                updates.completedBy = user?.workerId || 0;
            } else if (activeTool === 'pending') {
                updates.status = 'pending';
                updates.completedAt = undefined;
                updates.completedBy = undefined;
                updates.assignedWorkers = [];
            }

            db.fieldTables.update(table.id!, updates);
            if (firebaseService.isReady) {
                firebaseService.upsertRecords('fieldTables', [{
                    ...table,
                    ...updates,
                    id: `${table.projectId}_${table.tableId}`
                }]).catch(console.error);
            }
            soundService.playSuccess();
            return;
        }

        const newSelected = new Set(selectedIdsRef.current);

        if (e?.shiftKey && lastSelectedIdRef.current && tables) {
            const tableList = filteredTablesRef.current;
            const idx1 = tableList.findIndex(t => t.id!.toString() === lastSelectedIdRef.current);
            const idx2 = tableList.findIndex(t => t.id!.toString() === id);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                for (let i = start; i <= end; i++) {
                    newSelected.add(tableList[i].id!.toString());
                }
            }
        } else if (e?.ctrlKey || e?.metaKey) {
            if (newSelected.has(id)) newSelected.delete(id);
            else newSelected.add(id);
        } else {
            if (newSelected.has(id) && newSelected.size === 1) newSelected.clear();
            else {
                newSelected.clear();
                newSelected.add(id);
            }
        }

        selectedIdsRef.current = newSelected;
        lastSelectedIdRef.current = id;
        setSelectedIds(newSelected);
        setShowRightSidebar(newSelected.size > 0);
        soundService.playClick();
    }, [activeTool, user?.workerId, tables]);

    // Auto-initialize tables if missing
    useEffect(() => {
        const initTables = async () => {
            if (!tables || tables.length > 0 || isInitializing) return;

            const project = await db.projects.get(projectId);
            if (project && project.tables && project.tables.length > 0) {
                console.log(`Initializing fieldTables for project ${projectId}...`);
                setIsInitializing(true);
                const newTables: FieldTable[] = project.tables.map(tDef => ({
                    projectId,
                    tableId: tDef.id,
                    tableType: tDef.type === 'S' ? 'small' : tDef.type === 'L' ? 'large' : 'medium',
                    status: 'pending',
                    assignedWorkers: []
                }));
                await db.fieldTables.bulkAdd(newTables);
                setIsInitializing(false);
            }
        };
        initTables();
    }, [projectId, tables, isInitializing]);

    // Default to list view on mobile
    useEffect(() => {
        if (window.innerWidth < 768) {
            setViewMode('list');
            setShowLeftSidebar(false);
        }
    }, []);

    // Handlers

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedIds(new Set());
                selectedIdsRef.current = new Set();
                setShowRightSidebar(false);
            }
            if (selectedIdsRef.current.size > 0) {
                if (e.key === 'c') handleBulkAction('complete');
                if (e.key === 'p') handleBulkAction('pending');
                if (e.key === 'd') handleBulkAction('defect');
                if (e.key === 'Delete') handleBulkAction('pending');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleBulkAction]);

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

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && (e.target as HTMLElement).classList.contains('canvas-area')) {
            isDragging.current = true;
            startPos.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging.current || e.touches.length !== 1) return;
        setOffset({
            x: e.touches[0].clientX - startPos.current.x,
            y: e.touches[0].clientY - startPos.current.y
        });
    };

    const handleTouchEnd = () => {
        isDragging.current = false;
    };


    return (
        <div className="relative w-full h-[85vh] min-h-[500px] md:min-h-[700px] flex overflow-hidden bg-[#020617] font-sans rounded-[3rem] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]">

            {/* Left Sidebar - Statistics & Filters */}
            <aside className={`transition-all duration-500 h-full border-r border-white/5 bg-black/20 backdrop-blur-3xl shrink-0 flex flex-col ${showLeftSidebar ? 'w-80 lg:w-96' : 'w-0 overflow-hidden'}`}>
                <div className="p-8 grow space-y-10 custom-scrollbar overflow-y-auto">
                    <header className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-[0.8] mb-1">FIELD<span className="text-indigo-500">.</span>PLAN</h2>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Interaktivní</p>
                            </div>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Vyhledat stůl..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 transition-all font-bold text-sm"
                            />
                            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </header>

                    <section className="grid grid-cols-2 gap-4">
                        {[
                            { label: 'Celkem', value: stats.total, color: 'text-white', bg: 'bg-white/5' },
                            { label: 'Hotovo', value: stats.completed, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                            { label: 'Proces', value: stats.inProgress, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                            { label: 'Závady', value: stats.defect, color: 'text-rose-500', bg: 'bg-rose-500/10' }
                        ].map((s, i) => (
                            <div key={i} className={`${s.bg} p-5 rounded-[2rem] border border-white/5 group hover:border-white/10 transition-colors`}>
                                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 opacity-50 ${s.color}`}>{s.label}</p>
                                <p className="text-3xl font-black text-white italic tracking-tighter leading-none">{s.value}</p>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Filtr Stavu</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'all', label: 'Vše' },
                                    { id: 'pending', label: 'Čeká' },
                                    { id: 'completed', label: 'Hotovo' },
                                    { id: 'defect', label: 'Závady' }
                                ].map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setFilterStatus(s.id)}
                                        className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterStatus === s.id
                                            ? 'bg-white text-black border-white shadow-lg'
                                            : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-1">Pracovník</label>
                            <div className="relative group">
                                <select
                                    value={filterWorker}
                                    onChange={e => setFilterWorker(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                                    className="w-full bg-black/40 border border-white/5 p-5 rounded-[2rem] text-white font-black italic tracking-tighter text-lg outline-none focus:border-indigo-500/50 transition-all appearance-none"
                                >
                                    <option value="all">Všichni členové</option>
                                    {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </aside>

            {/* Main Interactive Canvas Area */}
            <main ref={containerRef} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className="canvas-area flex-1 relative bg-[radial-gradient(circle_at_50%_50%,_#111827_0%,_#020617_100%)] overflow-hidden">

                {/* Visual Grid Backdrop */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                        backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                        backgroundSize: `${60 * zoom}px ${60 * zoom}px`,
                        transform: `translate(${offset.x % (60 * zoom)}px, ${offset.y % (60 * zoom)}px)`
                    }}
                />

                {/* Helper Tooltip Overlay */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-opacity duration-300">
                    <div className="bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-3">
                        <span className="text-white font-black uppercase text-[10px] tracking-widest">
                            {activeTool === 'cursor' && 'Režim výběru a detailu'}
                            {activeTool === 'complete' && 'Kliknutím označíte HOTOVO'}
                            {activeTool === 'defect' && 'Kliknutím nahlásíte ZÁVADU'}
                            {activeTool === 'pending' && 'Kliknutím RESETUJETE stav'}
                        </span>
                    </div>
                </div>

                {viewMode === 'map' ? (
                    <>
                        <div className="absolute p-40 pointer-events-none touch-none"
                            style={{
                                transform: `translate(${offset.x}px, ${offset.y}px)`,
                                display: 'grid',
                                gridTemplateColumns: `repeat(auto-fit, minmax(${100 * zoom}px, 1fr))`,
                                width: '4000px',
                                gap: `${20 * zoom}px`,
                                transition: isDragging.current ? 'none' : 'transform 0.2s ease-out'
                            }}>
                            {filteredTables.map(table => (
                                <div key={table.id} className="pointer-events-auto">
                                    <TableItem
                                        table={table}
                                        zoom={zoom}
                                        workers={workers || []}
                                        isSelected={selectedIds.has(table.id!.toString())}
                                        completedWorker={table.status === 'completed' ? workers?.find(w => w.id === table.completedBy) : null}
                                        assignedWorkers={table.assignedWorkers?.map(id => workers?.find(w => w.id === id)).filter(Boolean) as Worker[]}
                                        tasks={tasks?.filter(t => t.tableIds?.includes(table.tableId)) || []}
                                        onToggle={handleToggleSelect}
                                        onContextMenu={handleContextMenu}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Status Overlay */}
                        <div className="absolute right-8 top-8 px-6 py-4 bg-[#0f172a]/60 backdrop-blur-2xl border border-white/5 rounded-[2rem] shadow-2xl z-50 pointer-events-none hidden md:block">
                            <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Zvětšení</p>
                                    <p className="text-xl font-black text-white italic tracking-tighter leading-none">{Math.round(zoom * 100)}%</p>
                                </div>
                                <div className="w-px h-8 bg-white/10" />
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Navigace</p>
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tight">Interaktivní mapa</p>
                                </div>
                            </div>
                        </div>

                        {/* Paint Mode Toolbar - Floating Bottom Action Bar */}
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 bg-[#0f172a]/90 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_0_50px_rgba(0,0,0,0.5)] active:scale-[0.98] transition-all">

                            <button
                                onClick={() => setActiveTool('cursor')}
                                className={`p-4 rounded-full transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] group ${activeTool === 'cursor' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 relative -top-2 scale-110' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                                {activeTool === 'cursor' && <span className="text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">Výběr</span>}
                            </button>

                            <div className="w-px h-8 bg-white/10 mx-1"></div>

                            <button
                                onClick={() => setActiveTool('complete')}
                                className={`p-4 rounded-full transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] group ${activeTool === 'complete' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 relative -top-2 scale-110' : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10'}`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {activeTool === 'complete' && <span className="text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">Hotovo</span>}
                            </button>

                            <button
                                onClick={() => setActiveTool('defect')}
                                className={`p-4 rounded-full transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] group ${activeTool === 'defect' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 relative -top-2 scale-110' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-500/10'}`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {activeTool === 'defect' && <span className="text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">Závada</span>}
                            </button>

                            <button
                                onClick={() => setActiveTool('pending')}
                                className={`p-4 rounded-full transition-all flex flex-col items-center justify-center gap-1 min-w-[80px] group ${activeTool === 'pending' ? 'bg-slate-500 text-white shadow-lg shadow-slate-500/40 relative -top-2 scale-110' : 'text-slate-400 hover:text-white hover:bg-slate-500/10'}`}
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                {activeTool === 'pending' && <span className="text-[9px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-bottom-2">Reset</span>}
                            </button>
                        </div>

                        {contextMenu && (
                            <ContextMenu
                                table={contextMenu.table}
                                x={contextMenu.x}
                                y={contextMenu.y}
                                workers={workers || []}
                                onClose={() => setContextMenu(null)}
                                onAction={(action, data) => {
                                    setContextMenu(null);
                                    if (action === 'detail') onTableClick?.(contextMenu.table);
                                    else if (action === 'assign') {
                                        setSelectedIds(new Set([contextMenu.table.id!.toString()]));
                                        handleBulkAction('assign', data);
                                    } else if (action === 'defect') {
                                        setSelectedIds(new Set([contextMenu.table.id!.toString()]));
                                        setShowDefectModal(true);
                                    } else {
                                        setSelectedIds(new Set([contextMenu.table.id!.toString()]));
                                        handleBulkAction(action);
                                    }
                                }}
                            />
                        )}
                    </>
                ) : (
                    <div className="absolute inset-0 overflow-y-auto px-6 pt-28 pb-40 space-y-4 custom-scrollbar bg-[#020617]">
                        {filteredTables.map(table => {
                            const isDone = table.status === 'completed';
                            const isErr = table.status === 'defect';
                            const isWork = table.assignedWorkers?.length;

                            return (
                                <div key={table.id} onClick={() => {
                                    if (activeTool !== 'cursor') {
                                        // Mobile list view paint mode support
                                        if (activeTool === 'defect') {
                                            setSelectedIds(new Set([table.id!.toString()]));
                                            setShowDefectModal(true);
                                        } else {
                                            // Execute direct action
                                            const updates: any = {};
                                            if (activeTool === 'complete') {
                                                updates.status = 'completed';
                                                updates.completedAt = new Date();
                                                updates.completedBy = user?.workerId || 0;
                                            } else if (activeTool === 'pending') {
                                                updates.status = 'pending';
                                                updates.completedAt = undefined;
                                                updates.completedBy = undefined;
                                                updates.assignedWorkers = [];
                                            }

                                            db.fieldTables.update(table.id!, updates);
                                            soundService.playSuccess();
                                        }
                                    } else {
                                        onTableClick?.(table)
                                    }
                                }} className="group bg-[#0a0c1a]/60 border border-white/5 rounded-[2rem] p-6 flex items-center justify-between shadow-xl active:scale-[0.98] transition-all hover:bg-white/[0.04] hover:border-white/10">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-3 h-20 rounded-full transition-all duration-500 ${isDone ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : isErr ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : isWork ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-slate-800'}`}></div>
                                        <div>
                                            <h3 className="text-3xl font-black text-white italic tracking-tighter mb-2 uppercase group-hover:text-indigo-400 transition-colors">{table.tableId}</h3>
                                            <div className={`inline-flex px-4 py-2 rounded-xl text-[10px] uppercase font-black tracking-[0.2em] border ${isDone ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isErr ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : isWork ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-white/5 text-slate-500 border-white/5'}`}>
                                                {isDone ? 'HOTOVO' : isErr ? 'ZÁVADA' : isWork ? 'V PROCESU' : 'ČEKÁ'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center -space-x-4 pl-4">
                                        {table.assignedWorkers?.map(wid => {
                                            const w = workers?.find(wk => wk.id === wid);
                                            if (!w) return null;
                                            return (
                                                <div key={wid}
                                                    className="w-14 h-14 rounded-2xl border-4 border-[#020617] flex items-center justify-center font-black text-white text-sm shadow-2xl relative z-10 transition-transform group-hover:scale-110"
                                                    style={{ backgroundColor: getWorkerColor(wid, w.color, workers || []) }}>
                                                    {getInitials(w.name)}
                                                </div>
                                            )
                                        })}
                                        {(!table.assignedWorkers || table.assignedWorkers.length === 0) && (
                                            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-600">
                                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {filteredTables.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-40 text-slate-700">
                                <svg className="w-20 h-20 mb-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="text-xl font-black italic uppercase tracking-widest opacity-30">Žádné stoly nenalezeny</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Left Sidebar Toggle Button */}
                <button
                    onClick={() => setShowLeftSidebar(!showLeftSidebar)}
                    className="absolute left-6 top-8 w-14 h-14 bg-[#0f172a]/80 backdrop-blur-2xl border border-white/5 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl hover:bg-indigo-600 transition-all z-50 active:scale-90"
                >
                    <svg className={`w-6 h-6 transition-transform duration-500 ${showLeftSidebar ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
            </main>

            {/* Right Sidebar - Selection Context */}
            <aside className={`transition-all duration-500 h-full border-l border-white/5 bg-black/20 backdrop-blur-3xl shrink-0 flex flex-col ${showRightSidebar ? 'w-80 lg:w-96' : 'w-0 overflow-hidden'}`}>
                <div className="p-10 grow space-y-10 overflow-y-auto custom-scrollbar">
                    <header className="space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1">Kontextový výběr</p>
                        <h2 className="text-7xl font-black text-white italic tracking-tighter uppercase leading-[0.8] mb-4">
                            {selectedIds.size}<span className="text-indigo-500 text-5xl align-top ml-2">x</span>
                        </h2>
                        <button onClick={() => { setSelectedIds(new Set()); setShowRightSidebar(false); }} className="px-6 py-3 bg-white/5 border border-white/10 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] rounded-[1rem] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 transition-all w-full">Zrušit výběr</button>
                    </header>

                    <nav className="space-y-4">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Akce týmu</label>

                        <button onClick={() => setShowWorkLogForm(true)} className="group relative w-full overflow-hidden p-6 bg-white text-black rounded-[2rem] transition-all font-black uppercase tracking-widest text-xs flex items-center justify-between shadow-2xl active:scale-[0.98]">
                            <span className="relative z-10">{t('log_work')}</span>
                            <svg className="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>

                        <button onClick={() => handleBulkAction('complete')} className="w-full p-6 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-[2rem] transition-all font-black uppercase tracking-widest text-xs flex items-center justify-between group">
                            <span>Označit hotovo</span>
                            <div className="px-3 py-1 bg-black/20 rounded-lg text-[10px] opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">Klávesa C</div>
                        </button>

                        <button onClick={() => handleBulkAction('pending')} className="w-full p-6 bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 rounded-[2rem] transition-all font-black uppercase tracking-widest text-xs flex items-center justify-between group">
                            <span>Resetovat stav</span>
                            <div className="px-3 py-1 bg-black/20 rounded-lg text-[10px] opacity-40 group-hover:opacity-100 transition-opacity whitespace-nowrap">Klávesa P</div>
                        </button>
                    </nav>

                    <section className="space-y-6">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Rychlé přiřazení</label>
                        <div className="grid grid-cols-1 gap-3">
                            {workers?.map(w => (
                                <button key={w.id} onClick={() => handleBulkAction('assign', w.id)} className="flex items-center gap-5 p-5 rounded-3xl bg-black/40 border border-white/5 hover:border-indigo-500/30 transition-all group overflow-hidden">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xs border border-white/20 shadow-xl group-hover:scale-110 transition-transform flex-shrink-0" style={{ backgroundColor: getWorkerColor(w.id!, w.color, workers || []) }}>{getInitials(w.name)}</div>
                                    <div className="flex-1 text-left min-w-0">
                                        <p className="text-white font-black uppercase italic tracking-tighter text-lg truncate leading-none">{w.name}</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Člen čet</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">
                                        <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* Right Sidebar Footer - Progress */}
                <div className="p-10 border-t border-white/5 bg-black/40 space-y-6">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Postup projektu</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter leading-none">
                                {Math.round((stats.completed / (stats.total || 1)) * 100)}<span className="text-indigo-500 text-2xl">%</span>
                            </p>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }} />
                    </div>
                </div>
            </aside>

            {/* Work Log Form Modal */}
            {showWorkLogForm && (
                <TimeRecordForm
                    onClose={() => {
                        setShowWorkLogForm(false);
                        setSelectedIds(new Set());
                        setShowRightSidebar(false);
                    }}
                    initialTableIds={Array.from(selectedIds)}
                />
            )}

            {/* Defect Reporting Modal */}
            {showDefectModal && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                    <div className="w-full max-w-md bg-slate-900 rounded-[2.5rem] border border-white/10 shadow-2xl p-8 space-y-6 animate-zoom-in">
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                                <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Nahlásit závadu</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                                {selectedIds.size > 0 ? `Týká se ${selectedIds.size} stolů` : 'Běžná závada'}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Popis problému</label>
                            <textarea
                                value={defectNotes}
                                onChange={(e) => setDefectNotes(e.target.value)}
                                className="w-full p-4 bg-black/40 text-white rounded-2xl border border-white/10 focus:border-rose-500/50 outline-none min-h-[120px] text-sm font-bold"
                                placeholder="Např. chybějící šrouby, uražený roh panelu..."
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <button
                                onClick={() => { setShowDefectModal(false); setDefectNotes(''); }}
                                className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 font-black uppercase tracking-widest text-xs transition-colors"
                            >
                                Zrušit
                            </button>
                            <button
                                onClick={() => {
                                    handleBulkAction('defect', defectNotes);
                                    setShowDefectModal(false);
                                    setDefectNotes('');
                                    setSelectedIds(new Set());
                                    setShowRightSidebar(false);
                                }}
                                disabled={!defectNotes.trim()}
                                className="py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/20 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                            >
                                Nahlásit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FieldPlan;
