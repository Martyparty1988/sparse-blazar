import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { ChatMessage, Worker, Project } from '../types';
import { soundService } from '../services/soundService';
import { safety } from '../services/safetyService';
import ChatDebug from './ChatDebug'; // Debug panel

const IS_DEV = import.meta.env.DEV;

const notifyUser = (message: ChatMessage, showToast: (msg: string, type?: any) => void, t: any) => {
    soundService.playMessageReceived();
    safety.vibrate(200);
    const name = message.senderName || 'Systém';
    showToast(t('new_message_from', { name }).replace('{name}', name), 'info');

    // Increment badge
    if (safety.has('navigator') && 'setAppBadge' in navigator) {
        (navigator as any).setAppBadge().catch(() => { });
    }

    if (safety.notification && safety.notification.permission === 'granted' && document.hidden) {
        try {
            new safety.notification(`${message.senderName}`, {
                body: message.text,
                icon: '/icon-192.svg',
                tag: 'chat-msg'
            } as any);
        } catch (e) { console.error('Notification failed', e); }
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
    const [seenStatus, setSeenStatus] = useState<Record<string, string>>({});
    const [replyToMessage, setReplyToMessage] = useState<ChatMessage | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Mobile-specific state: 'list' shows channels, 'chat' shows message window
    const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
    const [activeChannelId, setActiveChannelId] = useState<string>('general');
    const [unreads, setUnreads] = useState<Record<string, any>>({});
    const [keyboardOffset, setKeyboardOffset] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const chatFooterRef = useRef<HTMLDivElement>(null);

    const allProjects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());
    const workers = useLiveQuery(() => db.workers.toArray());

    useEffect(() => {
        if (!currentUser?.workerId || !firebaseService.isReady) return;
        return firebaseService.subscribe(`unread/${currentUser.workerId}`, (data) => {
            setUnreads(data || {});
        });
    }, [currentUser?.workerId]);

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

    // Keyboard & Viewport Logic (iOS Support)
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleViewportChange = () => {
            const viewport = window.visualViewport!;
            const offset = window.innerHeight - viewport.height - viewport.offsetTop;
            setKeyboardOffset(Math.max(0, offset));

            // Auto-scroll to bottom on keyboard open if was already at bottom
            if (offset > 0) {
                const container = scrollRef.current;
                if (container) {
                    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                    if (isNearBottom) {
                        setTimeout(() => {
                            container.scrollTop = container.scrollHeight;
                        }, 100);
                    }
                }
            }
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', handleViewportChange);
        return () => {
            window.visualViewport?.removeEventListener('resize', handleViewportChange);
            window.visualViewport?.removeEventListener('scroll', handleViewportChange);
        };
    }, []);

    // Smart Auto-scroll Logic
    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        if (isNearBottom) {
            container.scrollTop = container.scrollHeight;
        }
    }, [messages, mobileView]);

    useEffect(() => {
        if (currentUser?.workerId) {
            firebaseService.requestNotificationPermission(currentUser.workerId).catch(() => {
                // Silently ignore notification permission errors
            });
        }
    }, [currentUser?.workerId]);

    useEffect(() => {
        let alive = true;

        async function initChat() {
            if (!firebaseService || !firebaseService.isReady || !activeChannelId) return;
            const path = `chat/${activeChannelId}`;
            setMessages([]);

            let unsubscribe: (() => void) | undefined;
            let unsubTyping: (() => void) | undefined;
            let unsubSeen: (() => void) | undefined;

            try {
                unsubscribe = firebaseService.subscribe(path, (data) => {
                    if (!alive) return;
                    if (data) {
                        const messageList: ChatMessage[] = Object.values(data);
                        messageList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                        const lastMsg = messageList[messageList.length - 1];

                        setMessages(prev => {
                            if (lastMsg && currentUser?.workerId && lastMsg.senderId !== currentUser?.workerId && lastMsg.senderId !== -1) {
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
                unsubTyping = firebaseService.subscribeTypingStatus(activeChannelId, (data) => {
                    if (!alive || !currentUser?.workerId || !data) return;
                    const names = Object.entries(data)
                        .filter(([uid]) => Number(uid) !== currentUser.workerId)
                        .map(([, info]) => info.name);
                    setTypingUsers(names);
                });

                // Seen Status Subscription
                unsubSeen = firebaseService.subscribe(`chat/${activeChannelId}/seen`, (data) => {
                    if (!alive || !data) return;
                    setSeenStatus(data);
                });

                // Mark as seen, clear badge and unread RTDB node
                if (currentUser?.workerId) {
                    firebaseService.markAsSeen(activeChannelId, currentUser.workerId).catch(() => { });
                    firebaseService.updateBadge(0);
                    firebaseService.setData(`unread/${currentUser.workerId}/${activeChannelId}`, null).catch(() => { });
                }
            } catch (err) {
                console.error('Chat subscriptions failed:', err);
            }

            // Store cleanups in a way that we can call them later if needed,
            // but the main cleanup is in the return function
            return () => {
                if (unsubscribe) unsubscribe();
                if (unsubTyping) unsubTyping();
                if (unsubSeen) unsubSeen();
            };
        }

        const cleanupPromise = initChat();

        return () => {
            alive = false;
            // Execute cleanup if initChat returned a cleanup function
            cleanupPromise.then(cleanup => cleanup && cleanup());
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
            channelId: activeChannelId,
            replyTo: replyToMessage?.id
        };

        try {
            await firebaseService.setData(`chat/${activeChannelId}/${newMessage.id}`, newMessage);
            // Clear typing status immediately on send
            if (currentUser?.workerId) {
                firebaseService.setTypingStatus(activeChannelId, currentUser.workerId, currentUser.username || 'User', false);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            }
            setInputText('');
            setReplyToMessage(null);
            soundService.playClick();
        } catch (error) {
            showToast("Chyba při odesílání", "error");
        } finally {
            setIsSending(false);
        }
    };

    const handleToggleReaction = async (messageId: string, emoji: string) => {
        if (!currentUser?.workerId) return;
        try {
            await firebaseService.toggleReaction(activeChannelId, messageId, emoji, currentUser.workerId);
            soundService.playClick();
        } catch (error) {
            console.error(error);
        }
    };

    const isMe = (msg: ChatMessage) =>
        msg.senderId === currentUser?.workerId ||
        (msg.senderId === -1 && user?.role === 'admin');

    const groupedMessages = useMemo(() => {
        const groups: { date: string, items: { senderId: number, name: string, messages: ChatMessage[] }[] }[] = [];
        messages.forEach((msg) => {
            if (!msg.timestamp) return; // Skip messages without timestamp
            const dateObj = new Date(msg.timestamp);
            if (isNaN(dateObj.getTime())) return; // Skip invalid dates

            const dateStr = dateObj.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            let dateLabel = dateStr;
            const todayStr = new Date().toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            if (dateStr === todayStr) dateLabel = t('today');

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
        <div
            className="fixed inset-0 md:static flex flex-col md:flex-row max-w-7xl mx-auto overflow-hidden bg-[#0a0c1a]"
            style={{
                top: 'calc(64px + var(--safe-top))',
                height: 'calc(100dvh - 64px - var(--safe-top))'
            }}
        >
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
                        className={`w-full p-4 rounded-[1.5rem] flex items-center gap-4 transition-all duration-300 group ${activeChannelId === 'general' ? 'bg-indigo-600 shadow-[0_10px_20px_-5px_rgba(79,70,229,0.3)]' : 'hover:bg-white/5'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-colors ${activeChannelId === 'general' ? 'bg-white text-indigo-600' : 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-white'}`}>#</div>
                        <div className="text-left flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                                <span className={`block text-[8px] font-black uppercase tracking-[0.2em] mb-0.5 ${activeChannelId === 'general' ? 'text-indigo-200' : 'text-slate-600'}`}>Public</span>
                                {unreads['general'] && activeChannelId !== 'general' && (
                                    <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
                                )}
                            </div>
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
                            <div className={`text-left font-bold truncate text-sm flex-1 ${activeChannelId === `project_${p.id}` ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{p.name}</div>
                            {unreads[`project_${p.id}`] && activeChannelId !== `project_${p.id}` && (
                                <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse mr-2" />
                            )}
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
                                    <span className="relative z-10 text-white drop-shadow-md">{(w?.name || 'N/A').substring(0, 2).toUpperCase()}</span>
                                </div>
                                <div className={`text-left font-bold truncate text-sm flex-1 transition-colors ${activeChannelId === dmId ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>{w.name}</div>
                                {unreads[dmId] && activeChannelId !== dmId && (
                                    <div className="w-4 h-4 rounded-full bg-rose-500 text-[8px] font-black text-white flex items-center justify-center animate-bounce mr-2">1</div>
                                )}
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
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-3 md:p-6 space-y-6 custom-scrollbar relative z-10 overscroll-contain pb-8"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
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
                                        <div key={idx} className={`flex gap-2 ${senderMe ? 'flex-row-reverse' : 'flex-row'} animate-slide-up group/msg max-w-[85%] md:max-w-4xl ${senderMe ? 'ml-auto' : 'mr-auto'}`}>
                                            <div
                                                className="w-8 h-8 rounded-[0.8rem] flex items-center justify-center text-[9px] font-black text-white shrink-0 shadow-lg border-2 border-white/5 bg-cover bg-center"
                                                style={{ backgroundColor: workers?.find(w => w.id === item.senderId)?.color || '#3b82f6' }}
                                            >
                                                {(item?.name || 'User').substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className={`flex flex-col space-y-0.5 ${senderMe ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
                                                {!senderMe && <span className="text-[9px] font-black text-slate-400 uppercase px-1 tracking-wider opacity-0 group-hover/msg:opacity-100 transition-opacity">{item.name}</span>}
                                                {item.messages.map((msg, msgIdx) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`relative transition-all group/bubble ${msg.isSystem ? 'w-full flex justify-center py-4' : ''}`}
                                                    >
                                                        {msg.isSystem ? (
                                                            <div className="bg-indigo-500/10 border border-indigo-500/20 px-6 py-3 rounded-full flex items-center gap-3 max-w-[90%] backdrop-blur-sm shadow-xl animate-fade-in">
                                                                <span className="text-lg">📢</span>
                                                                <span className="text-xs font-bold text-indigo-300 uppercase tracking-wide text-center leading-relaxed">
                                                                    {msg.text}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="relative">
                                                                {/* Reaction Toolbar (appearing on hover/context) */}
                                                                <div className={`absolute -top-10 z-[100] flex gap-2 p-2 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl opacity-0 scale-90 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:scale-100 group-hover/bubble:pointer-events-auto transition-all ${senderMe ? 'right-0' : 'left-0'}`}>
                                                                    {['👍', '❤️', '🔥', '👏', '😂', '😮'].map(emoji => (
                                                                        <button
                                                                            key={emoji}
                                                                            onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                            className="w-8 h-8 flex items-center justify-center hover:scale-125 transition-transform text-lg"
                                                                        >
                                                                            {emoji}
                                                                        </button>
                                                                    ))}
                                                                    <div className="w-px h-6 bg-white/10 mx-1"></div>
                                                                    <button
                                                                        onClick={() => setReplyToMessage(msg)}
                                                                        className="px-3 text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors"
                                                                    >
                                                                        Odpovědět
                                                                    </button>
                                                                </div>

                                                                <div
                                                                    className={`px-3.5 py-2 rounded-2xl text-[15px] leading-snug shadow-lg backdrop-blur-sm transition-all hover:scale-[1.01] relative max-w-[78%] break-words ${senderMe
                                                                        ? 'bg-indigo-600 text-white rounded-tr-sm hover:bg-indigo-500 shadow-indigo-900/20'
                                                                        : 'bg-white/10 text-slate-200 rounded-tl-sm hover:bg-white/15 shadow-black/20'}`}
                                                                >
                                                                    {msg.replyTo && (
                                                                        <div className="mb-3 p-3 bg-black/20 rounded-xl border-l-4 border-white/20 text-xs opacity-70 italic truncate">
                                                                            {messages.find(m => m.id === msg.replyTo)?.text || 'Původní zpráva smazána'}
                                                                        </div>
                                                                    )}
                                                                    {msg.text}
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest opacity-40 block text-right mt-1 ${senderMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                                        {msg.timestamp && !isNaN(new Date(msg.timestamp).getTime())
                                                                            ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                                            : '...'}
                                                                    </span>
                                                                </div>

                                                                {/* Display Reactions */}
                                                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                                                    <div className={`flex flex-wrap gap-1 mt-1.5 ${senderMe ? 'justify-end' : 'justify-start'}`}>
                                                                        {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                                                                            const reactedByMe = userIds.includes(currentUser?.workerId || -1);
                                                                            return (
                                                                                <button
                                                                                    key={emoji}
                                                                                    onClick={() => handleToggleReaction(msg.id, emoji)}
                                                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black transition-all ${reactedByMe ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'}`}
                                                                                >
                                                                                    <span className="text-xs">{emoji}</span>
                                                                                    <span>{userIds.length}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* Seen Status Avatars (Only for the last message in a sequence or globally last) */}
                                                                {msgIdx === item.messages.length - 1 && (
                                                                    <div className={`flex items-center gap-1 mt-1.5 ${senderMe ? 'justify-end' : 'justify-start'}`}>
                                                                        {Object.entries(seenStatus)
                                                                            .filter(([uid, timestamp]) => {
                                                                                const userIdNum = Number(uid);
                                                                                if (userIdNum === (currentUser?.workerId || -1)) return false;
                                                                                const sTime = new Date(timestamp).getTime();
                                                                                const mTime = new Date(msg.timestamp).getTime();
                                                                                if (isNaN(sTime) || isNaN(mTime)) return false;
                                                                                return sTime >= mTime;
                                                                            })
                                                                            .map(([uid]) => {
                                                                                const w = workers?.find(worker => String(worker.id) === uid);
                                                                                return (
                                                                                    <div
                                                                                        key={uid}
                                                                                        className="w-4 h-4 rounded-full border border-white/20 text-[6px] font-black flex items-center justify-center text-white shadow-sm"
                                                                                        style={{ backgroundColor: w?.color || '#334155' }}
                                                                                        title={`Viděno: ${w?.name}`}
                                                                                    >
                                                                                        {(w?.name || '?').substring(0, 1).toUpperCase()}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                    </div>
                                                                )}
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
                    <div />
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
                <div
                    ref={chatFooterRef}
                    className="p-3 md:p-6 bg-black/60 backdrop-blur-3xl border-t border-white/10 shrink-0 relative z-20 transition-transform duration-75"
                    style={{
                        transform: `translateY(-${keyboardOffset}px)`,
                        paddingBottom: `calc(${keyboardOffset > 0 ? '8px' : 'var(--safe-bottom)'} + 8px)`
                    }}
                >
                    {replyToMessage && (
                        <div className="max-w-5xl mx-auto mb-4 p-4 bg-indigo-500/10 border-l-4 border-indigo-500 rounded-r-2xl flex justify-between items-center animate-slide-up">
                            <div className="flex-1 truncate">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Odpověď pro {replyToMessage.senderName}</p>
                                <p className="text-sm text-slate-300 truncate">{replyToMessage.text}</p>
                            </div>
                            <button onClick={() => setReplyToMessage(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}
                    <form onSubmit={handleSend} className="flex gap-4 max-w-5xl mx-auto relative">
                        <input
                            type="text"
                            value={inputText}
                            onChange={e => { setInputText(e.target.value); handleTyping(); }}
                            placeholder={t('type_message')}
                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2rem] px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-[16px] tracking-wide"
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

            {/* Debug Panel (only in development) */}
            {IS_DEV && <ChatDebug channelId={activeChannelId} />}
        </div>
    );
};


// 1. Local Error Boundary for Chat
class ChatErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; errorDetails: string | null }
> {
    state = { hasError: false, errorDetails: null };

    static getDerivedStateFromError(error: Error) {
        return {
            hasError: true,
            errorDetails: error?.message || 'Unknown error'
        };
    }

    componentDidCatch(error: any, info: any) {
        const errorLog = {
            message: error?.message || 'Unknown error',
            name: error?.name,
            stack: error?.stack,
            componentStack: info?.componentStack,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            appVersion: '1.0.0'
        };

        console.error('🔥 Chat Component Crashed:', errorLog);

        // Store in localStorage for bug reports
        try {
            localStorage.setItem('last_chat_error', JSON.stringify(errorLog));
        } catch (e) {
            console.warn('Failed to save error to localStorage:', e);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, errorDetails: null });
        // Force full page reload to clear any bad state
        window.location.reload();
    };

    handleReport = () => {
        try {
            const errorData = localStorage.getItem('last_chat_error');
            const subject = encodeURIComponent('MST Chat - Nahlášení chyby');
            const body = encodeURIComponent(
                `Dobrý den,\n\nPři používání chatu došlo k chybě.\n\nTechnické detaily:\n${errorData || 'Detaily nejsou dostupné'}\n\nDěkuji`
            );
            window.location.href = `mailto:support@example.com?subject=${subject}&body=${body}`;
        } catch (e) {
            console.error('Failed to prepare error report:', e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#020617]">
                    <div className="text-6xl mb-6">💬</div>
                    <h3 className="text-xl font-bold text-white mb-3">
                        Chat se teď nenačetl
                    </h3>
                    <p className="text-sm text-slate-400 mb-8 max-w-sm leading-relaxed">
                        Zkuste to znovu nebo nahlaste problém, pokud chyba přetrvává.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <button
                            onClick={this.handleRetry}
                            className="px-8 py-4 bg-indigo-600 text-white rounded-full font-bold text-base hover:bg-indigo-700 active:scale-95 transition-all shadow-lg min-w-[160px]"
                        >
                            Zkusit znovu
                        </button>
                        <button
                            onClick={this.handleReport}
                            className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold text-base hover:bg-white/20 active:scale-95 transition-all border border-white/20 min-w-[160px]"
                        >
                            Nahlásit problém
                        </button>
                    </div>

                    {this.state.errorDetails && (
                        <details className="mt-4 text-left max-w-md w-full">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400 transition-colors py-2">
                                🔧 Technické detaily
                            </summary>
                            <pre className="mt-3 p-4 bg-black/50 rounded-lg text-xs text-slate-300 overflow-auto border border-white/10">
                                {this.state.errorDetails}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }
        return this.props.children;
    }
}

// 2. Export wrapped component
export default () => (
    <ChatErrorBoundary>
        <Chat />
    </ChatErrorBoundary>
);
