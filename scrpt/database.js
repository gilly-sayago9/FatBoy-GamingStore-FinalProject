// --- FIREBASE CONFIGURATION (From your SDK) ---
const firebaseConfig = {
    apiKey: "AIzaSyDrhrXouDJHrs4BrNB1bcpQ1AKnrORMnso",
    authDomain: "fatboy-gamestore.firebaseapp.com",
    projectId: "fatboy-gamestore",
    storageBucket: "fatboy-gamestore.firebasestorage.app",
    messagingSenderId: "270239523176",
    appId: "1:270239523176:web:301074b5fbd6c5e7e2f6dd",
    measurementId: "G-MH1RRH3BGB"
};

// Initialize Firebase using Global Namespaces (Compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics();

// --- DATABASE HELPER FUNCTIONS ---
const database = {
    // 1. SAVE/UPDATE USER DATA (Merges updates like cart items and history)
    saveUser: async (user) => {
        if (!user || !user.uid) return;
        
        try {
            await db.collection('users').doc(user.uid).set({
                username: user.username,
                email: user.email,
                role: user.role,
                cart: user.cart || [],
                history: user.history || []
            }, { merge: true });
        } catch (error) {
            console.error("Error saving user:", error);
        }
    },

    // 2. GET USER DATA (On login)
    getUser: async (uid) => {
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                return { uid: uid, ...doc.data() };
            }
            return null;
        } catch (error) {
            console.error("Error getting user:", error);
            return null;
        }
    },

    // 3. GET GAMES (Reads from Firestore 'games' collection)
    getGames: async () => {
        try {
            const snapshot = await db.collection('games').get();
            if (snapshot.empty) {
                // If DB is empty, add default games (Seeding)
                const initialGames = [
                    { id: 1, title: 'Elden Ring', price: 59.99, img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200' },
                    { id: 2, title: 'Cyberpunk 2077', price: 29.99, img: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=200' },
                    { id: 3, title: 'GTA V', price: 19.99, img: 'https://images.unsplash.com/photo-1621259182902-88543d354b0d?auto=format&fit=crop&q=80&w=200' }
                ];
                initialGames.forEach(async (g) => {
                    await db.collection('games').doc(String(g.id)).set(g);
                });
                return initialGames;
            }
            return snapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error("Error getting games:", error);
            return [];
        }
    },

    // 4. ADMIN: SAVE/UPDATE GAME
    saveGameToDB: async (game) => {
        await db.collection('games').doc(String(game.id)).set(game, { merge: true });
    },

    // 5. ADMIN: DELETE GAME
    deleteGameFromDB: async (id) => {
        await db.collection('games').doc(String(id)).delete();
    },

    // 6. ADMIN: GET ALL USERS
    getAllUsers: async () => {
        const snapshot = await db.collection('users').get();
        return snapshot.docs.map(doc => doc.data());
    },

    // 7. ADMIN: DELETE USER
    deleteUserFromDB: async (username) => {
        const snapshot = await db.collection('users').where('username', '==', username).get();
        snapshot.forEach(doc => {
            doc.ref.delete();
        });
    }
};