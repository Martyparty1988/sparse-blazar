const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp({
    databaseURL: "https://mst-marty-solar-2025-default-rtdb.europe-west1.firebasedatabase.app"
});

/**
 * Automatické odeslání push notifikace při nové zprávě v chatu
 */
exports.sendChatNotification = functions.database.ref('/chat/{channelId}/{messageId}')
    .onCreate(async (snapshot, context) => {
        const message = snapshot.val();
        const channelId = context.params.channelId;

        // Ignorovat systémové zprávy
        if (message.senderId === -1) return null;

        const payload = {
            notification: {
                title: `Nová zpráva: ${message.senderName}`,
                body: message.text.length > 100 ? message.text.substring(0, 97) + '...' : message.text,
                icon: '/icon-192.svg',
                clickAction: `/#/chat`, // URL kam notifikace vede
            }
        };

        // Zjistit komu poslat (všichni v kanálu kromě odesílatele)
        // Pro jednoduchost teď pošleme všem, kdo mají zaregistrovaný fcmToken
        const workersSnapshot = await admin.database().ref('/workers').once('value');
        const workers = workersSnapshot.val();

        const tokens = [];
        if (workers) {
            Object.values(workers).forEach(worker => {
                // Neposílat odesílateli
                if (worker.id !== message.senderId && worker.fcmToken) {
                    tokens.push(worker.fcmToken);
                }
            });
        }

        if (tokens.length > 0) {
            try {
                const response = await admin.messaging().sendToDevice(tokens, payload);
                console.log(`Notifikace odeslána na ${tokens.length} zařízení.`, response);
            } catch (error) {
                console.error('Chyba při odesílání notifikací:', error);
            }
        }

        return null;
    });

/**
 * Notifikace při změně stavu stolu (např. nahlášení závady)
 */
exports.sendDefectNotification = functions.database.ref('/fieldTables/{tableKey}')
    .onUpdate(async (change, context) => {
        const after = change.after.val();
        const before = change.before.val();

        // Pokud se změnil status na 'defect'
        if (after.status === 'defect' && before.status !== 'defect') {
            const payload = {
                notification: {
                    title: `⚠️ Závada na projektu: ${after.projectId}`,
                    body: `Stůl ${after.tableId} byl nahlášen jako vadný.`,
                    icon: '/icon-192.svg'
                }
            };

            // Poslat adminům
            const workersSnapshot = await admin.database().ref('/workers').once('value');
            const workers = workersSnapshot.val();
            const adminTokens = [];

            if (workers) {
                Object.values(workers).forEach(worker => {
                    // Tady by byla logika pro zjištění admina, zatím pošleme všem s tokenem
                    // Ideálně kontrolovat worker.role === 'admin' pokud to v DB máme
                    if (worker.fcmToken) {
                        adminTokens.push(worker.fcmToken);
                    }
                });
            }

            if (adminTokens.length > 0) {
                await admin.messaging().sendToDevice(adminTokens, payload);
            }
        }
        return null;
    });
