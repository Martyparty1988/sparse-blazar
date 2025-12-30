import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { ChatMessage, Worker } from '../types';
import BackButton from './BackButton';
import { soundService } from '../services/soundService';

const notifyUser = (message: ChatMessage, showToast: (msg: string, type?: any) => void, t: any) => {
    // Sound
    soundService.playMessageReceived();

    // Vibration
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    // Toast Notification
    const name = message.senderName || 'Systém';
    showToast(t('new_message_from', { name }).replace('{name}', name), 'info');

    // System Notification
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification(`New message from ${message.senderName}`, {
            body: message.text,
            icon: '/icon-192.png'
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

    // Channels
    const [activeChannelId, setActiveChannelId] = useState<string>('general');
    const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());
    const workers = useLiveQuery(() => db.workers.toArray());

    const CHAT_LIMIT = 50;

    useEffect(() => {
        const initNotifications = async () => {
            if ('Notification' in window) {
                if (Notification.permission !== 'granted') {
                    // Pre-request (browser might block this without user interaction, 
                    // but we check status first)
                    await Notification.requestPermission();
                }

                // Always try to update/refresh token if we have a user
                if (currentUser?.workerId) {
                    try {
                        await firebaseService.requestNotificationPermission(currentUser.workerId);
                    } catch (err) {
                        console.error("Failed to requests notification permission/token:", err);
                    }
                }
            }
        };

        if (currentUser) {
            initNotifications();
        }
    }, [currentUser]);

    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };
        // Small delay to ensure render is complete
        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [messages]);

    useEffect(() => {
        if (!firebaseService.isReady) return;

        const path = `chat/${activeChannelId}`;
        setMessages([]);

        firebaseService.subscribe(path, (data) => {
            if (data) {
                const messageList: ChatMessage[] = Object.values(data);
                messageList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                // Get the very last message to check for notification
                const lastMsg = messageList[messageList.length - 1];

                setMessages(prev => {
                    // Only notify if the message is actually new and not from ME
                    if (lastMsg &&
                        lastMsg.senderId !== currentUser?.workerId &&
                        lastMsg.senderId !== -1) {

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

        return () => {
            firebaseService.unsubscribe(path);
        };
    }, [activeChannelId, currentUser?.workerId, showToast, t]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        soundService.playClick();
        setIsSending(true);

        const newMessage: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: inputText.trim(),
            senderId: currentUser?.workerId || -1,
            senderName: currentUser?.name || user?.username || 'Admin',
            timestamp: new Date().toISOString(),
            channelId: activeChannelId
        };

        try {
            await firebaseService.upsertRecords(`chat/${activeChannelId}`, [newMessage]);
            setInputText('');
        } catch (error) {
            console.error("Failed to send message", error);
            showToast("Chyba při odesílání", "error");
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteMessage = async (msgId: string) => {
        if (!window.confirm(t('confirm_delete_message') || 'Opravdu smazat zprávu?')) return;

        try {
            await firebaseService.removeData(`chat/${activeChannelId}/${msgId}`);
            soundService.playClick();
        } catch (error) {
            console.error("Failed to delete message", error);
        }
    };

    const isMe = (msg: ChatMessage) =>
        msg.senderId === currentUser?.workerId ||
        (msg.senderId === -1 && user?.role === 'admin' && currentUser?.workerId === undefined);

    const getWorkerColor = (senderId: number) => {
        if (senderId === -1) return '#64748b'; // Admin color
        return workers?.find(w => w.id === senderId)?.color || '#3b82f6';
    };

    // Message Grouping and Date Headers
    const groupedMessages = useMemo(() => {
        const groups: { date: string, items: { senderId: number, name: string, messages: ChatMessage[] }[] }[] = [];

        messages.forEach((msg, idx) => {
            const dateObj = new Date(msg.timestamp);
            const dateStr = dateObj.toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

            // Check if it's today/yesterday
            let dateLabel = dateStr;
            const today = new Date().toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
            const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(language === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

            if (dateStr === today) dateLabel = t('today');
            else if (dateStr === yesterday) dateLabel = t('yesterday');

            let dateGroup = groups.find(g => g.date === dateLabel);
            if (!dateGroup) {
                dateGroup = { date: dateLabel, items: [] };
                groups.push(dateGroup);
            }

            const lastItemGroup = dateGroup.items[dateGroup.items.length - 1];
            const timeDiff = lastItemGroup ? (new Date(msg.timestamp).getTime() - new Date(lastItemGroup.messages[lastItemGroup.messages.length - 1].timestamp).getTime()) : 0;

            // Group by same sender if within 5 minutes
            if (lastItemGroup && lastItemGroup.senderId === msg.senderId && timeDiff < 300000) {
                lastItemGroup.messages.push(msg);
            } else {
                dateGroup.items.push({
                    senderId: msg.senderId,
                    name: msg.senderName,
                    messages: [msg]
                });
            }
        });

        return groups;
    }, [messages, language, t]);

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const activeProjectName = useMemo(() => {
        if (activeChannelId === 'general') return t('general');
        if (activeChannelId.startsWith('dm_')) {
            const parts = activeChannelId.split('_');
            const otherWorkerId = parts[1] === String(currentUser?.workerId || -1) ? parts[2] : parts[1];
            return workers?.find(w => String(w.id) === otherWorkerId)?.name || 'Soukromý chat';
        }
        return projects?.find(p => `project_${p.id}` === activeChannelId)?.name || 'Project';
    }, [activeChannelId, projects, workers, t, currentUser]);

    const getDmChannelId = (otherWorkerId: number) => {
        const myId = currentUser?.workerId || -1;
        const ids = [myId, otherWorkerId].sort((a, b) => Number(a) - Number(b));
        return `dm_${ids[0]}_${ids[1]}`;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] max-w-7xl mx-auto md:flex-row gap-4 p-2 md:p-4 overflow-hidden">
            {/* Sidebar / Channels */}
            <div className="w-full md:w-80 flex flex-col gap-4 shrink-0 h-auto md:h-full">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10a2 2 0 012-2h2m2 4h6a2 2 0 002-2V7a2 2 0 00-2-2H9a2 2 0 00-2 2v3a2 2 0 002 2z" /></svg>
                        </div>
                        <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                            {t('channels')}
                        </h1>
                    </div>
                    <div className="md:hidden">
                        <BackButton />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
                    <button
                        onClick={() => setActiveChannelId('general')}
                        className={`w-full group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-300 ${activeChannelId === 'general'
                            ? 'bg-gradient-to-r from-indigo-600/20 to-blue-600/20 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                            }`}
                    >
                        {activeChannelId === 'general' && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full"></div>
                        )}
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${activeChannelId === 'general' ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                        </div>
                        <div className="text-left">
                            <span className={`block font-black uppercase text-xs tracking-widest ${activeChannelId === 'general' ? 'text-indigo-400' : 'text-slate-500'}`}>Global</span>
                            <span className="text-lg font-bold text-white tracking-tight">{t('general')}</span>
                        </div>
                    </button>

                    <div className="flex items-center gap-3 px-4 py-2 mt-4">
                        <div className="h-px flex-1 bg-white/10"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projekty</span>
                        <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    {projects?.map(project => (
                        <button
                            key={project.id}
                            onClick={() => setActiveChannelId(`project_${project.id}`)}
                            className={`w-full group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-300 ${activeChannelId === `project_${project.id}`
                                ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                }`}
                        >
                            {activeChannelId === `project_${project.id}` && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-emerald-500 rounded-r-full"></div>
                            )}
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${activeChannelId === `project_${project.id}` ? 'bg-emerald-500 text-white shadow-emerald-500/50' : 'bg-slate-800 text-slate-400'}`}>
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                            </div>
                            <div className="text-left w-full overflow-hidden">
                                <span className={`block font-black uppercase text-[10px] tracking-widest ${activeChannelId === `project_${project.id}` ? 'text-emerald-400' : 'text-slate-500'}`}>Active</span>
                                <span className="text-md font-bold text-white tracking-tight truncate block">#{project.name}</span>
                            </div>
                        </button>
                    ))}

                    <div className="flex items-center gap-3 px-4 py-2 mt-4">
                        <div className="h-px flex-1 bg-white/10"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tým (Soukromé)</span>
                        <div className="h-px flex-1 bg-white/10"></div>
                    </div>

                    {workers?.filter(w => w.id !== currentUser?.workerId).map(worker => {
                        const dmId = getDmChannelId(worker.id!);
                        return (
                            <button
                                key={worker.id}
                                onClick={() => setActiveChannelId(dmId)}
                                className={`w-full group relative flex items-center gap-4 p-4 rounded-3xl border transition-all duration-300 ${activeChannelId === dmId
                                    ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/50 shadow-lg shadow-purple-500/10'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                    }`}
                            >
                                {activeChannelId === dmId && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-purple-500 rounded-r-full"></div>
                                )}
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg`} style={{ backgroundColor: worker.color || '#334155' }}>
                                    <span className="text-sm font-black text-white">{worker.name.substring(0, 2).toUpperCase()}</span>
                                </div>
                                <div className="text-left w-full overflow-hidden">
                                    <span className={`block font-black uppercase text-[10px] tracking-widest ${activeChannelId === dmId ? 'text-purple-400' : 'text-slate-500'}`}>Messenger</span>
                                    <span className="text-md font-bold text-white tracking-tight truncate block">{worker.name}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Chat Window */}
            <div className="flex-1 flex flex-col bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden relative">
                {/* Chat Header */}
                <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${activeChannelId === 'general' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                        <div>
                            <h2 className="text-xl font-black text-white italic uppercase tracking-tight leading-none">{activeProjectName}</h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time discussion</p>
                        </div>
                    </div>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar scroll-smooth">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 animate-fade-in">
                            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5 group relative">
                                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl scale-125 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <svg className="w-12 h-12 text-slate-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            </div>
                            <p className="text-xl font-black text-slate-400 mb-1 uppercase tracking-widest italic">{t('no_data')}?</p>
                            <p className="text-sm font-bold text-slate-600 text-center max-w-xs uppercase tracking-tight">
                                {t('type_message')}
                            </p>
                        </div>
                    ) : (
                        groupedMessages.map((group) => (
                            <div key={group.date} className="space-y-6">
                                {/* Date Divider */}
                                <div className="flex items-center gap-4 py-2">
                                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/5 px-4 py-1.5 rounded-full border border-white/5">{group.date}</span>
                                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
                                </div>

                                {group.items.map((item, groupIdx) => {
                                    const senderIsMe = isMe({ senderId: item.senderId } as any);
                                    const color = getWorkerColor(item.senderId);

                                    return (
                                        <div
                                            key={`${group.date}-${item.senderId}-${groupIdx}`}
                                            className={`flex gap-4 ${senderIsMe ? 'flex-row-reverse' : 'flex-row'} animate-list-item`}
                                            style={{ animationDelay: `${groupIdx * 0.05}s` }}
                                        >
                                            {/* Avatar */}
                                            <div
                                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-black text-white shrink-0 shadow-lg border-2 border-slate-900 transition-transform hover:scale-110`}
                                                style={{ backgroundColor: color }}
                                                title={item.name}
                                            >
                                                {item.name.substring(0, 2).toUpperCase()}
                                            </div>

                                            <div className={`flex flex-col space-y-1.5 max-w-[80%] md:max-w-[65%] ${senderIsMe ? 'items-end' : 'items-start'}`}>
                                                {!senderIsMe && (
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1">{item.name}</span>
                                                )}

                                                {item.messages.map((msg, msgIdx) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`group relative px-5 py-3.5 rounded-3xl text-[14px] leading-relaxed font-bold font-sans shadow-xl border transition-all ${senderIsMe
                                                            ? 'bg-gradient-to-br from-indigo-500 to-blue-700 text-white border-white/10 rounded-tr-none hover:shadow-indigo-500/20'
                                                            : 'bg-white/10 text-slate-100 border-white/5 rounded-tl-none hover:bg-white/15'
                                                            }`}
                                                    >
                                                        {msg.text}

                                                        {senderIsMe && (
                                                            <button
                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                className="absolute -top-2 -left-2 w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border-2 border-slate-900 shadow-xl z-20 hover:scale-125"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        )}

                                                        {/* Individual Time Badge (appears on hover) */}
                                                        <div className={`absolute bottom-0 ${senderIsMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
                                                            <span className="text-[9px] font-black text-slate-600 bg-black/40 px-2 py-1 rounded-lg border border-white/5">{formatTime(msg.timestamp)}</span>
                                                        </div>

                                                        {/* Show time on the last bubble of the group permanently if not hovered */}
                                                        {msgIdx === item.messages.length - 1 && (
                                                            <div className={`mt-2 flex opacity-40 text-[9px] font-black ${senderIsMe ? 'justify-end' : 'justify-start'}`}>
                                                                {formatTime(msg.timestamp)}
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
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Message Input */}
                <div className="p-6 md:p-8 bg-black/40 border-t border-white/10 backdrop-blur-3xl">
                    <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto flex gap-3">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={t('type_message')}
                            className="flex-1 bg-white/5 border-2 border-white/5 rounded-[2rem] px-8 py-5 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.07] transition-all font-bold shadow-2xl relative z-10 text-lg"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isSending}
                            className="bg-gradient-to-br from-indigo-500 to-blue-600 disabled:opacity-30 disabled:grayscale text-white w-16 h-16 rounded-[2rem] transition-all shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center justify-center relative z-10 shrink-0 group/btn"
                        >
                            {isSending ? (
                                <svg className="animate-spin h-7 w-7" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-7 h-7 transform group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            )}
                        </button>
                    </form>
                    <p className="text-center text-[10px] font-black text-slate-600 uppercase tracking-widest mt-4 opacity-50">Press Enter to send message</p>
                </div>
            </div>
        </div>
    );
};

export default Chat;
