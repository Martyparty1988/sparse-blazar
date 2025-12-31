
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

            onClose();
            showToast("Projekt úspěšně uložen!", "success");

        } catch (error) {
            console.error("Failed to save project:", error);
            showToast("Chyba při ukládání projektu.", "error");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-md p-0 md:p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-h-[95vh] md:max-w-3xl bg-slate-900 rounded-t-3xl md:rounded-3xl shadow-2xl border-t md:border border-white/10 flex flex-col overflow-hidden animate-slide-up" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl md:text-3xl font-black text-white italic tracking-tighter uppercase">{project ? t('edit_project') : t('add_project')}</h2>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-all bg-white/5 rounded-full"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
                
                <div className="p-6 overflow-y-auto grow custom-scrollbar space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Název projektu</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full p-4 bg-black/40 text-white text-lg font-bold rounded-xl border border-white/10" />
                    </div>

                    <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/10 space-y-4">
                        <label className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">Seznam stolů</label>
                        <textarea value={tableList} onChange={(e) => { setTableList(e.target.value); setIsTablesProcessed(false); }} rows={6} placeholder="Vložte seznam ID stolů..." className="w-full p-4 bg-black/60 text-white placeholder-slate-500 rounded-xl border border-white/10 text-sm font-mono" />
                        <button onClick={handleProcessTables} className="w-full py-3 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-all">Zpracovat stoly a nastavit typy</button>
                    </div>

                    {isTablesProcessed && structuredTables.length > 0 && (
                        <div className="p-4 bg-black/20 rounded-2xl animate-fade-in border border-white/10">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">Nastavení typů stolů ({structuredTables.length})</h3>
                               <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-md self-start sm:self-center">
                                   <span className="text-[9px] uppercase font-bold text-slate-500 px-1">Hromadně:</span>
                                   <button onClick={() => handleBulkTypeChange('small')} className="px-2 py-0.5 bg-white/10 text-xs rounded hover:bg-indigo-500">S</button>
                                   <button onClick={() => handleBulkTypeChange('medium')} className="px-2 py-0.5 bg-white/10 text-xs rounded hover:bg-indigo-500">M</button>
                                   <button onClick={() => handleBulkTypeChange('large')} className="px-2 py-0.5 bg-white/10 text-xs rounded hover:bg-indigo-500">L</button>
                               </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                {structuredTables.map(table => (
                                    <div key={table.id} className="bg-slate-800 p-2 rounded-lg flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-slate-300 truncate pr-1">{table.id}</span>
                                        <select value={table.type} onChange={(e) => handleTableTypeChange(table.id, e.target.value as TableType)} className="bg-black/50 text-white text-xs font-bold border-none rounded p-1 focus:ring-1 focus:ring-indigo-500 shrink-0">
                                            <option value="small">Malý</option>
                                            <option value="medium">Střední</option>
                                            <option value="large">Velký</option>
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Přiřadit pracovníky</label>
                        <div className="flex flex-wrap gap-2 p-3 bg-black/40 rounded-xl border border-white/10">
                            {allWorkers?.map(worker => (
                                <button type="button" key={worker.id} onClick={() => setWorkerIds(prev => prev.includes(worker.id!) ? prev.filter(id => id !== worker.id) : [...prev, worker.id!])} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${workerIds.includes(worker.id!) ? 'bg-indigo-500 text-white border-transparent' : 'text-slate-300 border-slate-700 hover:border-indigo-500'}`}>
                                    {worker.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-white/10 bg-black/20 flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="px-8 py-3 bg-white/5 text-white font-black rounded-xl hover:bg-white/10 transition-all uppercase tracking-widest text-[10px]">Zrušit</button>
                    <button type="submit" onClick={handleSubmit} className="flex-1 md:flex-none px-10 py-3 bg-white text-black font-black rounded-xl hover:bg-indigo-400 hover:text-white transition-all shadow-lg uppercase tracking-widest text-[10px]">Uložit projekt</button>
                </div>
            </div>
        </div>
    );
};

export default ProjectForm;
