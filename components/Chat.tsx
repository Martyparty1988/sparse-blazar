
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useToast } from '../contexts/ToastContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { ChatMessage, Worker, Project } from '../types';
import BackButton from './BackButton';
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
        setMobileView('chat');
    };

    useEffect(() => {
        const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        const timer = setTimeout(scrollToBottom, 100);
        return () => clearTimeout(timer);
    }, [messages, mobileView]);

    useEffect(() => {
        if (!firebaseService.isReady) return;
        const path = `chat/${activeChannelId}`;
        setMessages([]);

        firebaseService.subscribe(path, (data) => {
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
            await firebaseService.upsertRecords(`chat/${activeChannelId}`, [newMessage]);
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
        <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] max-w-7xl mx-auto md:flex-row gap-0 md:gap-4 overflow-hidden bg-slate-950/50">
            {/* Sidebar */}
            <div className={`w-full md:w-80 flex-col shrink-0 h-full bg-slate-900/50 backdrop-blur-xl border-r border-white/5 ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex`}>
                <div className="p-6 flex items-center justify-between">
                     <h1 className="text-2xl font-black text-white italic tracking-tighter uppercase">{t('channels')}</h1>
                     <div className="md:hidden"><BackButton /></div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 space-y-2 pb-20 md:pb-4">
                    <button onClick={() => handleChannelSelect('general')} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${activeChannelId === 'general' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                        <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-bold">#</div>
                        <div className="text-left"><span className="block text-[10px] font-black uppercase opacity-50">Public</span><span className="font-bold">{t('general')}</span></div>
                    </button>
                    <div className="pt-4 pb-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Moje Projekty</div>
                    {projects.map(p => (
                        <button key={p.id} onClick={() => handleChannelSelect(`project_${p.id}`)} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${activeChannelId === `project_${p.id}` ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                            <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-bold">P</div>
                            <div className="text-left font-bold truncate">#{p.name}</div>
                        </button>
                    ))}
                    <div className="pt-4 pb-2 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Kolegové</div>
                    {workers?.filter(w => w.id !== currentUser?.workerId).map(w => (
                         <button key={w.id} onClick={() => handleChannelSelect(`dm_${[currentUser?.workerId || -1, w.id].sort((a,b)=>Number(a)-Number(b)).join('_')}`)} className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${activeChannelId.includes(`_${w.id}`) ? 'bg-purple-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs" style={{backgroundColor: w.color || '#334155'}}>{w.name.substring(0,2).toUpperCase()}</div>
                            <div className="text-left font-bold truncate">{w.name}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col h-full bg-slate-900/20 backdrop-blur-sm ${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex`}>
                <div className="p-4 md:p-6 border-b border-white/5 bg-black/20 flex items-center gap-4">
                    <button onClick={() => setMobileView('list')} className="md:hidden p-2 -ml-2 text-slate-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                    <div><h2 className="text-xl font-black text-white italic uppercase tracking-tight">{activeProjectName}</h2></div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
                    {groupedMessages.map(group => (
                        <div key={group.date} className="space-y-6">
                            <div className="flex items-center gap-4 py-2"><div className="h-px flex-1 bg-white/5"></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{group.date}</span><div className="h-px flex-1 bg-white/5"></div></div>
                            {group.items.map((item, idx) => (
                                <div key={idx} className={`flex gap-3 ${isMe({senderId: item.senderId} as any) ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{backgroundColor: workers?.find(w=>w.id===item.senderId)?.color || '#3b82f6'}}>{item.name.substring(0,2).toUpperCase()}</div>
                                    <div className={`flex flex-col space-y-1 max-w-[80%] ${isMe({senderId: item.senderId} as any) ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[9px] font-black text-slate-500 uppercase px-1">{item.name}</span>
                                        {item.messages.map(msg => (
                                            <div key={msg.id} className={`px-4 py-2.5 rounded-2xl text-sm font-bold shadow-lg ${isMe(msg) ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/10 text-slate-200 rounded-tl-none'}`}>{msg.text}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 md:p-8 bg-black/20 border-t border-white/5">
                    <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
                        <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-bold" />
                        <button type="submit" disabled={!inputText.trim() || isSending} className="bg-indigo-600 disabled:opacity-30 text-white px-8 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-indigo-600/20">Poslat</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;
