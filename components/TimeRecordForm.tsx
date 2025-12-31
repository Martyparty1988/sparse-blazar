
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Project, TimeRecord } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../contexts/ToastContext';
import { soundService } from '../services/soundService';

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
    const [workType, setWorkType] = useState<'hourly' | 'task'>(editRecord ? 'hourly' : (savedWorkType || 'hourly'));
    const [projectId, setProjectId] = useState<number | ''>(editRecord?.projectId || initialProjectId || (savedProjectId ? Number(savedProjectId) : ''));
    const [workerId] = useState<number>(currentUser?.workerId || -1);
    const [description, setDescription] = useState(editRecord?.description || '');
    const [tableIds, setTableIds] = useState<string[]>(initialTableIds || []);
    const [isListening, setIsListening] = useState(false);

    // Time States
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Data
    const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());

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
            start.setHours(7, 0, 0, 0); // Default to 7:00 AM
            const end = new Date(now);
            end.setHours(15, 30, 0, 0); // Default to 3:30 PM
            setStartTime(toLocalISO(start));
            setEndTime(toLocalISO(end));
        }
    }, [editRecord]);

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
            };

            let finalId: number;
            if (editRecord?.id) {
                await db.records.update(editRecord.id, recordData);
                finalId = editRecord.id;
            } else {
                finalId = await db.records.add(recordData as TimeRecord);
            }

            if (firebaseService.isReady) {
                await firebaseService.upsertRecords('timeRecords', [{
                    ...recordData,
                    id: finalId,
                    startTime: recordData.startTime.toISOString(),
                    endTime: recordData.endTime.toISOString()
                }]);
            }

            localStorage.setItem('last_work_type', workType);
            localStorage.setItem('last_project_id', String(projectId));

            showToast("Zapsáno ✅", "success");
            soundService.playSuccess();
            onClose();
        } catch (err) {
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
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Project Selection */}
                    {!initialProjectId && (
                        <section>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Vyberte projekt</label>
                            <div className="grid grid-cols-2 gap-2">
                                {projects?.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setProjectId(p.id!)}
                                        className={`p-3 rounded-xl text-xs font-bold transition-all border text-left truncate ${projectId === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Quick Time Presets */}
                    <section className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">Rychlá volba času</label>
                        <div className="flex gap-2">
                            <button onClick={() => handleQuickTime('full_day')} className="flex-1 py-3 px-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-xl border border-white/5 transition-all">Celý den (7-15:30)</button>
                            <button onClick={() => handleQuickTime('half_day')} className="flex-1 py-3 px-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-xl border border-white/5 transition-all">Půlden (7-11:00)</button>
                            <button onClick={() => handleQuickTime('now')} className="flex-1 py-3 px-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase rounded-xl shadow-lg shadow-indigo-500/20 transition-all">Právě teď</button>
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
                            placeholder="Zadejte popis práce..."
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors text-sm font-bold"
                            rows={3}
                        />
                    </section>
                </div>

                <div className="p-6 bg-black/40 border-t border-white/5">
                    <button
                        onClick={handleSubmit}
                        disabled={isSending || !projectId}
                        className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all disabled:opacity-30"
                    >
                        {isSending ? 'Ukládám...' : 'Uložit záznam'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeRecordForm;
