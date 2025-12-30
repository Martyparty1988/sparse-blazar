
import React, { useState, useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import TimeRecordForm from './TimeRecordForm';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { TimeRecord, ProjectTask, TableStatusHistory, Worker, Project, SolarTable } from '../types';
import ClockIcon from './icons/ClockIcon';
import BackButton from './BackButton';

// A unified type for all activities in the feed
type ActivityItem = {
    id: string;
    type: 'record' | 'task' | 'table';
    date: Date;
    workerName: string;
    projectName: string;
    description: string;
    details: string;
};

const TimeRecords: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);

    // Fetch all data types for the activity feed, filtering if not admin
    const records = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.records.toArray();
        if (user?.workerId) return db.records.where('workerId').equals(user.workerId).toArray();
        return [];
    }, [user]);

    const tasks = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.projectTasks.where('completionDate').above(new Date(0)).toArray();
        if (user?.workerId) return db.projectTasks.where('assignedWorkerId').equals(user.workerId).filter(t => !!t.completionDate).toArray();
        return [];
    }, [user]);

    const tableHistory = useLiveQuery(async () => {
        if (user?.role === 'admin') return db.tableStatusHistory.where('status').equals('completed').toArray();
        if (user?.workerId) return db.tableStatusHistory.where('workerId').equals(user.workerId).filter(h => h.status === 'completed').toArray();
        return [];
    }, [user]);

    const workers = useLiveQuery(() => db.workers.toArray(), [], []);
    const projects = useLiveQuery(() => db.projects.toArray(), [], []);
    const tables = useLiveQuery(() => db.solarTables.toArray(), [], []);

    const activityFeed = useMemo(() => {
        if (!records || !tasks || !tableHistory) return [];

        const workerMap = new Map<number, string>(
            workers.filter(w => w.id != null).map(w => [w.id!, w.name] as [number, string])
        );
        const projectMap = new Map<number, string>(
            projects.filter(p => p.id != null).map(p => [p.id!, p.name] as [number, string])
        );
        const tableMap = new Map<number, SolarTable>(
            tables.filter(t => t.id != null).map(t => [t.id!, t] as [number, SolarTable])
        );

        const feed: ActivityItem[] = [];

        // Process TimeRecords
        records.forEach(r => {
            const start = new Date(r.startTime);
            const end = new Date(r.endTime);
            const durationMs = end.getTime() - start.getTime();

            let details = 'N/A';
            if (!isNaN(durationMs) && durationMs >= 0) {
                const hours = Math.floor(durationMs / 3600000);
                const minutes = Math.floor((durationMs % 3600000) / 60000);
                details = `${hours}h ${minutes}m`;
            }

            feed.push({
                id: `rec-${r.id}`,
                type: 'record',
                date: start,
                workerName: workerMap.get(r.workerId) || t('unassigned'),
                projectName: projectMap.get(r.projectId) || 'Unknown Project',
                description: r.description || 'General Work',
                details: details
            });
        });

        // Process ProjectTasks
        tasks.forEach(task => {
            if (task.completionDate && task.assignedWorkerId) {
                feed.push({
                    id: `task-${task.id}`,
                    type: 'task',
                    date: new Date(task.completionDate),
                    workerName: workerMap.get(task.assignedWorkerId) || t('unassigned'),
                    projectName: projectMap.get(task.projectId) || 'Unknown Project',
                    description: task.description,
                    details: `€${task.price.toFixed(2)}`
                });
            }
        });

        // Process TableStatusHistory
        tableHistory.forEach(h => {
            const table = tableMap.get(h.tableId);
            if (table) {
                feed.push({
                    id: `table-${h.id}`,
                    type: 'table',
                    date: new Date(h.timestamp),
                    workerName: workerMap.get(h.workerId) || t('unassigned'),
                    projectName: projectMap.get(table.projectId) || 'Unknown Project',
                    description: t('completed_table_summary', { code: table.tableCode }),
                    details: t(table.tableType)
                });
            }
        });

        return feed.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [records, tasks, tableHistory, workers, projects, tables, t]);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <h1 className="text-5xl font-bold text-white [text-shadow:0_4px_12px_rgba(0,0,0,0.5)]">{t('work_log')}</h1>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg text-lg transform hover:scale-105 flex items-center gap-2"
                >
                    <ClockIcon className="w-6 h-6" />
                    {t('add_record')}
                </button>
            </div>

            <div className="space-y-4">
                {activityFeed.length > 0 ? activityFeed.map(item => (
                    <div key={item.id} className="p-4 bg-black/20 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-lg hover:bg-black/30 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <p className="text-xl font-bold text-white">{item.description}</p>
                                <p className="text-gray-300">
                                    {item.workerName} @ <span className="font-semibold text-cyan-400">{item.projectName}</span>
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="font-bold text-lg text-white">{item.details}</p>
                                <p className="text-sm text-gray-400">{item.date.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-12 text-gray-300 text-lg bg-slate-900/30 rounded-2xl border border-white/5">
                        {t('no_data')}
                    </div>
                )}
            </div>

            {showForm && (
                <TimeRecordForm onClose={() => setShowForm(false)} />
            )}
        </div>
    );
};

export default TimeRecords;
