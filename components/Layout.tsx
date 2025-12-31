import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import DashboardIcon from './icons/DashboardIcon';
import ProjectsIcon from './icons/ProjectsIcon';
import SettingsIcon from './icons/SettingsIcon';
import ClockIcon from './icons/ClockIcon';
import ChatIcon from './icons/ChatIcon';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import FloatingActionMenu from './FloatingActionMenu';

const BottomNavBar: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const location = useLocation();

    // Larger icons for better touch targets (48x48 min)
    const navItems = [
        { to: "/", title: t('dashboard'), icon: <DashboardIcon className="w-8 h-8" />, roles: ['admin', 'user'] },
        { to: "/projects", title: t('projects'), icon: <ProjectsIcon className="w-8 h-8" />, roles: ['admin', 'user'] },
        { to: "/chat", title: "Chat", icon: <ChatIcon className="w-8 h-8" />, roles: ['admin', 'user'] },
        { to: "/records", title: t('work_log'), icon: <ClockIcon className="w-8 h-8" />, roles: ['admin', 'user'] },
        { to: "/settings", title: t('settings'), icon: <SettingsIcon className="w-8 h-8" />, roles: ['admin'] },
    ];

    const visibleItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));

    return (
        <nav
            className="fixed bottom-0 left-0 z-[100] w-full bg-[#1a1d37]/95 backdrop-blur-xl border-t border-white/5 md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all glass-card"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
            <div className="flex justify-around items-center px-2 py-4">
                {visibleItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `group flex flex-col items-center justify-center w-full gap-1 transition-all duration-300 touch-manipulation min-h-[56px] ${isActive
                                ? 'text-white'
                                : 'text-slate-500 hover:text-slate-300'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`relative p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/10 scale-110 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'scale-100'}`}>
                                    {item.icon}
                                    {isActive && <div className="absolute inset-x-2 -bottom-1 h-0.5 bg-[var(--color-accent)] rounded-full shadow-[0_0_8px_var(--color-accent)]"></div>}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-wider transition-opacity duration-300 ${isActive ? 'opacity-100 text-[var(--color-accent)]' : 'opacity-0 scale-0 h-0 hidden'}`}>
                                    {item.title}
                                </span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { t } = useI18n();
    const location = useLocation();

    // Mock Weather Data
    const weather = { temp: 5, icon: '☁️' };
    const dateStr = new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="fixed inset-0 w-full h-[100dvh] flex flex-col bg-transparent overflow-hidden supports-[height:100dvh]:h-[100dvh]">
            {/* Header - Notch & Dynamic Island Friendly */}
            <header
                className="fixed top-0 left-0 right-0 z-[100] bg-[#1a1d37]/80 backdrop-blur-md border-b border-white/5 shadow-sm transition-all"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="flex justify-between items-center h-16 px-6">
                    {/* Left: Online Status + Logo */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-black/30 px-2 pl-1.5 py-1 rounded-full border border-white/5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] font-black text-emerald-500 tracking-widest">ONLINE</span>
                        </div>
                        <span className="text-xl font-black italic tracking-tighter text-white">MST<span className="text-[var(--color-accent)]">.</span></span>
                    </div>

                    {/* Right: Date + Weather */}
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{dateStr}</span>
                        <div className="flex items-center gap-1.5 text-white/90">
                            <span className="text-xs">{weather.icon}</span>
                            <span className="text-xs font-bold font-mono">{weather.temp}°C</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main
                className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 overscroll-contain"
                style={{
                    paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))',
                    paddingBottom: 'calc(8rem + env(safe-area-inset-bottom, 0px))',
                    paddingLeft: 'env(safe-area-inset-left, 0px)',
                    paddingRight: 'env(safe-area-inset-right, 0px)',
                    marginLeft: 'env(safe-area-inset-left, 0px)',
                    marginRight: 'env(safe-area-inset-right, 0px)'
                }}
            >
                <div key={location.pathname} className="max-w-7xl mx-auto w-full h-full">
                    {children}
                </div>
            </main>

            <BottomNavBar />

            {/* Show FAB only on non-dashboard pages to avoid duplication */}
            {location.pathname !== '/' && <FloatingActionMenu />}

        </div>
    );
};

export default Layout;