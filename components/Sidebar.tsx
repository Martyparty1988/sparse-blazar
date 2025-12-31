
import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import DashboardIcon from './icons/DashboardIcon';
import ProjectsIcon from './icons/ProjectsIcon';
import SettingsIcon from './icons/SettingsIcon';
import ClockIcon from './icons/ClockIcon';
import ChatIcon from './icons/ChatIcon';
import WorkersIcon from './icons/WorkersIcon';
import ChartBarIcon from './icons/ChartBarIcon';
import DocumentTextIcon from './icons/DocumentTextIcon';
import WrenchIcon from './icons/WrenchIcon';
import CalendarIcon from './icons/CalendarIcon';
import BrainIcon from './icons/BrainIcon';

const Sidebar: React.FC = () => {
    const { t } = useI18n();
    const { user, logout } = useAuth();

    const navItems = [
        { to: "/", title: t('dashboard'), icon: <DashboardIcon />, roles: ['admin', 'user'] },
        { to: "/projects", title: t('projects'), icon: <ProjectsIcon />, roles: ['admin', 'user'] },
        { to: "/workers", title: t('workers'), icon: <WorkersIcon />, roles: ['admin'] },
        { to: "/records", title: t('work_log'), icon: <ClockIcon />, roles: ['admin', 'user'] },
        { to: "/reports", title: t('reports'), icon: <DocumentTextIcon />, roles: ['admin'] },
        { to: "/stats", title: 'Statistiky', icon: <ChartBarIcon />, roles: ['admin'] },
        { to: "/field-plans", title: 'Plány v terénu', icon: <CalendarIcon />, roles: ['admin', 'user'] },
        { to: "/chat", title: "Firemní chat", icon: <ChatIcon />, roles: ['admin', 'user'] },
        { to: "/tools", title: 'Nářadí', icon: <WrenchIcon />, roles: ['admin'] },
    ];

    const adminItems = [
         { to: "/settings", title: t('settings'), icon: <SettingsIcon />, roles: ['admin'] },
         { to: "/payroll", title: "Mzdy", icon: <BrainIcon />, roles: ['admin'] },
    ];

    const getVisibleItems = (items: any[]) => items.filter(item => item.roles.includes(user?.role || 'user'));

    return (
        <aside className="hidden md:flex flex-col w-64 bg-[#111324] text-white fixed h-full">
            <div className="flex items-center justify-center h-16 border-b border-white/5">
                 <Link to="/" className="text-2xl font-black italic tracking-tighter text-white">MST<span className="text-[var(--color-accent)]">.</span></Link>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-2">
                <p className="px-4 pt-4 pb-2 text-xs font-bold text-slate-400 uppercase">Hlavní</p>
                {getVisibleItems(navItems).map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end // Use end for exact matching on "/"
                        className={({ isActive }) =>
                            `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                                isActive
                                    ? 'bg-[var(--color-primary)]/80 text-white shadow-lg'
                                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            }`
                        }
                    >
                        <div className="w-6 h-6 mr-3">{item.icon}</div>
                        <span>{item.title}</span>
                    </NavLink>
                ))}
                
                {user?.role === 'admin' && (
                    <>
                        <p className="px-4 pt-4 pb-2 text-xs font-bold text-slate-400 uppercase">Administrace</p>
                        {getVisibleItems(adminItems).map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                                        isActive
                                            ? 'bg-[var(--color-primary)]/80 text-white shadow-lg'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    }`
                                }
                            >
                                <div className="w-6 h-6 mr-3">{item.icon}</div>
                                <span>{item.title}</span>
                            </NavLink>
                        ))}
                    </>
                )}
            </nav>
            <div className="px-4 py-4 border-t border-white/5">
                <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-slate-600 mr-3">
                        {/* You can add user avatar here */}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{user?.name}</p>
                        <button onClick={logout} className="text-xs text-slate-400 hover:text-red-500">Odhlásit se</button>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
