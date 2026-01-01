
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Project, FieldTable, Worker } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { firebaseService } from '../services/firebaseService';
import { useToast } from '../contexts/ToastContext';
import { useLiveQuery } from 'dexie-react-hooks';

interface ProjectFormProps {
    project?: Project;
    onClose: () => void;
}

type TableType = 'small' | 'medium' | 'large';

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose }) => {
    const { t } = useI18n();
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');
    const [workerIds, setWorkerIds] = useState<number[]>([]);
    const allWorkers = useLiveQuery(() => db.workers.toArray(), []);

    const [tableList, setTableList] = useState('');
    const [structuredTables, setStructuredTables] = useState<{ id: string, type: TableType }[]>([]);
    const [isTablesProcessed, setIsTablesProcessed] = useState(false);

    const detectTableType = (tableId: string): TableType => {
        const id = tableId.toLowerCase();
        if (id.includes('28') || id.startsWith('it28')) return 'small';
        if (id.includes('42') || id.startsWith('it42')) return 'medium';
        if (id.includes('56') || id.startsWith('it56')) return 'large';
        return 'medium';
    };

    useEffect(() => {
        if (project) {
            setName(project.name);
            setLocation(project.location || '');
            setStartDate(project.startDate || '');
            setEndDate(project.endDate || '');
            setStatus(project.status);
            setWorkerIds(project.workerIds || []);

            const fetchRelatedData = async () => {
                const existingTables = await db.fieldTables.where('projectId').equals(project.id!).toArray();
                if (existingTables.length > 0) {
                    const tableIds = existingTables.map(t => t.tableId);
                    setTableList(tableIds.join('\n'));
                    setStructuredTables(existingTables.map(t => ({ id: t.tableId, type: t.tableType })));
                    setIsTablesProcessed(true);
                }
            };
            fetchRelatedData();
        }
    }, [project]);

    const handleProcessTables = () => {
        const tableIds = tableList.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
        if (tableIds.length === 0) {
            showToast("Seznam stolů je prázdný.", "warning");
            return;
        }
        const newStructuredTables = tableIds.map(id => ({ id, type: detectTableType(id) }));
        setStructuredTables(newStructuredTables);
        setIsTablesProcessed(true);
        showToast(`Zpracováno ${tableIds.length} stolů.`, 'info');
    };

    const handleTableTypeChange = (id: string, type: TableType) => {
        setStructuredTables(prev => prev.map(t => t.id === id ? { ...t, type } : t));
    };

    const handleBulkTypeChange = (type: TableType) => {
        setStructuredTables(prev => prev.map(t => ({ ...t, type })));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const tableIdsFromInput = tableList.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);

        if (tableIdsFromInput.length > 0 && !isTablesProcessed) {
            showToast("Stiskněte tlačítko 'Zpracovat stoly' pro potvrzení typů.", "error");
            return;
        }

        const now = new Date();
        const projectData: Omit<Project, 'id'> = {
            name,
            location,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            status,
            workerIds,
            tables: structuredTables.map(t => t.id),
            createdAt: project?.createdAt || now,
            updatedAt: now,
        };

        try {
            let projectId = project?.id;
            if (projectId) {
                await db.projects.update(projectId, projectData);
            } else {
                projectId = await db.projects.add(projectData as Project) as number;
            }

            await db.fieldTables.where('projectId').equals(projectId).delete();
            const fieldTables: FieldTable[] = structuredTables.map(t => ({ projectId: projectId!, tableId: t.id, tableType: t.type, status: 'pending' }));
            if (fieldTables.length > 0) await db.fieldTables.bulkAdd(fieldTables);

            // Announce new project in General Chat
            if (!project?.id && firebaseService.isReady) {
                const systemMsg = {
                    id: Date.now().toString(),
                    text: `🚀 Byla zahájena příprava nového projektu: ${name} (${location || 'Bez lokace'}). Plánovaný start: ${startDate ? new Date(startDate).toLocaleDateString('cs-CZ') : 'Neurčeno'}.`,
                    senderId: -1, // System ID
                    senderName: 'Systém',
                    timestamp: new Date().toISOString(),
                    channelId: 'general',
                    isSystem: true // Flag for styling
                };
                // We use fire-and-forget here, no await needed strictly, but good practice to catch
                firebaseService.setData(`chat/general/${systemMsg.id}`, systemMsg).catch(console.error);
            }

            onClose();
            showToast("Projekt úspěšně uložen!", "success");

        } catch (error) {
            console.error("Failed to save project:", error);
            showToast("Chyba při ukládání projektu.", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[#020617]/90 backdrop-blur-xl p-0 md:p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-h-[95vh] md:max-w-4xl bg-[#0a0c1a] rounded-t-[3rem] md:rounded-[3rem] shadow-[0_0_100px_rgba(79,70,229,0.1)] border border-white/5 flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>

                {/* Modal Header */}
                <div className="px-8 py-8 border-b border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent flex justify-between items-center">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
                            {project ? 'Upravit projekt' : 'Nový projekt'}
                        </h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Konfigurace solárního parku</p>
                    </div>
                    <button onClick={onClose} className="p-3 text-slate-500 hover:text-white transition-all bg-white/5 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                        {/* Left Column: Basic Info */}
                        <div className="lg:col-span-5 space-y-8">
                            <div className="group relative">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Název projektu</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full px-6 py-5 bg-black/40 text-white text-xl font-black italic tracking-tighter rounded-3xl border border-white/5 focus:border-indigo-500/50 outline-none transition-all"
                                    placeholder="Např. FVE Brno 2"
                                />
                            </div>

                            <div className="group relative">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Lokace</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full px-6 py-5 bg-black/40 text-white text-lg font-bold rounded-3xl border border-white/5 focus:border-indigo-500/50 outline-none transition-all"
                                    placeholder="Např. Brno, Slatina"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="group relative">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Začátek</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-6 py-5 bg-black/40 text-white font-bold rounded-3xl border border-white/5 focus:border-indigo-500/50 outline-none transition-all"
                                    />
                                </div>
                                <div className="group relative">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">Konec (odhad)</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-6 py-5 bg-black/40 text-white font-bold rounded-3xl border border-white/5 focus:border-indigo-500/50 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 ml-1">Aktuální stav</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['active', 'completed', 'on_hold'] as const).map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatus(s)}
                                            className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${status === s
                                                ? 'bg-indigo-600 text-white border-transparent'
                                                : 'bg-black/40 text-slate-500 border-white/5 hover:border-white/10'}`}
                                        >
                                            {t(s as any)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Přiřadit tým</label>
                                <div className="flex flex-wrap gap-2 p-5 bg-black/40 rounded-[2.5rem] border border-white/5 min-h-[120px]">
                                    {allWorkers?.map(worker => (
                                        <button
                                            type="button"
                                            key={worker.id}
                                            onClick={() => setWorkerIds(prev => prev.includes(worker.id!) ? prev.filter(id => id !== worker.id) : [...prev, worker.id!])}
                                            className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all duration-300 border ${workerIds.includes(worker.id!)
                                                ? 'bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-600/20'
                                                : 'bg-white/5 text-slate-400 border-white/5 hover:border-indigo-500/30'}`}
                                        >
                                            {worker.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Tables Setup */}
                        <div className="lg:col-span-7 space-y-6">
                            <div className="relative group">
                                <div className="flex justify-between items-center mb-3 ml-1">
                                    <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest">Import stolů (FieldPlan)</label>
                                    <span className="text-[9px] font-bold text-slate-600 italic">ID oddělujte novým řádkem</span>
                                </div>
                                <textarea
                                    value={tableList}
                                    onChange={(e) => { setTableList(e.target.value); setIsTablesProcessed(false); }}
                                    rows={8}
                                    placeholder="ST1-01&#10;ST1-02&#10;..."
                                    className="w-full p-6 bg-black/40 text-white placeholder-slate-700 rounded-[2rem] border border-white/5 text-sm font-mono leading-relaxed outline-none focus:border-indigo-500/30 transition-all custom-scrollbar"
                                />
                                <button
                                    type="button"
                                    onClick={handleProcessTables}
                                    className="mt-4 w-full py-5 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-[2rem] hover:bg-indigo-500 transition-all shadow-xl active:scale-[0.98]"
                                >
                                    Zanalyzovat konstrukce
                                </button>
                            </div>

                            {isTablesProcessed && structuredTables.length > 0 && (
                                <div className="p-6 bg-white/[0.02] rounded-[2.5rem] animate-fade-in border border-indigo-500/10 space-y-6">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <div className="space-y-0.5">
                                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Typy konstrukcí</h3>
                                            <p className="text-[9px] font-bold text-indigo-500/50 uppercase tracking-widest">{structuredTables.length} stolů detekováno</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
                                            <span className="text-[8px] uppercase font-black text-slate-600 px-3">Hromadně:</span>
                                            <button type="button" onClick={() => handleBulkTypeChange('small')} className="px-3 py-2 bg-white/5 text-[9px] font-black rounded-xl hover:bg-white/10 transition-colors uppercase">S (1)</button>
                                            <button type="button" onClick={() => handleBulkTypeChange('medium')} className="px-3 py-2 bg-white/5 text-[9px] font-black rounded-xl hover:bg-white/10 transition-colors uppercase">M (1.5)</button>
                                            <button type="button" onClick={() => handleBulkTypeChange('large')} className="px-3 py-2 bg-white/5 text-[9px] font-black rounded-xl hover:bg-white/10 transition-colors uppercase">L (2)</button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {structuredTables.map(table => (
                                            <div key={table.id} className="group/item bg-black/40 p-3 rounded-2xl border border-white/5 flex flex-col gap-2 hover:border-indigo-500/30 transition-all">
                                                <span className="text-[10px] font-black text-slate-300 truncate tracking-tight">{table.id}</span>
                                                <select
                                                    value={table.type}
                                                    onChange={(e) => handleTableTypeChange(table.id, e.target.value as TableType)}
                                                    className="w-full bg-[#1a1c2e] text-indigo-400 text-[10px] font-black uppercase tracking-tighter border-none rounded-xl py-2 px-3 focus:ring-1 focus:ring-indigo-500 outline-none"
                                                >
                                                    <option value="small">S (1 str)</option>
                                                    <option value="medium">M (1.5 str)</option>
                                                    <option value="large">L (2 str)</option>
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </form>

                {/* Modal Footer */}
                <div className="p-8 border-t border-white/5 bg-white/[0.01] flex flex-col md:flex-row gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-10 py-5 bg-white/5 text-slate-400 font-black rounded-[2.5rem] hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest text-[11px]"
                    >
                        Zrušit
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className="flex-1 px-12 py-5 bg-white text-black font-black rounded-[2.5rem] hover:bg-indigo-600 hover:text-white transition-all shadow-[0_20px_40px_rgba(255,255,255,0.05)] uppercase tracking-[0.2em] text-[11px]"
                    >
                        Uložit konfiguraci projektu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectForm;
