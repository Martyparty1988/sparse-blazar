
import React from 'react';
import { useI18n } from '../contexts/I18nContext';
import TrashIcon from './icons/TrashIcon';

interface ConfirmationModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'danger'
}) => {
  const { t } = useI18n();

  const getButtonStyles = () => {
    switch (variant) {
      case 'danger': return 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40 text-white';
      case 'warning': return 'bg-amber-500 hover:bg-amber-400 shadow-amber-900/40 text-black';
      default: return 'bg-sky-500 hover:bg-sky-400 shadow-sky-900/40 text-black';
    }
  };

  const getIconStyles = () => {
    switch (variant) {
      case 'danger': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'warning': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onCancel}></div>
      <div className="relative w-full max-h-[90vh] overflow-y-auto md:max-w-md p-10 bg-slate-900/90 backdrop-blur-2xl rounded-t-[3rem] md:rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.7)] border-t md:border border-white/20 transform transition-all scale-100 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:pb-10">
        <div className="flex flex-col items-center text-center">
          <div className={`p-6 rounded-full mb-8 border-2 ${getIconStyles()} shadow-inner`}>
            <TrashIcon className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter leading-tight italic">{title}</h2>
          <p className="text-lg text-gray-400 mb-10 leading-relaxed font-medium">
            {message}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={onCancel}
              className="flex-1 px-8 py-4 bg-white/5 text-white font-black rounded-2xl hover:bg-white/10 transition-all border border-white/10 uppercase tracking-widest text-xs active:scale-95"
            >
              {cancelLabel || t('cancel')}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-8 py-4 font-black rounded-2xl transition-all shadow-2xl uppercase tracking-widest text-xs active:scale-95 ${getButtonStyles()}`}
            >
              {confirmLabel || t('delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
