import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project, SolarTable, Worker, TimeRecord, ProjectTask } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { processRecordDescription, processFieldTableDescription } from '../services/recordProcessor';

interface WorkLogFormProps {
    onClose: () => void;
}

const TimeRecordForm: React.FC<WorkLogFormProps> = ({ onClose }) => {
    const { t } = useI18n();

    // Load defaults from localStorage
    const savedWorkType = localStorage.getItem('last_work_type') as 'hourly' | 'task' | null;
    const savedProjectId = localStorage.getItem('last_project_id');
    const savedWorkerId = localStorage.getItem('last_worker_id');

    const [workType, setWorkType] = useState<'hourly' | 'task'>(savedWorkType || 'hourly');
    const [taskType, setTaskType] = useState<'panels' | 'construction' | 'cables'>('cables');

    // Common fields
    const [projectId, setProjectId] = useState<number | ''>(savedProjectId ? Number(savedProjectId) : '');
    const [workerId, setWorkerId] = useState<number | ''>(savedWorkerId ? Number(savedWorkerId) : '');
    const [description, setDescription] = useState('');

    // Hourly fields
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // Task fields
    const [panelCount, setPanelCount] = useState('');
    const [pricePerPanel, setPricePerPanel] = useState('');
    const [flatPrice, setFlatPrice] = useState('');
    const [tableId, setTableId] = useState<number | ''>('');
    const [tableSize, setTableSize] = useState<'small' | 'medium' | 'large'>('small');
    const [worker2Id, setWorker2Id] = useState<number | ''>('');

    const projects = useLiveQuery(() => db.projects.toArray());
    const workers = useLiveQuery(() => db.workers.orderBy('name').toArray());
    const tables = useLiveQuery(() => projectId ? db.solarTables.where({ projectId: Number(projectId), status: 'pending' }).toArray() : [], [projectId]);

    useEffect(() => {
        const now = new Date();
        const end = new Date(now);
        end.setMinutes(end.getMinutes() - end.getTimezoneOffset());

        // Default Start Time: 07:00 AM today
        const start = new Date(now);
        start.setHours(7, 0, 0, 0); // 07:00:00
        start.setMinutes(start.getMinutes() - start.getTimezoneOffset());

        setStartTime(start.toISOString().slice(0, 16));
        setEndTime(end.toISOString().slice(0, 16));
    }, []);

    // Save choices to localStorage
    const handleWorkTypeChange = (type: 'hourly' | 'task') => {
        setWorkType(type);
        localStorage.setItem('last_work_type', type);
    };

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setProjectId(val);
        setTableId(''); // Reset table selection when project changes
        localStorage.setItem('last_project_id', String(val));
    };

    const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = Number(e.target.value);
        setWorkerId(val);
        localStorage.setItem('last_worker_id', String(val));
    };

    // ... (rest of logic)

    const calculatedTaskPrice = useMemo(() => {
        if (taskType === 'panels') {
            const count = Number(panelCount);
            const perPanel = Number(pricePerPanel);
            return (count * perPanel) || 0;
        }
        return Number(flatPrice) || 0;
    }, [taskType, panelCount, pricePerPanel, flatPrice]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId || !workerId) {
            alert("Please select a worker and project.");
            return;
        }

        try {
            if (workType === 'hourly') {
                if (new Date(endTime) <= new Date(startTime)) {
                    alert(t('end_time_error'));
                    return;
                }
                const recordData: Omit<TimeRecord, 'id'> = {
                    workerId: Number(workerId),
                    projectId: Number(projectId),
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                    description,
                };
                const newId = await db.records.add(recordData as TimeRecord);

                // Process both old and new table systems
                const record = { ...recordData, id: newId } as TimeRecord;
                await processRecordDescription(record); // Legacy solarTables

                // NEW: Process fieldTables if project has them
                const project = await db.projects.get(Number(projectId));
                if (project?.tables && project.tables.length > 0) {
                    const updatedCount = await processFieldTableDescription(record);
                    if (updatedCount > 0) {
                        alert(`✅ Work logged! ${updatedCount} table(s) marked as completed.`);
                        onClose();
                        return;
                    }
                }

            } else { // Task-based work
                let taskData: Omit<ProjectTask, 'id'>;
                switch (taskType) {
                    case 'panels':
                        const count = Number(panelCount);
                        const perPanel = Number(pricePerPanel);
                        if (isNaN(count) || count <= 0 || isNaN(perPanel) || perPanel <= 0) {
                            alert(t('invalid_panel_input'));
                            return;
                        }
                        taskData = {
                            projectId: Number(projectId), taskType: 'panels', assignedWorkerId: Number(workerId),
                            description: t('panels_task_desc', { count }), panelCount: count, pricePerPanel: perPanel,
                            price: count * perPanel, completionDate: new Date(),
                            startTime: new Date(startTime), endTime: new Date(endTime) // Add time tracking
                        };
                        await db.projectTasks.add(taskData as ProjectTask);
                        break;
                    case 'construction':
                        const price = Number(flatPrice);
                        if (!description.trim() || isNaN(price) || price <= 0) {
                            alert(t('invalid_construction_input'));
                            return;
                        }
                        taskData = {
                            projectId: Number(projectId), taskType: 'construction', assignedWorkerId: Number(workerId),
                            description: description.trim(), price: price, completionDate: new Date(),
                            startTime: new Date(startTime), endTime: new Date(endTime) // Add time tracking
                        };
                        await db.projectTasks.add(taskData as ProjectTask);
                        break;
                    case 'cables':
                        if (!tableId) { alert("Please select a table for cabling work."); return; }
                        await db.transaction('rw', db.solarTables, db.tableAssignments, db.tableStatusHistory, async () => {
                            await db.solarTables.update(tableId, { status: 'completed', tableType: tableSize });
                            await db.tableAssignments.where('tableId').equals(tableId).delete();
                            const workersToAssign = [workerId, worker2Id].filter(Boolean) as number[];
                            await db.tableAssignments.bulkAdd(workersToAssign.map(wId => ({ tableId: Number(tableId), workerId: wId })));
                            await db.tableStatusHistory.bulkAdd(workersToAssign.map(wId => ({
                                tableId: Number(tableId), workerId: wId, status: 'completed', timestamp: new Date()
                            })));
                        });
                        break;
                }
            }
            alert(`Work logged successfully!`);
            onClose();

        } catch (error) {
            console.error("Failed to log work:", error);
            alert("Failed to log work.");
        }
    };

    const renderTaskFields = () => {
        switch (taskType) {
            case 'panels':
                return (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('panel_count')}</label>
                                <input type="number" id="panelCount" value={panelCount} onChange={e => setPanelCount(e.target.value)} required min="1" className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('price_per_panel')}</label>
                                <input type="number" id="pricePerPanel" value={pricePerPanel} onChange={e => setPricePerPanel(e.target.value)} required min="0.01" step="0.01" className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                            </div>
                        </div>
                        <div className="p-4 bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-2xl flex justify-between items-center">
                            <span className="text-xs font-black text-[var(--color-primary)] uppercase tracking-widest">{t('total_price')}</span>
                            <span className="text-xl font-black text-white">€{calculatedTaskPrice.toFixed(2)}</span>
                        </div>
                    </>
                );
            case 'construction':
                return (
                    <>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('description')}</label>
                            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={3} placeholder="Popis práce..." className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none text-sm leading-relaxed" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('flat_rate')}</label>
                            <input type="number" id="flatPrice" value={flatPrice} onChange={e => setFlatPrice(e.target.value)} required min="0.01" step="0.01" className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                        </div>
                    </>
                );
            case 'cables':
                return (
                    <>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_table')}</label>
                            <select id="tableId" value={tableId} onChange={e => setTableId(Number(e.target.value))} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900" disabled={!tables || tables.length === 0}>
                                <option value="" disabled>{tables && tables.length > 0 ? t('select_table') : t('no_tables_defined')}</option>
                                {tables?.map(t => <option key={t.id} value={t.id}>{t.tableCode}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('table_size')}</label>
                                <select id="table-size" value={tableSize} onChange={e => setTableSize(e.target.value as any)} className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900">
                                    <option value="small">{t('small')}</option>
                                    <option value="medium">{t('medium')}</option>
                                    <option value="large">{t('large')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('worker_2_optional')}</label>
                                <select id="worker2Id" value={worker2Id} onChange={e => setWorker2Id(e.target.value === '' ? '' : Number(e.target.value))} className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900">
                                    <option value="">-</option>
                                    {workers?.filter(w => w.id !== Number(workerId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </>
                );
            default: return null;
        }
    };


    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md p-0 md:p-4 animate-fade-in">
            <div className="w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-lg bg-slate-900 md:bg-slate-900/90 backdrop-blur-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border-t md:border border-white/10 flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-6 md:p-8 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('log_work')}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar pb-40">
                    <form id="time-record-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Work Type Switcher (iOS Segmented Control Style) */}
                        <div>
                            <div className="flex p-1 rounded-2xl bg-black/40 border border-white/5 relative">
                                <div
                                    className="absolute top-1 bottom-1 rounded-xl bg-[var(--color-primary)] shadow-lg transition-all duration-300 ease-out"
                                    style={{
                                        left: '4px',
                                        width: 'calc(50% - 4px)',
                                        transform: workType === 'task' ? 'translateX(100%)' : 'translateX(0)'
                                    }}
                                ></div>
                                <button type="button" onClick={() => handleWorkTypeChange('hourly')} className="relative z-10 flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-colors text-white">{t('hourly_rate_work')}</button>
                                <button type="button" onClick={() => handleWorkTypeChange('task')} className="relative z-10 flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-colors text-white">{t('task_based_work')}</button>
                            </div>
                        </div>

                        {/* Common Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_worker')}</label>
                                <select id="workerId-main" value={workerId} onChange={handleWorkerChange} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm appearance-none [&>option]:bg-slate-900">
                                    <option value="" disabled>{t('select_worker')}</option>
                                    {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_project')}</label>
                                <select id="projectId-main" value={projectId} onChange={handleProjectChange} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm appearance-none [&>option]:bg-slate-900">
                                    <option value="" disabled>{t('select_project')}</option>
                                    {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Conditional Fields */}
                        {workType === 'hourly' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('start_time')}</label>
                                        <input
                                            type="datetime-local"
                                            value={startTime}
                                            onChange={e => setStartTime(e.target.value)}
                                            required
                                            className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-mono text-xs font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('end_time')}</label>
                                        <input
                                            type="datetime-local"
                                            value={endTime}
                                            onChange={e => setEndTime(e.target.value)}
                                            required
                                            className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-mono text-xs font-bold"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('description')}</label>
                                    <textarea
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        rows={3}
                                        placeholder="Např. hotový stůl 28.1..."
                                        className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none text-sm leading-relaxed"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('task_type')}</label>
                                    <select value={taskType} onChange={e => setTaskType(e.target.value as any)} className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900">
                                        <option value="cables">{t('cables')}</option>
                                        <option value="panels">{t('panels')}</option>
                                        <option value="construction">{t('construction')}</option>
                                    </select>
                                </div>
                                {projectId && renderTaskFields()}

                                {/* Time Fields for Efficiency Tracking */}
                                <div className="pt-6 border-t border-white/10">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('start_time')}</label>
                                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-mono text-xs font-bold" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('end_time')}</label>
                                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-mono text-xs font-bold" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="border-t border-white/10 p-4 md:p-6 bg-slate-900/95 backdrop-blur-xl flex gap-3 pb-safe">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-4 bg-white/5 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 transition-colors text-xs"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={(e) => {
                            // Trigger form submission manually since button is outside form on mobile often
                            const form = document.getElementById('time-record-form') as HTMLFormElement;
                            if (form) form.requestSubmit();
                        }}
                        className="flex-[2] py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] text-xs"
                    >
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeRecordForm;