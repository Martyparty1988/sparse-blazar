
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project, TimeRecord, FieldTable } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../contexts/ToastContext';
import { soundService } from '../services/soundService';
import RedoIcon from './icons/RedoIcon';

interface WorkLogFormProps {
    onClose: () => void;
    editRecord?: TimeRecord;
    initialTableIds?: string[];
    initialProjectId?: number;
}

const TimeRecordForm: React.FC<WorkLogFormProps> = ({ onClose, editRecord, initialTableIds, initialProjectId }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const { currentUser } = useAuth();

    // Smart Defaults
    const savedWorkType = localStorage.getItem('last_work_type') as 'hourly' | 'task' | null;
    const savedProjectId = localStorage.getItem('last_project_id');

    // States
    const [workType, setWorkType] = useState<'hourly' | 'task'>(
        editRecord?.workType || (initialTableIds && initialTableIds.length > 0 ? 'task' : (savedWorkType || 'hourly'))
    );
    const [projectId, setProjectId] = useState<number | ''>(editRecord?.projectId || initialProjectId || (savedProjectId ? Number(savedProjectId) : ''));
    const [workerId] = useState<number>(currentUser?.workerId || -1);
    const [description, setDescription] = useState(editRecord?.description || '');
    const [tableIds, setTableIds] = useState<string[]>(initialTableIds || []);
    const [isListening, setIsListening] = useState(false);

    // Task Specific States
    const [manualQuantity, setManualQuantity] = useState<number>(editRecord?.quantity || 0);
    const [manualTableType, setManualTableType] = useState<'small' | 'medium' | 'large'>(editRecord?.tableType || 'medium');

    // Time States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Data
    const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());
    const worker = useLiveQuery(() => workerId !== -1 ? db.workers.get(workerId) : undefined, [workerId]);

    // Convert string IDs to FieldTable objects for calculation
    const selectedTables = useLiveQuery(async () => {
        if (!projectId || tableIds.length === 0) return [];
        return await db.fieldTables.where('projectId').equals(Number(projectId))
            .filter(t => tableIds.includes(t.tableId))
            .toArray();
    }, [projectId, tableIds]);

    // Calculate Total Strings (Earnings Base)
    const calculatedStrings = useMemo(() => {
        if (workType !== 'task') return 0;

        // If specific tables are selected, calculate exact sum
        if (selectedTables && selectedTables.length > 0) {
            return selectedTables.reduce((acc, table) => {
                const coeff = table.tableType === 'small' ? 1 : table.tableType === 'large' ? 2 : 1.5;
                return acc + coeff;
            }, 0);
        }

        // Otherwise use manual quantity * type coeff
        const coeff = manualTableType === 'small' ? 1 : manualTableType === 'large' ? 2 : 1.5;
        return manualQuantity * coeff;
    }, [workType, selectedTables, manualQuantity, manualTableType]);

    // Memoize sorted projects to put the last used one on top
    const sortedProjects = useMemo(() => {
        if (!projects) return [];
        const lastPid = Number(savedProjectId);
        if (!lastPid) return projects;

        return [...projects].sort((a, b) => {
            if (a.id === lastPid) return -1;
            if (b.id === lastPid) return 1;
            return a.name.localeCompare(b.name);
        });
    }, [projects, savedProjectId]);

    const toLocalISO = (d: Date) => {
        const tzOffset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };

    useEffect(() => {
        if (editRecord) {
            setStartTime(toLocalISO(new Date(editRecord.startTime)));
            setEndTime(toLocalISO(new Date(editRecord.endTime)));
        } else {
            const now = new Date();
            const start = new Date(now);
            // Default to 'now' minus 8 hours if not set, or just common work hours
            start.setHours(7, 0, 0, 0);
            const end = new Date(now);
            // end.setHours(15, 30, 0, 0);

            setStartTime(toLocalISO(start));
            setEndTime(toLocalISO(end));
        }
    }, [editRecord]);

    // Update manual quantity defaulting if simple table selection
    useEffect(() => {
        if (selectedTables && selectedTables.length > 0 && manualQuantity === 0) {
            // We don't set manual quantity here because we use calculatedStrings.
            // Only relevant if we want to pre-fill manual inputs for fallback.
        }
    }, [selectedTables]);

    const handleQuickTime = (type: 'now' | 'full_day' | 'half_day') => {
        const now = new Date();
        if (type === 'now') {
            setEndTime(toLocalISO(now));
        } else if (type === 'full_day') {
            const s = new Date(now); s.setHours(7, 0, 0, 0);
            const e = new Date(now); e.setHours(15, 30, 0, 0);
            setStartTime(toLocalISO(s));
            setEndTime(toLocalISO(e));
        } else if (type === 'half_day') {
            const s = new Date(now); s.setHours(7, 0, 0, 0);
            const e = new Date(now); e.setHours(11, 0, 0, 0);
            setStartTime(toLocalISO(s));
            setEndTime(toLocalISO(e));
        }
        soundService.playClick();
    };

    const handleRepeatLast = async () => {
        try {
            const lastRecord = await db.records
                .where('workerId').equals(workerId)
                .reverse()
                .first();

            if (lastRecord) {
                setProjectId(lastRecord.projectId);
                setDescription(lastRecord.description);
                if (lastRecord.workType) setWorkType(lastRecord.workType);
                if (lastRecord.tableIds) setTableIds(lastRecord.tableIds);

                // Smart Time: Use yesterday's times but for TODAY
                const now = new Date();
                const lastStart = new Date(lastRecord.startTime);
                const lastEnd = new Date(lastRecord.endTime);

                const newStart = new Date(now);
                newStart.setHours(lastStart.getHours(), lastStart.getMinutes(), 0, 0);

                const newEnd = new Date(now);
                newEnd.setHours(lastEnd.getHours(), lastEnd.getMinutes(), 0, 0);

                setStartTime(toLocalISO(newStart));
                setEndTime(toLocalISO(newEnd));

                showToast("Načten poslední záznam", "info");
                soundService.playClick();
            } else {
                showToast("Žádný předchozí záznam nenalezen", "warning");
            }
        } catch (e) {
            console.error(e);
            showToast("Chyba při načítání historie", "error");
        }
    };

    const toggleListening = () => {
        if (!('webkitSpeechRecognition' in window)) {
            showToast("Hlasové zadávání není v tomto prohlížeči podporováno.", "warning");
            return;
        }

        const SpeechRecognition = (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'cs-CZ';
        recognition.continuous = false;

        recognition.onstart = () => {
            setIsListening(true);
            soundService.playClick();
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
            setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectId || workerId === -1) {
            showToast("Chybí projekt nebo pracovník", "error");
            return;
        }

        setIsSending(true);
        try {
            const recordData: Omit<TimeRecord, 'id'> = {
                workerId,
                projectId: Number(projectId),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                description: description || (tableIds.length > 0 ? `Stoly: ${tableIds.join(', ')}` : ''),
                tableIds: tableIds.length > 0 ? tableIds : undefined,
                workType,
                // Store the calculated STRINGS as quantity, so stats are easy
                quantity: workType === 'task' ? calculatedStrings : undefined,
                tableType: workType === 'task' && tableIds.length === 0 ? manualTableType : undefined
            };

            let finalId: number;
            if (editRecord?.id) {
                await db.records.update(editRecord.id, recordData);
                finalId = editRecord.id;
            } else {
                finalId = await db.records.add(recordData as TimeRecord);
            }

            // Sync with Firebase
            if (firebaseService.isReady) {
                await firebaseService.upsertRecords('timeRecords', [{
                    ...recordData,
                    id: finalId,
                    startTime: recordData.startTime.toISOString(),
                    endTime: recordData.endTime.toISOString()
                }]);
            }

            // If Task-based and has tables, update their status!
            if (workType === 'task' && tableIds.length > 0) {
                const tablesToUpdate = await db.fieldTables.where('projectId').equals(Number(projectId))
                    .filter(t => tableIds.includes(t.tableId))
                    .toArray();

                for (const table of tablesToUpdate) {
                    const updates = {
                        status: 'completed' as const,
                        completedAt: new Date(),
                        completedBy: workerId
                    };
                    await db.fieldTables.update(table.id!, updates);

                    if (firebaseService.isReady) {
                        firebaseService.upsertRecords('fieldTables', [{
                            ...table,
                            ...updates,
                            id: `${table.projectId}_${table.tableId}`
                        }]).catch(console.error);
                    }
                }
            }

            localStorage.setItem('last_work_type', workType);
            localStorage.setItem('last_project_id', String(projectId));

            showToast("Zapsáno ✅", "success");
            soundService.playSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            showToast("Chyba při ukládání", "error");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-4 animate-fade-in">
            <div className="w-full max-h-[95vh] md:max-w-lg bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-white/10 flex flex-col overflow-hidden animate-slide-up">

                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Rychlý zápis práce</h2>
                    <button onClick={() => { soundService.playClick(); onClose(); }} className="p-2 text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Work Type Switcher - Top Priority */}
                    <div className="grid grid-cols-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                        <button
                            onClick={() => setWorkType('hourly')}
                            className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${workType === 'hourly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            Hodinová
                        </button>
                        <button
                            onClick={() => setWorkType('task')}
                            className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${workType === 'task' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            Úkolová
                        </button>
                    </div>

                    {/* Task Specific Inputs */}
                    {workType === 'task' && (
                        <div className="space-y-4 animate-slide-in-right">
                            {/* If came from map selection */}
                            {tableIds.length > 0 ? (
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                                    <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Vybrané stoly ({tableIds.length})</h3>
                                    <p className="text-white font-mono text-sm truncate opacity-70">{tableIds.join(', ')}</p>
                                </div>
                            ) : (
                                // Manual Quantity Input
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Počet kusů</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            value={manualQuantity}
                                            onChange={e => setManualQuantity(Number(e.target.value))}
                                            className="w-full bg-black/40 text-white text-lg font-black p-3 rounded-xl border border-white/10 focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Velikost stolu</label>
                                        <select
                                            value={manualTableType}
                                            onChange={e => setManualTableType(e.target.value as any)}
                                            className="w-full bg-black/40 text-white text-sm font-bold p-3 rounded-xl border border-white/10 outline-none"
                                        >
                                            <option value="small">S (1 str)</option>
                                            <option value="medium">M (1.5 str)</option>
                                            <option value="large">L (2 str)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {/* Earnings Estimate */}
                            <div className="p-5 bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 rounded-2xl flex justify-between items-center">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Celkem stringů</p>
                                    <p className="text-2xl font-black text-white italic tracking-tighter">{calculatedStrings.toFixed(1)} <span className="text-sm not-italic opacity-50 font-normal">str</span></p>
                                </div>
                                {worker && (
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Odměna cca</p>
                                        <p className="text-2xl font-black text-emerald-400 italic tracking-tighter">
                                            {Math.round(calculatedStrings * (worker.stringPrice || 0))} <span className="text-sm text-emerald-600/50">Kč</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Repeat Last Button - Featured for Speed */}
                    {!initialProjectId && !editRecord && (
                        <button
                            onClick={handleRepeatLast}
                            className="w-full py-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 mb-2"
                        >
                            <RedoIcon className="w-5 h-5" />
                            <span className="font-black uppercase tracking-widest text-xs">Zopakovat včerejší práci</span>
                        </button>
                    )}

                    {/* Project Selection */}
                    {!initialProjectId && (
                        <section>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Vyberte projekt</label>
                            <div className="grid grid-cols-2 gap-2">
                                {sortedProjects?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => { soundService.playClick(); setProjectId(p.id!); }}
                                        className={`p-3 rounded-xl text-xs font-bold transition-all border text-left truncate ${projectId === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Quick Time Presets (Visible for both, but maybe less emphasized for Task) */}
                    <section className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                            {workType === 'task' ? 'Čas realizace (pro statistiku)' : 'Odpracovaný čas (pro výplatu)'}
                        </label>
                        <div className="flex gap-2">
                            <button onClick={() => { soundService.playClick(); handleQuickTime('full_day'); }} className="flex-1 py-3 px-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-xl border border-white/5 transition-all touch-manipulation">Celý den</button>
                            <button onClick={() => { soundService.playClick(); handleQuickTime('half_day'); }} className="flex-1 py-3 px-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-xl border border-white/5 transition-all touch-manipulation">Půlden</button>
                            <button onClick={() => { soundService.playClick(); handleQuickTime('now'); }} className="flex-1 py-3 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-indigo-500/20 transition-all touch-manipulation">Teď</button>
                        </div>
                    </section>

                    {/* Time Input Details */}
                    <div className="grid grid-cols-2 gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Začátek</label>
                            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-black/40 text-white text-xs p-3 rounded-xl border border-white/10" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Konec</label>
                            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-black/40 text-white text-xs p-3 rounded-xl border border-white/10" />
                        </div>
                    </div>

                    {/* Description with Voice Support */}
                    <section>
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Popis práce</label>
                            <button
                                onClick={toggleListening}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                {isListening ? 'Poslouchám...' : 'Diktovat'}
                            </button>
                        </div>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder={workType === 'task' ? "Poznámka k úkolu..." : "Co se dělalo..."}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm font-bold"
                            rows={3}
                        />
                    </section>
                </div>

                <div
                    className="p-6 bg-black/40 border-t border-white/5"
                    style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <button
                        onClick={(e) => { soundService.playClick(); handleSubmit(e); }}
                        disabled={isSending || !projectId}
                        className={`w-full text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all disabled:opacity-30 touch-manipulation ${workType === 'task' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-indigo-600 to-blue-600'}`}
                    >
                        {isSending ? 'Ukládám...' : workType === 'task' ? 'Potvrdit úkol' : 'Uložit hodiny'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeRecordForm;
