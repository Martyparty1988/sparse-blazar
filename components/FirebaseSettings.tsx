import React, { useState, useEffect } from 'react';
import { firebaseService, FirebaseConfig } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const FirebaseSettings: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [configInput, setConfigInput] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [dbUrl, setDbUrl] = useState('');

    useEffect(() => {
        const currentConfig = firebaseService.getConfig();
        if (currentConfig) {
            setIsConnected(true);
            setDbUrl(currentConfig.databaseURL);
            // Don't show full keys for security, just status
            setConfigInput(JSON.stringify(currentConfig, null, 2));
        }
    }, []);

    const handleSave = () => {
        try {
            // Allow user to paste just the inner object or the full "const firebaseConfig = {...}" string
            let cleanInput = configInput.trim();
            // Remove js variable declaration if present
            if (cleanInput.startsWith('const firebaseConfig =')) {
                cleanInput = cleanInput.replace('const firebaseConfig =', '').trim();
                if (cleanInput.endsWith(';')) {
                    cleanInput = cleanInput.slice(0, -1);
                }
            }

            // Fix lazy copy-paste issues (e.g. unquoted keys) - simple heuristic or rely on valid JSON
            // For now assume user pastes valid JSON or object literal.
            // If keys are not quoted, JSON.parse fails. We could suggest using a JSON formatter tool site.
            // Or we ask user to paste only values.

            // Try formatting object literal to JSON if needed (simple regex for basic keys)
            // { apiKey: "..." } -> { "apiKey": "..." }
            const jsonStr = cleanInput.replace(/(\w+):/g, '"$1":');

            const config: FirebaseConfig = JSON.parse(jsonStr);

            if (!config.databaseURL || !config.apiKey) {
                throw new Error('Invalid config: missing databaseURL or apiKey');
            }

            const success = firebaseService.init(config);
            if (success) {
                setIsConnected(true);
                setDbUrl(config.databaseURL);
                showToast('🔥 Firebase Connected!', 'success');
            } else {
                showToast('Failed to connect to Firebase', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Invalid Configuration Syntax. Please paste valid JSON Object.', 'error');
            alert("Please paste the object inside { ... }. \nExample:\n{\n  \"apiKey\": \"...\",\n  \"authDomain\": \"...\"\n}");
        }
    };

    const handleDisconnect = () => {
        if (confirm('Disconnect from Firebase? Sync will stop.')) {
            firebaseService.disconnect();
            setIsConnected(false);
            setConfigInput('');
            setDbUrl('');
            showToast('Disconnected', 'info');
        }
    };

    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${isConnected ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-gray-400'}`}>
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
                            <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
                            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
                            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Firebase Database</h3>
                        {isConnected ? (
                            <p className="text-xs text-green-400 font-bold uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Connected
                            </p>
                        ) : (
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Not Connected</p>
                        )}
                    </div>
                </div>
                {isConnected && (
                    <button
                        onClick={() => firebaseService.upsertRecords('test', [{ id: 'ping', time: new Date().toISOString() }])}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold uppercase tracking-widest rounded-lg transition-all"
                    >
                        Test Write
                    </button>
                )}
            </div>

            {isAdmin && (
                <div className="bg-black/40 rounded-2xl p-6 border border-white/5 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Firebase Config (JSON)</label>
                        {!isConnected ? (
                            <textarea
                                value={configInput}
                                onChange={(e) => setConfigInput(e.target.value)}
                                rows={8}
                                placeholder={`Paste your firebaseConfig here:\n{\n  "apiKey": "AIza...",\n  "authDomain": "...",\n  "databaseURL": "..."\n}`}
                                className="w-full bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-mono text-gray-300 focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        ) : (
                            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                                <p className="text-green-400 font-mono text-xs break-all">Database URL: {dbUrl}</p>
                                <p className="text-gray-500 text-xs mt-2">Configuration is saved securely.</p>
                            </div>
                        )}

                    </div>

                    <div className="flex justify-end gap-3">
                        {isConnected ? (
                            <button
                                onClick={handleDisconnect}
                                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-xl uppercase tracking-widest text-xs transition-all"
                            >
                                Disconnect
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all shadow-lg shadow-orange-500/20"
                            >
                                Connect Firebase
                            </button>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};
