
import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    updateProfile
} from 'firebase/auth';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { db } from '../services/db';
import type { Worker } from '../types';

const Login: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { t } = useI18n();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(firebaseService.getAuth, email, password);
        } catch (err: any) {
            console.error(err);
            setError(t('login_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError(t('passwords_do_not_match'));
            return;
        }
        setIsLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(firebaseService.getAuth, email, password);
            if (userCredential.user) {
                await updateProfile(userCredential.user, { displayName: name });

                // Create local worker record
                const newWorker: Omit<Worker, 'id'> = {
                    name,
                    username: email.split('@')[0],
                    hourlyRate: 0,
                    panelPrice: 0,
                    stringPrice: 0,
                    meterPrice: 0,
                    createdAt: new Date(),
                    color: '#3b82f6'
                };
                const id = await db.workers.add(newWorker as Worker);

                // Sync to Firestore
                if (firebaseService.isReady) {
                    await firebaseService.upsertRecords('workers', [{ ...newWorker, id }]);
                }
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Registration failed");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(firebaseService.getAuth, email);
            setMessage(t('reset_link_sent'));
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Reset failed");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#020617] relative overflow-hidden">
            {/* Premium Animated Background Layer */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-[10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-purple-600/5 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '4s' }} />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo Area */}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    <div className="inline-block p-6 rounded-[2.5rem] bg-white/[0.03] border border-white/5 mb-6 shadow-3xl hover:scale-110 transition-transform duration-700 group cursor-default">
                        <h1 className="text-6xl font-black text-white tracking-tighter italic leading-none">
                            MST<span className="text-indigo-500 animate-pulse">.</span>
                        </h1>
                    </div>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-60">
                        Smart Solar Management
                    </p>
                </div>

                {/* Main Auth Card */}
                <div className="glass-dark p-10 rounded-[4rem] border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-700">
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-8 animate-fade-in">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    {t('login')}
                                </h2>
                                <div className="h-1 w-12 bg-indigo-500 rounded-full" />
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email')}</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-bold text-sm"
                                        placeholder="admin@mst.app"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('password')}</label>
                                        <button
                                            type="button"
                                            onClick={() => setMode('reset')}
                                            className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors"
                                        >
                                            {t('reset_password')}?
                                        </button>
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-bold text-sm"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl animate-shake">
                                    <p className="text-rose-400 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-indigo-600 hover:text-white transition-all duration-500 shadow-2xl active:scale-95 disabled:opacity-50 mt-4 overflow-hidden"
                            >
                                <span className="relative z-10">{isLoading ? t('processing') : t('login')}</span>
                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            </button>

                            <div className="text-center pt-4">
                                <button
                                    type="button"
                                    onClick={() => setMode('register')}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2 mx-auto"
                                >
                                    {t('dont_have_account')} <span className="text-indigo-400 font-black">{t('create_account')}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-8 animate-fade-in">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    {t('create_account')}
                                </h2>
                                <div className="h-1 w-12 bg-indigo-500 rounded-full" />
                            </div>

                            <div className="space-y-4">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm"
                                    placeholder={t('worker_name')}
                                    required
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm"
                                    placeholder={t('email')}
                                    required
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm"
                                    placeholder={t('password')}
                                    required
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm"
                                    placeholder={t('confirm_password')}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl animate-shake">
                                    <p className="text-rose-400 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="group relative w-full h-16 bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-indigo-500 transition-all duration-500 shadow-2xl active:scale-95 disabled:opacity-50 overflow-hidden"
                            >
                                <span className="relative z-10">{isLoading ? t('processing') : t('register')}</span>
                                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                            </button>

                            <div className="text-center pt-4">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    {t('already_have_account')} <span className="text-indigo-400 font-black">{t('login')}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'reset' && (
                        <form onSubmit={handleReset} className="space-y-8 animate-fade-in">
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    {t('reset_password')}
                                </h2>
                                <div className="h-1 w-12 bg-indigo-500 rounded-full" />
                            </div>

                            <p className="text-slate-500 text-xs font-bold px-2 leading-relaxed">
                                {t('reset_password_desc')}
                            </p>

                            <div className="space-y-4">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm"
                                    placeholder={t('email')}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-2xl">
                                    <p className="text-rose-400 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>
                                </div>
                            )}
                            {message && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl">
                                    <p className="text-emerald-400 text-[10px] font-black uppercase text-center tracking-widest">{message}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-16 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-slate-200 transition-all shadow-2xl active:scale-95 disabled:opacity-50"
                            >
                                {isLoading ? t('processing') : t('send_reset_link')}
                            </button>

                            <div className="text-center pt-4">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    {t('back_to_login')}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Footer Info */}
                <div className="mt-16 text-center animate-in fade-in duration-1000 delay-500">
                    <p className="text-[9px] font-black text-slate-700 uppercase tracking-[0.6em] flex items-center justify-center gap-4">
                        <span className="w-8 h-px bg-slate-800" />
                        &copy; 2026 MST TECHNOLOGY &bull; V.4.5
                        <span className="w-8 h-px bg-slate-800" />
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
