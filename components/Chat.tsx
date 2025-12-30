import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { firebaseService } from '../services/firebaseService';
import type { ChatMessage } from '../types';
import BackButton from './BackButton';

const Chat: React.FC = () => {
    const { user, currentUser } = useAuth();
    const { t } = useI18n();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSending, setIsSending] = useState(false);

    // Limit to last 50 messages to keep it fast
    // In a real app we would paginate, but for now this is fine.
    const CHAT_LIMIT = 50;

    useEffect(() => {
        const scrollToBottom = () => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        };
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!firebaseService.isReady) return;

        console.log("Subscribing to chat...");
        // Listen to the chat node
        firebaseService.subscribe('chat', (data) => {
            if (data) {
                const messageList: ChatMessage[] = Object.values(data);
                // Sort by timestamp
                messageList.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                // Keep only last N
                setMessages(messageList.slice(-CHAT_LIMIT));
            } else {
                setMessages([]);
            }
        });

        // Cleanup listener on unmount
        return () => {
            firebaseService.unsubscribe('chat');
        };
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !currentUser?.workerId) return;

        setIsSending(true);
        const newMessage: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            text: inputText.trim(),
            senderId: currentUser.workerId,
            senderName: currentUser.name,
            timestamp: new Date().toISOString()
        };

        try {
            // We use upsertRecords with a custom array to just push this 1 message
            // Ideally we'd use 'push' but our service exposes upsert.
            // Using ID keys manually works fine for this scale.
            await firebaseService.upsertRecords('chat', [newMessage]);
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

    const isMe = (msg: ChatMessage) => msg.senderId === currentUser?.workerId;

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] max-w-4xl mx-auto">
            <div className="md:hidden pt-4 pb-2">
                <div className="flex items-center gap-4">
                    <BackButton />
                    <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                        Team Chat
                    </h1>
                </div>
            </div>

            <div className="hidden md:block mb-6">
                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter underline decoration-indigo-500 decoration-4">
                    Team Chat
                </h1>
            </div>

            {/* Chat Window */}
            <div className="flex-1 bg-slate-900/60 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-2xl relative">
                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <p className="text-sm font-bold uppercase tracking-widest">Zatím žádné zprávy</p>
                            <p className="text-xs">Buďte první kdo něco napíše!</p>
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
