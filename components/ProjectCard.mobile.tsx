
import React, { useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project } from '../types';
import { useI18n } from '../contexts/I18nContext';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import useSwipe from '../hooks/useSwipe';

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-emerald-500';
            case 'completed': return 'bg-indigo-500';
            case 'on_hold': return 'bg-amber-500';
            default: return 'bg-slate-500';
        }
    };

    const handleSwipeLeft = () => {
        if (isAdmin) {
            setIsSwiped(true);
        }
    };

    const handleSwipeRight = () => {
        setIsSwiped(false);
    };

    const swipeHandlers = useSwipe({ onSwipeLeft: handleSwipeLeft, onSwipeRight: handleSwipeRight, threshold: 40 });

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(project);
        setIsSwiped(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(project);
        setIsSwiped(false);
    };

    const handleCardClick = () => {
        if (isSwiped) {
            setIsSwiped(false);
        } else {
            onManageTasks(project);
        }
    }

    return (
        <div className="relative w-full overflow-hidden rounded-xl" ref={cardRef}>
            <div
                className={`transition-transform duration-300 ease-in-out transform ${isSwiped ? '-translate-x-32' : 'translate-x-0'}`}
                {...swipeHandlers}
                onClick={handleCardClick}
            >
                <div className="bg-slate-800/50 backdrop-blur-md p-3.5 border border-white/10 flex flex-col gap-3 active:bg-slate-700 transition-colors">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-white text-lg line-clamp-2 pr-2">{project.name}</h3>
                        <div className={`shrink-0 px-3 py-1 text-xs font-semibold rounded-full text-white flex items-center gap-2 ${getStatusColor(project.status)}`}>
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(project.status)} animate-pulse`}></span>
                            {t(project.status as any)}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-slate-400">{t('tasks')}</span>
                            <span className="text-xs font-bold text-white">{stats.completedTasks} / {stats.totalTasks}</span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2.5">
                            <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${stats.taskProgress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {isAdmin && (
                <div className="absolute top-0 right-0 h-full flex items-center" style={{ pointerEvents: isSwiped ? 'auto' : 'none' }}>
                    <div
                        className={`flex transition-opacity duration-300 ${isSwiped ? 'opacity-100' : 'opacity-0'}`}
                    >
                        <button
                            onClick={handleEdit}
                            className="w-16 h-full flex items-center justify-center bg-blue-600 text-white"
                            aria-label={t('edit')}
                        >
                            <PencilIcon className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleDelete}
                            className="w-16 h-full flex items-center justify-center bg-red-600 text-white"
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
