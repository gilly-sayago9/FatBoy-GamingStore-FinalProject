// --- FIREBASE CONFIGURATION (DATA) ---
const firebaseConfig = {
    apiKey: "AIzaSyDrhrXouDJHrs4BrNB1bcpQ1AKnrORMnso",
    authDomain: "fatboy-gamestore.firebaseapp.com",
    projectId: "fatboy-gamestore",
    messagingSenderId: "270239523176",
    appId: "1:270239523176:web:301074b5fbd6c5e7e2f6dd",
    measurementId: "G-MH1RRH3BGB"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// --- CLOUDINARY CONFIGURATION (IMAGES) ---
const CLOUDINARY_CLOUD_NAME = "dbfgqoelw"; 
const CLOUDINARY_PRESET = "fatboy_uploads"; 

const database = {
    // --- FIREBASE DATABASE FUNCTIONS ---

    saveUser: async (user) => {
        if (!user || !user.uid) return;
        try {
            await db.collection('users').doc(user.uid).set({
                username: user.username,
                email: user.email,
                role: user.role || 'user',
                cart: user.cart || [],
                history: user.history || []
            }, { merge: true });
        } catch (error) {
            console.error("Error saving user:", error);
            throw error;
        }
    },

    getUser: async (uid) => {
        try {
            const doc = await db.collection('users').doc(uid).get();
            return doc.exists ? { uid: uid, ...doc.data() } : null;
        } catch (error) {
            console.error("Error getting user:", error);
            return null;
        }
    },

    // Find User by Username (for Login)
    findUserByUsername: async (username) => {
        try {
            const snapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();
            
            if (snapshot.empty) return null;
            return snapshot.docs[0].data();
        } catch (error) {
            console.error("Error finding username:", error);
            return null;
        }
    },

    getGames: async () => {
        try {
            const snapshot = await db.collection('games').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error("Error getting games:", error);
            return [];
        }
    },

    saveGameToDB: async (game) => {
        await db.collection('games').doc(String(game.id)).set(game, { merge: true });
    },

    deleteGameFromDB: async (id) => {
        await db.collection('games').doc(String(id)).delete();
    },

    getAllUsers: async () => {
        try {
            const snapshot = await db.collection('users').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (error) {
            console.error("Error getting users:", error);
            return [];
        }
    },

    deleteUserFromDB: async (username) => {
        const snapshot = await db.collection('users').where('username', '==', username).get();
        const deletePromises = [];
        snapshot.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);
    },

    // --- CLOUDINARY UPLOAD FUNCTION ---
    uploadImage: async (file) => {
        if (!file) return null;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_PRESET);

        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            if (!response.ok) throw new Error("Cloudinary Upload Failed");

            const data = await response.json();
            return data.secure_url; 
        } catch (error) {
            console.error("Upload Error:", error);
            alert("Failed to upload image. Check console.");
            return null;
        }
    }
};