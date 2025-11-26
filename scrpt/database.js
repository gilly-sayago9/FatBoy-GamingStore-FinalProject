const db = {
    // --- DATABASE SIMULATION (LocalStorage) ---
    initDB: () => {
        if (!localStorage.getItem('fbg_users')) {
            const initialUsers = [
                // ADMIN ACCOUNT (Pre-made)
                { username: 'admin', password: '123', role: 'admin', history: [] },
                // TEST USER
                { username: 'user', password: '123', role: 'user', history: [] }
            ];
            localStorage.setItem('fbg_users', JSON.stringify(initialUsers));
        }
        if (!localStorage.getItem('fbg_games')) {
            const initialGames = [
                { id: 1, title: 'Elden Ring', price: 59.99, img: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=200' },
                { id: 2, title: 'Cyberpunk 2077', price: 29.99, img: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&q=80&w=200' },
                { id: 3, title: 'GTA V', price: 19.99, img: 'https://images.unsplash.com/photo-1621259182902-88543d354b0d?auto=format&fit=crop&q=80&w=200' }
            ];
            localStorage.setItem('fbg_games', JSON.stringify(initialGames));
        }
    },

    getData: (key) => JSON.parse(localStorage.getItem(key)),
    setData: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
};

// Initialize immediately when file loads
db.initDB();