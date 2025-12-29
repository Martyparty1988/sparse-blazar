
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Project, SolarTable, TableAssignment, Worker, AnnotationPath, PlanAnnotation, TableStatusHistory } from '../types';
import CheckCircleIcon from './icons/CheckCircleIcon';
import ClockIcon from './icons/ClockIcon';
import PencilSwooshIcon from './icons/PencilSwooshIcon';
import EraserIcon from './icons/EraserIcon';
import UndoIcon from './icons/UndoIcon';
import RedoIcon from './icons/RedoIcon';
import TrashIcon from './icons/TrashIcon';
import ColorSwatchIcon from './icons/ColorSwatchIcon';
import ConfirmationModal from './ConfirmationModal';
import MapIcon from './icons/MapIcon';
import { useTouchGestures } from '../hooks/useTouchGestures';

declare const pdfjsLib: any;

// Helper to get a consistent color for a worker
const getWorkerColor = (workerId: number) => {
    const colors = [
        '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
        '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ];
    return colors[workerId % colors.length];
};

// --- Table Management Modal ---
interface TableManagementModalProps {
    table?: SolarTable;
    coords?: { x: number; y: number };
    projectId: number;
    onClose: () => void;
}

const TableManagementModal: React.FC<TableManagementModalProps> = ({ table, coords, projectId, onClose }) => {
    const { t } = useI18n();
    const [tableCode, setTableCode] = useState('');
    const [tableType, setTableType] = useState<'small' | 'medium' | 'large'>('small');
    const [status, setStatus] = useState<'pending' | 'completed'>('pending');
    const [workerToAssign, setWorkerToAssign] = useState<number | ''>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const workers: Worker[] | undefined = useLiveQuery(() => db.workers.toArray());
    const assignments = useLiveQuery(() => table ? db.tableAssignments.where('tableId').equals(table.id!).toArray() : [], [table]);
    const workerMap = useMemo(() => new Map(workers?.map(w => [w.id!, w]) || []), [workers]);

    useEffect(() => {
        if (table) {
            setTableCode(table.tableCode);
            setTableType(table.tableType);
            setStatus(table.status);
        }
    }, [table]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const getTableTypeFromCode = (code: string): 'small' | 'medium' | 'large' => {
            const c = code.toLowerCase();
            if (c.startsWith('it28')) return 'small';
            if (c.startsWith('it42')) return 'medium';
            if (c.startsWith('it56')) return 'large';
            return tableType;
        };

        if (table?.id) {
            await db.solarTables.update(table.id, {
                tableCode,
                tableType: getTableTypeFromCode(tableCode),
                status
            });
        } else if (coords) {
            const tableData: Omit<SolarTable, 'id'> = {
                projectId,
                x: coords.x,
                y: coords.y,
                tableCode,
                tableType: getTableTypeFromCode(tableCode),
                status,
            };
            await db.solarTables.add(tableData as SolarTable);
        }
        onClose();
    };

    const handleDelete = async () => {
        if (table?.id) {
            await db.transaction('rw', db.solarTables, db.tableAssignments, db.tableStatusHistory, async () => {
                await db.tableStatusHistory.where('tableId').equals(table.id!).delete();
                await db.tableAssignments.where('tableId').equals(table.id!).delete();
                await db.solarTables.delete(table.id!);
            });
            onClose();
        }
    };

    const handleAssignWorker = async () => {
        if (!table || !workerToAssign) return;
        const assignment = { tableId: table.id!, workerId: Number(workerToAssign) };
        const existing = await db.tableAssignments.where(assignment).first();
        if (!existing) {
            await db.tableAssignments.add(assignment);
        }
        setWorkerToAssign('');
    };

    const handleUnassignWorker = async (assignmentId: number) => {
        await db.tableAssignments.delete(assignmentId);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                <div className="w-full max-w-lg p-8 bg-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <h2 className="text-3xl font-bold mb-6 text-white border-b border-white/10 pb-4">{table ? t('edit_table') : t('add_table')}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="table-code" className="block text-lg font-medium text-gray-300 mb-2">{t('table_code')}</label>
                                <input
                                    type="text"
                                    id="table-code"
                                    value={tableCode}
                                    onChange={e => setTableCode(e.target.value)}
                                    required
                                    className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl focus:ring-blue-400 text-lg"
                                    placeholder={t('table_code_placeholder')}
                                />
                            </div>

                            <div>
                                <label htmlFor="table-type" className="block text-lg font-medium text-gray-300 mb-2">{t('table_type')}</label>
                                <select
                                    id="table-type"
                                    value={tableType}
                                    onChange={e => setTableType(e.target.value as 'small' | 'medium' | 'large')}
                                    className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800"
                                >
                                    <option value="small">{t('small')}</option>
                                    <option value="medium">{t('medium')}</option>
                                    <option value="large">{t('large')}</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="table-status" className="block text-lg font-medium text-gray-300 mb-2">{t('status')}</label>
                                <select
                                    id="table-status"
                                    value={status}
                                    onChange={e => setStatus(e.target.value as 'pending' | 'completed')}
                                    className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800"
                                >
                                    <option value="pending">{t('pending')}</option>
                                    <option value="completed">{t('completed')}</option>
                                </select>
                            </div>

                            {table && (
                                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <label className="block text-lg font-medium text-gray-300 mb-3">{t('assigned_workers')}</label>
                                    {assignments && assignments.length > 0 ? (
                                        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
                                            {assignments.map(a => (
                                                <div key={a.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                                    <span className="text-gray-200">{workerMap.get(a.workerId)?.name || '...'}</span>
                                                    <button type="button" onClick={() => handleUnassignWorker(a.id!)} className="text-red-400 text-sm font-bold">{t('unassign')}</button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 mb-4 italic">{t('unassigned')}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <select
                                            value={workerToAssign}
                                            onChange={e => setWorkerToAssign(Number(e.target.value))}
                                            className="flex-grow p-3 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800"
                                        >
                                            <option value="" disabled>{t('select_worker')}</option>
                                            {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                        <button type="button" onClick={handleAssignWorker} disabled={!workerToAssign} className="px-4 bg-[var(--color-primary)] text-white font-bold rounded-xl">{t('add')}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end space-x-4 mt-8">
                            {table && <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-6 py-3 bg-pink-600 text-white font-bold rounded-xl">{t('delete')}</button>}
                            <button type="button" onClick={onClose} className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl">{t('cancel')}</button>
                            <button type="submit" className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl">{t('save')}</button>
                        </div>
                    </form>
                </div>
            </div>
            {showDeleteConfirm && (
                <ConfirmationModal
                    title={t('delete_table_title')}
                    message={t('delete_table_confirm', { code: tableCode })}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(false)}
                />
            )}
        </>
    );
};

// --- Plan View ---
const Plan: React.FC = () => {
    const { t } = useI18n();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
    const [pageNum, setPageNum] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [zoom, setZoom] = useState(1.0);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

    const [modalCoords, setModalCoords] = useState<{ x: number; y: number } | null>(null);
    const [editingTable, setEditingTable] = useState<SolarTable | undefined>(undefined);

    const [drawingMode, setDrawingMode] = useState<'pencil' | 'eraser' | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [paths, setPaths] = useState<AnnotationPath[]>([]);
    const [redoStack, setRedoStack] = useState<AnnotationPath[]>([]);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [strokeColor, setStrokeColor] = useState('#ff0000');

    // Touch gestures for mobile
    const { touchHandlers, resetGestures } = useTouchGestures({
        onPinch: (newScale) => {
            setZoom(Math.max(0.5, Math.min(3, newScale)));
        },
        onPan: (deltaX, deltaY) => {
            if (!drawingMode) {
                setPanOffset(prev => ({
                    x: prev.x + deltaX,
                    y: prev.y + deltaY
                }));
            }
        },
        onDoubleTap: () => {
            setZoom(1.0);
            setPanOffset({ x: 0, y: 0 });
        },
        minScale: 0.5,
        maxScale: 3
    });

    // Ref to track what project/page the local paths/redoStack belong to
    const lastLoadedViewRef = useRef<{ projectId: number | '', pageNum: number }>({ projectId: '', pageNum: 1 });

    const projects = useLiveQuery(() => db.projects.toArray());
    const selectedProject = useMemo(() => projects?.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
    const tables = useLiveQuery(() => selectedProjectId ? db.solarTables.where('projectId').equals(selectedProjectId).toArray() : [], [selectedProjectId]);

    // Live query for existing annotations
    const annotations = useLiveQuery(
        () => (selectedProjectId && pageNum) ? db.planAnnotations.where({ projectId: selectedProjectId, page: pageNum }).first() : null,
        [selectedProjectId, pageNum]
    );

    // Load annotations into state when project/page changes
    useEffect(() => {
        if (selectedProjectId !== lastLoadedViewRef.current.projectId || pageNum !== lastLoadedViewRef.current.pageNum) {
            if (annotations) {
                setPaths(annotations.paths);
            } else {
                setPaths([]);
            }
            setRedoStack([]);
            lastLoadedViewRef.current = { projectId: selectedProjectId, pageNum };
        }
    }, [annotations, selectedProjectId, pageNum]);

    useEffect(() => {
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
        }
    }, []);

    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return;
        setIsLoading(true);
        try {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: zoom });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (annotationCanvasRef.current) {
                annotationCanvasRef.current.height = viewport.height;
                annotationCanvasRef.current.width = viewport.width;
            }

            await page.render({ canvasContext: context, viewport }).promise;
            drawPaths();
        } catch (err) {
            console.error("PDF render failed:", err);
        } finally {
            setIsLoading(false);
        }
    }, [pdfDoc, pageNum, zoom]);

    useEffect(() => {
        if (selectedProject?.planFile) {
            const loadPdf = async () => {
                const arrayBuffer = await selectedProject.planFile!.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                setPdfDoc(pdf);
                setTotalPages(pdf.numPages);
                setPageNum(1);
            };
            loadPdf();
        } else {
            setPdfDoc(null);
            setTotalPages(0);
        }
    }, [selectedProject]);

    useEffect(() => {
        renderPage();
    }, [renderPage]);

    const drawPaths = useCallback(() => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        paths.forEach(path => {
            ctx.beginPath();
            ctx.strokeStyle = path.tool === 'eraser' ? '#ffffff00' : path.color;
            ctx.lineWidth = path.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = path.tool === 'eraser' ? 'destination-out' : 'source-over';

            if (path.points.length > 0) {
                ctx.moveTo(path.points[0].x * canvas.width / 100, path.points[0].y * canvas.height / 100);
                path.points.forEach(p => ctx.lineTo(p.x * canvas.width / 100, p.y * canvas.height / 100));
            }
            ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
    }, [paths]);

    useEffect(() => {
        drawPaths();
    }, [drawPaths]);

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (drawingMode) return;
        const rect = containerRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setModalCoords({ x, y });
        setEditingTable(undefined);
    };

    const savePathsToDB = async (currentPaths: AnnotationPath[]) => {
        if (!selectedProjectId || !pageNum) return;
        const existing = await db.planAnnotations.where({ projectId: selectedProjectId, page: pageNum }).first();
        if (existing) {
            await db.planAnnotations.update(existing.id!, { paths: currentPaths });
        } else {
            await db.planAnnotations.add({ projectId: selectedProjectId as number, page: pageNum, paths: currentPaths });
        }
    };

    const startDrawing = (e: React.MouseEvent) => {
        if (!drawingMode) return;
        setIsDrawing(true);
        const rect = annotationCanvasRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPaths([...paths, { color: strokeColor, strokeWidth, tool: drawingMode, points: [{ x, y }] }]);
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing) return;
        const rect = annotationCanvasRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        const newPaths = [...paths];
        newPaths[newPaths.length - 1].points.push({ x, y });
        setPaths(newPaths);
    };

    const stopDrawing = async () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        await savePathsToDB(paths);
    };

    const undo = async () => {
        if (paths.length === 0) return;
        const last = paths[paths.length - 1];
        const newPaths = paths.slice(0, -1);
        setRedoStack([...redoStack, last]);
        setPaths(newPaths);
        await savePathsToDB(newPaths);
    };

    const redo = async () => {
        if (redoStack.length === 0) return;
        const last = redoStack[redoStack.length - 1];
        const newPaths = [...paths, last];
        setPaths(newPaths);
        setRedoStack(redoStack.slice(0, -1));
        await savePathsToDB(newPaths);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-bold text-white">{t('plan')}</h1>
                    <select
                        value={selectedProjectId}
                        onChange={e => setSelectedProjectId(Number(e.target.value))}
                        className="bg-black/20 text-white p-3 rounded-xl border border-white/20 focus:ring-2 focus:ring-blue-400 [&>option]:bg-gray-800"
                    >
                        <option value="" disabled>{t('select_project')}</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                {pdfDoc && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center bg-black/30 rounded-xl p-1 border border-white/10">
                            <button onClick={() => setDrawingMode(drawingMode === 'pencil' ? null : 'pencil')} className={`p-2 rounded-lg transition-colors ${drawingMode === 'pencil' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}><PencilSwooshIcon className="w-5 h-5" /></button>
                            <button onClick={() => setDrawingMode(drawingMode === 'eraser' ? null : 'eraser')} className={`p-2 rounded-lg transition-colors ${drawingMode === 'eraser' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10'}`}><EraserIcon className="w-5 h-5" /></button>
                            <button onClick={undo} className="p-2 text-gray-400 hover:bg-white/10 rounded-lg"><UndoIcon className="w-5 h-5" /></button>
                            <button onClick={redo} className="p-2 text-gray-400 hover:bg-white/10 rounded-lg"><RedoIcon className="w-5 h-5" /></button>
                        </div>

                        <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/10">
                            <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum === 1} className="px-3 py-1 text-white disabled:opacity-30">‹</button>
                            <span className="text-sm font-mono text-white">{pageNum}/{totalPages}</span>
                            <button onClick={() => setPageNum(p => Math.min(totalPages, p + 1))} disabled={pageNum === totalPages} className="px-3 py-1 text-white disabled:opacity-30">›</button>
                        </div>

                        <div className="flex items-center gap-2 bg-black/30 rounded-xl p-1 border border-white/10">
                            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="px-3 py-1 text-white">-</button>
                            <span className="text-xs font-mono text-white">{Math.round(zoom * 100)}%</span>
                            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="px-3 py-1 text-white">+</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="relative flex justify-center bg-gray-950 p-4 md:p-8 rounded-3xl border border-white/5 overflow-hidden min-h-[60vh] shadow-inner">
                {isLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}

                {pdfDoc ? (
                    <div
                        className="relative overflow-auto custom-scrollbar w-full h-full flex items-center justify-center"
                        {...touchHandlers}
                    >
                        <div
                            ref={containerRef}
                            className="relative shadow-2xl transition-transform duration-100"
                            onClick={handleCanvasClick}
                            style={{
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                                transformOrigin: 'center center'
                            }}
                        >
                            <canvas ref={canvasRef} className="rounded-lg shadow-lg" />
                            <canvas
                                ref={annotationCanvasRef}
                                className="absolute inset-0 z-2 pointer-events-auto cursor-crosshair touch-none"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                style={{ pointerEvents: drawingMode ? 'auto' : 'none' }}
                            />
                            {tables?.map(t => (
                                <div
                                    key={t.id}
                                    onClick={(e) => { e.stopPropagation(); setEditingTable(t); setModalCoords(null); }}
                                    className={`absolute w-6 h-6 md:w-4 md:h-4 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-150 active:scale-125 z-10 ${t.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}
                                    style={{ left: `${t.x}%`, top: `${t.y}%`, transform: 'translate(-50%, -50%)' }}
                                    title={t.tableCode}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-500 text-xl font-bold flex flex-col items-center justify-center h-full space-y-4">
                        <MapIcon className="w-16 h-16 opacity-20" />
                        <p className="text-center px-4">{selectedProjectId ? t('no_plan_available') : t('select_project_to_view_plan')}</p>
                    </div>
                )}

                {/* Mobile zoom hint */}
                {pdfDoc && (
                    <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-2 rounded-full backdrop-blur-sm">
                        👆 Pinch to zoom • Double tap to reset
                    </div>
                )}
            </div>

            {(modalCoords || editingTable) && (
                <TableManagementModal
                    projectId={selectedProjectId as number}
                    coords={modalCoords || undefined}
                    table={editingTable}
                    onClose={() => { setModalCoords(null); setEditingTable(undefined); }}
                />
            )}
        </div>
    );
};

export default Plan;
