import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { safety } from '../services/safetyService';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { hapticService } from '../services/hapticService';
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
        const lastProjectId = safety.storage.getItem('last_report_project_id');
        if (lastProjectId && !projectId) {
            setProjectId(Number(lastProjectId));
        }
    }, []);

    // Fetch existing report
    useEffect(() => {
        const loadReport = async () => {
            try {
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
            } catch (error) {
                console.error('Failed to load daily report:', error);
            }
        };
        loadReport();
    }, [projectId, reportDate]);

    const handleProjectChange = (id: number) => {
        hapticService.light();
        setProjectId(id);
        safety.storage.setItem('last_report_project_id', String(id));
    };

    const handleShareReport = async () => {
        if (!projectId) return;
        hapticService.medium();
        const project = projects?.find(p => p.id === Number(projectId));

        const textToShare = `*${t('daily_report')} - ${project?.name} - ${reportDate}*

✅ *${t('completed_strings')}:* ${stringsCompleted || '0'}

📝 *${t('notes')}:*
${notes || '-'}

⚠️ *${t('issues')}:*
${issues || '-'}`;

        try {
            // Try native share first (mobile)
            if (navigator.share && /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent)) {
                await navigator.share({
                    title: `${t('daily_report')} - ${project?.name}`,
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

    const handleWhatsAppShare = () => {
        if (!projectId) return;
        hapticService.medium();
        const project = projects?.find(p => p.id === Number(projectId));

        const textToShare = `*${t('daily_report')} - ${project?.name} - ${reportDate}*

✅ *${t('completed_strings')}:* ${stringsCompleted || '0'}

📝 *${t('notes')}:*
${notes || '-'}

⚠️ *${t('issues')}:*
${issues || '-'}`;

        const encodedText = encodeURIComponent(textToShare);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');

        handleSave(true);
    };

    const handleSave = async (silent = false) => {
        if (!projectId) {
            hapticService.error();
            alert(t('project_required_error'));
            return;
        }

        if (!silent) hapticService.success();

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

            // Sync to Firebase
            if (firebaseService.isReady) {
                // Fetch the ID if it was a new add
                let reportId = existing?.id;
                if (!reportId) {
                    const newReport = await db.dailyReports.where({ projectId: Number(projectId), date: reportDate }).first();
                    reportId = newReport?.id;
                }

                if (reportId) {
                    firebaseService.upsertRecords('dailyReports', [{ ...reportData, id: reportId }])
                        .catch(err => console.error('Firebase sync failed', err));
                }
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert(t('save_error'));
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20 space-y-8 animate-fade-in">
            <header className="relative pt-6 md:pt-8 px-4 md:px-0 space-y-4">
                <div className="flex items-center gap-3">
                    <span className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]"></span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Výkazy práce</span>
                </div>
                <h1 className="text-5xl sm:text-7xl md:text-8xl font-black text-white tracking-tighter italic leading-[0.85] uppercase">
                    DAILY<span className="text-emerald-500 font-normal">.</span>REPORT
                </h1>
                <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px] md:text-sm pl-1 border-l-2 border-white/10 ml-1">
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
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold min-h-[56px] [&>option]:bg-slate-900"
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
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-bold min-h-[56px]"
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
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none font-mono text-xl min-h-[56px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest">📝 {t('notes')}</label>
                        <textarea
                            rows={3}
                            placeholder="..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-4 bg-black/40 text-white border border-white/10 rounded-2xl focus:ring-2 focus:ring-[var(--color-primary)] outline-none min-h-[100px]"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-gray-500 uppercase ml-1 mb-2 tracking-widest text-red-400">⚠️ {t('issues')}</label>
                        <textarea
                            rows={2}
                            placeholder="..."
                            value={issues}
                            onChange={e => setIssues(e.target.value)}
                            className="w-full p-4 bg-red-900/20 text-white border border-red-500/30 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none min-h-[80px]"
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mt-10 border-t border-white/10 pt-8 pb-safe md:pb-0">
                    <button
                        onClick={() => handleSave(false)}
                        disabled={!projectId}
                        className="flex-1 px-8 py-5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 disabled:opacity-50 active:scale-95 min-h-[64px]"
                    >
                        💾 {t('save')}
                    </button>
                    <button
                        onClick={handleShareReport}
                        disabled={!projectId}
                        className="flex-1 px-8 py-5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 min-h-[64px]"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        {t('share_copy_report') || 'Sdílet / Kopírovat'}
                    </button>
                    <button
                        onClick={handleWhatsAppShare}
                        disabled={!projectId}
                        className="flex-1 px-8 py-5 bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 min-h-[64px]"
                    >
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.508 0-9.987 4.479-9.987 9.987 0 1.763.462 3.487 1.339 5.004L2 22l5.132-1.347c1.467.799 3.111 1.221 4.88 1.221 5.508 0 9.987-4.479 9.987-9.987 0-2.662-1.037-5.164-2.921-7.048C17.164 3.037 14.674 2 12.012 2zM12.012 3.974c2.14 0 4.152.83 5.662 2.34 1.51 1.51 2.34 3.522 2.34 5.662 0 4.417-3.593 8.01-8.01 8.01-1.554 0-3.048-.452-4.323-1.306l-.31-.205-3.045.798.813-2.964-.225-.358c-.933-1.488-1.425-3.21-1.425-4.975C3.501 7.567 7.094 3.974 12.012 3.974zM12.012 3.974c2.14 0 4.152.83 5.662 2.34 1.51 1.51 2.34 3.522 2.34 5.662 0 4.417-3.593 8.01-8.01 8.01-1.554 0-3.048-.452-4.323-1.306l-.31-.205-3.045.798.813-2.964-.225-.358c-.933-1.488-1.425-3.21-1.425-4.975C3.501 7.567 7.094 3.974 12.012 3.974zM8.336 7.427c-.157 0-.414.059-.628.293-.214.234-.814.796-.814 1.94s.828 2.248.943 2.404c.114.156 1.63 2.488 3.948 3.487.551.238 1.054.382 1.487.52.553.176 1.056.151 1.453.092.443-.066 1.357-.554 1.543-1.091.186-.537.186-.996.129-1.092-.057-.096-.214-.156-.443-.272s-1.357-.669-1.571-.747c-.214-.078-.371-.117-.528.117s-.6 1.15-.742 1.31c-.143.159-.286.176-.514.059-.228-.117-.964-.356-1.837-1.134-.68-.606-1.138-1.355-1.272-1.583-.133-.228-.014-.351.099-.465.105-.102.228-.272.343-.408s.157-.228.228-.382c.071-.156.036-.293-.017-.408a2.59 2.59 0 00-.547-1.305c-.144-.338-.288-.282-.414-.282z" /></svg>
                        WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DailyReports;
