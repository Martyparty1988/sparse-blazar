import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project, TimeRecord, ProjectTask } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { processRecordDescription, processFieldTableDescription } from '../services/recordProcessor';

// Utility Hook for Media Query
function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);
    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, [query]);
    return matches;
}

interface WorkLogFormProps {
    onClose: () => void;
}

const TimeRecordForm: React.FC<WorkLogFormProps> = ({ onClose }) => {
    const { t } = useI18n();
    const isDesktop = useMediaQuery('(min-width: 768px)');

    // Steps: 0 = Who/Where, 1 = What (Type), 2 = Details/Time
    const [step, setStep] = useState(0);

    // Initial State loading
    const savedWorkType = localStorage.getItem('last_work_type') as 'hourly' | 'task' | null;
    const savedProjectId = localStorage.getItem('last_project_id');
    const savedWorkerId = localStorage.getItem('last_worker_id');

    const [workType, setWorkType] = useState<'hourly' | 'task'>(savedWorkType || 'hourly');
    const [taskType, setTaskType] = useState<'panels' | 'construction' | 'cables'>('cables');

    // Fields
    const [projectId, setProjectId] = useState<number | ''>(savedProjectId ? Number(savedProjectId) : '');
    const [workerId, setWorkerId] = useState<number | ''>(savedWorkerId ? Number(savedWorkerId) : '');
    const [description, setDescription] = useState('');

    // Time fields
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    // Task fields
    const [panelCount, setPanelCount] = useState('');
    const [pricePerPanel, setPricePerPanel] = useState('');
    const [flatPrice, setFlatPrice] = useState('');
    const [tableId, setTableId] = useState<number | ''>('');
    const [tableSize, setTableSize] = useState<'small' | 'medium' | 'large'>('small');
    const [worker2Id, setWorker2Id] = useState<number | ''>('');

    // Data
    const projects = useLiveQuery(() => db.projects.toArray());
    const workers = useLiveQuery(() => db.workers.orderBy('name').toArray());
    const tables = useLiveQuery(() => projectId ? db.solarTables.where({ projectId: Number(projectId), status: 'pending' }).toArray() : [], [projectId]);

    // Last Record info for "Repeat" button
    const [lastRecord, setLastRecord] = useState<TimeRecord | null>(null);

    // --- Smart Defaults & Initialization ---

    useEffect(() => {
        // Initialize Timestamps
        const now = new Date();
        const end = new Date(now);
        end.setMinutes(end.getMinutes() - end.getTimezoneOffset()); // Local ISO fix

        // Default Start: 7:00 AM or based on last entry logic
        const start = new Date(now);
        start.setHours(7, 0, 0, 0);
        start.setMinutes(start.getMinutes() - start.getTimezoneOffset());

        setStartTime(start.toISOString().slice(0, 16));
        setEndTime(end.toISOString().slice(0, 16));

        // Attempt to find last record to offer "Repeat"
        if (savedWorkerId) {
            db.records.where('workerId').equals(Number(savedWorkerId)).reverse().first().then(rec => {
                if (rec) setLastRecord(rec);
            });
        }
    }, [savedWorkerId]);

    // Update Start Time based on last "Check-out" if applicable (Smart Logic)
    useEffect(() => {
        if (workerId && projectId) {
            // Find the VERY LAST record for this worker today
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            db.records
                .where('workerId').equals(Number(workerId))
                .filter(r => r.endTime > todayStart)
                .reverse()
                .first()
                .then(lastToday => {
                    if (lastToday) {
                        // If they worked today, start next task when the last one ended
                        const nextStart = new Date(lastToday.endTime);
                        nextStart.setMinutes(nextStart.getMinutes() - nextStart.getTimezoneOffset());
                        setStartTime(nextStart.toISOString().slice(0, 16));
                    }
                });
        }
    }, [workerId, projectId]);

    // --- Handlers ---

    const handleRepeatLast = () => {
        if (!lastRecord) return;
        setProjectId(lastRecord.projectId);
        setWorkerId(lastRecord.workerId);
        setDescription(lastRecord.description || '');
        // We keep current date/time, just copy project/worker/desc
        // Also could copy workType if we stored it in DB, but TimeRecord implies hourly mostly.
        setWorkType('hourly');
        alert(t('last_entry_loaded') || 'Načten poslední záznam (kromě času).');
    };

    const handleQuickTime = (type: 'start' | 'end', action: 'now' | '-30m' | '+30m' | '-1h' | '+1h') => {
        const targetSetter = type === 'start' ? setStartTime : setEndTime;
        const currentVal = type === 'start' ? startTime : endTime;

        const date = currentVal ? new Date(currentVal) : new Date();

        if (action === 'now') {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            targetSetter(now.toISOString().slice(0, 16));
            return;
        }

        let minutes = 0;
        if (action === '-30m') minutes = -30;
        if (action === '+30m') minutes = 30;
        if (action === '-1h') minutes = -60;
        if (action === '+1h') minutes = 60;

        date.setTime(date.getTime() + (minutes * 60 * 1000));
        targetSetter(date.toISOString().slice(0, 16));
    };

    const calculateDuration = () => {
        if (!startTime || !endTime) return 0;
        const s = new Date(startTime).getTime();
        const e = new Date(endTime).getTime();
        return Math.max(0, (e - s) / (1000 * 60 * 60)); // in hours
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

        // Final Validation before Save
        if (!projectId || !workerId) {
            alert("Vyberte pracovníka a projekt.");
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
                const record = { ...recordData, id: newId } as TimeRecord;

                await processRecordDescription(record);

                // NEW: Process fieldTables
                const project = await db.projects.get(Number(projectId));
                if (project?.tables && project.tables.length > 0) {
                    await processFieldTableDescription(record);
                }

            } else { // Task
                let taskData: Omit<ProjectTask, 'id'>;
                const commonTaskData = {
                    projectId: Number(projectId),
                    assignedWorkerId: Number(workerId),
                    completionDate: new Date(),
                    startTime: new Date(startTime),
                    endTime: new Date(endTime)
                };

                if (taskType === 'panels') {
                    const count = Number(panelCount);
                    const perPanel = Number(pricePerPanel);
                    taskData = { ...commonTaskData, taskType: 'panels', description: t('panels_task_desc', { count }), panelCount: count, pricePerPanel: perPanel, price: count * perPanel };
                    await db.projectTasks.add(taskData as ProjectTask);
                } else if (taskType === 'construction') {
                    taskData = { ...commonTaskData, taskType: 'construction', description: description.trim(), price: Number(flatPrice) };
                    await db.projectTasks.add(taskData as ProjectTask);
                } else if (taskType === 'cables') {
                    if (!tableId) { alert("Select a table."); return; }
                    // Cabling logic...
                    await db.transaction('rw', db.solarTables, db.tableAssignments, db.tableStatusHistory, async () => {
                        await db.solarTables.update(tableId, { status: 'completed', tableType: tableSize });
                        await db.tableAssignments.where('tableId').equals(tableId).delete();
                        const workersToAssign = [workerId, worker2Id].filter(Boolean) as number[];
                        await db.tableAssignments.bulkAdd(workersToAssign.map(wId => ({ tableId: Number(tableId), workerId: wId })));
                        await db.tableStatusHistory.bulkAdd(workersToAssign.map(wId => ({
                            tableId: Number(tableId), workerId: wId, status: 'completed', timestamp: new Date()
                        })));
                    });
                }
            }

            // Save defaults
            localStorage.setItem('last_work_type', workType);
            localStorage.setItem('last_project_id', String(projectId));
            localStorage.setItem('last_worker_id', String(workerId));

            alert(t('saved_successfully') || 'Uloženo!');
            onClose();

        } catch (error) {
            console.error("Failed to log work:", error);
            alert("Chyba při ukládání.");
        }
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 2));
    const prevStep = () => setStep(s => Math.max(s - 1, 0));

    // --- Renderers ---

    // Krok 0: KDO a KDE
    const renderStep0 = () => (
        <div className="space-y-6 animate-fade-in">
            {lastRecord && !projectId ? (
                <button
                    type="button"
                    onClick={handleRepeatLast}
                    className="w-full p-4 mb-4 bg-gradient-to-r from-blue-900/40 to-slate-900/40 border border-blue-500/30 rounded-2xl flex items-center gap-3 hover:bg-blue-900/60 transition-all"
                >
                    <div className="p-2 bg-blue-500/20 rounded-full text-blue-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    </div>
                    <div className="text-left">
                        <div className="text-[10px] font-black uppercase text-blue-300 tracking-widest">{t('repeat_last_entry') || 'Zopakovat poslední'}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[200px]">{lastRecord.description || 'Bez popisu'}</div>
                    </div>
                </button>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_worker')}</label>
                    <select id="workerId-main" value={workerId} onChange={(e) => setWorkerId(Number(e.target.value))} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm appearance-none [&>option]:bg-slate-900">
                        <option value="" disabled>{t('select_worker')}</option>
                        {workers?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_project')}</label>
                    <select id="projectId-main" value={projectId} onChange={(e) => setProjectId(Number(e.target.value))} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm appearance-none [&>option]:bg-slate-900">
                        <option value="" disabled>{t('select_project')}</option>
                        {projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );

    // Krok 1: CO (Typ práce)
    const renderStep1 = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="flex p-1 rounded-2xl bg-black/40 border border-white/5 relative">
                <div
                    className="absolute top-1 bottom-1 rounded-xl bg-[var(--color-primary)] shadow-lg transition-all duration-300 ease-out"
                    style={{
                        left: '4px',
                        width: 'calc(50% - 4px)',
                        transform: workType === 'task' ? 'translateX(100%)' : 'translateX(0)'
                    }}
                ></div>
                <button type="button" onClick={() => setWorkType('hourly')} className="relative z-10 flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-colors text-white">{t('hourly_rate_work')}</button>
                <button type="button" onClick={() => setWorkType('task')} className="relative z-10 flex-1 py-3 text-xs font-black uppercase tracking-wider text-center transition-colors text-white">{t('task_based_work')}</button>
            </div>

            {workType === 'task' && (
                <div>
                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('task_type')}</label>
                    <select value={taskType} onChange={e => setTaskType(e.target.value as any)} className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900">
                        <option value="cables">{t('cables')}</option>
                        <option value="panels">{t('panels')}</option>
                        <option value="construction">{t('construction')}</option>
                    </select>
                </div>
            )}
        </div>
    );

    // Krok 2: KOLIK / DETAILY
    const renderStep2 = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Time Section - Always visible now for better data */}
            <div className="p-4 rounded-3xl bg-black/20 border border-white/5">
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
                        <div className="flex gap-1 mt-2 overflow-x-auto pb-1 no-scrollbar">
                            <button type="button" onClick={() => handleQuickTime('start', '-1h')} className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-white whitespace-nowrap">-1h</button>
                            <button type="button" onClick={() => handleQuickTime('start', '-30m')} className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-white whitespace-nowrap">-30m</button>
                            <button type="button" onClick={() => handleQuickTime('start', '+30m')} className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-white whitespace-nowrap">+30m</button>
                        </div>
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
                        <div className="flex gap-1 mt-2 overflow-x-auto pb-1 no-scrollbar">
                            <button type="button" onClick={() => handleQuickTime('end', 'now')} className="px-2 py-1 bg-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-lg text-[9px] font-bold hover:bg-[var(--color-accent)] hover:text-white whitespace-nowrap">TEĎ</button>
                            <button type="button" onClick={() => handleQuickTime('end', '+1h')} className="px-2 py-1 bg-white/5 rounded-lg text-[9px] font-bold text-slate-400 hover:text-white whitespace-nowrap">+1h</button>
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 px-3 py-1 rounded-full">Trvání: {calculateDuration().toFixed(1)}h</span>
                </div>
            </div>

            {/* Task Specific Fields */}
            {workType === 'task' ? (
                <>
                    {taskType === 'panels' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('panel_count')}</label>
                                <input inputMode="decimal" type="number" value={panelCount} onChange={e => setPanelCount(e.target.value)} required min="1" className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('price_per_panel')}</label>
                                <input inputMode="decimal" type="number" value={pricePerPanel} onChange={e => setPricePerPanel(e.target.value)} required min="0.01" step="0.01" className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                            </div>
                        </div>
                    )}
                    {taskType === 'construction' && (
                        <>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('description')}</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3} className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none text-sm leading-relaxed" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('flat_rate')}</label>
                                <input inputMode="decimal" type="number" value={flatPrice} onChange={e => setFlatPrice(e.target.value)} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm" />
                            </div>
                        </>
                    )}
                    {taskType === 'cables' && (
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">{t('select_table')}</label>
                            <select value={tableId} onChange={e => setTableId(Number(e.target.value))} required className="w-full p-4 bg-white/5 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] outline-none font-bold text-sm [&>option]:bg-slate-900">
                                <option value="" disabled>{tables && tables.length > 0 ? t('select_table') : t('no_tables_defined')}</option>
                                {tables?.map(t => <option key={t.id} value={t.id}>{t.tableCode}</option>)}
                            </select>
                        </div>
                    )}
                </>
            ) : (
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
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md p-0 md:p-4 animate-fade-in">
            <div className="w-full h-[90vh] md:h-auto md:max-h-[85vh] md:max-w-lg bg-slate-900 md:bg-slate-900/90 backdrop-blur-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border-t md:border border-white/10 flex flex-col overflow-hidden">

                {/* Header with Progress Steps (Mobile) */}
                <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-2xl font-black text-white uppercase tracking-tight">{t('log_work')}</h2>
                        <button onClick={onClose} className="p-2 rounded-full bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-400 hover:text-white">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    {!isDesktop && (
                        <div className="flex gap-2">
                            {[0, 1, 2].map(s => (
                                <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step >= s ? 'bg-[var(--color-accent)]' : 'bg-white/10'}`}></div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar pb-40">
                    <form id="time-record-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Desktop: Show all. Mobile: Show current step */}
                        {isDesktop ? (
                            <>
                                {renderStep0()}
                                {renderStep1()}
                                {renderStep2()}
                            </>
                        ) : (
                            <>
                                {step === 0 && renderStep0()}
                                {step === 1 && renderStep1()}
                                {step === 2 && renderStep2()}
                            </>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="border-t border-white/10 p-4 md:p-6 bg-slate-900/95 backdrop-blur-xl flex gap-3 pb-safe">
                    {/* Back Button (Mobile only, step > 0) */}
                    {!isDesktop && step > 0 && (
                        <button type="button" onClick={prevStep} className="px-6 py-4 bg-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-colors">
                            ←
                        </button>
                    )}

                    {!isDesktop && step < 2 ? (
                        <button
                            type="button"
                            onClick={() => {
                                // Basic validation before next
                                if (step === 0 && (!workerId || !projectId)) { alert("Vyberte pracovníka a projekt."); return; }
                                nextStep();
                            }}
                            className="flex-1 py-4 bg-[var(--color-primary)] text-white font-black uppercase tracking-widest rounded-2xl hover:bg-opacity-90 shadow-lg"
                        >
                            {t('next') || 'Další'}
                        </button>
                    ) : (
                        // Save Button (Desktop or Mobile Last Step)
                        <button
                            onClick={(e) => {
                                const form = document.getElementById('time-record-form') as HTMLFormElement;
                                if (form) form.requestSubmit();
                            }}
                            className="flex-[2] py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-black uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] text-xs"
                        >
                            {t('save')}
                        </button>
                    )}

                    {/* Cancel Button (Desktop logic) */}
                    {isDesktop && (
                        <button type="button" onClick={onClose} className="px-8 py-4 bg-white/5 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-white/10 text-xs">{t('cancel')}</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimeRecordForm;