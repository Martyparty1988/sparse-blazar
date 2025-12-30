import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Project, ProjectTask, Worker } from '../types';
import ConfirmationModal from './ConfirmationModal';
import { firebaseService } from '../services/firebaseService';

interface ProjectTasksModalProps {
    project: Project;
    onClose: () => void;
}

const ProjectTasksModal: React.FC<ProjectTasksModalProps> = ({ project, onClose }) => {
    const { t } = useI18n();
    const tasks = useLiveQuery(() => db.projectTasks.where('projectId').equals(project.id!).toArray(), [project.id]);
    const workers = useLiveQuery(() => db.workers.toArray());

    // Fetch all incomplete tasks to calculate global workload for each worker
    const allActiveTasks = useLiveQuery(() => db.projectTasks.filter(t => !t.completionDate).toArray());

    const [showAddForm, setShowAddForm] = useState(false);
    const [taskType, setTaskType] = useState<'panels' | 'construction' | 'cables'>('construction');
    const [description, setDescription] = useState('');
    const [panelCount, setPanelCount] = useState('');
    const [pricePerPanel, setPricePerPanel] = useState('');
    const [tableSize, setTableSize] = useState<'small' | 'medium' | 'large'>('small');
    const [price, setPrice] = useState('');
    const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
    const [workerFilter, setWorkerFilter] = useState<number | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');

    const workerMap = useMemo(() => new Map(workers?.map(w => [w.id!, w.name])), [workers]);

    // Filtered tasks logic
    const filteredTasks = useMemo(() => {
        if (!tasks) return [];
        return tasks.filter(task => {
            const matchesWorker = workerFilter === 'all' || task.assignedWorkerId === workerFilter;
            const matchesStatus = statusFilter === 'all'
                ? true
                : statusFilter === 'completed'
                    ? !!task.completionDate
                    : !task.completionDate;
            return matchesWorker && matchesStatus;
        });
    }, [tasks, workerFilter, statusFilter]);

    // Individual Progress Logic
    const workerProgress = useMemo(() => {
        if (!tasks || !workers) return [];
        const stats: Record<number, { name: string, total: number, completed: number }> = {};

        tasks.forEach(task => {
            if (task.assignedWorkerId) {
                if (!stats[task.assignedWorkerId]) {
                    stats[task.assignedWorkerId] = {
                        name: workerMap.get(task.assignedWorkerId) || '?',
                        total: 0,
                        completed: 0
                    };
                }
                stats[task.assignedWorkerId].total++;
                if (task.completionDate) stats[task.assignedWorkerId].completed++;
            }
        });

        return Object.entries(stats).map(([id, data]) => ({
            id: Number(id),
            ...data,
            percent: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
        })).sort((a, b) => b.percent - a.percent);
    }, [tasks, workers, workerMap]);

    // Overall Progress Calculations
    const stats = useMemo(() => {
        if (!tasks) return null;
        const total = tasks.length;
        const completed = tasks.filter(t => t.completionDate).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        const breakdown = {
            panels: { total: 0, completed: 0 },
            construction: { total: 0, completed: 0 },
            cables: { total: 0, completed: 0 }
        };

        tasks.forEach(t => {
            breakdown[t.taskType].total++;
            if (t.completionDate) breakdown[t.taskType].completed++;
        });

        return { total, completed, percent, breakdown };
    }, [tasks]);

    const workerLoad = useMemo(() => {
        const load: Record<number, number> = {};
        allActiveTasks?.forEach(t => {
            if (t.assignedWorkerId) {
                load[t.assignedWorkerId] = (load[t.assignedWorkerId] || 0) + 1;
            }
        });
        return load;
    }, [allActiveTasks]);

    const resetForm = () => {
        setShowAddForm(false);
        setTaskType('construction');
        setDescription('');
        setPanelCount('');
        setPricePerPanel('');
        setTableSize('small');
        setPrice('');
    }

    const handleToggleCompletion = async (task: ProjectTask) => {
        const newDate = task.completionDate ? undefined : new Date();
        await db.projectTasks.update(task.id!, {
            completionDate: newDate
        });

        if (firebaseService.isReady) {
            firebaseService.upsertRecords('projectTasks', [{
                ...task,
                completionDate: newDate ? newDate.toISOString() : undefined
            }]).catch(console.error);
        }
    };

    const handleAssignWorker = async (taskId: number, workerId: number | '') => {
        const assignedId = workerId === '' ? undefined : Number(workerId);
        await db.projectTasks.update(taskId, { assignedWorkerId: assignedId });

        if (firebaseService.isReady) {
            const task = await db.projectTasks.get(taskId);
            if (task) {
                firebaseService.upsertRecords('projectTasks', [{
                    ...task,
                    assignedWorkerId: assignedId,
                    completionDate: task.completionDate ? (task.completionDate instanceof Date ? task.completionDate.toISOString() : task.completionDate) : undefined,
                    startTime: task.startTime ? (task.startTime instanceof Date ? task.startTime.toISOString() : task.startTime) : undefined,
                    endTime: task.endTime ? (task.endTime instanceof Date ? task.endTime.toISOString() : task.endTime) : undefined
                }]).catch(console.error);
            }
        }
    };

    const handleDeleteTask = async () => {
        if (taskToDelete !== null) {
            await db.projectTasks.delete(taskToDelete);

            if (firebaseService.isReady) {
                firebaseService.deleteRecords('projectTasks', [String(taskToDelete)])
                    .catch(console.error);
            }

            setTaskToDelete(null);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        let taskData: Omit<ProjectTask, 'id'>;

        switch (taskType) {
            case 'panels':
                const count = Number(panelCount);
                const perPanel = Number(pricePerPanel);
                if (count <= 0 || perPanel <= 0) return;
                taskData = {
                    projectId: project.id!,
                    taskType: 'panels',
                    description: t('panels_task_desc', { count }),
                    panelCount: count,
                    pricePerPanel: perPanel,
                    price: count * perPanel,
                    tableSize: undefined
                };
                break;
            case 'cables':
                if (Number(price) <= 0) return;
                taskData = {
                    projectId: project.id!,
                    taskType: 'cables',
                    description: t('cables_task_desc', { size: t(tableSize) }),
                    tableSize: tableSize,
                    price: Number(price),
                    panelCount: undefined,
                    pricePerPanel: undefined
                };
                break;
            case 'construction':
            default:
                if (!description.trim() || Number(price) <= 0) return;
                taskData = {
                    projectId: project.id!,
                    taskType: 'construction',
                    description: description.trim(),
                    price: Number(price),
                    panelCount: undefined,
                    pricePerPanel: undefined,
                    tableSize: undefined
                };
                break;
        }

        const newId = await db.projectTasks.add(taskData as ProjectTask);

        if (firebaseService.isReady) {
            firebaseService.upsertRecords('projectTasks', [{ ...taskData, id: newId }])
                .catch(console.error);
        }

        resetForm();
    };

    const calculatedPrice = useMemo(() => {
        if (taskType === 'panels') {
            const count = Number(panelCount);
            const perPanel = Number(pricePerPanel);
            return (count * perPanel) || 0;
        }
        return Number(price) || 0;
    }, [taskType, panelCount, pricePerPanel, price]);

    const taskTypeOptions: { id: 'construction' | 'panels' | 'cables'; label: string }[] = [
        { id: 'construction', label: t('construction') },
        { id: 'panels', label: t('panels') },
        { id: 'cables', label: t('cables') }
    ];

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-lg p-0 md:p-4 animate-fade-in">
            <div className="w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl p-6 md:p-8 bg-slate-900/90 md:bg-slate-900/80 backdrop-blur-3xl md:rounded-[2.5rem] shadow-2xl border-none md:border border-white/10 flex flex-col">
                <div className="flex-shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-4xl font-black text-white tracking-tight uppercase italic">{t('tasks')}</h2>
                            <p className="text-lg text-blue-200/60 font-bold">{project.name}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onClose}
                                className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                            >
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                    </div>

                    {/* Individual Progress Dashboard */}
                    <div className="mb-6 overflow-hidden">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Týmový výkon</h3>
                            <div className="flex gap-2">
                                <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 mr-2">
                                    {(['all', 'pending', 'completed'] as const).map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setStatusFilter(status)}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${statusFilter === status ? 'bg-white text-black' : 'text-slate-500 hover:text-white'}`}
                                        >
                                            {status === 'all' ? 'Vše' : status === 'pending' ? 'Čeká' : 'Hotovo'}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => { setWorkerFilter('all'); setStatusFilter('all'); }}
                                    className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded text-blue-400 hover:text-white transition-colors"
                                >
                                    Resetovat filtr
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
                            {workerProgress.map(wp => (
                                <button
                                    key={wp.id}
                                    onClick={() => setWorkerFilter(wp.id)}
                                    className={`flex-shrink-0 min-w-[160px] p-4 rounded-2xl border transition-all ${workerFilter === wp.id ? 'bg-indigo-600/30 border-indigo-500/50 shadow-lg scale-105' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-black text-white truncate max-w-[80px]">{wp.name}</span>
                                        <span className="text-[10px] font-mono font-bold text-indigo-300">{wp.completed}/{wp.total}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-700"
                                            style={{ width: `${wp.percent}%` }}
                                        ></div>
                                    </div>
                                    <div className="mt-1 text-[9px] font-bold text-slate-500 text-right uppercase tracking-tighter">
                                        {wp.percent}% Dokončeno
                                    </div>
                                </button>
                            ))}
                            {workerProgress.length === 0 && (
                                <div className="w-full text-center py-4 bg-white/5 rounded-2xl border border-dashed border-white/10">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Zatím žádná přiřazení</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Overall Progress Progress Bar */}
                    {stats && (
                        <div className="mb-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 px-1">
                                <span>Celkový postup úkolů</span>
                                <span className="text-white">{stats.percent}% ({stats.completed}/{stats.total})</span>
                            </div>
                            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-1000"
                                    style={{ width: `${stats.percent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-3 custom-scrollbar">
                    {filteredTasks && filteredTasks.length > 0 ? (
                        filteredTasks.map(task => (
                            <div key={task.id} className={`p-5 rounded-3xl group transition-all border border-white/5 ${task.completionDate ? 'bg-emerald-900/10 border-emerald-500/10' : 'bg-white/5 hover:bg-white/10'}`}>
                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="flex-grow">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${task.completionDate ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                {task.taskType}
                                            </span>
                                            {task.assignedWorkerId && (
                                                <span
                                                    onClick={() => setWorkerFilter(task.assignedWorkerId!)}
                                                    className="text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-2 py-1 rounded-lg border border-indigo-400/20 cursor-pointer hover:bg-indigo-400/20"
                                                >
                                                    {workerMap.get(task.assignedWorkerId)}
                                                </span>
                                            )}
                                            {task.completionDate && (
                                                <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                                    ✓ {new Date(task.completionDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-lg font-bold leading-tight ${task.completionDate ? 'text-gray-500 line-through' : 'text-white'}`}>
                                            {task.description}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <div className="px-4 py-2 rounded-xl bg-black/20 border border-white/5">
                                            <span className="font-mono font-bold text-white text-sm">€{task.price.toFixed(2)}</span>
                                        </div>

                                        <select
                                            value={task.assignedWorkerId || ''}
                                            onChange={(e) => handleAssignWorker(task.id!, e.target.value === '' ? '' : Number(e.target.value))}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer ${task.assignedWorkerId
                                                ? 'bg-blue-600/20 text-blue-200 border-blue-500/30'
                                                : 'bg-white/5 text-gray-400 border-white/10'
                                                } [&>option]:bg-slate-900`}
                                            disabled={!!task.completionDate}
                                        >
                                            <option value="">Přiřadit...</option>
                                            {workers?.map(w => {
                                                const load = workerLoad[w.id!] || 0;
                                                return (
                                                    <option key={w.id} value={w.id}>
                                                        {w.name} ({load})
                                                    </option>
                                                );
                                            })}
                                        </select>

                                        <button
                                            onClick={() => handleToggleCompletion(task)}
                                            className={`p-2.5 rounded-xl transition-all shadow-lg active:scale-95 ${task.completionDate
                                                ? 'bg-amber-500/20 text-amber-400'
                                                : 'bg-emerald-500 text-black'
                                                }`}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                        </button>

                                        <button
                                            onClick={() => setTaskToDelete(task.id!)}
                                            className="p-2.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-16 opacity-50">
                            <p className="text-xl font-bold text-gray-400">{t('no_tasks_found')}</p>
                            <p className="text-xs text-slate-500 mt-2">Zkuste změnit filtry nebo přidat nový úkol.</p>
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 mt-6 pt-6 border-t border-white/10">
                    {showAddForm ? (
                        <form onSubmit={handleAddTask} className="space-y-4 animate-fade-in bg-white/5 p-6 rounded-3xl border border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xl font-black text-white uppercase tracking-wide">{t('add_task')}</h3>
                                <div className="inline-flex rounded-xl bg-black/40 p-1 border border-white/10">
                                    {taskTypeOptions.map(opt => (
                                        <button key={opt.id} type="button" onClick={() => setTaskType(opt.id)} className={`px-4 py-2 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider ${taskType === opt.id ? 'bg-white text-black shadow-lg' : 'text-gray-400'}`}>{opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            {taskType === 'construction' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('task_description')} required className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl focus:ring-1 focus:ring-indigo-500 font-bold" />
                                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={t('flat_rate')} min="0" step="0.01" required className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl focus:ring-1 focus:ring-indigo-500 font-bold" />
                                </div>
                            )}
                            {taskType === 'panels' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="number" value={panelCount} onChange={e => setPanelCount(e.target.value)} placeholder={t('panel_count')} min="1" step="1" required className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl focus:ring-1 focus:ring-indigo-500 font-bold" />
                                    <input type="number" value={pricePerPanel} onChange={e => setPricePerPanel(e.target.value)} placeholder={t('price_per_panel')} min="0" step="0.01" required className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl focus:ring-1 focus:ring-indigo-500 font-bold" />
                                </div>
                            )}
                            {taskType === 'cables' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <select value={tableSize} onChange={e => setTableSize(e.target.value as any)} className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl font-bold [&>option]:bg-gray-900">
                                        <option value="small">{t('small')}</option>
                                        <option value="medium">{t('medium')}</option>
                                        <option value="large">{t('large')}</option>
                                    </select>
                                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={t('task_price')} min="0" step="0.01" required className="p-4 bg-black/30 text-white border border-white/10 rounded-2xl focus:ring-1 focus:ring-indigo-500 font-bold" />
                                </div>
                            )}
                            <div className="flex justify-between items-center pt-2">
                                <div className="text-xl font-black text-white tracking-tight">€{calculatedPrice.toFixed(2)}</div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={resetForm} className="px-6 py-3 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-colors uppercase tracking-wider text-xs">{t('cancel')}</button>
                                    <button type="submit" className="px-8 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] shadow-lg transition-all active:scale-95 uppercase tracking-wider text-xs">{t('add')}</button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="w-full py-5 bg-white/5 border-2 border-dashed border-white/10 text-gray-400 font-bold rounded-3xl hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2"
                        >
                            + {t('add_task')}
                        </button>
                    )}
                </div>
            </div>

            {taskToDelete !== null && (
                <ConfirmationModal
                    title={t('delete_task_title')}
                    message={t('confirm_delete')}
                    onConfirm={handleDeleteTask}
                    onCancel={() => setTaskToDelete(null)}
                    variant="danger"
                />
            )}
        </div>
    );
};

export default ProjectTasksModal;