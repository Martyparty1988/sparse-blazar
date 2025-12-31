
import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project } from '../types';
import { useI18n } from '../contexts/I18nContext';
import ClockIcon from './icons/ClockIcon';

const ProjectCardMobile: React.FC<{
    project: Project;
    onManageTasks: (p: Project) => void;
}> = ({ project, onManageTasks }) => {
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
        <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col gap-4 active:bg-slate-700 transition-colors" onClick={() => onManageTasks(project)}>
            <div className="flex justify-between items-start">
                <h3 className="font-bold text-white text-lg line-clamp-2">{project.name}</h3>
                <div className={`px-3 py-1 text-xs font-semibold rounded-full text-white flex items-center gap-2 ${getStatusColor(project.status)}`}>
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
    );
};

export default ProjectCardMobile;
