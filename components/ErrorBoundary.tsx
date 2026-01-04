import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 bg-[#020617] text-white">
                    <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center space-y-6 animate-scale-in">
                        <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20">
                            <span className="text-4xl">⚠️</span>
                        </div>

                        <div>
                            <h1 className="text-2xl font-black italic uppercase tracking-tight mb-2">Něco se pokazilo</h1>
                            <p className="text-sm text-slate-400 font-medium">Omlouváme se, aplikace narazila na neočekávanou chybu.</p>
                        </div>

                        {this.state.error && (
                            <div className="p-4 bg-black/40 rounded-xl text-left border border-white/5 overflow-hidden">
                                <code className="text-[10px] text-red-300 font-mono break-words block">
                                    {this.state.error.toString()}
                                </code>
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-600/30 active:scale-95 transition-all text-sm hover:brightness-110"
                        >
                            Obnovit aplikaci
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
