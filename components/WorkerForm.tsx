import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Worker, Project } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';

interface WorkerFormProps {
  worker?: Worker;
  onClose: () => void;
}

const WorkerForm: React.FC<WorkerFormProps> = ({ worker, onClose }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [panelPrice, setPanelPrice] = useState('0');
  const [stringPrice, setStringPrice] = useState('0');
  const [meterPrice, setMeterPrice] = useState('0');
  const [password, setPassword] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [projectIds, setProjectIds] = useState<number[]>([]);

  const activeProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray(), []);

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setHourlyRate(String(worker.hourlyRate || 0));
      setPanelPrice(String(worker.panelPrice || 0));
      setStringPrice(String(worker.stringPrice || 0));
      setMeterPrice(String(worker.meterPrice || 0));
      setPassword(worker.password || '1234');
      setColor(worker.color || '#3b82f6');
      setProjectIds(worker.projectIds || []);
    }
  }, [worker]);

  const handleProjectToggle = (projectId: number) => {
    setProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const workerData: Omit<Worker, 'id'> = {
      name,
      hourlyRate: user?.role === 'admin' ? (Number(hourlyRate) || 0) : (worker?.hourlyRate ?? 0),
      panelPrice: user?.role === 'admin' ? (Number(panelPrice) || 0) : (worker?.panelPrice ?? 0),
      stringPrice: user?.role === 'admin' ? (Number(stringPrice) || 0) : (worker?.stringPrice ?? 0),
      meterPrice: user?.role === 'admin' ? (Number(meterPrice) || 0) : (worker?.meterPrice ?? 0),
      password: password,
      username: name.toLowerCase().replace(/\s/g, ''),
      color: color,
      projectIds,
      createdAt: worker?.createdAt || new Date(),
    };

    let finalId = worker?.id;
    if (finalId) {
      await db.workers.update(finalId, workerData);
    } else {
      finalId = (await db.workers.add(workerData as Worker)) as number;
    }

    // Bi-directional sync: Update project's workerIds
    if (activeProjects) {
        for (const project of activeProjects) {
            const isAssigned = projectIds.includes(project.id!);
            const wasAssigned = project.workerIds?.includes(finalId!);

            if (isAssigned && !wasAssigned) {
                const newWorkerIds = [...(project.workerIds || []), finalId!];
                await db.projects.update(project.id!, { workerIds: newWorkerIds });
                firebaseService.updateRecord('projects', project.id!, { workerIds: newWorkerIds });
            } else if (!isAssigned && wasAssigned) {
                const newWorkerIds = project.workerIds?.filter(id => id !== finalId!);
                await db.projects.update(project.id!, { workerIds: newWorkerIds });
                firebaseService.updateRecord('projects', project.id!, { workerIds: newWorkerIds });
            }
        }
    }

    if (firebaseService.isReady && finalId) {
      firebaseService.upsertRecords('workers', [{ ...workerData, id: finalId }])
        .catch(console.error);
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full h-full md:h-auto md:max-w-lg p-8 md:p-10 bg-slate-900/90 backdrop-blur-3xl md:rounded-[3rem] shadow-2xl border-none md:border border-white/20 transform transition-all scale-100 overflow-y-auto custom-scrollbar">
        <h2 className="text-4xl font-black mb-8 text-white tracking-tighter uppercase italic border-b border-white/10 pb-6">
          {worker ? t('edit_worker') : t('add_worker')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">{t('worker_name')}</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-5 bg-black/40 text-white placeholder-gray-500 text-lg font-bold rounded-2xl shadow-inner border border-white/10" placeholder="John Doe" />
          </div>

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Přiřazené projekty</label>
            <div className="flex flex-wrap gap-2 p-4 bg-black/40 rounded-2xl border border-white/10">
                {activeProjects?.map(project => (
                    <button
                        key={project.id}
                        type="button"
                        onClick={() => handleProjectToggle(project.id!)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${projectIds.includes(project.id!) ? 'bg-[var(--color-accent)] border-transparent text-white' : 'bg-transparent border-white/10 text-gray-500 hover:border-white/30'}`}
                    >
                        {project.name}
                    </button>
                ))}
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Hodinová sazba a ceny za práci</label>
              </div>
              <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Hodinivo" className="p-4 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={panelPrice} onChange={(e) => setPanelPrice(e.target.value)} placeholder="Cena Panel" className="p-4 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={stringPrice} onChange={(e) => setStringPrice(e.target.value)} placeholder="Cena String" className="p-4 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={meterPrice} onChange={(e) => setMeterPrice(e.target.value)} placeholder="Cena Konstrukce" className="p-4 bg-black/40 text-white rounded-xl border border-white/10" />
              <div className="col-span-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">Přihlašovací heslo</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-4 bg-black/40 text-white rounded-xl border border-white/10" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">{t('worker_color')}</label>
            <div className="grid grid-cols-6 gap-2">
              {['#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ef4444', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#4f46e5', '#db2777', '#f97316'].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 rounded-lg ${color === c ? 'ring-2 ring-white scale-110 shadow-lg' : 'opacity-50'}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-white/5 text-white font-black rounded-xl uppercase tracking-widest text-[10px]">{t('cancel')}</button>
            <button type="submit" className="px-8 py-3 bg-white text-black font-black rounded-xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-[var(--color-accent)] hover:text-white transition-all active:scale-95">{t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerForm;
