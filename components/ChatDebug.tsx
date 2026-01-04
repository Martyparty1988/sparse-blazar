import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Debug komponenta pro diagnostiku problémů s chatem
 * Použij jako: <ChatDebug channelId="general" />
 */
const ChatDebug: React.FC<{ channelId: string }> = ({ channelId }) => {
    const { currentUser } = useAuth();
    const [debugInfo, setDebugInfo] = useState<any>({});
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        const info: any = {
            firebaseReady: firebaseService.isReady,
            firebaseOnline: firebaseService.isOnline,
            currentUser: currentUser?.username,
            workerId: currentUser?.workerId,
            channelId: channelId,
            timestamp: new Date().toISOString()
        };

        setDebugInfo(info);

        // Subscribe to messages
        const unsubscribe = firebaseService.subscribe(`chat/${channelId}`, (data) => {
            setDebugInfo((prev: any) => ({
                ...prev,
                messagesReceived: data ? Object.keys(data).length : 0,
                lastUpdate: new Date().toISOString(),
                rawData: data
            }));
        });

        return () => unsubscribe();
    }, [channelId, currentUser]);

    const sendTestMessage = async () => {
        if (!testMessage.trim()) return;

        const message = {
            id: `test_${Date.now()}`,
            text: testMessage,
            senderId: currentUser?.workerId || -999,
            senderName: currentUser?.username || 'Debug User',
            timestamp: new Date().toISOString()
        };

        try {
            const result = await firebaseService.setData(`chat/${channelId}/${message.id}`, message);
            setDebugInfo((prev: any) => ({
                ...prev,
                lastSentMessage: message,
                lastSentResult: result,
                lastSentAt: new Date().toISOString()
            }));
            setTestMessage('');
        } catch (error: any) {
            setDebugInfo((prev: any) => ({
                ...prev,
                lastError: error.message,
                lastErrorAt: new Date().toISOString()
            }));
        }
    };

    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-[500px] overflow-auto bg-black/90 text-white p-4 rounded-lg border border-green-500 text-xs font-mono z-[9999]">
            <h3 className="text-green-400 font-bold mb-2">🔍 Chat Debug Panel</h3>

            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1">
                    <span className="text-gray-400">Firebase Ready:</span>
                    <span className={debugInfo.firebaseReady ? 'text-green-400' : 'text-red-400'}>
                        {debugInfo.firebaseReady ? '✅' : '❌'}
                    </span>

                    <span className="text-gray-400">Firebase Online:</span>
                    <span className={debugInfo.firebaseOnline ? 'text-green-400' : 'text-red-400'}>
                        {debugInfo.firebaseOnline ? '✅' : '❌'}
                    </span>

                    <span className="text-gray-400">User:</span>
                    <span className="text-blue-300">{debugInfo.currentUser || 'N/A'}</span>

                    <span className="text-gray-400">Worker ID:</span>
                    <span className="text-blue-300">{debugInfo.workerId || 'N/A'}</span>

                    <span className="text-gray-400">Channel:</span>
                    <span className="text-blue-300">{debugInfo.channelId}</span>

                    <span className="text-gray-400">Messages:</span>
                    <span className="text-yellow-300">{debugInfo.messagesReceived || 0}</span>

                    <span className="text-gray-400">Last Update:</span>
                    <span className="text-purple-300 text-[10px]">{debugInfo.lastUpdate || 'Never'}</span>
                </div>

                <div className="mt-4 pt-2 border-t border-gray-700">
                    <p className="text-gray-400 mb-1">Test Message:</p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            className="flex-1 bg-gray-800 px-2 py-1 rounded text-white"
                            placeholder="Type test message..."
                        />
                        <button
                            onClick={sendTestMessage}
                            className="bg-green-600 px-3 py-1 rounded hover:bg-green-700"
                        >
                            Send
                        </button>
                    </div>
                </div>

                {debugInfo.lastError && (
                    <div className="mt-2 p-2 bg-red-900/50 rounded border border-red-500">
                        <p className="text-red-300 font-bold">Last Error:</p>
                        <p className="text-red-200 text-[10px]">{debugInfo.lastError}</p>
                        <p className="text-gray-400 text-[9px]">{debugInfo.lastErrorAt}</p>
                    </div>
                )}

                {debugInfo.rawData && (
                    <details className="mt-2">
                        <summary className="cursor-pointer text-gray-400 hover:text-white">Raw Data</summary>
                        <pre className="mt-1 p-2 bg-gray-900 rounded overflow-auto max-h-40 text-[9px]">
                            {JSON.stringify(debugInfo.rawData, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};

export default ChatDebug;
