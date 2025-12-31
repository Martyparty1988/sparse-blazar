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

        return () => firebaseService.unsubscribe(path);
    }, [activeChannelId, currentUser?.workerId, showToast, t]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        setIsSending(true);

        const newMessage: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: inputText.trim(),
            senderId: currentUser?.workerId || -1,
            senderName: currentUser?.name || 'Admin',
            timestamp: new Date().toISOString(),
            channelId: activeChannelId
        };

        try {
            await firebaseService.setData(`chat/${activeChannelId}/${newMessage.id}`, newMessage);
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
            <div className={`w-full md:w-80 flex-col shrink-0 h-full border-r border-white/5 bg-[#111324] ${mobileView === 'list' ? 'flex' : 'hidden md:flex'}`}>
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <h1 className="text-xl font-black text-white italic tracking-tighter uppercase">{t('channels')}</h1>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
                    <button
                        onClick={() => handleChannelSelect('general')}
                        className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 ${activeChannelId === 'general' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}
                    >
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-bold">#</div>
                        <div className="text-left"><span className="block text-[10px] font-black uppercase opacity-50">Public</span><span className="font-bold">{t('general')}</span></div>
                    </button>

                    <div className="pt-4 pb-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-white/5 mt-4">Moje Projekty</div>
                    {projects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => handleChannelSelect(`project_${p.id}`)}
                            className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 ${activeChannelId === `project_${p.id}` ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}
                        >
                            <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-bold">P</div>
                            <div className="text-left font-bold truncate">#{p.name}</div>
                        </button>
                    ))}

                    <div className="pt-4 pb-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest border-t border-white/5 mt-4">Kolegové</div>
                    {workers?.filter(w => w.id !== currentUser?.workerId).map(w => {
                        const dmId = `dm_${[currentUser?.workerId || -1, w.id].sort((a, b) => Number(a) - Number(b)).join('_')}`;
                        return (
                            <button
                                key={w.id}
                                onClick={() => handleChannelSelect(dmId)}
                                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 ${activeChannelId === dmId ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-slate-400 border border-transparent hover:bg-white/10'}`}
                            >
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs" style={{ backgroundColor: w.color || '#334155' }}>{w.name.substring(0, 2).toUpperCase()}</div>
                                <div className="text-left font-bold truncate">{w.name}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Chat Area (Chat Window View) */}
            <div className={`flex-1 flex flex-col h-full bg-[#0a0c1a] relative ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
                {/* Header */}
                <div className="px-4 py-4 md:px-8 border-b border-white/5 bg-[#111324]/80 backdrop-blur-md flex items-center gap-4 shrink-0">
                    <button
                        onClick={handleBackToList}
                        className="md:hidden p-2 -ml-2 text-indigo-400 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1 overflow-hidden">
                        <h2 className="text-lg md:text-xl font-black text-white italic uppercase tracking-tight truncate leading-tight">{activeProjectName}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aktivní nyní</span>
                        </div>
                    </div>

                    {/* Notification Enable Button */}
                    {Notification.permission !== 'granted' && (
                        <button
                            onClick={() => currentUser?.workerId && firebaseService.requestNotificationPermission(currentUser.workerId)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 text-[10px] font-black uppercase hover:bg-indigo-600 transition-all hover:text-white"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            Zapnout notifikace
                        </button>
                    )}
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar bg-gradient-to-b from-[#0a0c1a] to-[#111324]/20">
                    {groupedMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 animate-fade-in opacity-50">
                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center mb-4 italic font-black text-2xl">?</div>
                            <p className="font-bold uppercase tracking-widest text-xs">Zatím žádné zprávy</p>
                        </div>
                    ) : (
                        groupedMessages.map(group => (
                            <div key={group.date} className="space-y-6">
                                <div className="flex items-center gap-4 py-2 opacity-50">
                                    <div className="h-px flex-1 bg-white/5"></div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.date}</span>
                                    <div className="h-px flex-1 bg-white/5"></div>
                                </div>
                                {group.items.map((item, idx) => {
                                    const senderMe = isMe({ senderId: item.senderId } as any);
                                    return (
                                        <div key={idx} className={`flex gap-3 ${senderMe ? 'flex-row-reverse' : 'flex-row'} animate-slide-up`}>
                                            <div
                                                className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-lg"
                                                style={{ backgroundColor: workers?.find(w => w.id === item.senderId)?.color || '#3b82f6' }}
                                            >
                                                {item.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className={`flex flex-col space-y-1 max-w-[85%] md:max-w-[70%] ${senderMe ? 'items-end' : 'items-start'}`}>
                                                {!senderMe && <span className="text-[9px] font-black text-slate-500 uppercase px-1">{item.name}</span>}
                                                {item.messages.map(msg => (
                                                    <div
                                                        key={msg.id}
                                                        className={`px-4 py-2.5 rounded-2xl text-[13px] font-medium shadow-md transition-all ${senderMe
                                                            ? 'bg-indigo-600 text-white rounded-tr-none hover:bg-indigo-500'
                                                            : 'bg-white/10 text-slate-200 rounded-tl-none hover:bg-white/15'}`}
                                                    >
                                                        {msg.text}
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

                {/* Input Area */}
                <div className="p-4 md:p-8 bg-[#111324] border-t border-white/5 shrink-0">
                    <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
                        <input
                            type="text"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder={t('type_message')}
                            className="flex-1 bg-black/30 border border-white/5 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium text-sm"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isSending}
                            className="bg-indigo-600 disabled:opacity-30 text-white w-14 h-14 md:px-8 md:w-auto rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center"
                        >
                            <span className="hidden md:inline">Odeslat</span>
                            <svg className="w-6 h-6 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
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
