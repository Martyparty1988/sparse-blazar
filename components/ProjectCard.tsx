
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
        <div className="group glass-dark rounded-[3.5rem] p-8 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col gap-8 h-full shadow-2xl hover:scale-[1.02] relative overflow-hidden">
            {/* Decorative Blur */}
            <div className={`absolute -top-24 -right-24 w-64 h-64 bg-opacity-20 blur-[80px] rounded-full transition-colors duration-700 ${styles.bg.replace('/10', '/5')}`} />

            <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-start gap-4">
                    <h3 className="font-black text-white text-3xl tracking-tighter uppercase italic leading-[0.85] group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {project.name}
                    </h3>
                    <div className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-3 ${styles.bg} ${styles.text} border border-white/5 shadow-lg backdrop-blur-md`}>
                        <span className={`w-2 h-2 rounded-full ${styles.dot} animate-pulse shadow-[0_0_10px_currentColor]`}></span>
                        {t(project.status as any)}
                    </div>
                </div>

                <p className="text-sm font-bold text-slate-500 line-clamp-3 leading-relaxed tracking-tight pl-4 border-l-2 border-white/5">
                    {project.description || 'Bez popisu projektu...'}
                </p>
            </div>

            <div className="space-y-4 relative z-10 bg-black/20 p-6 rounded-[2.5rem] mt-2 border border-white/5">
                <div className="flex justify-between items-end">
                    <div className="space-y-2">
                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 opacity-60">{t('tasks')}</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-white italic tracking-tighter">{stats.completedTasks}</span>
                            <span className="text-sm font-black text-slate-600 italic">/ {stats.totalTasks}</span>
                        </div>
                    </div>
                    <span className="text-4xl font-black text-white/10 italic tracking-tighter group-hover:text-indigo-500/20 transition-colors">{stats.taskProgress}%</span>
                </div>

                <div className="w-full bg-slate-800/50 rounded-full h-4 overflow-hidden p-1 border border-white/5 shadow-inner">
                    <div
                        className="bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)] relative"
                        style={{ width: `${stats.taskProgress}%` }}
                    >
                        <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]" />
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center relative z-10">
                <button
                    onClick={() => onManageTasks(project)}
                    className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-white bg-indigo-600 hover:bg-indigo-500 px-8 py-4 rounded-[2rem] transition-all shadow-lg hover:shadow-indigo-500/20 active:scale-95"
                >
                    <ClockIcon className="w-4 h-4" />
                    {t('tasks')}
                </button>

                <div className="flex items-center gap-2">
                    <Link
                        to={`/field-plans?projectId=${project.id}`}
                        className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10 group/btn"
                    >
                        <svg className="w-5 h-5 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </Link>
                    {isAdmin && (
                        <>
                            <button
                                onClick={() => onEdit(project)}
                                className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-2xl transition-all border border-transparent hover:border-white/10 group/btn"
                            >
                                <PencilIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                            <button
                                onClick={() => onDelete(project)}
                                className="w-12 h-12 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-2xl transition-all border border-transparent hover:border-rose-500/20 group/btn"
                            >
                                <TrashIcon className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectCard;
