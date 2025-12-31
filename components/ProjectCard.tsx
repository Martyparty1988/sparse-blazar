
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
        return <ProjectCardMobile {...props} />;
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

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'active': return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500' };
            case 'completed': return { bg: 'bg-indigo-500/10', text: 'text-indigo-400', dot: 'bg-indigo-500' };
            case 'on_hold': return { bg: 'bg-amber-500/10', text: 'text-amber-500', dot: 'bg-amber-500' };
            default: return { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-500' };
        }
    };

    const styles = getStatusStyles(project.status);

    return (
        <div className="group glass-card rounded-[2.5rem] p-8 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col gap-8 h-full bg-white/[0.01] hover:bg-white/[0.03] shadow-xl">
            <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="font-black text-white text-2xl tracking-tighter uppercase italic leading-none group-hover:text-indigo-400 transition-colors">{project.name}</h3>
                    <div className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2 ${styles.bg} ${styles.text} border border-white/5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} animate-pulse`}></span>
                        {t(project.status as any)}
                    </div>
                </div>
                <p className="text-sm font-bold text-slate-500 line-clamp-2 leading-relaxed tracking-tight">{project.description || 'Bez popisu projektu...'}</p>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="block text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('tasks')}</span>
                        <span className="text-lg font-black text-white italic tracking-tighter">{stats.completedTasks} <span className="text-slate-600 text-sm">/ {stats.totalTasks}</span></span>
                    </div>
                    <span className="text-2xl font-black text-indigo-500 italic tracking-tighter">{stats.taskProgress}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-3 overflow-hidden p-0.5 border border-white/5">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.taskProgress}%` }}></div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
                <button
                    onClick={() => onManageTasks(project)}
                    className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white bg-indigo-600/20 border border-indigo-500/30 px-6 py-3 rounded-2xl hover:bg-indigo-600 transition-all shadow-lg"
                >
                    <ClockIcon className="w-4 h-4" />
                    {t('tasks')}
                </button>

                <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity duration-500">
                    <Link to={`/field-plans?projectId=${project.id}`} className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </Link>
                    {isAdmin && (
                        <>
                            <button onClick={() => onEdit(project)} className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all">
                                <PencilIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(project)} className="p-3 text-slate-400 hover:text-pink-500 hover:bg-pink-500/5 rounded-2xl transition-all">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;
