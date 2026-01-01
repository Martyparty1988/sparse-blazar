import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { ChatMessage, Worker, Project } from '../types';
import { soundService } from '../services/soundService';

const notifyUser = (message: ChatMessage, showToast: (msg: string, type?: any) => void, t: any) => {
    soundService.playMessageReceived();
    if (navigator.vibrate) navigator.vibrate(200);
    const name = message.senderName || 'Systém';
    showToast(t('new_message_from', { name }).replace('{name}', name), 'info');
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification(`New message from ${message.senderName}`, {
            body: message.text,
            icon: '/icon-192.svg'
        });
    }
};

const Chat: React.FC = () => {
    const { user, currentUser } = useAuth();
    const { t, language } = useI18n();
    const { showToast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Mobile-specific state: 'list' shows channels, 'chat' shows message window
    const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
    const [activeChannelId, setActiveChannelId] = useState<string>('general');

    const allProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());
    const workers = useLiveQuery(() => db.workers.toArray());

    // Filter projects based on user role and assignment
    const projects = useMemo(() => {
        if (!allProjects) return [];
        if (user?.role === 'admin') return allProjects;
        // For workers, only show projects where they are assigned
        return allProjects.filter(p => p.workerIds?.includes(currentUser?.workerId || -1));
    }, [allProjects, user?.role, currentUser?.workerId]);

    const CHAT_LIMIT = 50;

    const handleChannelSelect = (channelId: string) => {
        setActiveChannelId(channelId);
        setMobileView('chat'); // Switch to chat window on mobile
    };

    const handleBackToList = () => {
        setMobileView('list'); // Switch back to channel list on mobile
    };

    useEffect(() => {
        const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [messages, mobileView]);

    useEffect(() => {
        if (currentUser?.workerId) {
            firebaseService.requestNotificationPermission(currentUser.workerId);
        }
    }, [currentUser?.workerId]);

    useEffect(() => {
        if (!firebaseService.isReady) return;
        const path = `chat/${activeChannelId}`;
        setMessages([]);

        const unsubscribe = firebaseService.subscribe(path, (data) => {
            if (data) {
                const messageList: ChatMessage[] = Object.values(data);
                messageList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                const lastMsg = messageList[messageList.length - 1];

                setMessages(prev => {
                    if (lastMsg && lastMsg.senderId !== currentUser?.workerId && lastMsg.senderId !== -1) {
                        const isNewest = prev.length === 0 || !prev.find(m => m.id === lastMsg.id);
                        const msgTime = new Date(lastMsg.timestamp).getTime();
                        if (isNewest && (Date.now() - msgTime < 10000)) {
                            notifyUser(lastMsg, showToast, t);
                        }
                    }
                    return messageList.slice(-CHAT_LIMIT);
                });
            } else {
                setMessages([]);
            }
        });

        // Typing Status Subscription
        const unsubTyping = firebaseService.subscribeTypingStatus(activeChannelId, (data) => {
            if (!currentUser?.workerId) return;
            const names = Object.entries(data)
                .filter(([uid]) => Number(uid) !== currentUser.workerId) // Don't show myself
                // Filter out stale typing (older than 5s) - optional but good for cleanup
                .map(([, info]) => info.name);
            setTypingUsers(names);
        });

        return () => {
            unsubscribe();
            unsubTyping();
        };
    }, [activeChannelId, currentUser?.workerId, showToast, t]);

    const handleTyping = () => {
        if (!currentUser?.workerId) return;

        firebaseService.setTypingStatus(activeChannelId, currentUser.workerId, currentUser.username || 'User', true);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            firebaseService.setTypingStatus(activeChannelId, currentUser.workerId, currentUser.username || 'User', false);
        }, 3000);
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        setIsSending(true);

        const newMessage: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: inputText.trim(),
            senderId: currentUser?.workerId || -1,
            senderName: currentUser?.username || 'Admin',
            timestamp: new Date().toISOString(),
            channelId: activeChannelId
        };

        try {
            await firebaseService.setData(`chat/${activeChannelId}/${newMessage.id}`, newMessage);
            // Clear typing status immediately on send
            if (currentUser?.workerId) {
                firebaseService.setTypingStatus(activeChannelId, currentUser.workerId, currentUser.username || 'User', false);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            }
            setInputText('');
            soundService.playClick();
        } catch (error) {
            showToast("Chyba při odesílání", "error");
        } finally {
            setIsSending(false);
        }
    };

    const isMe = (msg: ChatMessage) =>
        msg.senderId === currentUser?.workerId ||
        (msg.senderId === -1 && user?.role === 'admin');

    const groupedMessages = useMemo(() => {
        const groups: { date: string, items: { senderId: number, name: string, messages: ChatMessage[] }[] }[] = [];
        messages.forEach((msg) => {
            const dateObj = new Date(msg.timestamp);
            const dateStr = dateObj.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            let dateLabel = dateStr;
            if (dateStr === new Date().toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })) dateLabel = t('today');

            let dateGroup = groups.find(g => g.date === dateLabel);
            if (!dateGroup) {
                dateGroup = { date: dateLabel, items: [] };
                groups.push(dateGroup);
            }
            const lastItemGroup = dateGroup.items[dateGroup.items.length - 1];
            if (lastItemGroup && lastItemGroup.senderId === msg.senderId) {
                lastItemGroup.messages.push(msg);
            } else {
                dateGroup.items.push({ senderId: msg.senderId, name: msg.senderName, messages: [msg] });
            }
        });
        return groups;
    }, [messages, language, t]);

    const activeProjectName = useMemo(() => {
        if (activeChannelId === 'general') return t('general');
        if (activeChannelId.startsWith('dm_')) {
            const parts = activeChannelId.split('_');
            const otherId = parts[1] === String(currentUser?.workerId || -1) ? parts[2] : parts[1];
            return workers?.find(w => String(w.id) === otherId)?.name || 'Soukromý chat';
        }
        return projects?.find(p => `project_${p.id}` === activeChannelId)?.name || 'Project';
    }, [activeChannelId, projects, workers, t, currentUser]);

    return (
        <div className="fixed inset-x-0 top-16 bottom-16 md:bottom-0 md:static flex flex-col md:flex-row h-full max-w-7xl mx-auto overflow-hidden bg-[#0a0c1a]">
            {/* Sidebar (List View) */}
            <div className={`w-full md:w-80 flex-col shrink-0 h-full border-r border-white/5 bg-black/20 backdrop-blur-2xl ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
                <div className="p-8 border-b border-white/5">
                    <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase relative">
                        {t('channels')}
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_currentColor]"></span>
                    </h1>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1 custom-scrollbar">
                    <button
                        onClick={() => handleChannelSelect('general')}
                        className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 transition-all duration-300 group ${activeChannelId === 'general' ? 'bg-indigo-600 shadow-[0_10px_20px_-5px_rgba(79,70,229,0.3)]' : 'hover:bg-white/5'}`}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-colors ${activeChannelId === 'general' ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white'}`}>#</div>
                        <div className="text-left">
                            <span className={`block text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${activeChannelId === 'general' ? 'text-indigo-200' : 'text-slate-600'}`}>Public</span>
                            <span className={`font-bold text-sm ${activeChannelId === 'general' ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{t('general')}</span>
                        </div>
                    </button>

                    <div className="pt-8 pb-3 px-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] opacity-60">Projekty</div>
                    {projects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => handleChannelSelect(`project_${p.id}`)}
                            className={`w-full p-3 rounded-[1.5rem] flex items-center gap-3 transition-all duration-300 group ${activeChannelId === `project_${p.id}` ? 'bg-indigo-600' : 'hover:bg-white/5'}`}
                        >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs transition-colors ${activeChannelId === `project_${p.id}` ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500 group-hover:text-white'}`}>P</div>
                            <div className={`text-left font-bold truncate text-sm ${activeChannelId === `project_${p.id}` ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{p.name}</div>
                        </button>
                    ))}

                    <div className="pt-8 pb-3 px-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] opacity-60">Kolegové</div>
                    {workers?.filter(w => w.id !== currentUser?.workerId).map(w => {
                        const dmId = `dm_${[currentUser?.workerId || -1, w.id].sort((a, b) => Number(a) - Number(b)).join('_')}`;
                        return (
                            <button
                                key={w.id}
                                onClick={() => handleChannelSelect(dmId)}
                                className={`w-full p-3 rounded-[1.5rem] flex items-center gap-3 transition-all duration-300 group ${activeChannelId === dmId ? 'bg-indigo-600' : 'hover:bg-white/5'}`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-[10px] bg-cover bg-center shadow-inner relative overflow-hidden`}
                                    style={{ backgroundColor: w.color || '#334155' }}
                                >
                                    <div className="absolute inset-0 bg-black/10" />
                                    <span className="relative z-10 text-white drop-shadow-md">{w.name.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <div className={`text-left font-bold truncate text-sm transition-colors ${activeChannelId === dmId ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{w.name}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chat Area (Chat Window View) */}
            <div className={`flex-1 flex flex-col h-full relative overflow-hidden ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
                <div className="absolute inset-0 bg-[#020617]" />
                <div className="absolute -top-[20%] -right-[20%] w-[80%] h-[80%] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

                {/* Header */}
                <div className="relative z-10 px-6 py-5 border-b border-white/5 bg-black/20 backdrop-blur-xl flex items-center gap-6 shrink-0 shadow-lg">
                    <button
                        onClick={handleBackToList}
                        className="md:hidden p-3 -ml-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all active:scale-95"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1 overflow-hidden">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter truncate leading-none mb-1">{activeProjectName}</h2>
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgb(16,185,129)]"></span>
                            <span className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.2em]">{t('active_now') || 'ONLINE'}</span>
                        </div>
                    </div>

                    {/* Notification Enable Button */}
                    {Notification.permission !== 'granted' && (
                        <button
                            onClick={() => currentUser?.workerId && firebaseService.requestNotificationPermission(currentUser.workerId)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-2xl hover:scale-105 transition-all shadow-lg"
                            title="Zapnout notifikace"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                        </button>
                    )}
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 custom-scrollbar relative z-10">
                    {groupedMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center animate-fade-in opacity-50 space-y-4">
                            <div className="w-24 h-24 rounded-full bg-white/5 border border-white/5 flex items-center justify-center italic font-black text-6xl text-slate-700">?</div>
                            <p className="font-black uppercase tracking-[0.2em] text-xs text-slate-600">Zatím žádné zprávy</p>
                        </div>
                    ) : (
                        groupedMessages.map(group => (
                            <div key={group.date} className="space-y-6">
                                <div className="flex items-center gap-4 py-2 opacity-60">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em] bg-black/20 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">{group.date}</span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                                </div>
                                {group.items.map((item, idx) => {
                                    const senderMe = isMe({ senderId: item.senderId } as any);
                                    return (
                                        <div key={idx} className={`flex gap-4 ${senderMe ? 'flex-row-reverse' : 'flex-row'} animate-slide-up group/msg max-w-4xl ${senderMe ? 'ml-auto' : 'mr-auto'}`}>
                                            <div
                                                className="w-10 h-10 rounded-[1rem] flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg border-2 border-white/5 bg-cover bg-center"
                                                style={{ backgroundColor: workers?.find(w => w.id === item.senderId)?.color || '#3b82f6' }}
                                            >
                                                {item.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className={`flex flex-col space-y-1 ${senderMe ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                                                {!senderMe && <span className="text-[9px] font-black text-slate-400 uppercase px-1 tracking-wider opacity-0 group-hover/msg:opacity-100 transition-opacity">{item.name}</span>}
                                                {item.messages.map((msg, msgIdx) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`relative transition-all ${msg.isSystem ? 'w-full flex justify-center py-4' : ''}`}
                                                    >
                                                        {msg.isSystem ? (
                                                            <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-full flex items-center gap-3 max-w-[90%] backdrop-blur-sm shadow-xl">
                                                                <span className="text-lg">📢</span>
                                                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide text-center leading-relaxed">
                                                                    {msg.text}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className={`px-6 py-4 rounded-[1.5rem] text-sm leading-relaxed shadow-lg backdrop-blur-sm transition-all hover:scale-[1.01] relative ${senderMe
                                                                    ? 'bg-indigo-600 text-white rounded-tr-sm hover:bg-indigo-500 shadow-indigo-900/20'
                                                                    : 'bg-white/10 text-slate-200 rounded-tl-sm hover:bg-white/15 shadow-black/20'}`}
                                                            >
                                                                {msg.text}
                                                                <span className={`text-[9px] font-bold uppercase tracking-wider opacity-40 block text-right mt-1 ${senderMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                    <div className="absolute bottom-24 left-8 text-xs font-bold text-indigo-400 animate-pulse flex items-center gap-2">
                        <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                        {typingUsers.join(', ')} {typingUsers.length === 1 ? 'píše...' : 'píší...'}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-6 md:p-8 bg-black/20 backdrop-blur-xl border-t border-white/5 shrink-0 relative z-20">
                    <form onSubmit={handleSend} className="flex gap-4 max-w-5xl mx-auto relative">
                        <input
                            type="text"
                            value={inputText}
                            onChange={e => { setInputText(e.target.value); handleTyping(); }}
                            placeholder={t('type_message')}
                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2rem] px-8 py-5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-sm tracking-wide"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isSending}
                            className="group bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed text-white w-16 h-auto md:w-auto md:px-10 rounded-[2rem] font-black uppercase tracking-[0.2em] active:scale-95 transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center overflow-hidden relative"
                        >
                            <span className="hidden md:inline relative z-10">Odeslat</span>
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 md:group-hover:opacity-20 transition-opacity" />
                            <svg className="w-6 h-6 md:hidden relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;
