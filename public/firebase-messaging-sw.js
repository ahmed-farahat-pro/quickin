importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

// Access the environment variables from the URL query string (workaround for SW)
// Or hardcode the public config here since it is public anyway.
const firebaseConfig = {
    apiKey: "AIzaSyB9QpqqZ6mWU5W_efdYjxOVvV0R9POCpIc",
    authDomain: "quickin-7d9c1.firebaseapp.com",
    projectId: "quickin-7d9c1",
    storageBucket: "quickin-7d9c1.firebasestorage.app",
    messagingSenderId: "528153634416",
    appId: "1:528153634416:web:7123d8cafd7a88b446b6b5",
    measurementId: "G-BCQTHGT1SX"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);

        // Customize notification here safely
        const notificationTitle = payload?.notification?.title || payload?.data?.title || 'New Notification';
        const notificationOptions = {
            body: payload?.notification?.body || payload?.data?.body || 'You have a new message.',
            icon: '/logo-icon.png', // Fallback to your actual logo icon
            data: payload?.data || {}
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
    });
} catch (err) {
    console.log("Error initializing Firebase SW", err);
}
