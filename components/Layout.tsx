import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import DashboardIcon from './icons/DashboardIcon';
import ProjectsIcon from './icons/ProjectsIcon';
import SettingsIcon from './icons/SettingsIcon';
import ClockIcon from './icons/ClockIcon';
import BrainIcon from './icons/BrainIcon';
import ClockIcon from './icons/ClockIcon';
import BrainIcon from './icons/BrainIcon';
import ChatIcon from './icons/ChatIcon';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';

const BottomNavBar: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();

    const navItems = [
        { to: "/", title: t('dashboard'), icon: <DashboardIcon className="w-7 h-7" />, roles: ['admin', 'user'] },
        { to: "/projects", title: t('projects'), icon: <ProjectsIcon className="w-7 h-7" />, roles: ['admin', 'user'] },
        { to: "/chat", title: "Chat", icon: <ChatIcon className="w-7 h-7" />, roles: ['admin', 'user'] },
        { to: "/records", title: t('work_log'), icon: <ClockIcon className="w-7 h-7" />, roles: ['admin', 'user'] },
        { to: "/settings", title: t('settings'), icon: <SettingsIcon className="w-7 h-7" />, roles: ['admin'] },
    ];

    const visibleItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));

    return (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md md:hidden">
            <div className="glass-card rounded-[3rem] px-2 py-3 flex justify-around items-center shadow-[0_30px_70px_rgba(0,0,0,0.7)] border-white/20">
                {visibleItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `relative flex flex-col items-center justify-center p-6 rounded-[2.5rem] transition-all duration-300 touch-manipulation ${isActive
                                ? 'bg-white/15 text-[var(--color-accent)] scale-105 shadow-[0_0_20px_rgba(56,189,248,0.3)]'
                                : 'text-slate-400 hover:text-white active:scale-95'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                                    {item.icon}
                                </div>
                                {isActive && (
                                    <>
                                        <span className="absolute -bottom-0.5 w-2 h-2 bg-[var(--color-accent)] rounded-full shadow-[0_0_15px_rgba(56,189,248,0.8)] animate-pulse"></span>
                                        <span className="absolute inset-0 bg-gradient-to-t from-[var(--color-accent)]/20 to-transparent rounded-[2.5rem] opacity-50"></span>
                                    </>
                                )}
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, logout } = useAuth();
    const { t, language, setLanguage } = useI18n();
    const location = useLocation();

    return (
        <div className="fixed inset-0 w-full h-full flex flex-col bg-transparent overflow-hidden">
            {/* Header */}
            <header className="flex justify-between items-center h-24 px-6 md:px-12 shrink-0 z-50 w-full">
                <div className="flex flex-col gap-0.5">
                    <Link to="/" className="text-2xl md:text-3xl font-black italic tracking-tighter text-white hover:opacity-80 transition-opacity flex items-center gap-2">
                        MST<span className="text-[var(--color-accent)]">.</span>
                        <span className="hidden md:inline text-lg text-slate-400 font-bold not-italic tracking-normal border-l-2 border-slate-600 pl-3 ml-1">Martyho Solar Tracker</span>
                    </Link>
                    <div className="hidden md:block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 ml-1">
                        Projektový hub pro montáže
                    </div>
                </div>
                <div className="md:hidden">
                    <ConnectionStatusIndicator />
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6 lg:gap-10 bg-black/20 px-8 py-3 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl">
                    {[
                        { to: "/", title: t('dashboard'), roles: ['admin', 'user'] },
                        { to: "/projects", title: t('projects'), roles: ['admin', 'user'] },
                        { to: "/chat", title: "TEAM CHAT", roles: ['admin', 'user'] },
                        { to: "/records", title: t('work_log'), roles: ['admin', 'user'] },
                        { to: "/settings", title: t('settings'), roles: ['admin'] },
                    ].filter(item => item.roles.includes(user?.role || 'user')).map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `text-sm font-black uppercase tracking-widest transition-all hover:scale-105 ${isActive ? 'text-[var(--color-accent)] drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'text-slate-400 hover:text-white'}`}
                        >
                            {item.title}
                        </NavLink>
                    ))}
                </nav>

                <div className="flex items-center gap-4">
                    <div className="hidden md:block">
                        <ConnectionStatusIndicator />
                    </div>

                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/10">
                        {/* Language Switcher */}
                        <button
                            onClick={() => setLanguage(language === 'cs' ? 'en' : 'cs')}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all font-black text-xs border border-white/5 active:scale-95"
                            title={t('switch_language')}
                        >
                            {language.toUpperCase()}
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={logout}
                            className="h-10 px-4 flex items-center gap-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/20 transition-all font-bold text-xs uppercase tracking-wider active:scale-95"
                            title={t('logout')}
                        >
                            <span>{t('logout')}</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        </button>
                    </div>
                </div>
            </header >

            {/* Main Content Area */}
            < main className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 pb-32 overscroll-contain" >
                <div key={location.pathname} className="max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main >

            <BottomNavBar />


        </div >
    );
};

export default Layout;