
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import DashboardIcon from './icons/DashboardIcon';
import ProjectsIcon from './icons/ProjectsIcon';
import SettingsIcon from './icons/SettingsIcon';
import ClockIcon from './icons/ClockIcon';
import ChatIcon from './icons/ChatIcon';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import FloatingActionMenu from './FloatingActionMenu';
import Sidebar from './Sidebar'; // Import the Sidebar
import TimeRecordForm from './TimeRecordForm';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';
import { hapticService } from '../services/hapticService';

const BottomNavBar: React.FC = () => {
    const { t } = useI18n();
    const { user } = useAuth();
    const location = useLocation();

    const navItems = [
        { to: "/", title: t('dashboard'), icon: <DashboardIcon className="w-[22px] h-[22px]" />, roles: ['admin', 'user'] },
        { to: "/projects", title: 'Seznam', icon: <ProjectsIcon className="w-[22px] h-[22px]" />, roles: ['admin', 'user'] },
        { to: "/chat", title: "Chat", icon: <ChatIcon className="w-[22px] h-[22px]" />, roles: ['admin', 'user'] },
        { to: "/records", title: 'Práce', icon: <ClockIcon className="w-[22px] h-[22px]" />, roles: ['admin', 'user'] },
        { to: "/settings", title: t('settings'), icon: <SettingsIcon className="w-[22px] h-[22px]" />, roles: ['admin', 'user'] },
    ];

    const visibleItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));

    return (
        <nav
            className="fixed bottom-0 left-0 z-[100] w-full bg-[#020617]/95 backdrop-blur-3xl border-t border-white/10 md:hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-all"
            style={{
                paddingBottom: 'var(--safe-bottom)',
                height: 'calc(56px + var(--safe-bottom))'
            }}
        >
            <div className="flex justify-around items-center px-4 h-14">
                {visibleItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `group flex flex-col items-center justify-center w-full gap-1 transition-all duration-300 touch-manipulation min-h-[56px] rounded-2xl ${isActive
                                ? 'text-white'
                                : 'text-slate-500 hover:text-slate-300'
                            }`
                        }
                        onClick={() => hapticService.light()}
                    >
                        {({ isActive }) => (
                            <>
                                <div className={`relative p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] scale-110 -translate-y-1 border border-white/20' : 'bg-transparent scale-100'}`}>
                                    {isActive ? React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: "w-[22px] h-[22px] text-white" }) : React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { className: "w-[22px] h-[22px] text-slate-500" })}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${isActive ? 'opacity-100 text-indigo-400 translate-y-0' : 'opacity-0 translate-y-2 hidden'}`}>
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
    const [showQuickLog, setShowQuickLog] = useState(false);

    useEffect(() => {
        // Fix for iOS app mounting sometimes causing scroll offset
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if active element is input/textarea to avoid triggering while typing
            const target = e.target as HTMLElement;
            if (['input', 'textarea'].includes(target.tagName.toLowerCase())) return;

            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                setShowQuickLog(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="w-full h-[100dvh] flex bg-transparent overflow-hidden">
            {/* Sidebar for desktop */}
            <Sidebar />

            <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
                {/* Header - Only for Mobile, as Sidebar has its own */}
                <header
                    className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1a1d37]/80 backdrop-blur-xl border-b border-white/5 shadow-sm"
                    style={{
                        paddingTop: 'var(--safe-top)',
                        height: 'calc(52px + var(--safe-top))'
                    }}
                >
                    <div
                        className="flex justify-between items-center h-[52px] px-5"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-lg font-black italic tracking-tighter text-white">MST<span className="text-[var(--color-accent)]">.</span></span>
                        </div>
                        <div className="flex items-center gap-3">
                            <NotificationBell className="w-5 h-5" />
                            <ConnectionStatusIndicator />
                        </div>
                    </div>
                </header>

                {/* Main Content Area */}
                <main
                    className="flex-1 app-scroll p-4 md:p-8 overscroll-contain"
                    style={{
                        paddingTop: 'calc(52px + var(--safe-top))',
                        paddingBottom: 'calc(84px + var(--safe-bottom))', // Bottom Nav (56px) + FAB space
                    }}
                >
                    <div key={location.pathname} className="max-w-7xl mx-auto w-full h-full">
                        {children}
                    </div>
                </main>

                {/* Bottom Nav for mobile */}
                <BottomNavBar />


            </div>

            {/* Global FAB - Log Work */}
            {!showQuickLog && (
                <div
                    className={`fixed bottom-[calc(56px+var(--safe-bottom)+12px)] right-4 z-40 md:bottom-10 md:right-10 animate-slide-in-right transition-opacity duration-300 ${location.pathname.includes('/records') || location.pathname.includes('/edit') || location.pathname.includes('/new') ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                >
                    <button
                        onClick={() => { setShowQuickLog(true); hapticService.medium(); }}
                        className="w-13 h-13 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-full shadow-[0_10px_30px_rgba(79,70,229,0.5)] flex items-center justify-center text-white active:scale-90 transition-transform hover:scale-110 border border-white/20"
                        title="Zapsat práci (Z)"
                    >
                        <ClockIcon className="w-6 h-6 drop-shadow-md" />
                    </button>
                </div>
            )}

            {/* Global Quick Log Modal */}
            {showQuickLog && (
                <TimeRecordForm
                    onClose={() => setShowQuickLog(false)}
                />
            )}
        </div>
    );
};

export default Layout;
