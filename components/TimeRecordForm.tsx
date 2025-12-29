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
    const [workType, setWorkType] = useState<'hourly' | 'task'>('hourly');
    const [taskType, setTaskType] = useState<'panels' | 'construction' | 'cables'>('cables');

    // Common fields
    const [projectId, setProjectId] = useState<number | ''>('');
    const [workerId, setWorkerId] = useState<number | ''>('');
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
    const workers = useLiveQuery(() => db.workers.toArray());
    const tables = useLiveQuery(() => projectId ? db.solarTables.where({ projectId: Number(projectId), status: 'pending' }).toArray() : [], [projectId]);

    useEffect(() => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setStartTime(now.toISOString().slice(0, 16));
        setEndTime(now.toISOString().slice(0, 16));
    }, []);

    const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setProjectId(Number(e.target.value));
        setTableId(''); // Reset table selection when project changes
    };

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
                        <div>
                            <label htmlFor="panelCount" className="block text-lg font-medium text-gray-300 mb-2">{t('panel_count')}</label>
                            <input type="number" id="panelCount" value={panelCount} onChange={e => setPanelCount(e.target.value)} required min="1" className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                        </div>
                        <div>
                            <label htmlFor="pricePerPanel" className="block text-lg font-medium text-gray-300 mb-2">{t('price_per_panel')}</label>
                            <input type="number" id="pricePerPanel" value={pricePerPanel} onChange={e => setPricePerPanel(e.target.value)} required min="0.01" step="0.01" className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                        </div>
                        <div className="p-4 bg-black/30 rounded-lg text-center">
                            <span className="text-lg font-bold text-gray-300">{t('total_price')}: </span>
                            <span className="text-xl font-bold text-white">€{calculatedTaskPrice.toFixed(2)}</span>
                        </div>
                    </>
                );
            case 'construction':
                return (
                    <>
                        <div>
                            <label htmlFor="description" className="block text-lg font-medium text-gray-300 mb-2">{t('description')}</label>
                            <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                        </div>
                        <div>
                            <label htmlFor="flatPrice" className="block text-lg font-medium text-gray-300 mb-2">{t('flat_rate')}</label>
                            <input type="number" id="flatPrice" value={flatPrice} onChange={e => setFlatPrice(e.target.value)} required min="0.01" step="0.01" className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                        </div>
                    </>
                );
            case 'cables':
                return (
                    <>
                        <div>
                            <label htmlFor="tableId" className="block text-lg font-medium text-gray-300 mb-2">{t('select_table')}</label>
                            <select id="tableId" value={tableId} onChange={e => setTableId(Number(e.target.value))} required className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800" disabled={!tables || tables.length === 0}>
                                <option value="" disabled>{tables && tables.length > 0 ? t('select_table') : t('no_tables_defined')}</option>
                                {tables?.map(t => <option key={t.id} value={t.id}>{t.tableCode}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="table-size" className="block text-lg font-medium text-gray-300 mb-2">{t('table_size')}</label>
                            <select id="table-size" value={tableSize} onChange={e => setTableSize(e.target.value as any)} className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800">
                                <option value="small">{t('small')}</option>
                                <option value="medium">{t('medium')}</option>
                                <option value="large">{t('large')}</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="worker2Id" className="block text-lg font-medium text-gray-300 mb-2">{t('worker_2_optional')}</label>
                            <select id="worker2Id" value={worker2Id} onChange={e => setWorker2Id(e.target.value === '' ? '' : Number(e.target.value))} className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800">
                                <option value="">N/A</option>
                                {workers?.filter(w => w.id !== Number(workerId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                    </>
                );
            default: return null;
        }
    };


    return (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-lg p-4">
            <div className="w-full max-w-lg p-8 bg-black/20 backdrop-blur-2xl rounded-3xl shadow-xl border border-white/10 max-h-[90vh] overflow-y-auto">
                <h2 className="text-3xl font-bold mb-6 text-white">{t('log_work')}</h2>
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Work Type Switcher */}
                    <div>
                        <label className="block text-lg font-medium text-gray-300 mb-2">{t('work_type')}</label>
                        <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1 w-full">
                            <button type="button" onClick={() => setWorkType('hourly')} className={`px-4 py-2 text-sm font-bold rounded-md w-1/2 transition-colors ${workType === 'hourly' ? 'bg-[var(--color-primary)]' : 'hover:bg-white/10'}`}>{t('hourly_rate_work')}</button>
                            <button type="button" onClick={() => setWorkType('task')} className={`px-4 py-2 text-sm font-bold rounded-md w-1/2 transition-colors ${workType === 'task' ? 'bg-[var(--color-primary)]' : 'hover:bg-white/10'}`}>{t('task_based_work')}</button>
                        </div>
                    </div>

                    {/* Common Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="workerId-main" className="block text-lg font-medium text-gray-300 mb-2">{t('select_worker')}</label>
                            <select id="workerId-main" value={workerId} onChange={e => setWorkerId(Number(e.target.value))} required className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800">
                                <option value="" disabled>{t('select_worker')}</option>
                                {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="projectId-main" className="block text-lg font-medium text-gray-300 mb-2">{t('select_project')}</label>
                            <select id="projectId-main" value={projectId} onChange={handleProjectChange} required className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800">
                                <option value="" disabled>{t('select_project')}</option>
                                {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Conditional Fields */}
                    {workType === 'hourly' ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="startTime" className="block text-lg font-medium text-gray-300 mb-2">{t('start_time')}</label>
                                    <input type="datetime-local" id="startTime" value={startTime} onChange={e => setStartTime(e.target.value)} required className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                                </div>
                                <div>
                                    <label htmlFor="endTime" className="block text-lg font-medium text-gray-300 mb-2">{t('end_time')}</label>
                                    <input type="datetime-local" id="endTime" value={endTime} onChange={e => setEndTime(e.target.value)} required className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="description-hourly" className="block text-lg font-medium text-gray-300 mb-2">{t('description')}</label>
                                <textarea id="description-hourly" value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl" />
                                <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                                    <span className="text-lg">💡</span>
                                    <p>
                                        <strong>Tip:</strong> Napište "hotový stůl 28.1" nebo "dokončil 149" pro automatické označení stolů v plánovém poli.
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-lg font-medium text-gray-300 mb-2">{t('task_type')}</label>
                                <select value={taskType} onChange={e => setTaskType(e.target.value as any)} className="mt-1 block w-full p-4 bg-black/20 text-white border border-white/20 rounded-xl [&>option]:bg-gray-800">
                                    <option value="cables">{t('cables')}</option>
                                    <option value="panels">{t('panels')}</option>
                                    <option value="construction">{t('construction')}</option>
                                </select>
                            </div>
                            {projectId && renderTaskFields()}
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end space-x-4 pt-4">
                        <button type="button" onClick={onClose} className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors text-lg">{t('cancel')}</button>
                        <button type="submit" className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-md text-lg">{t('save')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TimeRecordForm;