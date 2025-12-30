
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { Worker } from '../types';
import WorkersIcon from './icons/WorkersIcon';
import SettingsIcon from './icons/SettingsIcon';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
    const [mode, setMode] = useState<'worker' | 'admin'>('worker');
    const [isRegistering, setIsRegistering] = useState(false);

    // Login State
    const [password, setPassword] = useState('');
    const [selectedWorkerId, setSelectedWorkerId] = useState<number | ''>('');

    // Registration State
    const [regName, setRegName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [error, setError] = useState('');

    const { login } = useAuth();
    const { t } = useI18n();
    const workers = useLiveQuery(() => db.workers.toArray());

    const [biometricAvailable, setBiometricAvailable] = useState(false);

    useEffect(() => {
        import('../utils/biometrics').then(mod => {
            if (mod.isBiometricSupported() && localStorage.getItem('biometric_enabled') === 'true') {
                setBiometricAvailable(true);
            }
        });
    }, []);

    const handleBiometricLogin = async () => {
        setError('');
        const { authenticateBiometrics } = await import('../utils/biometrics');
        const username = await authenticateBiometrics();
        if (username) {
            const worker = await db.workers.where('name').equals(username).first();
            if (worker) {
                login({ username: worker.name, role: 'user', workerId: worker.id });
                return;
            }
            if (username === 'admin') {
                login({ username: 'admin', role: 'admin' });
                return;
            }
        }
        setError("Biometrické ověření selhalo");
    };

    const resetForms = () => {
        setError('');
        setPassword('');
        setRegName('');
        setRegUsername('');
        setRegPassword('');
        setConfirmPassword('');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (mode === 'admin') {
            if (password === 'Martyy88') {
                login({ username: 'admin', role: 'admin' });
                if (localStorage.getItem('biometric_enabled') !== 'true') {
                    import('../utils/biometrics').then(mod => mod.registerBiometrics('admin'));
                }
            } else {
                setError(t('login_error'));
            }
        } else {
            if (!selectedWorkerId) {
                setError(t('select_worker'));
                return;
            }

            const worker = await db.workers.get(Number(selectedWorkerId));
            if (worker) {
                if (worker.password && worker.password !== password) {
                    setError(t('login_error'));
                    return;
                }
                login({ username: worker.name, role: 'user', workerId: worker.id });
                if (localStorage.getItem('biometric_enabled') !== 'true') {
                    import('../utils/biometrics').then(mod => mod.registerBiometrics(worker.name));
                }
            } else {
                setError(t('worker_not_found', { name: '' }));
            }
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!regName || !regUsername || !regPassword) {
            setError(t('fill_all_fields'));
            return;
        }

        if (regPassword !== confirmPassword) {
            setError(t('passwords_do_not_match'));
            return;
        }

        const existingUser = await db.workers.where('username').equalsIgnoreCase(regUsername).first();
        if (existingUser) {
            setError(t('username_taken'));
            return;
        }

        const newWorkerData: Omit<Worker, 'id'> = {
            name: regName,
            username: regUsername,
            password: regPassword,
            hourlyRate: 0,
            createdAt: new Date()
        };

        try {
            const id = await db.workers.add(newWorkerData as Worker);
            login({ username: regName, role: 'user', workerId: id });
        } catch (err) {
            console.error(err);
            setError("Registration failed");
        }
    };

    return (
        <div className="h-[100dvh] w-full flex items-center justify-center p-6 relative overflow-hidden scroll-y">
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--color-primary)] opacity-20 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-[400px] glass-card rounded-3xl p-8 shadow-2xl border border-white/10 relative z-10 bg-slate-950/50 my-auto">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white tracking-tighter mb-1">MST<span className="text-[var(--color-accent)]">.</span></h1>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Solar Management System</p>
                </div>

                {!isRegistering ? (
                    <>
                        {/* Pill Switcher */}
                        <div className="flex p-1 bg-black/40 rounded-xl mb-6 border border-white/5">
                            <button
                                onClick={() => { setMode('worker'); resetForms(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'worker' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                Zaměstnanec
                            </button>
                            <button
                                onClick={() => { setMode('admin'); resetForms(); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${mode === 'admin' ? 'bg-[var(--color-primary)] text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                            >
                                Admin
                            </button>
                        </div>

                        {biometricAvailable && (
                            <button
                                onClick={handleBiometricLogin}
                                className="w-full mb-6 py-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
                            >
                                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0112 3a10.003 10.003 0 014.139 18.442l.054.09M12 11c1.01 0 1.956.242 2.788.67m-5.576 0c.832-.428 1.778-.67 2.788-.67" />
                                </svg>
                                <span className="font-bold text-sm uppercase tracking-wider">Přihlásit přes Face ID / Otisk</span>
                            </button>
                        )}

                        <form className="space-y-5" onSubmit={handleLogin}>
                            {mode === 'worker' && (
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('select_worker')}</label>
                                    <select
                                        value={selectedWorkerId}
                                        onChange={(e) => setSelectedWorkerId(Number(e.target.value))}
                                        className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm font-medium transition-all"
                                        required
                                    >
                                        <option value="" disabled>Vyberte jméno...</option>
                                        {workers?.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">{t('password')}</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm font-medium transition-all placeholder-slate-600"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                    <p className="text-red-400 font-bold text-xs">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-slate-200 active:scale-95 transition-all shadow-lg text-sm uppercase tracking-wide mt-2"
                            >
                                {t('login')}
                            </button>
                        </form>

                        {mode === 'worker' && (
                            <div className="text-center mt-6">
                                <button
                                    onClick={() => { setIsRegistering(true); resetForms(); }}
                                    className="text-slate-500 hover:text-white font-medium text-xs transition-colors"
                                >
                                    {t('dont_have_account')} <span className="text-[var(--color-accent)] underline underline-offset-2">{t('create_account')}</span>
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="text-center mb-6">
                            <h2 className="text-lg font-bold text-white uppercase tracking-wide">{t('create_account')}</h2>
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="text"
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm"
                                placeholder="Jméno a Příjmení"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="text"
                                value={regUsername}
                                onChange={(e) => setRegUsername(e.target.value)}
                                className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm"
                                placeholder="Uživatelské jméno"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="password"
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm"
                                placeholder="Heslo"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full p-3.5 bg-black/30 text-white border border-white/10 rounded-xl focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none text-sm"
                                placeholder="Potvrdit heslo"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                                <p className="text-red-400 font-bold text-xs">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-3.5 bg-white text-black font-bold rounded-xl hover:bg-slate-200 active:scale-95 transition-all shadow-lg text-sm uppercase tracking-wide mt-2"
                        >
                            {t('register')}
                        </button>

                        <div className="text-center mt-6">
                            <button
                                type="button"
                                onClick={() => { setIsRegistering(false); resetForms(); }}
                                className="text-slate-500 hover:text-white font-medium text-xs transition-colors"
                            >
                                {t('already_have_account')} <span className="text-[var(--color-accent)] underline underline-offset-2">{t('login')}</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Login;
