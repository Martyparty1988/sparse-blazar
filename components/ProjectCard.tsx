
import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project } from '../types';
import { useI18n } from '../contexts/I18nContext';
import ProjectCardMobile from './ProjectCard.mobile';
import { Link } from 'react-router-dom';

// Icons
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import ClockIcon from './icons/ClockIcon';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

const ProjectCard: React.FC<{
    project: Project;
    isAdmin: boolean;
    onEdit: (p: Project) => void;
    onDelete: (p: Project) => void;
    onManageTasks: (p: Project) => void;
}> = (props) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return <ProjectCardMobile project={props.project} onManageTasks={props.onManageTasks} />;
    }

    return <ProjectCardDesktop {...props} />;
};


const ProjectCardDesktop: React.FC<{
    project: Project;
    isAdmin: boolean;
    onEdit: (p: Project) => void;
    onDelete: (p: Project) => void;
    onManageTasks: (p: Project) => void;
}> = ({ project, isAdmin, onEdit, onDelete, onManageTasks }) => {
    const { t } = useI18n();

    const tasks = useLiveQuery(() => db.projectTasks.where('projectId').equals(project.id!).toArray(), [project.id]);

    const stats = useMemo(() => {
        const totalTasks = tasks?.length || 0;
        const completedTasks = tasks?.filter(t => !!t.completionDate).length || 0;
        const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return { totalTasks, completedTasks, taskProgress };
    }, [tasks]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'completed': return 'bg-indigo-500';
            case 'on_hold': return 'bg-amber-500';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-md rounded-lg p-5 border border-white/10 flex flex-col gap-4 h-full">
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-white text-xl pr-4">{project.name}</h3>
                 <div className={`px-3 py-1 text-xs font-semibold rounded-full text-white flex items-center gap-2 ${getStatusColor(project.status)}`}>
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(project.status)} animate-pulse`}></span>
                    {t(project.status as any)}
                </div>
            </div>

            <p className="text-sm text-slate-400 flex-grow">{project.description || t('no_description')}</p>

            <div>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold text-slate-400">{t('tasks')}</span>
                    <span className="text-xs font-bold text-white">{stats.completedTasks} / {stats.totalTasks}</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${stats.taskProgress}%` }}></div>
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
                <button onClick={() => onManageTasks(project)} className="flex items-center gap-2 text-sm text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-500 transition-colors">
                    <ClockIcon className="w-5 h-5" />
                    {t('tasks')}
                </button>
                {isAdmin && (
                    <div className="flex gap-2">
                         <Link to={`/field-plans?projectId=${project.id}`} className="p-2 text-slate-400 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
                        </Link>
                        <button onClick={() => onEdit(project)} className="p-2 text-slate-400 hover:text-white transition-colors">
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(project)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectCard;
