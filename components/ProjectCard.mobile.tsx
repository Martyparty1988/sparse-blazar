
import React, { useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project } from '../types';
import { useI18n } from '../contexts/I18nContext';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import useSwipe from '../hooks/useSwipe';
import { hapticService } from '../services/hapticService';

const ProjectCardMobile: React.FC<{
    project: Project;
    isAdmin: boolean;
    onEdit: (p: Project) => void;
    onDelete: (p: Project) => void;
    onManageTasks: (p: Project) => void;
}> = ({ project, isAdmin, onEdit, onDelete, onManageTasks }) => {
    const { t } = useI18n();
    const [isSwiped, setIsSwiped] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

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

    const statusObj = getStatusStyles(project.status);

    const handleSwipeLeft = () => {
        if (isAdmin) {
            setIsSwiped(true);
            hapticService.medium();
        }
    };

    const handleSwipeRight = () => {
        setIsSwiped(false);
        hapticService.medium();
    };

    const swipeHandlers = useSwipe({ onSwipeLeft: handleSwipeLeft, onSwipeRight: handleSwipeRight, threshold: 40 });

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticService.light();
        onEdit(project);
        setIsSwiped(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        hapticService.error();
        onDelete(project);
        setIsSwiped(false);
    };

    const handleCardClick = () => {
        hapticService.light();
        if (isSwiped) {
            setIsSwiped(false);
        } else {
            onManageTasks(project);
        }
    }

    return (
        <div className="relative w-full overflow-hidden rounded-[2rem] glass-dark border border-white/5 active:scale-[0.98] transition-all duration-300" ref={cardRef}>
            <div
                className={`transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] transform ${isSwiped ? '-translate-x-32' : 'translate-x-0'}`}
                {...swipeHandlers}
                onClick={handleCardClick}
            >
                <div className="p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                            <h3 className="font-black text-white text-xl italic tracking-tighter uppercase leading-none mb-1 line-clamp-1">{project.name}</h3>
                            <p className="text-[10px] font-bold text-slate-500 truncate opacity-60">
                                {project.location || 'Nespecifikovaná lokalita'}
                            </p>
                        </div>
                        <div className={`shrink-0 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border border-white/10 flex items-center gap-2 ${statusObj.bg} ${statusObj.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dot} animate-pulse shadow-[0_0_8px_currentColor]`}></span>
                            {t(project.status as any)}
                        </div>
                    </div>

                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{t('tasks')}</span>
                                <span className="text-xs font-black text-white italic tracking-tighter">{stats.completedTasks}<span className="text-slate-600 font-normal ml-0.5">/ {stats.totalTasks}</span></span>
                            </div>
                            <span className="text-sm font-black text-indigo-400 italic">{stats.taskProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5 group">
                            <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(99,102,241,0.3)] relative" style={{ width: `${stats.taskProgress}%` }}>
                                <div className="absolute inset-0 bg-white/20 animate-shimmer" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isAdmin && (
                <div className="absolute inset-y-0 right-0 flex items-center h-full" style={{ pointerEvents: isSwiped ? 'auto' : 'none' }}>
                    <div
                        className={`flex h-full transition-all duration-300 ${isSwiped ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}
                    >
                        <button
                            onClick={handleEdit}
                            className="w-16 h-full flex items-center justify-center bg-indigo-600 text-white active:scale-90 transition-transform border-l border-white/10"
                            aria-label={t('edit')}
                        >
                            <PencilIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-16 h-full flex items-center justify-center bg-rose-600 text-white active:scale-90 transition-transform"
                            aria-label={t('delete')}
                        >
                            <TrashIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectCardMobile;
