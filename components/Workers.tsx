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
      className="group glass-card rounded-3xl p-6 border border-white/10 hover:border-[var(--color-accent)]/30 transition-all flex items-center justify-between animate-list-item"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg group-hover:rotate-3 transition-transform">
          {worker.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-xl font-black text-white italic tracking-tight">{worker.name}</h3>
          {isAdmin && (
            <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest mt-1">
              {t('hourly_rate')}: <span className="text-[var(--color-accent)]">€{Number(worker.hourlyRate).toFixed(2)}</span>
            </p>
          )}
        </div>
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(worker)}
            className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
            title={t('edit_worker')}
          >
            <PencilIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(worker)}
            className="p-3 text-gray-400 hover:text-pink-500 hover:bg-pink-500/5 rounded-2xl transition-all"
            title={t('delete_worker_title')}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
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
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-[0.8]">
            {t('workers')}
          </h1>
          <p className="text-xl text-gray-400 font-bold tracking-tight">
            Správa týmu pracovníků a jejich finančních ohodnocení.
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={handleAdd}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-[var(--color-accent)] hover:text-white transition-all shadow-[0_10px_30px_rgba(255,255,255,0.2)]"
            title={t('add_worker')}
          >
            <PlusIcon className="w-5 h-5" />
            {t('add_worker')}
          </button>
        )}
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