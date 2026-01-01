const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Automatické odeslání push notifikace při nové zprávě v chatu (VYLEPŠENO)
 */
exports.sendChatNotification = functions.database.ref('/chat/{channelId}/{messageId}')
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val();
        const channelId = context.params.channelId;

        if (message.senderId === -1) return null; // Ignorovat systémové

        const payload = {
            notification: {
                title: `${message.senderName} (${channelId === 'general' ? 'Global' : 'Chat'})`,
                body: message.text.length > 100 ? message.text.substring(0, 97) + '...' : message.text,
                icon: '/icon-192.svg',
                clickAction: `/#/chat`,
            },
            data: {
                channelId: channelId,
                senderId: String(message.senderId)
            }
        };

        const tokens = [];
        const workersSnapshot = await admin.database().ref('/workers').once('value');
        const workers = workersSnapshot.val();
        if (!workers) return null;

        const workerList = Object.values(workers);

        if (channelId === 'general') {
            // Pošli všem s tokenem kromě odesílatele
            workerList.forEach(w => {
                if (w.id !== message.senderId && w.fcmToken) tokens.push(w.fcmToken);
            });
        }
        else if (channelId.startsWith('project_')) {
            // Pošli jen členům projektu
            const projectId = parseInt(channelId.replace('project_', ''));
            const projectSnap = await admin.database().ref(`/projects/${projectId}`).once('value');
            const project = projectSnap.val();

            const memberIds = project?.workerIds || [];
            workerList.forEach(w => {
                if (memberIds.includes(w.id) && w.id !== message.senderId && w.fcmToken) {
                    tokens.push(w.fcmToken);
                }
            });
        }
        else if (channelId.startsWith('dm_')) {
            // Pošli jen druhému účastníkovi v DM (dm_ID1_ID2)
            const parts = channelId.split('_');
            const targetId = parseInt(parts[1]) === message.senderId ? parseInt(parts[2]) : parseInt(parts[1]);

            const targetWorker = workerList.find(w => w.id === targetId);
            if (targetWorker && targetWorker.fcmToken) {
                tokens.push(targetWorker.fcmToken);
                payload.notification.title = `Soukromá zpráva: ${message.senderName}`;
            }
        }

        if (tokens.length > 0) {
            try {
                const messages = tokens.map(token => ({
                    token: token,
                    notification: payload.notification,
                    data: payload.data
                }));
                await admin.messaging().sendEach(messages);
                console.log(`✅ Notifikace doručena na ${tokens.length} zařízení v kanálu ${channelId}`);
            } catch (error) {
                console.error('❌ Chyba při odesílání FCM:', error);
            }
        }

        // --- NEW: Update unread status in RTDB ---
        const unreadUpdates = {};
        const unreadPath = `unread`;

        if (channelId === 'general') {
            workerList.forEach(w => {
                if (w.id !== message.senderId) {
                    unreadUpdates[`${unreadPath}/${w.id}/${channelId}`] = {
                        text: message.text,
                        timestamp: message.timestamp,
                        senderName: message.senderName
                    };
                }
            });
        } else if (channelId.startsWith('project_')) {
            const projectId = parseInt(channelId.replace('project_', ''));
            const projectSnap = await admin.database().ref(`/projects/${projectId}`).once('value');
            const project = projectSnap.val();
            const memberIds = project?.workerIds || [];

            memberIds.forEach(uid => {
                if (uid !== message.senderId) {
                    unreadUpdates[`${unreadPath}/${uid}/${channelId}`] = {
                        text: message.text,
                        timestamp: message.timestamp,
                        senderName: message.senderName
                    };
                }
            });
        } else if (channelId.startsWith('dm_')) {
            const parts = channelId.split('_');
            const targetId = parseInt(parts[1]) === message.senderId ? parseInt(parts[2]) : parseInt(parts[1]);
            unreadUpdates[`${unreadPath}/${targetId}/${channelId}`] = {
                text: message.text,
                timestamp: message.timestamp,
                senderName: message.senderName
            };
        }

        if (Object.keys(unreadUpdates).length > 0) {
            await admin.database().ref().update(unreadUpdates);
        }

        return null;
    });

/**
 * Notifikace při nahlášení závady na stole
 */
exports.sendDefectNotification = functions.database.ref('/fieldTables/{tableKey}')
    .onUpdate(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();

        if (after.status === 'defect' && before.status !== 'defect') {
            const payload = {
                notification: {
                    title: `⚠️ Závada: Projekt ${after.projectId}`,
                    body: `Stůl ${after.tableId} vyžaduje pozornost!`,
                    icon: '/icon-192.svg'
                }
            };

            const workersSnap = await admin.database().ref('/workers').once('value');
            const workers = workersSnap.val();
            if (!workers) return null;

            const tokens = Object.values(workers)
                .filter(w => w.fcmToken) // V ideálním světě jen adminům
                .map(w => w.fcmToken);

            if (tokens.length > 0) {
                const messages = tokens.map(token => ({ token: token, notification: payload.notification }));
                await admin.messaging().sendEach(messages);
            }
        }
        return null;
    });
