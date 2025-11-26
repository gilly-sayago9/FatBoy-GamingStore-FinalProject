const app = {
    // STATE
    currentUser: null,
    isRegistering: false,

    // --- SESSION MANAGEMENT ---
    // Save user to browser memory
    saveSession: (user) => {
        localStorage.setItem('fbg_session', JSON.stringify(user));
        app.currentUser = user;
    },

    // Load user from browser memory
    loadSession: () => {
        const session = localStorage.getItem('fbg_session');
        if (session) {
            app.currentUser = JSON.parse(session);
        }
        return app.currentUser;
    },

    // Clear memory (Logout)
    clearSession: () => {
        localStorage.removeItem('fbg_session');
        app.currentUser = null;
    },

    // Check if user is allowed on this page
    checkLogin: (requiredRole) => {
        const user = app.loadSession();
        if (!user) {
            window.location.href = 'index.html'; // Not logged in? Go to login
            return;
        }
        
        // If user tries to access admin page, or admin tries to access user page
        if (requiredRole && user.role !== requiredRole) {
            if(user.role === 'admin') window.location.href = 'admin.html';
            else window.location.href = 'dashboard.html';
        }

        // If on dashboard, update the UI details
        if(requiredRole === 'user') {
            app.updateDashboardUI();
        }
    },

    // --- AUTHENTICATION ---
    toggleAuthMode: () => {
        app.isRegistering = !app.isRegistering;
        document.getElementById('auth-title').innerText = app.isRegistering ? "Create Account" : "Log in to continue";
        document.querySelector('.btn-primary').innerText = app.isRegistering ? "Sign Up" : "Log in";
        document.getElementById('auth-switch-text').innerText = app.isRegistering ? "Already have an account? Log in" : "Create an account";
    },

    handleAuth: (e) => {
        e.preventDefault();
        const userIn = document.getElementById('username').value;
        const passIn = document.getElementById('password').value;
        const users = db.getData('fbg_users');

        if (app.isRegistering) {
            // Register
            if (users.find(u => u.username === userIn)) {
                alert("Username already taken!");
                return;
            }
            users.push({ username: userIn, password: passIn, role: 'user', history: [] });
            db.setData('fbg_users', users);
            alert("Account created! Please log in.");
            app.toggleAuthMode();
        } else {
            // Login
            const user = users.find(u => u.username === userIn && u.password === passIn);
            if (user) {
                // Init session with cart (if not present)
                const sessionUser = { ...user, cart: [] }; 
                app.saveSession(sessionUser);

                // REDIRECT based on role
                if (user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            } else {
                alert("Invalid credentials!");
            }
        }
    },

    logout: () => {
        app.clearSession();
        window.location.href = 'index.html';
    },

    // --- VIDEO SOUND LOGIC (Index.html only) ---
    toggleVideoSound: () => {
        const video = document.getElementById('bg-video');
        const icon = document.querySelector('.sound-icon');
        if(!video) return;

        video.muted = !video.muted;
        if (video.muted) {
            icon.classList.remove('fa-volume-high');
            icon.classList.add('fa-volume-mute');
            icon.style.color = 'white';
        } else {
            icon.classList.remove('fa-volume-mute');
            icon.classList.add('fa-volume-high');
            icon.style.color = '#facc15';
        }
    },

    // --- NAVIGATION (Dashboard.html only) ---
    hideAll: () => {
        document.querySelectorAll('.main-content').forEach(el => el.classList.add('hidden'));
    },
    
    showShop: () => {
        app.hideAll();
        document.getElementById('shop-section').classList.remove('hidden');
        app.renderGames();
    },

    showCart: () => {
        app.hideAll();
        document.getElementById('cart-section').classList.remove('hidden');
        app.renderCart();
    },

    showDashboard: () => {
        app.hideAll();
        document.getElementById('dashboard-section').classList.remove('hidden');
        app.renderUserDashboard();
    },

    // --- USER LOGIC ---
    updateDashboardUI: () => {
        if(document.getElementById('cart-count')) {
            document.getElementById('cart-count').innerText = app.currentUser.cart.length;
        }
    },

    renderGames: () => {
        const games = db.getData('fbg_games');
        const container = document.getElementById('games-grid');
        if(!container) return; // Guard clause
        
        container.innerHTML = games.map(g => `
            <div class="game-card">
                <img src="${g.img || 'https://placehold.co/200x150?text=No+Image'}" alt="${g.title}">
                <h3>${g.title}</h3>
                <span class="price">$${g.price}</span>
                <button class="btn-primary" onclick="app.addToCart(${g.id})">Add to Cart</button>
            </div>
        `).join('');
    },

    addToCart: (gameId) => {
        const games = db.getData('fbg_games');
        const game = games.find(g => g.id === gameId);
        
        app.currentUser.cart.push(game);
        app.saveSession(app.currentUser); // Update session storage
        
        app.updateDashboardUI();
        alert(`${game.title} added to cart!`);
    },

    removeFromCart: (index) => {
        app.currentUser.cart.splice(index, 1);
        app.saveSession(app.currentUser); // Update session storage
        app.renderCart();
        app.updateDashboardUI();
    },

    renderCart: () => {
        const container = document.getElementById('cart-items');
        if(!container) return;

        let total = 0;
        if(app.currentUser.cart.length === 0) {
            container.innerHTML = "<p>Cart is empty.</p>";
        } else {
            container.innerHTML = app.currentUser.cart.map((item, index) => {
                total += item.price;
                return `
                <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${item.img || 'https://placehold.co/50'}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                        <span>${item.title}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <span>$${item.price}</span>
                        <span class="delete-btn" onclick="app.removeFromCart(${index})" title="Remove Item">
                            <i class="fas fa-times"></i>
                        </span>
                    </div>
                </div>`;
            }).join('');
        }
        document.getElementById('total-price').innerText = total.toFixed(2);
    },

    checkout: () => {
        if (app.currentUser.cart.length === 0) return alert("Cart is empty");
        
        // 1. Get real DB users
        const users = db.getData('fbg_users');
        const dbUserIndex = users.findIndex(u => u.username === app.currentUser.username);
        
        // 2. Create Record
        const purchaseRecord = { 
            date: new Date().toLocaleString(), 
            items: app.currentUser.cart, 
            total: parseFloat(document.getElementById('total-price').innerText) 
        };
        
        // 3. Update DB
        users[dbUserIndex].history.push(purchaseRecord);
        db.setData('fbg_users', users);
        
        // 4. Update Session
        app.currentUser.history = users[dbUserIndex].history;
        app.currentUser.cart = [];
        app.saveSession(app.currentUser);

        // 5. Reset UI
        app.updateDashboardUI();
        alert("Thank you for buying at FatBoy GameStop!");
        app.showDashboard(); 
    },

    renderUserDashboard: () => {
        const user = app.currentUser;
        document.getElementById('dash-username').innerText = user.username;
        let totalGames = 0;
        let totalSpent = 0;
        
        if(user.history) {
            user.history.forEach(order => {
                totalGames += order.items.length;
                totalSpent += order.total;
            });
        }
        document.getElementById('stat-count').innerText = totalGames;
        document.getElementById('stat-spent').innerText = '$' + totalSpent.toFixed(2);
        document.getElementById('stat-cart-count').innerText = user.cart.length;

        const historyContainer = document.getElementById('user-purchase-history');
        if (!user.history || user.history.length === 0) {
            historyContainer.innerHTML = '<p style="color:#666;">You haven\'t bought any games yet.</p>';
        } else {
            const reversedHistory = [...user.history].reverse(); 
            historyContainer.innerHTML = reversedHistory.map(order => `
                <div class="history-card">
                    <div class="history-header">
                        <span>Date: ${order.date}</span>
                        <span>Total: <strong style="color:white">$${order.total.toFixed(2)}</strong></span>
                    </div>
                    <ul class="history-items">
                        ${order.items.map(item => `<li>• ${item.title}</li>`).join('')}
                    </ul>
                </div>
            `).join('');
        }
    },

    // --- ADMIN LOGIC ---
    handleGameForm: (e) => {
        e.preventDefault();
        const title = document.getElementById('new-game-title').value;
        const price = parseFloat(document.getElementById('new-game-price').value);
        const fileInput = document.getElementById('new-game-img');
        const file = fileInput.files[0];
        const editId = document.getElementById('edit-game-id').value;

        const processSave = (imgUrl) => {
            const games = db.getData('fbg_games');

            if (editId) {
                const index = games.findIndex(g => g.id == editId);
                if (index > -1) {
                    const finalImg = imgUrl || games[index].img;
                    games[index] = { ...games[index], title, price, img: finalImg };
                    alert("Game Updated!");
                    app.cancelEdit(); 
                }
            } else {
                games.push({ id: Date.now(), title, price, img: imgUrl });
                alert("Game Added!");
                e.target.reset();
            }
            db.setData('fbg_games', games);
            app.renderAdminPanel();
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) { processSave(event.target.result); };
            reader.readAsDataURL(file); 
        } else {
            processSave('');
        }
    },

    startEdit: (id) => {
        const games = db.getData('fbg_games');
        const game = games.find(g => g.id === id);
        
        document.getElementById('new-game-title').value = game.title;
        document.getElementById('new-game-price').value = game.price;
        document.getElementById('edit-game-id').value = game.id;
        
        document.getElementById('form-game-heading').innerText = "Edit Game";
        document.getElementById('btn-save-game').innerText = "Update Game";
        document.getElementById('btn-save-game').style.backgroundColor = "#3498db"; 
        document.getElementById('btn-cancel-edit').style.display = "inline-block";
        document.querySelector('.admin-panel').scrollIntoView({ behavior: 'smooth' });
    },

    cancelEdit: () => {
        document.getElementById('game-form').reset();
        document.getElementById('edit-game-id').value = "";
        document.getElementById('form-game-heading').innerText = "Add New Game";
        document.getElementById('btn-save-game').innerText = "Add Game";
        document.getElementById('btn-save-game').style.backgroundColor = ""; 
        document.getElementById('btn-cancel-edit').style.display = "none";
    },

    deleteGame: (id) => {
        if(confirm("Delete this game?")) {
            let games = db.getData('fbg_games');
            games = games.filter(g => g.id !== id);
            db.setData('fbg_games', games);
            app.renderAdminPanel();
            if(document.getElementById('edit-game-id').value == id) app.cancelEdit();
        }
    },

    deleteUser: (username) => {
        if(confirm(`Are you sure you want to delete user "${username}"?`)) {
            let users = db.getData('fbg_users');
            users = users.filter(u => u.username !== username);
            db.setData('fbg_users', users);
            app.renderAdminPanel();
        }
    },

    renderAdminPanel: () => {
        const container = document.getElementById('admin-game-list');
        if(!container) return;

        const games = db.getData('fbg_games');
        container.innerHTML = games.map(g => `
            <li style="padding:5px 0; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${g.img || 'https://placehold.co/50'}" style="width:30px; height:30px; object-fit:cover; border-radius:4px;">
                    <span>${g.title} ($${g.price})</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <span class="edit-btn" onclick="app.startEdit(${g.id})" title="Edit Game"><i class="fas fa-pen"></i></span>
                    <span class="delete-btn" onclick="app.deleteGame(${g.id})" title="Delete Game"><i class="fas fa-trash"></i></span>
                </div>
            </li>
        `).join('');

        const users = db.getData('fbg_users');
        const userListContainer = document.getElementById('admin-user-list');
        userListContainer.innerHTML = users.filter(u => u.role !== 'admin').map(u => {
            const historyHTML = u.history.length ? u.history.map(h => `
                <div style="margin-left:15px; font-size:0.8rem; color:#aaa;">
                    [${h.date}] Spent: $${h.total} (${h.items.length} games)
                </div>
            `).join('') : '<div style="margin-left:15px; font-size:0.8rem;">No purchases yet.</div>';

            return `
                <div class="user-history-item">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>User: ${u.username}</strong>
                        <span class="delete-btn" onclick="app.deleteUser('${u.username}')" title="Delete User"><i class="fas fa-trash"></i></span>
                    </div>
                    ${historyHTML}
                </div>
            `;
        }).join('');
    }
};