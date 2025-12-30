import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { googleSheetsService } from '../services/googleSheetsService';
import type { Project, SolarTable, ProjectTask } from '../types';
import ProjectForm from './ProjectForm';
import ChartBarIcon from './icons/ChartBarIcon';
import ProjectTasksModal from './ProjectTasksModal';
import ConfirmationModal from './ConfirmationModal';
import MapIcon from './icons/MapIcon';
import PlusIcon from './icons/PlusIcon';
import ClockIcon from './icons/ClockIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import SearchIcon from './icons/SearchIcon';
import WorkersIcon from './icons/WorkersIcon';
import ShareIcon from './icons/ShareIcon';
import BackButton from './BackButton';

const ChevronDownIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m6 9 6 6 6-6" /></svg>
);

const TaskProgressRing: React.FC<{ percentage: number }> = ({ percentage }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center w-14 h-14" title={`${percentage}% dokončeno`}>
            <svg className="w-full h-full transform -rotate-90">
                <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-white/5"
                />
                <circle
                    cx="28"
                    cy="28"
                    r={radius}
                    stroke="url(#taskGradient)"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s ease-out' }}
                    strokeLinecap="round"
                />
                <defs>
                    <linearGradient id="taskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#d946ef" />
                    </linearGradient>
                </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white font-mono">
                {percentage}%
            </span>
        </div>
    );
};

