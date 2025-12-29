
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
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
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

    const projects = useLiveQuery(() =>
        db.projects
            .filter(p => p.tables && p.tables.length > 0) // Pouze projekty se stoly
            .toArray()
    );

    const selectedProject = projects?.find(p => p.id === selectedProjectId);

    // Auto-select first project
    React.useEffect(() => {
        if (projects && projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0].id!);
        }
    }, [projects, selectedProjectId]);

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
                <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter uppercase italic leading-[0.8] drop-shadow-2xl">
                    {t('field_plans') || 'Plánová pole'}<span className="text-[var(--color-accent)]">.</span>
                </h1>
                <p className="text-sm md:text-xl text-slate-400 font-bold tracking-tight max-w-2xl border-l-4 border-[var(--color-accent)] pl-4 py-1">
                    {t('field_plans_description') || 'Vizuální přehled všech stolů projektu s barevným kódováním podle pracovníků'}
                </p>
            </header>

            {/* Project Selector */}
            <div className="bg-white/[0.03] rounded-3xl border border-white/10 backdrop-blur-3xl shadow-2xl p-6">
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
                                    {isSelected && (
                                        <div className="text-[var(--color-accent)]">
                                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
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
