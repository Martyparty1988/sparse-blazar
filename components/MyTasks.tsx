
import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseService } from '../services/firebaseService';
import type { ProjectTask, Project, TimeRecord } from '../types';
import { soundService } from '../services/soundService';
import { useNavigate } from 'react-router-dom';

const MyTasks: React.FC = () => {
    const { currentUser } = useAuth();
    const { t } = useI18n();
    const { showToast } = useToast();
    const navigate = useNavigate();

    const workerId = currentUser?.workerId;

    // Data Queries
    const tasks = useLiveQuery(() => 
        workerId ? db.projectTasks.where('assignedWorkerId').equals(workerId).toArray() : Promise.resolve([])
    , [workerId]);
    
    const projects = useLiveQuery(() => db.projects.toArray(), []);

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const activeTask = useMemo(() => 
        tasks?.find(t => t.startTime && !t.endTime && !t.completionDate)
    , [tasks]);

    const pendingTasks = useMemo(() => 
        tasks?.filter(t => !t.startTime && !t.completionDate).sort((a,b) => (a.id || 0) - (b.id || 0))
    , [tasks]);

    const handleStartTask = async (task: ProjectTask) => {
        if (activeTask) {
            showToast("Již máte jeden aktivní úkol. Nejdříve jej dokončete.", "warning");
            return;
        }

        const startTime = new Date();
        try {
            await db.projectTasks.update(task.id!, { startTime });
            if (firebaseService.isReady) {
                await firebaseService.updateRecord('projectTasks', task.id!, { startTime: startTime.toISOString() });
            }
            soundService.playClick();
            showToast("Práce zahájena", "success");
        } catch (err) {
            showToast("Chyba při zahájení úkolu", "error");
        }
    };

    const handleFinishTask = async (task: ProjectTask) => {
        const endTime = new Date();
        const startTime = task.startTime ? new Date(task.startTime) : endTime;
        
        try {
            // 1. Mark task as completed
            await db.projectTasks.update(task.id!, { 
                endTime, 
                completionDate: endTime 
            });

            // 2. Create TimeRecord automatically
            const record: Omit<TimeRecord, 'id'> = {
                workerId: workerId!,
                projectId: task.projectId,
                startTime,
                endTime,
                description: `Úkol: ${task.description}`,
                projectTaskId: task.id,
                tableIds: task.tableIds
            };

            const recordId = await db.records.add(record as TimeRecord);

            // 3. Sync to Firebase
            if (firebaseService.isReady) {
                await firebaseService.updateRecord('projectTasks', task.id!, { 
                    endTime: endTime.toISOString(),
                    completionDate: endTime.toISOString()
                });
                await firebaseService.upsertRecords('timeRecords', [{
                    ...record,
                    id: recordId,
                    startTime: record.startTime.toISOString(),
                    endTime: record.endTime.toISOString()
                }]);
            }

            soundService.playSuccess();
            showToast("Úkol dokončen a čas zapsán ✅", "success");
        } catch (err) {
            showToast("Chyba při dokončování úkolu", "error");
        }
    };

    const formatDuration = (start: Date, end: Date) => {
        const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const getProjectName = (projectId: number) => projects?.find(p => p.id === projectId)?.name || 'Neznámý projekt';

    return (
        <div className="space-y-6 pb-20 animate-fade-in max-w-4xl mx-auto p-4">
            <header className="flex justify-between items-center">
                <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Moje Úkoly</h1>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dnes je</p>
                    <p className="text-white font-bold">{now.toLocaleDateString()}</p>
                </div>
            </header>

            {/* Active Task Section */}
            {activeTask ? (
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-8 shadow-2xl shadow-indigo-500/20 border border-white/10">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <svg className="w-32 h-32 animate-spin-slow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div>
                            <span className="bg-black/20 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-white/10 mb-4 inline-block">Právě pracujete</span>
                            <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2 leading-none">{activeTask.description}</h2>
                            <p className="text-indigo-100 font-bold opacity-80 uppercase text-xs tracking-widest">{getProjectName(activeTask.projectId)}</p>
                        </div>
                        
                        <div className="text-center md:text-right bg-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-md min-w-[160px]">
                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Doba trvání</p>
                            <p className="text-4xl font-mono font-black text-white">{formatDuration(new Date(activeTask.startTime!), now)}</p>
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <button 
                            onClick={() => handleFinishTask(activeTask)}
                            className="flex-1 bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            Hotovo / Dokončit
                        </button>
                        <button 
                            onClick={() => navigate(`/chat`)}
                            className="bg-black/20 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest border border-white/10 hover:bg-white/5 transition-all flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            Problém?
                        </button>
                    </div>
                </section>
            ) : (
                <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 text-center animate-fade-in">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </div>
                    <p className="text-xl font-black text-slate-400 uppercase italic tracking-widest mb-1">Žádná aktivní práce</p>
                    <p className="text-sm font-bold text-slate-600 uppercase tracking-tight">Vyberte si úkol z fronty níže a začněte pracovat.</p>
                </div>
            )}

            {/* Tasks Queue */}
            <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Fronta Úkolů ({pendingTasks?.length || 0})</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingTasks?.map((task, idx) => (
                        <div 
                            key={task.id} 
                            className="group bg-slate-800/50 hover:bg-slate-800 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-6 transition-all animate-list-item"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-white/5 rounded-xl text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full border border-white/5 group-hover:border-indigo-500/20 transition-all">Přiřazeno</span>
                            </div>
                            
                            <h4 className="text-lg font-bold text-white mb-1 leading-tight group-hover:text-indigo-400 transition-colors">{task.description}</h4>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">{getProjectName(task.projectId)}</p>
                            
                            <button 
                                onClick={() => handleStartTask(task)}
                                className="w-full bg-white/5 hover:bg-indigo-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-white/5 hover:border-transparent active:scale-95"
                            >
                                Začít pracovat
                            </button>
                        </div>
                    ))}
                    
                    {pendingTasks?.length === 0 && (
                        <div className="col-span-full py-12 text-center opacity-40 italic font-bold text-slate-500">
                            Všechny úkoly jsou hotové. Dobrá práce! 🎉
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default MyTasks;
