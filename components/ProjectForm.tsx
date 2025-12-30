
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import type { Project, ProjectComponent, FieldTable } from '../types';
import { useI18n } from '../contexts/I18nContext';
import { googleSheetsService } from '../services/googleSheetsService';
import { useToast } from '../contexts/ToastContext';

interface ProjectFormProps {
    project?: Project;
    onClose: () => void;
}

const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose }) => {
    const { t, language } = useI18n();
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');
    const [planFile, setPlanFile] = useState<File | undefined>(undefined);
    const [existingFileName, setExistingFileName] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'details' | 'components' | 'plan'>('details');
    const [tableList, setTableList] = useState('');
    const [components, setComponents] = useState<Omit<ProjectComponent, 'id' | 'projectId'>[]>([]);

    useEffect(() => {
        if (project) {
            setName(project.name);
            setDescription(project.description || '');
            setStatus(project.status);
            setPlanFile(project.planFile);
            setExistingFileName(project.planFile ? project.planFile.name : null);

            const fetchRelatedData = async () => {
                const existingComponents = await db.projectComponents.where('projectId').equals(project.id!).toArray();
                setComponents(existingComponents);

                // Load tables from new system
                if (project.tables && project.tables.length > 0) {
                    setTableList(project.tables.join('\n'));
                } else {
                    // Fallback: load from fieldTables
                    const existingTables = await db.fieldTables.where('projectId').equals(project.id!).toArray();
                    setTableList(existingTables.map(t => t.tableId).join('\n'));
                }
            };
            fetchRelatedData();
        }
    }, [project]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setPlanFile(file);
            setExistingFileName(file.name);
            setTableList('');
        } else {
            alert("Please select a valid PDF file.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Parse table list
        const tableIds = tableList
            .split(/[\n,]+/)
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // Validace: projekt nelze uložit bez stolů
        if (tableIds.length === 0) {
            alert(t('tables_required') || 'Seznam stolů je povinný! Projekt nelze uložit bez stolů.');
            return;
        }

        const now = new Date();
        const projectData: Omit<Project, 'id'> = {
            name,
            description,
            status,
            tables: tableIds, // NEW: Uložit seznam ID stolů
            planFile: planFile,
            createdAt: project?.createdAt || now,
            updatedAt: now,
        };

        try {
            let projectId = project?.id;

            if (projectId) {
                // Update existing project
                await db.projects.update(projectId, projectData);

                // Update components
                await db.projectComponents.where('projectId').equals(projectId).delete();
                if (components.length > 0) {
                    await db.projectComponents.bulkAdd(components.map(c => ({ ...c, projectId: projectId! })));
                }

                // Update field tables (NEW SYSTEM)
                await db.fieldTables.where('projectId').equals(projectId).delete();
                const fieldTables = tableIds.map(tableId => ({
                    projectId: projectId!,
                    tableId,
                    tableType: detectTableType(tableId),
                    status: 'pending' as const,
                    assignedWorkers: []
                }));
                await db.fieldTables.bulkAdd(fieldTables);

            } else {
                // Create new project
                projectId = await db.projects.add(projectData as Project);

                // Add components
                if (components.length > 0) {
                    await db.projectComponents.bulkAdd(components.map(c => ({ ...c, projectId: projectId! })));
                }

                // Create field tables (NEW SYSTEM)
                const fieldTables = tableIds.map(tableId => ({
                    projectId: projectId!,
                    tableId,
                    tableType: detectTableType(tableId),
                    status: 'pending' as const,
                    assignedWorkers: []
                }));
                await db.fieldTables.bulkAdd(fieldTables);

                // --- Auto Sync to Google Sheets ---
                if (googleSheetsService.isReady) {
                    showToast('Syncing to Google Sheets...', 'info');

                    // Prepare data for sync (remove File object)
                    const projectPayload = {
                        ...projectData,
                        id: projectId!,
                        planFile: undefined,
                        planFileName: projectData.planFile?.name
                    };

                    // Perform Upsert in background
                    Promise.all([
                        googleSheetsService.upsertData('projects', [projectPayload]),
                        googleSheetsService.upsertData('fieldTables', fieldTables)
                    ]).then(([projRes, tableRes]) => {
                        if (projRes.success && tableRes.success) {
                            showToast('✅ Project synced to Cloud', 'success');
                        } else {
                            console.warn('Sync issues:', { projRes, tableRes });
                            // showToast('Cloud sync had warnings', 'warning'); // Optional: don't annoy user if it works mostly
                        }
                    }).catch((err: any) => {
                        console.error('Auto-sync failed:', err);
                        showToast('Cloud sync failed', 'error');
                    });
                }

                onClose();
            } catch (error: any) {
                console.error("Failed to save project:", error);
                alert(t('save_failed') || "Failed to save project.");
            }
        };

        // Helper function to detect table type from ID
        function detectTableType(tableId: string): 'small' | 'medium' | 'large' {
            const id = tableId.toLowerCase();
            if (id.includes('28') || id.startsWith('it28')) return 'small';
            if (id.includes('42') || id.startsWith('it42')) return 'medium';
            if (id.includes('56') || id.startsWith('it56')) return 'large';
            return 'medium'; // default
        }

        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 md:p-4 animate-fade-in">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose}></div>
                <div className="relative w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl bg-slate-900/90 backdrop-blur-2xl md:rounded-[3rem] shadow-2xl border-none md:border border-white/20 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-8 border-b border-white/10 flex justify-between items-center shrink-0">
                        <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">{project ? t('edit_project') : t('add_project')}</h2>
                        <button onClick={onClose} className="p-3 text-gray-400 hover:text-white transition-all bg-white/5 rounded-2xl">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/5 bg-black/20 shrink-0 p-2 gap-2">
                        {[
                            { id: 'details', label: t('details') },
                            { id: 'components', label: t('components') }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex-1 py-4 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-[var(--color-accent)] shadow-inner' : 'text-gray-500 hover:bg-white/5'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="p-8 overflow-y-auto grow custom-scrollbar">
                        {activeTab === 'details' && (
                            <div className="space-y-8 animate-fade-in">
                                <div>
                                    <label htmlFor="name" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">{t('project_name')}</label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full p-5 bg-black/40 text-white placeholder-gray-600 text-lg font-bold rounded-2xl shadow-inner border border-white/10"
                                        placeholder="e.g. Solar Park Zarasai"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="description" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">{t('description')}</label>
                                    <textarea
                                        id="description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        rows={3}
                                        className="w-full p-5 bg-black/40 text-white placeholder-gray-600 font-bold rounded-2xl shadow-inner border border-white/10"
                                        placeholder="Detailní informace o lokalitě, klientovi..."
                                    />
                                </div>

                                {/* Table List Input - Promoted */}
                                <div className="bg-white/[0.03] p-6 rounded-3xl border border-white/10">
                                    <label className="block text-xs font-black text-[var(--color-accent)] uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                                        {t('table_list_manual') || 'Seznam stolů (Generátor Mapy)'}
                                    </label>
                                    <textarea
                                        value={tableList}
                                        onChange={(e) => setTableList(e.target.value)}
                                        rows={8}
                                        placeholder="Zadejte čísla stolů oddělená novým řádkem nebo čárkou (např: IT28-1, IT28-2...)"
                                        className="w-full p-5 bg-black/60 text-white placeholder-gray-600 rounded-2xl shadow-inner border border-white/10 text-sm font-mono custom-scrollbar focus:ring-2 focus:ring-[var(--color-accent)] outline-none"
                                    />
                                    <div className="mt-3 flex gap-2 items-start text-[10px] text-slate-400 font-medium leading-relaxed bg-black/20 p-3 rounded-xl">
                                        <span className="text-lg">💡</span>
                                        <p>{t('table_list_help') || 'Z tohoto seznamu se automaticky vygeneruje interaktivní mapa projektu. Každé ID stolu vytvoří jeden blok v mřížce.'}</p>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="status" className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">{t('status')}</label>
                                    <select
                                        id="status"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as any)}
                                        className="w-full p-5 bg-black/40 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest [&>option]:bg-gray-800"
                                    >
                                        <option value="active">{t('active')}</option>
                                        <option value="completed">{t('completed')}</option>
                                        <option value="on_hold">{t('on_hold')}</option>
                                    </select>
                                </div>

                                {/* Timestamps Display for Existing Projects */}
                                {project && (
                                    <div className="mt-12 pt-8 border-t border-white/5 space-y-3 opacity-40 hover:opacity-100 transition-opacity">
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em]">
                                            <span className="text-gray-500">{t('created_at')}</span>
                                            <span className="text-gray-300">{project.createdAt ? new Date(project.createdAt).toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US') : '-'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-[0.2em]">
                                            <span className="text-gray-500">{t('updated_at')}</span>
                                            <span className="text-gray-300">{project.updatedAt ? new Date(project.updatedAt).toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-US') : '-'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'components' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{t('components')}</h3>
                                    <button type="button" onClick={() => setComponents([...components, { name: '', description: '' }])} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[var(--color-accent)] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all">+ {t('add_component')}</button>
                                </div>
                                <div className="space-y-3">
                                    {components.map((comp, index) => (
                                        <div key={index} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 items-center group">
                                            <div className="flex-1 space-y-3">
                                                <input
                                                    type="text"
                                                    value={comp.name}
                                                    onChange={e => {
                                                        const newComps = [...components];
                                                        newComps[index].name = e.target.value;
                                                        setComponents(newComps);
                                                    }}
                                                    placeholder={t('component_name')}
                                                    className="w-full bg-black/40 border-none text-white font-bold p-3 rounded-xl placeholder-gray-600 focus:ring-1 focus:ring-[var(--color-accent)]"
                                                />
                                                <input
                                                    type="text"
                                                    value={comp.description}
                                                    onChange={e => {
                                                        const newComps = [...components];
                                                        newComps[index].description = e.target.value;
                                                        setComponents(newComps);
                                                    }}
                                                    placeholder={t('description')}
                                                    className="w-full bg-black/40 border-none text-gray-300 p-3 rounded-xl placeholder-gray-600 focus:ring-1 focus:ring-[var(--color-accent)]"
                                                />
                                            </div>
                                            <button type="button" onClick={() => setComponents(components.filter((_, i) => i !== index))} className="p-3 text-gray-500 hover:text-pink-500 bg-white/5 rounded-xl transition-all">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {components.length === 0 && (
                                    <div className="p-12 text-center border border-dashed border-white/5 rounded-3xl">
                                        <p className="text-gray-600 font-bold uppercase text-[10px] tracking-widest">{t('no_components')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-8 pb-12 md:pb-8 border-t border-white/10 bg-black/20 flex justify-end gap-4 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-10 py-5 bg-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-all uppercase tracking-widest text-[10px]"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            className="px-12 py-5 bg-white text-black font-black rounded-2xl hover:bg-[var(--color-accent)] hover:text-white transition-all shadow-xl uppercase tracking-widest text-[10px] active:scale-95"
                        >
                            {t('save')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    export default ProjectForm;
