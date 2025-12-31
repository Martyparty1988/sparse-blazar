
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
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0f172a] relative overflow-hidden">
            {/* Premium Animated Background */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="w-full max-w-md relative z-10 transition-all duration-500 transform">
                {/* Logo Area */}
                <div className="text-center mb-10 group">
                    <div className="inline-block p-4 rounded-3xl bg-white/5 border border-white/10 mb-4 shadow-2xl group-hover:scale-110 transition-transform duration-500">
                        <h1 className="text-5xl font-black text-white tracking-tighter italic">
                            MST<span className="text-indigo-500 text-6xl">.</span>
                        </h1>
                    </div>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em] opacity-60">
                        Marty Solar Management
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-white/5 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">

                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                                {t('login')}
                            </h2>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{t('email')}</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                                        placeholder="name@example.com"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('password')}</label>
                                        <button
                                            type="button"
                                            onClick={() => setMode('reset')}
                                            className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors"
                                        >
                                            {t('reset_password')}?
                                        </button>
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            {error && <p className="text-red-400 text-[10px] font-black uppercase text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20 mt-4">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 mt-4"
                            >
                                {isLoading ? t('processing') : t('login')}
                            </button>

                            <div className="text-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => setMode('register')}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    {t('dont_have_account')} <span className="text-indigo-400">{t('create_account')}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'register' && (
                        <form onSubmit={handleRegister} className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                                {t('create_account')}
                            </h2>

                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder={t('worker_name')}
                                    required
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder={t('email')}
                                    required
                                />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder={t('password')}
                                    required
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder={t('confirm_password')}
                                    required
                                />
                            </div>

                            {error && <p className="text-red-400 text-[10px] font-black uppercase text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? t('processing') : t('register')}
                            </button>

                            <div className="text-center mt-6">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                                >
                                    {t('already_have_account')} <span className="text-indigo-400">{t('login')}</span>
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'reset' && (
                        <form onSubmit={handleReset} className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-2">
                                {t('reset_password')}
                            </h2>
                            <p className="text-slate-400 text-xs font-bold px-1">{t('reset_password_desc')}</p>

                            <div className="space-y-4">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-bold"
                                    placeholder={t('email')}
                                    required
                                />
                            </div>

                            {error && <p className="text-red-400 text-[10px] font-black uppercase text-center bg-red-500/10 p-3 rounded-xl border border-red-500/20">{error}</p>}
                            {message && <p className="text-emerald-400 text-[10px] font-black uppercase text-center bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">{message}</p>}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? t('processing') : t('send_reset_link')}
                            </button>

                            <div className="text-center mt-6">
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
                <div className="mt-12 text-center">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.4em]">
                        &copy; 2025 MST TECHNOLOGY &bull; V.4.5
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
