
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom'; // Import useSearchParams
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import type { Project } from '../types';
import FieldPlanView from './FieldPlanView';

/**
 * Stránka pro správu plánových polí projektů
 * Zobrazuje seznam projektů a jejich plánová pole
 */
const FieldPlans: React.FC = () => {
    const { t } = useI18n();
    const [searchParams] = useSearchParams();
    const urlProjectId = searchParams.get('projectId');

    // Initialize with URL param if present, otherwise null
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(urlProjectId ? Number(urlProjectId) : null);

    const projects = useLiveQuery(() =>
        db.projects
            .filter(p => p.tables && p.tables.length > 0) // Pouze projekty se stoly
            .toArray()
    );

    const selectedProject = projects?.find(p => p.id === selectedProjectId);

    // Update selectedProjectId if URL param changes (e.g. navigation)
    useEffect(() => {
        if (urlProjectId) {
            setSelectedProjectId(Number(urlProjectId));
        }
    }, [urlProjectId]);

    // Auto-select first project if nothing selected
    useEffect(() => {
        if (projects && projects.length > 0 && !selectedProjectId && !urlProjectId) {
            setSelectedProjectId(projects[0].id!);
        }
    }, [projects, selectedProjectId, urlProjectId]);

    if (!projects || projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="text-8xl opacity-20">📐</div>
                <div className="text-center space-y-2">
                    <h2 className="text-3xl font-black text-white uppercase tracking-tight">
                        {t('no_field_plans') || 'Žádná plánová pole'}
                    </h2>
                    <p className="text-gray-500 font-bold max-w-md">
                        {t('create_project_with_tables') || 'Vytvořte projekt se seznamem stolů pro zobrazení plánového pole'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-32">
            {/* Header */}
            <header className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-7xl md:text-9xl font-black text-white tracking-tighter uppercase italic leading-[0.8] mb-8">
                        PROJEKTY<span className="text-indigo-500 not-italic">.</span>
                    </h1>
                </div>
            </header>

            {/* Project Selector - Hide if project is selected to maximize map space */}
            {!selectedProjectId ? (
                <div className="glass-dark rounded-[3rem] border border-white/5 p-10 animate-fade-in relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full" />
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />

                    <label className="block text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-8 relative z-10">
                        {t('select_project') || 'Vyberte projekt'}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                        {projects.map(project => {
                            const isSelected = project.id === selectedProjectId;
                            const tableCount = project.tables?.length || 0;

                            return (
                                <button
                                    key={project.id}
                                    onClick={() => setSelectedProjectId(project.id!)}
                                    className={`group p-8 rounded-[2rem] transition-all duration-500 text-left border relative overflow-hidden ${isSelected
                                        ? 'bg-indigo-600 border-indigo-500/50 shadow-2xl'
                                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.05] hover:border-indigo-500/30'
                                        }`}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                    <div className="flex items-start justify-between mb-6 relative z-10">
                                        <h3 className={`text-3xl font-black uppercase italic tracking-tighter line-clamp-1 ${isSelected ? 'text-white' : 'text-white group-hover:text-indigo-200'} transition-colors`}>
                                            {project.name}
                                        </h3>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isSelected ? 'bg-white text-indigo-600' : 'bg-white/10 text-slate-500 group-hover:bg-indigo-500 group-hover:text-white'} transition-all`}>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest relative z-10">
                                        <div className={`px-4 py-2 ${isSelected ? 'bg-black/20 text-white' : 'bg-black/40 text-slate-400 group-hover:text-white'} rounded-xl transition-colors`}>
                                            <span className="text-lg italic mr-1">{tableCount}</span>
                                            {t('tables') || 'stolů'}
                                        </div>
                                        <div className={`px-4 py-2 rounded-xl border ${project.status === 'active' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
                                            project.status === 'completed' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                                'bg-amber-500/20 border-amber-500/30 text-amber-400'
                                            }`}>
                                            {t(project.status as any)}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between glass-dark p-6 rounded-[2rem] border border-white/5 animate-fade-in mb-8 gap-4 bg-white/[0.02]">
                    <div className="flex items-center gap-6 w-full sm:w-auto">
                        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <span className="text-3xl filter drop-shadow-md">📍</span>
                        </div >
                        <div>
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] leading-none mb-2">Aktivní projekt</p>
                            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-md">{selectedProject?.name}</h2>
                        </div>
                    </div >
                    <button
                        onClick={() => setSelectedProjectId(null)}
                        className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg backdrop-blur-md"
                    >
                        {t('change_project') || 'Změnit projekt'}
                    </button>
                </div >
            )}

            {/* Field Plan View */}
            {
                selectedProjectId && (
                    <div className="animate-fade-in">
                        <FieldPlanView projectId={selectedProjectId} />
                    </div>
                )
            }
        </div >
    );
};

export default FieldPlans;
