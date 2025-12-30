import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { DailyReport } from '../types';

const DailyReports: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();

    // State
    const [projectId, setProjectId] = useState<number | ''>('');
    const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
    const [stringsCompleted, setStringsCompleted] = useState('');
    const [notes, setNotes] = useState('');
    const [issues, setIssues] = useState('');

    const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());

    // Load last used project from localStorage
    useEffect(() => {
        const lastProjectId = localStorage.getItem('last_report_project_id');
        if (lastProjectId && !projectId) {
            setProjectId(Number(lastProjectId));
        }
    }, []);

    // Fetch existing report
    useEffect(() => {
        const loadReport = async () => {
            if (projectId && reportDate) {
                const report = await db.dailyReports.where({ projectId: Number(projectId), date: reportDate }).first();
                if (report) {
                    setStringsCompleted(String(report.stringsCompleted));
                    setNotes(report.notes);
                    setIssues(report.issues);
                } else {
                    // Reset fields if no report exists
                    setStringsCompleted('');
                    setNotes('');
                    setIssues('');
                }
            }
        };
        loadReport();
    }, [projectId, reportDate]);

    const handleProjectChange = (id: number) => {
        setProjectId(id);
        localStorage.setItem('last_report_project_id', String(id));
    };

    const handleShareReport = async () => {
        if (!projectId) return;
        const project = projects?.find(p => p.id === Number(projectId));

        const textToShare = `*Daily Report - ${project?.name} - ${reportDate}*

✅ *${t('completed_strings')}:* ${stringsCompleted || '0'}

📝 *${t('notes')}:*
${notes || '-'}

⚠️ *${t('issues')}:*
${issues || '-'}`;

        try {
            // Try native share first (mobile)
            if (navigator.share && /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
                await navigator.share({
                    title: `Daily Report - ${project?.name}`,
                    text: textToShare,
                });
            } else {
                // Fallback to clipboard for desktop to avoid mail client opening
                await navigator.clipboard.writeText(textToShare);
                alert(`✅ ${t('report_copied_clipboard')}`);
            }
        } catch (error) {
            console.error('Share failed:', error);
            // Fallback if native share fails/cancels
            try {
                await navigator.clipboard.writeText(textToShare);
                alert(`✅ ${t('report_copied_clipboard')}`);
            } catch (err) {
                alert(`❌ ${t('report_copy_failed')}`);
            }
        }

        // Also save automatically when sharing
        handleSave(true);
    };

    const handleSave = async (silent = false) => {
        if (!projectId) {
            alert(t('project_required_error'));
            return;
        }

        const reportData: DailyReport = {
            projectId: Number(projectId),
            date: reportDate,
            stringsCompleted: Number(stringsCompleted) || 0,
            notes,
            issues,
            sentAt: new Date()
        };

        try {
            const existing = await db.dailyReports.where({ projectId: Number(projectId), date: reportDate }).first();
            if (existing && existing.id) {
                await db.dailyReports.update(existing.id, reportData);
            } else {
                await db.dailyReports.add(reportData);
            }
            if (!silent) alert(`✅ ${t('save_success')}`);
        } catch (error) {
            console.error('Error saving report:', error);
            alert(t('save_error'));
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-8 animate-fade-in">
            <header className="relative pt-6 md:pt-8 px-2 md:px-0">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter italic leading-none mb-4 md:mb-3">
                    DAILY<span className="text-[var(--color-primary)]">.</span>REPORT
                </h1>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs md:text-sm">
                    {t('daily_report')} • Status • Progress
                </p>
            </header>

            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-white/10 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest">{t('select_project')}</label>
                        <select
                            value={projectId}
                            onChange={e => handleProjectChange(Number(e.target.value))}
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold [&>option]:bg-slate-900"
                        >
                            <option value="">{t('select_project')}</option>
                            {projects?.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest">{t('date')}</label>
                        <input
                            type="date"
                            value={reportDate}
                            onChange={e => setReportDate(e.target.value)}
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold"
                        />
                    </div>
                </div>

                <div className="space-y-6">

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest">✅ {t('completed_strings')}</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={stringsCompleted}
                            onChange={e => setStringsCompleted(e.target.value)}
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-mono text-xl"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest">📝 {t('notes')}</label>
                        <textarea
                            rows={3}
                            placeholder="..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest text-red-400">⚠️ {t('issues')}</label>
                        <textarea
                            rows={2}
                            placeholder="..."
                            value={issues}
                            onChange={e => setIssues(e.target.value)}
                            className="w-full p-4 bg-red-900/20 text-white border border-red-500/30 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none"
                        />
                    </div>


                </div>

                <div className="flex flex-col md:flex-row gap-4 mt-10 border-t border-white/10 pt-8">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={!projectId}
                        className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 disabled:opacity-50"
                    >
                        💾 {t('save')}
                    </button>
                    <button
                        onClick={handleShareReport}
                        disabled={!projectId}
                        className="flex-1 px-8 py-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        {t('share_copy_report')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReports;
