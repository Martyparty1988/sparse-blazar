
import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { getWorkerColor, getInitials } from '../utils/workerColors';
import { useI18n } from '../contexts/I18nContext';

const Leaderboard: React.FC = () => {
    const { t } = useI18n();
    const workers = useLiveQuery(() => db.workers.toArray());

    // Query completed tables for today
    const completedToday = useLiveQuery(() => {
        const today = new Date().toISOString().split('T')[0];
        return db.fieldTables
            .filter(table => {
                if (!table.completedAt || table.status !== 'completed') return false;
                const completedDate = new Date(table.completedAt).toISOString().split('T')[0];
                return completedDate === today;
            })
            .toArray();
    });

    // Calculate rankings
    const ranking = useMemo(() => {
        if (!workers || !completedToday) return [];

        const stats = workers.map(worker => {
            const count = completedToday.filter(t => t.completedBy === worker.id).length;
            return {
                ...worker,
                count
            };
        });

        return stats
            .filter(s => s.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5
    }, [workers, completedToday]);

    if (!ranking || ranking.length === 0) {
        return (
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-[3rem] p-8 border border-white/5 flex flex-col justify-center items-center text-center min-h-[200px]">
                <div className="text-4xl mb-3 opacity-20">🏆</div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dnes zatím žádné výsledky</p>
                <p className="text-xs text-slate-600 font-bold mt-2">Buď první, kdo dnes dokončí stůl!</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-900/40 backdrop-blur-xl rounded-[3rem] p-8 border border-white/5 flex flex-col relative overflow-hidden group min-h-[300px]">
            <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            </div>

            <div className="relative z-10 w-full">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                    Mistrovský Leaderboard (Dnes)
                </p>

                <div className="space-y-4">
                    {ranking.map((worker, index) => (
                        <div key={worker.id} className="flex items-center gap-4 group/item">
                            <div className="text-2xl font-black text-slate-700 w-6 italic">
                                #{index + 1}
                            </div>
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs border-2 border-white/10 shadow-lg transform group-hover/item:scale-110 transition-transform"
                                style={{ backgroundColor: getWorkerColor(worker.id!, worker.color, workers || []) }}
                            >
                                {getInitials(worker.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-white font-bold text-sm truncate uppercase tracking-tighter">{worker.name}</div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full"
                                        style={{ width: `${(worker.count / ranking[0].count) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-black text-white">{worker.count}</div>
                                <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t('tables') || 'stolů'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
