
// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
    apiKey: "AIzaSyCNTmfg7r1hf1SFnJhXZSV0vejWWJB2oew",
    authDomain: "mst-marty-solar-2025.firebaseapp.com",
    databaseURL: "https://mst-marty-solar-2025-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "mst-marty-solar-2025",
    storageBucket: "mst-marty-solar-2025.firebasestorage.app",
    messagingSenderId: "706935785372",
    appId: "1:706935785372:web:abf4d4e888d3d10ee2ea59",
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: payload.notification.icon || '/icon-192.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
