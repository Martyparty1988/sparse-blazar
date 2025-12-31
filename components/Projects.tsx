
import React, { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { firebaseService } from '../services/firebaseService';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import usePullToRefresh from '../hooks/usePullToRefresh';
import type { Project } from '../types';
import ProjectForm from './ProjectForm';
import ProjectTasksModal from './ProjectTasksModal';
import ConfirmationModal from './ConfirmationModal';
import ProjectCard from './ProjectCard';
import SearchIcon from './icons/SearchIcon';
import WorkersIcon from './icons/WorkersIcon';
import PlusIcon from './icons/PlusIcon';
import RedoIcon from './icons/RedoIcon';

const Projects: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('active');
    const [workerFilter, setWorkerFilter] = useState<number | 'all'>('all');
    const [managingTasksFor, setManagingTasksFor] = useState<Project | null>(null);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

    const projects = useLiveQuery(() => db.projects.toArray(), []);
    const workers = useLiveQuery(() => db.workers.toArray(), []);
    const allTasks = useLiveQuery(() => db.projectTasks.toArray(), []);
    
    const handleDataRefresh = useCallback(async () => {
        try {
            await firebaseService.syncAll();
            showToast('Data byla obnovena', 'success');
        } catch (error) {
            console.error("Failed to refresh data:", error);
            showToast('Nepodařilo se obnovit data', 'error');
        }
    }, [showToast]);

    const { isRefreshing } = usePullToRefresh({ onRefresh: handleDataRefresh });

    const projectsWithWorker = useMemo(() => {
        if (workerFilter === 'all' || !allTasks) return null;
        const projectIds = new Set<number>();
        allTasks.forEach(task => {
            if (task.assignedWorkerId === workerFilter) projectIds.add(task.projectId);
        });
        return projectIds;
    }, [workerFilter, allTasks]);

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
            await db.transaction('rw', [db.projects, db.projectTasks, db.solarTables, db.fieldTables], async () => {
                await db.projectTasks.where('projectId').equals(projectToDelete.id!).delete();
                await db.solarTables.where('projectId').equals(projectToDelete.id!).delete();
                await db.fieldTables.where('projectId').equals(projectToDelete.id!).delete();
                await db.projects.delete(projectToDelete.id!);
            });
            showToast('Projekt smazán', 'success');
            setProjectToDelete(null);
        }
    };

    const filterOptions: ('all' | 'active' | 'completed' | 'on_hold')[] = ['all', 'active', 'completed', 'on_hold'];

    return (
        <div className="space-y-6 md:space-y-8 pb-32">
             <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${isRefreshing ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10 pointer-events-none'}`}>
                <div className="bg-indigo-600 text-white rounded-full p-2 shadow-lg">
                    <RedoIcon className="w-5 h-5 animate-spin" />
                </div>
            </div>

            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">
                    {t('projects')}
                </h1>
                {user?.role === 'admin' && (
                    <button 
                        onClick={handleAdd} 
                        className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-black font-bold text-sm rounded-lg shadow-lg hover:bg-opacity-90 transition-all active:scale-95">
                        <PlusIcon className="w-5 h-5" />
                        {t('add_project')}
                    </button>
                )}
            </header>

            {/* Search and Filter Section */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder={`${t('search')}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg border-2 border-transparent focus:border-indigo-500 focus:ring-0 transition-all"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1 md:flex-none">
                        <select
                            value={workerFilter}
                            onChange={(e) => setWorkerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full h-full pl-10 pr-4 py-3 bg-slate-800 text-white rounded-lg appearance-none border-2 border-transparent focus:border-indigo-500 focus:ring-0 transition-all cursor-pointer"
                        >
                            <option value="all">{t('all_workers')}</option>
                            {workers?.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                        <WorkersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative flex-1 md:flex-none">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="w-full h-full pl-4 pr-10 py-3 bg-slate-800 text-white rounded-lg appearance-none border-2 border-transparent focus:border-indigo-500 focus:ring-0 transition-all cursor-pointer"
                        >
                            {filterOptions.map(status => (
                                <option key={status} value={status}>{t(status as any)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProjects.map((project, idx) => (
                    <ProjectCard
                        key={project.id}
                        project={project}
                        isAdmin={user?.role === 'admin'}
                        onEdit={handleEdit}
                        onDelete={confirmDelete}
                        onManageTasks={setManagingTasksFor}
                    />
                ))}
                 {filteredProjects.length === 0 && (
                    <div className="col-span-full py-20 text-center text-slate-500">
                        <SearchIcon className="w-12 h-12 mx-auto mb-4" />
                        <p className="text-lg font-semibold">{t('no_data')}</p>
                    </div>
                )}
            </div>

            {showForm && <ProjectForm project={selectedProject} onClose={() => setShowForm(false)} />}
            {managingTasksFor && <ProjectTasksModal project={managingTasksFor} onClose={() => setManagingTasksFor(null)} />}
            {projectToDelete && (
                <ConfirmationModal
                    title={t('delete_project')}
                    message={`Opravdu chcete smazat projekt "${projectToDelete.name}"? Tato akce je nevratná.`}
                    onConfirm={handleDelete}
                    onCancel={() => setProjectToDelete(null)}
                />
            )}
        </div>
    );
};

export default Projects;
