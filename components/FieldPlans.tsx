
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
            {/* Header */}
            <header className="space-y-4 md:hidden">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                        {t('field_plans') || 'Plánová pole'}
                    </h1>
                </div>
            </header>

            <header className="hidden md:block">
                <h1 className="text-6xl font-black mb-12 text-white italic uppercase tracking-tighter underline decoration-[var(--color-accent)] decoration-8">
                    {t('field_plans')}
                </h1>
            </header>

            {/* Project Selector - Hide if project is selected to maximize map space */}
            {!selectedProjectId ? (
                <div className="bg-white/[0.03] rounded-3xl border border-white/10 backdrop-blur-3xl shadow-2xl p-6 animate-fade-in">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
                        {t('select_project') || 'Vyberte projekt'}
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {projects.map(project => {
                            const isSelected = project.id === selectedProjectId;
                            const tableCount = project.tables?.length || 0;

                            return (
                                <button
                                    key={project.id}
                                    onClick={() => setSelectedProjectId(project.id!)}
                                    className={`p-6 rounded-2xl transition-all text-left ${isSelected
                                        ? 'bg-white/10 border-2 border-[var(--color-accent)] shadow-lg'
                                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight line-clamp-1">
                                            {project.name}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <div className="px-3 py-1 bg-black/30 rounded-lg border border-white/10">
                                            <span className="text-white font-bold">{tableCount}</span>
                                            <span className="text-gray-500 ml-1">{t('tables') || 'stolů'}</span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg border ${project.status === 'active' ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                            project.status === 'completed' ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                                'bg-yellow-500/20 border-yellow-500/30 text-yellow-400'
                                            }`}>
                                            <span className="text-xs font-bold uppercase">{t(project.status as any)}</span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl p-4 animate-fade-in mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                            <span className="text-xl">📍</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Aktivní projekt</p>
                            <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">{selectedProject?.name}</h2>
                        </div>
                    </div>
                    <button
                        onClick={() => setSelectedProjectId(null)}
                        className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                        {t('change_project') || 'Změnit projekt'}
                    </button>
                </div>
            )}

            {/* Field Plan View */}
            {selectedProjectId && (
                <div className="animate-fade-in">
                    <FieldPlanView projectId={selectedProjectId} />
                </div>
            )}
        </div>
    );
};

export default FieldPlans;
