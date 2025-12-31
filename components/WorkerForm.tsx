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
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-h-[95vh] md:max-w-lg bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-white/10 flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl md:text-3xl font-black text-white italic tracking-tighter uppercase">{worker ? t('edit_worker') : t('add_worker')}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-all bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div>
            <label htmlFor="name" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('worker_name')}</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-4 bg-black/40 text-white text-lg font-bold rounded-xl border border-white/10" placeholder="John Doe" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('assigned_projects')}</label>
            <div className="flex flex-wrap gap-2 p-3 bg-black/40 rounded-xl border border-white/10">
              {activeProjects?.map(project => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleProjectToggle(project.id!)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${projectIds.includes(project.id!) ? 'bg-indigo-500 text-white border-transparent' : 'text-slate-300 border-slate-700 hover:border-indigo-500'}`}>
                  {project.name}
                </button>
              ))}
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('rates_and_prices')}</label>
              </div>
              <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder={t('hourly_rate')} className="p-3 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={panelPrice} onChange={(e) => setPanelPrice(e.target.value)} placeholder={t('panel_price')} className="p-3 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={stringPrice} onChange={(e) => setStringPrice(e.target.value)} placeholder={t('string_price')} className="p-3 bg-black/40 text-white rounded-xl border border-white/10" />
              <input type="number" value={meterPrice} onChange={(e) => setMeterPrice(e.target.value)} placeholder={t('meter_price')} className="p-3 bg-black/40 text-white rounded-xl border border-white/10" />
              <div className="col-span-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('password_label')}</label>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-black/40 text-white rounded-xl border border-white/10" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t('worker_color')}</label>
            <div className="grid grid-cols-6 gap-2 p-3 bg-black/40 rounded-xl border border-white/10">
              {['#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ef4444', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#4f46e5', '#db2777', '#f97316'].map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} className={`h-8 rounded-lg ${color === c ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white scale-105 shadow-lg' : 'opacity-60 hover:opacity-100'} transition-all`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

        </form>
        <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 py-3 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-[10px]">{t('cancel')}</button>
          <button type="submit" onClick={handleSubmit} className="flex-1 md:flex-none px-10 py-3 bg-white text-black font-black rounded-xl hover:bg-indigo-400 hover:text-white transition-all shadow-lg uppercase tracking-widest text-[10px]">{t('save')}</button>
        </div>
      </div>
    </div>
  );
};

export default WorkerForm;
