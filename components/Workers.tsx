import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  onClick: (id: number) => void;
}> = ({ worker, index, isAdmin, onEdit, onDelete, onClick }) => {
  const { t } = useI18n();

  return (
    <div
      onClick={() => onClick(worker.id!)}
      className="group glass-dark rounded-[1.5rem] p-4 border border-white/5 hover:border-indigo-500/30 transition-all duration-500 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-5 overflow-hidden relative shadow-2xl hover:scale-[1.01] cursor-pointer"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Decorative Blur */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-[80px] rounded-full group-hover:bg-indigo-500/20 transition-colors duration-700" />

      {/* "Detail" hint */}
      <div className="absolute top-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
        <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
      </div>

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black text-white shadow-2xl group-hover:scale-105 transition-transform duration-500 border border-white/10" style={{ backgroundColor: worker.color || '#6366f1' }}>
              {worker.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0a0c1a] shadow-lg"></div>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-lg font-black text-white italic tracking-tighter uppercase leading-none">{worker.name}</h3>
            <p className="text-[8px] font-black text-indigo-400/60 uppercase tracking-[0.3em] font-mono">Specialista montáže</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onEdit(worker)}
              className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(worker)}
              className="w-11 h-11 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-500/5 rounded-xl transition-all border border-transparent hover:border-rose-500/10"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-2 relative z-10 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 group/stat hover:bg-white/[0.05] transition-colors">
              <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 opacity-60">Sazba / h</span>
              <span className="text-lg font-black text-white italic tracking-tighter">€{Number(worker.hourlyRate || 0).toFixed(2)}</span>
            </div>
            <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 group/stat hover:bg-white/[0.05] transition-colors">
              <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5 opacity-60">Projekty</span>
              <span className="text-lg font-black text-white italic tracking-tighter">{worker.projectIds?.length || 0}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-4 rounded-[1.5rem] border border-white/5">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center group/rate">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-50">Panel</span>
                <span className="text-sm font-black text-indigo-300 italic">€{worker.panelPrice}</span>
              </div>
              <div className="text-center border-l border-white/5 group/rate">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-50">String</span>
                <span className="text-sm font-black text-indigo-300 italic">€{worker.stringPrice}</span>
              </div>
              <div className="text-center border-l border-white/5 group/rate">
                <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2 opacity-50">Metr</span>
                <span className="text-sm font-black text-indigo-300 italic">€{worker.meterPrice}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="pt-4 border-t border-white/5 mt-auto">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span>Přiřazené úkoly</span>
            <span className="text-white font-black">12 aktivních</span>
          </div>
        </div>
      )}
    </div>
  );
};

const Workers: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
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
    <div className="space-y-8 pb-24 max-w-7xl mx-auto px-4">
      <div className="md:hidden pt-4">
        <BackButton />
      </div>

      <header className="space-y-8">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-10">
          <div className="space-y-6 max-w-3xl">
            <div className="space-y-4 w-full overflow-hidden">
              <h1 className="text-6xl sm:text-8xl md:text-9xl font-black text-white tracking-tighter uppercase italic leading-[0.85] break-words">
                {t('team')}<span className="text-indigo-500 not-italic">.</span>
              </h1>
              <div className="h-2 w-32 md:w-48 bg-indigo-600 rounded-full shadow-[0_4px_20px_rgba(79,70,229,0.5)]" />
            </div>
            <p className="text-2xl text-slate-400 font-bold tracking-tight pl-2 border-l-4 border-white/5 py-2">
              Správa montážních čet a jejich výkonnosti v reálném čase.
            </p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={handleAdd}
              className="group relative w-full xl:w-auto overflow-hidden px-12 py-7 bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-[2.5rem] hover:scale-105 transition-all duration-500 shadow-[0_30px_60px_-15px_rgba(255,255,255,0.15)] active:scale-95"
            >
              <div className="relative z-10 flex items-center justify-center gap-4">
                <PlusIcon className="w-6 h-6" />
                {t('add_worker')}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </button>
          )}
        </div>

        {/* Team Stats Quick Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Celkem expertů', value: workers?.length || 0, icon: 'Users' },
            { label: 'Nasazení dnes', value: workers?.length ? Math.floor(workers.length * 0.8) : 0, color: 'text-emerald-500' },
            { label: 'Pracovní hodiny', value: '142h', color: 'text-indigo-400' },
            { label: 'Efektivita', value: '94%', color: 'text-amber-500' }
          ].map((stat, i) => (
            <div key={i} className="glass-dark p-8 rounded-[3rem] border border-white/5 flex flex-col justify-between h-40 group hover:border-indigo-500/30 transition-all duration-500">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <div className="w-2 h-2 rounded-full bg-white/10 group-hover:bg-indigo-500 transition-colors" />
              </div>
              <p className={`text-5xl font-black italic tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Enhanced Filter Section */}
      <div className="p-10 glass-dark rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full" />

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 relative z-10">
          {/* Name Search */}
          <div className="lg:col-span-2 space-y-4">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">{t('search')}</label>
            <div className="relative group">
              <input
                type="text"
                placeholder={`${t('search')}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-6 bg-white/[0.03] text-white placeholder-slate-600 border border-white/5 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:bg-white/[0.05] focus:border-indigo-500/30 text-xs font-black uppercase tracking-[0.2em] transition-all"
              />
              <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-600 group-focus-within:text-indigo-500 transition-colors" />
            </div>
          </div>

          {/* Sorting and Range Filters */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Seřadit</label>
              <div className="relative group">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-6 py-6 bg-white/[0.03] text-white border border-white/5 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:bg-white/[0.05] focus:border-indigo-500/30 text-[10px] font-black uppercase tracking-widest transition-all appearance-none cursor-pointer [&>option]:bg-slate-900"
                >
                  <option value="name">Jméno (A-Z)</option>
                  <option value="rate_asc">Sazba (Vzestupně)</option>
                  <option value="rate_desc">Sazba (Sestupně)</option>
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 group-hover:text-indigo-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            </div>

            {user?.role === 'admin' && (
              <>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Min. €/h</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minRate}
                    onChange={(e) => setMinRate(e.target.value)}
                    className="w-full px-6 py-6 bg-white/[0.03] text-white placeholder-slate-700 border border-white/5 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:bg-white/[0.05] text-[10px] font-black transition-all"
                  />
                </div>
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Max. €/h</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={maxRate}
                    onChange={(e) => setMaxRate(e.target.value)}
                    className="w-full px-6 py-6 bg-white/[0.03] text-white placeholder-slate-700 border border-white/5 rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:bg-white/[0.05] text-[10px] font-black transition-all"
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
            onClick={(id) => navigate(`/workers/${id}`)}
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