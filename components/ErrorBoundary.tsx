
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div className="flex flex-col items-center justify-center min-h-screen bg-[#020617] p-10 text-center">
                        <div className="text-6xl mb-6">⚠️</div>
                        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">Aplikace narazila na problém</h1>
                        <p className="text-slate-400 mb-8 max-w-sm font-medium">Omlouváme se, něco se pokazilo. Zkuste aplikaci restartovat nebo obnovit stránku.</p>
                        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl mb-8 w-full max-w-lg overflow-auto">
                            <code className="text-red-400 text-xs font-mono break-all">{this.state.error?.message}</code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-[var(--color-accent)] text-black font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all"
                        >
                            Obnovit stránku
                        </button>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
