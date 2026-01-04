
import React from 'react';
import PlusIcon from './icons/PlusIcon';
import ClockIcon from './icons/ClockIcon';

interface FloatingActionButtonProps {
  onClick: () => void;
  variant?: 'add' | 'log';
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, variant = 'add' }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-[calc(80px+var(--safe-bottom)+20px)] right-6 md:bottom-12 md:right-12 z-50 p-5 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-2xl hover:scale-110 active:scale-90 transition-all border border-white/20 animate-float group"
      aria-label={variant === 'add' ? 'Add new item' : 'Log work'}
    >
      <div className="relative">
        {variant === 'add' ? (
          <PlusIcon className="w-8 h-8" />
        ) : (
          <ClockIcon className="w-8 h-8" />
        )}
        <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md text-white text-sm font-bold rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {variant === 'add' ? 'Nový záznam' : 'Zapsat práci'}
        </span>
      </div>
    </button>
  );
};

export default FloatingActionButton;