import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlusIcon from './icons/PlusIcon';
import ClockIcon from './icons/ClockIcon';
import MapIcon from './icons/MapIcon';
import ImageIcon from './icons/ImageIcon';

const FloatingActionMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const toggleMenu = () => {
        // Basic haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(10);
        setIsOpen(!isOpen);
    };

    const menuItems = [
        {
            label: 'Zapsat práci',
            icon: <ClockIcon className="w-6 h-6" />,
            action: () => navigate('/records'),
            color: 'bg-emerald-500'
        },
        {
            label: 'Check-in',
            icon: <MapIcon className="w-6 h-6" />,
            action: () => navigate('/attendance'), // Or direct check-in logic later
        }

    ];

    return (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 md:hidden flex flex-col items-end gap-3 pointer-events-none">

            {/* Menu Items */}
            <div className={`flex flex-col items-end gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                {menuItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <span className="text-xs font-bold bg-black/80 text-white px-2 py-1 rounded-lg backdrop-blur-md shadow-sm">
                            {item.label}
                        </span>
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                item.action();
                            }}
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg shadow-black/30 active:scale-90 transition-transform ${item.color}`}
                        >
                            {item.icon}
                        </button>
                    </div>
                ))}
            </div>

            {/* Main Toggle Button */}
            <button
                onClick={toggleMenu}
                className={`w-14 h-14 rounded-[1.2rem] bg-gradient-to-br from-[var(--color-primary)] to-indigo-600 text-white shadow-[0_8px_30px_rgba(99,102,241,0.4)] flex items-center justify-center pointer-events-auto active:scale-95 transition-all duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
            >
                <PlusIcon className="w-8 h-8" />
            </button>

            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[-1] pointer-events-auto"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default FloatingActionMenu;
