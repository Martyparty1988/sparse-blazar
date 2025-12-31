import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Worker } from '../types';
import WorkerForm from './WorkerForm';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import ConfirmationModal from './ConfirmationModal';
import PlusIcon from './icons/PlusIcon';
import SearchIcon from './icons/SearchIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import BackButton from './BackButton';

const WorkerCard: React.FC<{
  worker: Worker;
  index: number;
  isAdmin: boolean;
  onEdit: (w: Worker) => void;
  onDelete: (w: Worker) => void;
}> = ({ worker, index, isAdmin, onEdit, onDelete }) => {
  const { t } = useI18n();

  return (
    <div
      className="group glass-card rounded-[2.5rem] p-4 md:p-6 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col gap-6 animate-list-item bg-white/[0.02] hover:bg-white/[0.05]"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-3xl flex items-center justify-center text-2xl font-black text-white shadow-2xl group-hover:scale-105 transition-transform duration-500" style={{ backgroundColor: worker.color || '#6366f1' }}>
              {worker.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-4 border-[#0a0c1a]"></div>
          </div>
          <div>
            <h3 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">{worker.name}</h3>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2">Montážní četa</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(worker)}
              className="p-3 text-slate-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(worker)}
              className="p-3 text-slate-500 hover:text-pink-500 hover:bg-pink-500/5 rounded-2xl transition-all"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
          <div className="bg-black/20 p-3 rounded-2xl">
            <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Hodinová sazba</span>
            <span className="text-sm font-black text-white italic tracking-tighter">€{Number(worker.hourlyRate || 0).toFixed(2)}</span>
          </div>
          <div className="bg-black/20 p-3 rounded-2xl">
            <span className="block text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Projektů</span>
            <span className="text-sm font-black text-white italic tracking-tighter">{worker.projectIds?.length || 0}</span>
          </div>
          <div className="col-span-2 bg-gradient-to-r from-indigo-600/10 to-transparent p-3 rounded-2xl flex justify-between items-center">
            <div className="flex gap-4">
              <div className="text-center">
                <span className="block text-[7px] font-black text-slate-500 uppercase">Panel</span>
                <span className="text-[11px] font-bold text-slate-300">€{worker.panelPrice}</span>
              </div>
              <div className="text-center border-l border-white/5 pl-4">
                <span className="block text-[7px] font-black text-slate-500 uppercase">String</span>
                <span className="text-[11px] font-bold text-slate-300">€{worker.stringPrice}</span>
              </div>
              <div className="text-center border-l border-white/5 pl-4">
                <span className="block text-[7px] font-black text-slate-500 uppercase">Metr</span>
                <span className="text-[11px] font-bold text-slate-300">€{worker.meterPrice}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Workers: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [minRate, setMinRate] = useState('');
  const [maxRate, setMaxRate] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'rate_asc' | 'rate_desc'>('name');
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [editingWorker, setEditingWorker] = useState<Worker | undefined>(undefined);

  const workers = useLiveQuery(() => db.workers.toArray(), []);

  const filteredWorkers = useMemo(() => {
    if (!workers) return [];
    const min = minRate !== '' ? Number(minRate) : 0;
    const max = maxRate !== '' ? Number(maxRate) : Infinity;

    return workers
      .filter(worker => {
        const matchesName = worker.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRate = worker.hourlyRate >= min && worker.hourlyRate <= max;
        return matchesName && matchesRate;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'rate_asc') return a.hourlyRate - b.hourlyRate;
        if (sortBy === 'rate_desc') return b.hourlyRate - a.hourlyRate;
        return 0;
      });
  }, [workers, searchTerm, minRate, maxRate, sortBy]);

  const handleAdd = () => {
    setEditingWorker(undefined);
    setShowForm(true);
  };

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setShowForm(true);
  };

  const confirmDelete = (worker: Worker) => {
    setWorkerToDelete(worker);
  };

  const handleDelete = async () => {
    if (workerToDelete?.id) {
      await db.workers.delete(workerToDelete.id);
      setWorkerToDelete(null);

      // Sync Delete to Firebase
      if (firebaseService.isReady) {
        firebaseService.deleteRecords('workers', [String(workerToDelete.id)])
          .catch(console.error);
      }
    }
  };

  return (
    <div className="space-y-12 pb-24">
      <div className="md:hidden">
        <BackButton />
      </div>
      <header className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-black text-white tracking-tighter uppercase italic leading-[0.8]">
              {t('team')}
            </h1>
            <p className="text-xl text-slate-500 font-bold tracking-tight">
              Správa montážních čet a jejich výkonnosti.
            </p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={handleAdd}
              className="group relative w-full md:w-auto overflow-hidden px-10 py-5 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-full hover:bg-indigo-600 hover:text-white transition-all duration-500 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                <PlusIcon className="w-5 h-5" />
                {t('add_worker')}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </button>
          )}
        </div>

        {/* Team Stats Quick Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Celkem lidí', value: workers?.length || 0, icon: 'Users' },
            { label: 'Aktivní dnes', value: workers?.length ? Math.floor(workers.length * 0.8) : 0, color: 'text-emerald-500' },
            { label: 'Pracovních hodin', value: '142h', color: 'text-indigo-400' },
            { label: 'Výkonnost', value: '94%', color: 'text-amber-500' }
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-[2rem] border border-white/5 bg-white/[0.02]">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black italic tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Enhanced Filter Section */}
      <div className="p-6 glass-card rounded-[2.5rem] border border-white/10 bg-slate-900/40 backdrop-blur-3xl shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Name Search */}
          <div className="relative group lg:col-span-1">
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">{t('search')}</label>
            <div className="relative">
              <input
                type="text"
                placeholder={`${t('search')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-black/40 text-white placeholder-gray-500 border-none rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm font-bold uppercase tracking-widest transition-all"
              />
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[var(--color-accent)] transition-colors" />
            </div>
          </div>

          {/* Sorting and Range Filters */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative group">
              <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Seřadit podle</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full p-4 bg-black/40 text-white border-none rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm font-bold transition-all appearance-none cursor-pointer [&>option]:bg-slate-900"
              >
                <option value="name">Jméno (A-Z)</option>
                <option value="rate_asc">Sazba (Vzestupně)</option>
                <option value="rate_desc">Sazba (Sestupně)</option>
              </select>
            </div>

            {user?.role === 'admin' && (
              <>
                <div className="relative group">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Min. €/h</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minRate}
                    onChange={(e) => setMinRate(e.target.value)}
                    className="w-full p-4 bg-black/40 text-white placeholder-gray-600 border-none rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm font-bold transition-all"
                  />
                </div>
                <div className="relative group">
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Max. €/h</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={maxRate}
                    onChange={(e) => setMaxRate(e.target.value)}
                    className="w-full p-4 bg-black/40 text-white placeholder-gray-600 border-none rounded-2xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm font-bold transition-all"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkers.map((worker, idx) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            index={idx}
            isAdmin={user?.role === 'admin'}
            onEdit={handleEdit}
            onDelete={confirmDelete}
          />
        ))}

        {filteredWorkers.length === 0 && (
          <div className="col-span-full py-32 text-center glass-card rounded-[3rem] border border-white/5 bg-white/[0.01]">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <SearchIcon className="w-10 h-10 text-gray-600" />
            </div>
            <p className="text-gray-500 text-2xl font-black uppercase tracking-widest italic opacity-50">{t('no_data')}</p>
          </div>
        )}
      </div>

      {showForm && (
        <WorkerForm
          worker={editingWorker}
          onClose={() => setShowForm(false)}
        />
      )}

      {workerToDelete && (
        <ConfirmationModal
          title={t('delete_worker_title')}
          message={t('delete_worker_confirm_name', { name: workerToDelete.name })}
          onConfirm={handleDelete}
          onCancel={() => setWorkerToDelete(null)}
        />
      )}
    </div>
  );
};

export default Workers;