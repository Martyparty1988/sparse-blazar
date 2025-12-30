
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Worker } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';

interface WorkerFormProps {
  worker?: Worker;
  onClose: () => void;
}

const WorkerForm: React.FC<WorkerFormProps> = ({ worker, onClose }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('0');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (worker) {
      setName(worker.name);
      setHourlyRate(String(worker.hourlyRate));
      setPassword(worker.password || '');
    } else {
      setName('');
      setHourlyRate('0');
      setPassword('');
    }
  }, [worker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const workerData: Omit<Worker, 'id'> = {
      name,
      hourlyRate: user?.role === 'admin' ? (Number(hourlyRate) || 0) : (worker?.hourlyRate ?? 0),
      password: password,
      username: name.toLowerCase().replace(/\s/g, ''),
      createdAt: worker?.createdAt || new Date(),
    };

    if (worker?.id) {
      await db.workers.update(worker.id, workerData);
    } else {
      await db.workers.add(workerData as Worker);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full h-full md:h-auto md:max-w-lg p-8 md:p-10 bg-slate-900/90 backdrop-blur-3xl md:rounded-[3rem] shadow-2xl border-none md:border border-white/20 transform transition-all scale-100 overflow-y-auto">
        <h2 className="text-4xl font-black mb-8 text-white tracking-tighter uppercase italic border-b border-white/10 pb-6">
          {worker ? t('edit_worker') : t('add_worker')}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">{t('worker_name')}</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full p-5 bg-black/40 text-white placeholder-gray-500 text-lg font-bold rounded-2xl shadow-inner border border-white/10 transition-all"
              placeholder="e.g. John Doe"
            />
          </div>

          {user?.role === 'admin' && (
            <>
              <div>
                <label htmlFor="hourlyRate" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">{t('hourly_rate')}</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">€</span>
                  <input
                    type="number"
                    id="hourlyRate"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    required
                    step="0.01"
                    min="0"
                    className="w-full p-5 pl-10 bg-black/40 text-white placeholder-gray-500 text-lg font-bold rounded-2xl shadow-inner border border-white/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-3 ml-1">{t('password')} (Login)</label>
                <input
                  type="text"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-5 bg-black/40 text-white placeholder-gray-500 text-lg font-bold rounded-2xl shadow-inner border border-white/10 transition-all"
                  placeholder="Heslo nebo PIN"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-4 bg-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-colors uppercase tracking-widest text-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-[var(--color-accent)] hover:text-white transition-all shadow-xl uppercase tracking-widest text-xs active:scale-95"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerForm;
