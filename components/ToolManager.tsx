import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Tool, ToolStatus, Worker } from '../types';
import ConfirmationModal from './ConfirmationModal';
import TrashIcon from './icons/TrashIcon';

// Mock icons mapping - in a real app, import specific icons
const getToolIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('vrta') || t.includes('drill')) return '🔌';
    if (t.includes('auto') || t.includes('car')) return '🚗';
    if (t.includes('žebř') || t.includes('ladder')) return '🪜';
    if (t.includes('měř') || t.includes('meter')) return '📏';
    return '🔧';
};

const ToolManager: React.FC = () => {
    const { t } = useI18n();
    const tools = useLiveQuery(() => db.tools.toArray());
    const workers = useLiveQuery(() => db.workers.toArray());

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<Tool | null>(null);
    const [filterStatus, setFilterStatus] = useState<ToolStatus | 'all'>('all');

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [serialNumber, setSerialNumber] = useState('');
    const [status, setStatus] = useState<ToolStatus>('available');
    const [assignedWorkerId, setAssignedWorkerId] = useState<string>('');
    const [notes, setNotes] = useState('');

    const resetForm = () => {
        setName('');
        setType('');
        setSerialNumber('');
        setStatus('available');
        setAssignedWorkerId('');
        setNotes('');
        setEditingTool(null);
        setIsAddModalOpen(false);
    };

    const handleEdit = (tool: Tool) => {
        setEditingTool(tool);
        setName(tool.name);
        setType(tool.type);
        setSerialNumber(tool.serialNumber || '');
        setStatus(tool.status);
        setAssignedWorkerId(tool.assignedWorkerId ? String(tool.assignedWorkerId) : '');
        setNotes(tool.notes || '');
        setIsAddModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const toolData: Tool = {
            name,
            type,
            serialNumber,
            status,
            assignedWorkerId: status === 'borrowed' && assignedWorkerId ? Number(assignedWorkerId) : undefined,
            notes,
            ...(editingTool ? { id: editingTool.id } : { purchaseDate: new Date() }),
            lastInspection: new Date(),
        };

        if (editingTool?.id) {
            await db.tools.update(editingTool.id, toolData);
        } else {
            await db.tools.add(toolData);
        }
        resetForm();
    };

    const handleDelete = async (id: number) => {
        if (confirm(t('confirm_delete'))) {
            await db.tools.delete(id);
        }
    };

    const handleQuickReturn = async (tool: Tool) => {
        await db.tools.update(tool.id!, { status: 'available', assignedWorkerId: undefined });
    };

    const filteredTools = tools?.filter(tool => filterStatus === 'all' || tool.status === filterStatus);

    const getWorkerName = (id?: number) => {
        if (!id) return '-';
        return workers?.find(w => w.id === id)?.name || 'Unknown';
    };

    const getStatusBadge = (s: ToolStatus) => {
        switch (s) {
            case 'available': return <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider">Volné</span>;
            case 'borrowed': return <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider">Půjčené</span>;
            case 'broken': return <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider">Rozbité</span>;
            case 'service': return <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">Servis</span>;
            case 'lost': return <span className="px-3 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-bold uppercase tracking-wider">Ztracené</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex gap-2 bg-black/20 p-1 rounded-xl border border-white/5">
                    {(['all', 'available', 'borrowed', 'service'] as const).map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterStatus(s)}
                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${filterStatus === s ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            {s === 'all' ? 'Vše' : s === 'available' ? 'Na skladě' : s === 'borrowed' ? 'U lidí' : 'Servis'}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-6 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg text-sm uppercase tracking-wider flex items-center gap-2"
                >
                    + Přidat
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTools?.map(tool => (
                    <div key={tool.id} className="group relative p-6 bg-slate-900/40 backdrop-blur-xl rounded-[2rem] border border-white/5 hover:border-white/10 transition-all hover:-translate-y-1 hover:shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-4xl">{getToolIcon(tool.type)}</span>
                            {getStatusBadge(tool.status)}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1">{tool.name}</h3>
                        <p className="text-xs text-gray-400 font-mono mb-4 uppercase tracking-widest">{tool.type} • {tool.serialNumber || 'No S/N'}</p>

                        {tool.status === 'borrowed' && (
                            <div className="mb-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
                                    {getWorkerName(tool.assignedWorkerId).substring(0, 2)}
                                </div>
                                <div>
                                    <p className="text-[10px] text-blue-300 uppercase font-bold">Má u sebe</p>
                                    <p className="text-sm text-white font-bold">{getWorkerName(tool.assignedWorkerId)}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 mt-auto pt-4 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(tool)} className="flex-1 py-2 bg-white/5 text-white text-xs font-bold rounded-lg hover:bg-white/10">Upravit</button>
                            {tool.status === 'borrowed' ? (
                                <button onClick={() => handleQuickReturn(tool)} className="flex-1 py-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg hover:bg-emerald-500/30">Vrátit</button>
                            ) : (
                                <button onClick={() => handleDelete(tool.id!)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <form onSubmit={handleSave} className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative">
                        <h2 className="text-2xl font-black text-white mb-6 uppercase tracking-wider">{editingTool ? 'Upravit nářadí' : 'Nové nářadí'}</h2>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Název</label>
                                    <input value={name} onChange={e => setName(e.target.value)} required className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="Např. Aku vrtačka Makita" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Typ</label>
                                    <input value={type} onChange={e => setType(e.target.value)} required className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="Např. Vrtačka" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Sériové číslo</label>
                                <input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none" placeholder="S/N..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Stav</label>
                                    <select value={status} onChange={e => setStatus(e.target.value as ToolStatus)} className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none  [&>option]:bg-slate-900">
                                        <option value="available">🟢 Volné</option>
                                        <option value="borrowed">🔵 Půjčené</option>
                                        <option value="broken">🔴 Rozbité</option>
                                        <option value="service">🟠 Servis</option>
                                        <option value="lost">⚫ Ztracené</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Přiřazeno komu</label>
                                    <select
                                        value={assignedWorkerId}
                                        onChange={e => setAssignedWorkerId(e.target.value)}
                                        disabled={status !== 'borrowed'}
                                        required={status === 'borrowed'}
                                        className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none disabled:opacity-50 [&>option]:bg-slate-900"
                                    >
                                        <option value="">- Vybrat -</option>
                                        {workers?.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Poznámky</label>
                                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-3 bg-black/40 rounded-xl border border-white/10 text-white focus:border-indigo-500 outline-none" rows={3}></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
                            <button type="button" onClick={resetForm} className="px-5 py-3 rounded-xl bg-white/5 text-white text-sm font-bold hover:bg-white/10">Zrušit</button>
                            <button type="submit" className="px-8 py-3 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 shadow-lg">Uložit</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default ToolManager;