const ProjectCard: React.FC<{
    project: Project;
    index: number;
    isAdmin: boolean;
    onEdit: (p: Project) => void;
    onDelete: (p: Project) => void;
    onManageTasks: (p: Project) => void;
    onSync: (p: Project) => void;
}> = ({ project, index, isAdmin, onEdit, onDelete, onManageTasks, onSync }) => {
    const { t, language } = useI18n();
    const [isExpanded, setIsExpanded] = useState(false);

    // Live Queries for statistics
    const tables = useLiveQuery(() => db.solarTables.where('projectId').equals(project.id!).toArray(), [project.id]);
    const tasks = useLiveQuery(() => db.projectTasks.where('projectId').equals(project.id!).toArray(), [project.id]);

    const stats = useMemo(() => {
        const totalTables = tables?.length || 0;
        const completedTables = tables?.filter(t => t.status === 'completed').length || 0;
        const tableProgress = totalTables > 0 ? Math.round((completedTables / totalTables) * 100) : 0;

        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => !!t.completionDate).length || 0;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Breakdown for expansion
        const breakdown = {
            panels: tasks?.filter(t => t.taskType === 'panels').length || 0,
            construction: tasks?.filter(t => t.taskType === 'construction').length || 0,
            cables: tasks?.filter(t => t.taskType === 'cables').length || 0,
        };

        return { totalTables, completedTables, tableProgress, totalTasks, completedTasks, taskProgress, breakdown };
    }, [tables, tasks]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'from-emerald-400 to-teal-500';
            case 'completed': return 'from-indigo-400 to-blue-500';
            case 'on_hold': return 'from-amber-400 to-orange-500';
            default: return 'from-slate-400 to-slate-500';
        }
    };

    return (
        <div
            className="group relative flex flex-col overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/40 backdrop-blur-3xl shadow-2xl transition-all duration-500 animate-list-item w-full max-w-[100vw]"
            style={{ animationDelay: `${index * 0.07}s` }}
        >
            {/* Glossy Overlay Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none"></div>
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--color-primary)] opacity-[0.07] blur-[100px] transition-all duration-700 group-hover:opacity-15 group-hover:scale-125"></div>

            <div className="relative z-10 flex flex-col h-full p-6 md:p-8">
                {/* Header: Status, Progress Ring & Admin Tools */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`px-4 py-1.5 rounded-full border border-white/10 bg-black/30 backdrop-blur-md flex items-center gap-2.5 shadow-xl`}>
                            <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${getStatusColor(project.status)} shadow-[0_0_12px_rgba(255,255,255,0.3)] animate-pulse`}></div>
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white/90">{t(project.status as any)}</span>
                        </div>
                        <TaskProgressRing percentage={stats.taskProgress} />
                    </div>

                    {isAdmin && (
                        <div className="flex gap-2">
                            {/* Create Plan / Map Button */}
                            <Link
                                to={`/plan?projectId=${project.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-purple-400 hover:bg-purple-500 hover:text-white backdrop-blur-md transition-all active:scale-90 border border-white/5 shadow-lg"
                                title={t('field_plan')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                            </Link>

                            {/* Sync Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onSync(project) }}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-emerald-400 hover:bg-emerald-500 hover:text-white backdrop-blur-md transition-all active:scale-90 border border-white/5 shadow-lg"
                                title={t('sync_to_sheets')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </button>

                            {/* Edit Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(project) }}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-blue-300 hover:bg-blue-500 hover:text-white backdrop-blur-md transition-all active:scale-90 border border-white/5 shadow-lg"
                                title={t('edit_project')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>

                            {/* Delete Button */}
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(project) }}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-rose-400 hover:bg-rose-500 hover:text-white backdrop-blur-md transition-all active:scale-90 border border-white/5 shadow-lg"
                                title={t('delete_project')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Content: Title & Description */}
                <div className="mb-6 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex items-center justify-between mb-2.5">
                        <h3 className="text-2xl md:text-3xl font-black tracking-tight text-white group-hover:text-[var(--color-accent)] transition-colors line-clamp-1 italic uppercase">{project.name}</h3>
                        <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[var(--color-accent)]' : ''}`} />
                    </div>

                    <p className={`text-sm font-medium leading-relaxed text-slate-400 transition-all duration-300 ${isExpanded ? '' : 'line-clamp-2 min-h-[3em]'}`}>
                        {project.description || t('no_data')}
                    </p>

                    {isExpanded && (
                        <div className="mt-6 space-y-4 animate-fade-in">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">{t('panels')}</div>
                                    <div className="text-lg font-black text-white">{stats.breakdown.panels}</div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">{t('construction')}</div>
                                    <div className="text-lg font-black text-white">{stats.breakdown.construction}</div>
                                </div>
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center">
                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">{t('cables')}</div>
                                    <div className="text-lg font-black text-white">{stats.breakdown.cables}</div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-white/5 space-y-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                    <span>{t('created_at')}</span>
                                    <span className="text-slate-400">{project.createdAt ? new Date(project.createdAt).toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US') : '-'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-600">
                                    <span>{t('updated_at')}</span>
                                    <span className="text-slate-400">{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US') : '-'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {project.googleSpreadsheetId && !isExpanded && (
                        <div className="flex items-center gap-2 mt-3 text-[9px] font-black uppercase tracking-[0.1em] text-slate-500 bg-white/5 w-fit px-3 py-1 rounded-full border border-white/5" title={t('last_sync')}>
                            <ShareIcon className="h-3 w-3 opacity-50" />
                            <span>{t('last_sync')}: {project.lastSync ? new Date(project.lastSync).toLocaleString() : t('never')}</span>
                        </div>
                    )}
                </div>

                {/* Progress Indicators */}
                <div className="space-y-6 mb-8">
                    {/* Tables Progress */}
                    <div className="space-y-2">
                        <div className="flex items-end justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500" title={t('tables')}>{t('tables')}</span>
                            <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                {stats.tableProgress}% <span className="text-slate-500 ml-1">({stats.completedTables}/{stats.totalTables})</span>
                            </span>
                        </div>
                        <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 shadow-inner">
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                                style={{ width: `${stats.tableProgress}%` }}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Progress Bar */}
                    <div className="space-y-2">
                        <div className="flex items-end justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500" title={t('tasks')}>{t('tasks')}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                    {stats.taskProgress}%
                                </span>
                                <span className="font-mono text-xs font-bold text-white bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                    {stats.completedTasks}/{stats.totalTasks}
                                </span>
                            </div>
                        </div>
                        <div className="relative h-4 w-full overflow-hidden rounded-full bg-black/40 border border-white/5 shadow-inner group-hover:border-white/10 transition-colors">
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-violet-600 via-purple-500 to-fuchsia-500 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(167,139,250,0.5)]"
                                style={{ width: `${stats.taskProgress}%` }}
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>
                        {stats.totalTasks === 0 && (
                            <div className="text-[9px] text-slate-600 italic text-center w-full">
                                {t('no_tasks_found')}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions: Glass Buttons */}
                <div className="mt-auto">
                    <button
                        onClick={() => onManageTasks(project)}
                        className="group/btn relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl bg-white/5 py-4 backdrop-blur-md transition-all hover:bg-white/10 active:scale-95 border border-white/5 shadow-xl w-full"
                        title={t('tasks')}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                        <ClockIcon className="h-6 w-6 text-indigo-400 transition-transform duration-300 group-hover/btn:scale-110 group-hover/btn:text-white" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/btn:text-white">{t('tasks')}</span>
                    </button>
                </div>
            </div>

            {/* Bottom Accent Bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${getStatusColor(project.status)} opacity-30`}></div>
        </div>
    );
};

const Projects: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all');
    const [workerFilter, setWorkerFilter] = useState<number | 'all'>('all');
    const [managingTasksFor, setManagingTasksFor] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [syncing, setSyncing] = useState(false);

    const projects = useLiveQuery(() => db.projects.toArray(), []);
    const workers = useLiveQuery(() => db.workers.toArray(), []);
    const allTasks = useLiveQuery(() => db.projectTasks.toArray(), []);
    const allAssignments = useLiveQuery(() => db.tableAssignments.toArray(), []);
    const allTables = useLiveQuery(() => db.solarTables.toArray(), []);

    const projectsWithWorker = useMemo(() => {
        if (workerFilter === 'all' || !allTasks || !allAssignments || !allTables) return null;
        const projectIds = new Set<number>();
        allTasks.forEach(task => { if (task.assignedWorkerId === workerFilter) projectIds.add(task.projectId); });
        const tableProjectMap = new Map<number, number>();
        allTables.forEach(t => tableProjectMap.set(t.id!, t.projectId));
        allAssignments.forEach(assignment => {
            const projectId = tableProjectMap.get(assignment.tableId);
            if (assignment.workerId === workerFilter && projectId) projectIds.add(projectId);
        });
        return projectIds;
    }, [workerFilter, allTasks, allAssignments, allTables]);

    const filteredProjects = useMemo(() => {
        if (!projects) return [];
        return projects
            .filter(project => statusFilter === 'all' ? true : project.status === statusFilter)
            .filter(project => !searchTerm ? true : project.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(project => workerFilter === 'all' ? true : projectsWithWorker?.has(project.id!))
            .sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
            });
    }, [projects, searchTerm, statusFilter, workerFilter, projectsWithWorker]);

    const handleAdd = () => { setSelectedProject(undefined); setShowForm(true); };
    const handleEdit = (project: Project) => { setSelectedProject(project); setShowForm(true); };
    const confirmDelete = (project: Project) => { setProjectToDelete(project); };

    const handleDelete = async () => {
        if (projectToDelete?.id) {
            await db.transaction('rw', [db.projects, db.projectTasks, db.solarTables, db.tableAssignments, db.tableStatusHistory], async () => {
                await db.projectTasks.where('projectId').equals(projectToDelete.id!).delete();
                await db.solarTables.where('projectId').equals(projectToDelete.id!).delete();
                await db.projects.delete(projectToDelete.id!);
            });
            setProjectToDelete(null);
        }
    };

    const handleSync = async (project: Project) => {
        setSyncing(true);
        showToast('Connecting to Google Sheets...', 'info');

        try {
            await googleSheetsService.init();
            if (!googleSheetsService.isLoggedIn) {
                await googleSheetsService.signIn();
            }

            let spreadsheetId = project.googleSpreadsheetId;

            if (!spreadsheetId) {
                spreadsheetId = await googleSheetsService.createSpreadsheet(`MST - ${project.name}`);
                await db.projects.update(project.id!, { googleSpreadsheetId: spreadsheetId });
            }

            const pTables = await db.solarTables.where('projectId').equals(project.id!).toArray();
            const pTasks = await db.projectTasks.where('projectId').equals(project.id!).toArray();
            const pRecords = await db.records.where('projectId').equals(project.id!).toArray();
            const pWorkers = await db.workers.toArray();

            const dataPayload = { project, tables: pTables, tasks: pTasks, records: pRecords, workers: pWorkers };
            await googleSheetsService.syncProjectData(spreadsheetId, dataPayload);

            const syncTimestamp = new Date();
            await db.projects.update(project.id!, { lastSync: syncTimestamp });
            showToast('Project synced successfully!', 'success');
            window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}`, '_blank');
        } catch (e) {
            console.error(e);
            showToast('Sync failed. Check console or API Key.', 'error');
        } finally {
            setSyncing(false);
        }
    };

    const filterOptions: ('all' | 'active' | 'completed' | 'on_hold')[] = ['all', 'active', 'completed', 'on_hold'];

    return (
        <div className="space-y-8 md:space-y-12 pb-32 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] overflow-x-hidden w-full max-w-[100vw] box-border">
            <div className="md:hidden">
                <BackButton />
            </div>
            {syncing && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/20 flex flex-col items-center gap-4 shadow-2xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)]"></div>
                        <p className="text-white font-black uppercase tracking-widest animate-pulse">Synchronizing with Google Sheets...</p>
                    </div>
                </div>
            )}

            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="space-y-3">
                    <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">
                        {t('projects')}<span className="text-[var(--color-accent)]">.</span>
                    </h1>
                    <p className="text-sm md:text-xl text-slate-400 font-bold tracking-tight max-w-2xl border-l-4 border-[var(--color-accent)] pl-4 py-1">
                        Komplexní přehled výstavby a technologického postupu solárních polí.
                    </p>
                </div>
                <div className="flex gap-3 w-full lg:w-auto">
                    {user?.role === 'admin' && (
                        <Link to="/statistics" className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-slate-900/50 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all border border-white/10 backdrop-blur-md active:scale-95 shadow-lg text-xs" title={t('statistics')}>
                            <ChartBarIcon className="w-5 h-5 text-[var(--color-accent)]" />
                            {t('statistics')}
                        </Link>
                    )}
                    {user?.role === 'admin' && (
                        <button onClick={handleAdd} className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-[var(--color-accent)] hover:text-white transition-all shadow-[0_15px_40px_rgba(255,255,255,0.15)] active:scale-95 group text-xs" title={t('add_project')}>
                            <PlusIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                            {t('add_project')}
                        </button>
                    )}
                </div>
            </header>

            {/* Search and Filter Section */}
            <div className="flex flex-col xl:flex-row gap-4 p-4 bg-white/[0.03] rounded-[2.5rem] border border-white/10 backdrop-blur-3xl shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full xl:w-auto xl:flex-1">
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder={`${t('search')}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-black/30 text-white placeholder-slate-500 border-none rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] transition-all font-bold"
                        />
                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-[var(--color-accent)] transition-colors" />
                    </div>

                    <div className="relative group">
                        <select
                            value={workerFilter}
                            onChange={(e) => setWorkerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full pl-12 pr-10 py-4 bg-black/30 text-white border-none rounded-2xl appearance-none focus:ring-2 focus:ring-[var(--color-accent)] transition-all font-bold cursor-pointer [&>option]:bg-slate-900"
                            title={t('filter_by_worker')}
                        >
                            <option value="all">{t('all_workers')}</option>
                            {workers?.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <WorkersIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none group-focus-within:text-[var(--color-accent)] transition-colors" />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    {filterOptions.map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`flex-grow md:flex-grow-0 px-3 py-3 md:px-6 md:py-4 rounded-2xl font-black text-[10px] transition-all border uppercase tracking-widest whitespace-nowrap ${statusFilter === status
                                ? 'bg-white text-black border-white shadow-[0_0_25px_rgba(255,255,255,0.3)] scale-105 z-10'
                                : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                                }`}
                            title={t(status === 'all' ? 'all_statuses' : (status as any))}
                        >
                            {t(status === 'all' ? 'all_statuses' : (status as any))}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
                {filteredProjects.map((project, idx) => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        index={idx}
                        isAdmin={user?.role === 'admin'}
                        onEdit={handleEdit}
                        onDelete={confirmDelete}
                        onManageTasks={setManagingTasksFor}
                        onSync={handleSync}
                    />
                ))}

                {filteredProjects.length === 0 && (
                    <div className="col-span-full py-40 text-center opacity-40">
                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <SearchIcon className="w-10 h-10 text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-2xl font-black uppercase tracking-widest italic">{t('no_data')}</p>
                    </div>
                )}
            </div>

            {showForm && <ProjectForm project={selectedProject} onClose={() => setShowForm(false)} />}
            {managingTasksFor && <ProjectTasksModal project={managingTasksFor} onClose={() => setManagingTasksFor(null)} />}
            {projectToDelete && (
                <ConfirmationModal
                    title={t('delete_project')}
                    message={`Systém trvale odstraní projekt "${projectToDelete.name}" včetně všech dat o stolech a úkolech. Potvrdit?`}
                    onConfirm={handleDelete}
                    onCancel={() => setProjectToDelete(null)}
                />
            )}
        </div>
    );
};

export default Projects;