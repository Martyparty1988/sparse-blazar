import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { firebaseService } from '../services/firebaseService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import type { ChatMessage } from '../types';
import BackButton from './BackButton';

// Notification Helper
const playNotificationSound = () => {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = 500;
        gainNode.gain.value = 0.1;

        oscillator.start();
        setTimeout(() => oscillator.stop(), 200);
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const notifyUser = (message: ChatMessage) => {
    // Sound
    playNotificationSound();

    // Vibration
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }

    // System Notification
    if (Notification.permission === 'granted' && document.hidden) {
        new Notification(`New message from ${message.senderName}`, {
            body: message.text,
            icon: '/icon-192.png' // Adjust if needed
        });
    }
};

const Chat: React.FC = () => {
    const { user, currentUser } = useAuth();
    const { t } = useI18n();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);

    // Channels
    const [activeChannelId, setActiveChannelId] = useState<string>('general');
    const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray());

    const CHAT_LIMIT = 50;

    // Permissions on mount
    useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!firebaseService.isReady) return;

        // Path: /chat/{channelId}
        const path = `chat/${activeChannelId}`;
        console.log(`Subscribing to ${path}...`);

        setMessages([]); // Clear on switch

        firebaseService.subscribe(path, (data) => {
            if (data) {
                const messageList: ChatMessage[] = Object.values(data);
                messageList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                setMessages(messageList.slice(-CHAT_LIMIT));

                // Notify if new message is not from me and recent
                const lastMsg = messageList[messageList.length - 1];
                if (lastMsg && lastMsg.senderId !== currentUser?.workerId && lastMsg.senderId !== -1) {
                    // Simple check: is it really new? (within last 5 seconds)
                    const msgTime = new Date(lastMsg.timestamp).getTime();
                    if (Date.now() - msgTime < 5000) {
                        notifyUser(lastMsg);
                    }
                }

            } else {
                setMessages([]);
            }
        });

        return () => {
            firebaseService.unsubscribe(path);
        };
    }, [activeChannelId]); // Re-sub when channel changes

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

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
            // Upsert into specific channel path: /chat/{channelId}/{messageId}
            // upsertRecords expects collection root. 
            // We can treat `chat/${activeChannelId}` as the collection.
            await firebaseService.upsertRecords(`chat/${activeChannelId}`, [newMessage]);
            setInputText('');
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsSending(false);
        }
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const isMe = (msg: ChatMessage) => msg.senderId === currentUser?.workerId || (msg.senderId === -1 && user?.role === 'admin' && currentUser?.workerId === undefined);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] max-w-6xl mx-auto md:flex-row gap-6">
            <div className="md:hidden pt-4 pb-2">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        Team Chat
                    </h1>
                </div>
            </div>

            <div className="hidden md:block mb-6 md:mb-0 w-full md:w-auto">
                {/* Desktop Title not needed in sidebar layout usually, but keeping consistency */}
            </div>

            {/* Channels Sidebar */}
            <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 md:h-full overflow-y-auto pb-4">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">Kanály</h2>

                <button
                    onClick={() => setActiveChannelId('general')}
                    className={`p-4 rounded-2xl text-left transition-all font-bold flex items-center gap-3 ${activeChannelId === 'general'
                            ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    <span className="text-lg">📢</span> General
                </button>

                {projects?.map(project => (
                    <button
                        key={project.id}
                        onClick={() => setActiveChannelId(`project_${project.id}`)}
                        className={`p-4 rounded-2xl text-left transition-all font-bold flex items-center gap-3 ${activeChannelId === `project_${project.id}`
                                ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <span className="text-lg">🏗️</span> #{project.name}
                    </button>
                ))}
            </div>

            {/* Chat Window */}
            <div className="flex-1 bg-slate-900/60 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-2xl relative h-full">

                {/* Mobile Channel Indicator */}
                <div className="md:hidden px-4 py-2 bg-black/20 text-xs font-black text-gray-400 uppercase tracking-widest text-center border-b border-white/5">
                    {activeChannelId === 'general' ? '📢 General' : `🏗️ #${projects?.find(p => `project_${p.id}` === activeChannelId)?.name || 'Project'}`}
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                            <span className="text-4xl mb-4">💬</span>
                            <p className="text-sm font-bold uppercase tracking-widest">Zatím žádné zprávy v kanálu</p>
                            <p className="text-xs">
                                {activeChannelId === 'general' ? 'General' : activeChannelId}
                            </p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe(msg) ? 'items-end' : 'items-start'} animate-fade-in`}
                            >
                                <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] ${isMe(msg) ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Avatar */}
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-white/10 ${isMe(msg) ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-300'}`}>
                                        {msg.senderName.substring(0, 2).toUpperCase()}
                                    </div>

                                    {/* Bubble */}
                                    <div
                                        className={`px-4 py-3 rounded-2xl text-sm font-medium shadow-lg break-words ${isMe(msg)
                                                ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-tr-none'
                                                : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'
                                            }`}
                                    >
                                        {!isMe(msg) && (
                                            <div className="text-[10px] font-bold text-indigo-300 mb-1 uppercase tracking-wider">
                                                {msg.senderName}
                                            </div>
                                        )}
                                        {msg.text}
                                    </div>
                                </div>
                                <span className={`text-[10px] text-gray-500 mt-1 font-mono font-bold mx-11`}>
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/20 border-t border-white/5 backdrop-blur-md">
                    <form onSubmit={handleSend} className="flex gap-2">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={t('type_message') || "Napište zprávu..."}
                            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-medium"
                        />
                        <button
                            type="submit"
                            disabled={!inputText.trim() || isSending}
                            className="bg-indigo-600 disabled:opacity-50 hover:bg-indigo-500 text-white p-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center aspect-square"
                        >
                            {isSending ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;
