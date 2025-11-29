const app = {
    // STATE
    currentUser: null,
    isRegistering: false,
    cachedGames: [], // Stores games for search filtering

    // --- INITIALIZATION ---
    init: () => {
        // Runs on all pages, handles redirection and state setting
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userData = await database.getUser(firebaseUser.uid);
                if(userData) {
                    app.currentUser = userData;
                    app.initPage(); // Call page-specific setup
                }
            } else if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin')) {
                // If on a restricted page without user, redirect to login
                window.location.href = 'index.html';
            }
        });
    },

    // Runs page-specific functions once the user is confirmed logged in
    initPage: () => {
        const path = window.location.pathname;

        // Pause video if user lands on index
        const video = document.getElementById('bg-video');
        if(video) video.pause(); 
        
        if (path.includes('user_dashboard')) {
            app.checkUserRole('user', app.currentUser.uid);
            app.renderGames(); // Load Shop
            app.updateDashboardUI();
            app.showShop(); // Default view
        } else if (path.includes('admin_dashboard')) {
            app.checkUserRole('admin', app.currentUser.uid);
            app.renderAdminPanel();
        }
    },

    // Check role and redirect if incorrect
    checkUserRole: async (requiredRole, uid) => {
        const userData = await database.getUser(uid);
        app.currentUser = userData;

        if (userData.role !== requiredRole) {
            if (userData.role === 'admin') {
                window.location.href = 'admin_dashboard.html';
            } else {
                window.location.href = 'user_dashboard.html';
            }
            return;
        }

        // Update UI elements that exist on that page
        if (document.getElementById('cart-count')) {
            document.getElementById('cart-count').innerText = app.currentUser.cart.length;
        }
    },

    // --- SEARCH LOGIC ---
    handleSearch: () => {
        const query = document.getElementById('search-input').value.toLowerCase();
        
        if (query.length > 0) {
            // Show Search View, Hide Browsing View
            document.getElementById('browsing-view').classList.add('hidden');
            document.getElementById('search-view').classList.remove('hidden');
            
            // Filter from cached games
            const filteredGames = app.cachedGames.filter(game => 
                game.title.toLowerCase().includes(query)
            );
            app.renderGameList(filteredGames, 'search-results-grid');
        } else {
            app.clearSearch();
        }
    },

    clearSearch: () => {
        const searchInput = document.getElementById('search-input');
        if(searchInput) searchInput.value = '';
        
        document.getElementById('browsing-view').classList.remove('hidden');
        document.getElementById('search-view').classList.add('hidden');
    },

    // --- SHOP LOGIC ---
    renderGames: async () => {
        // 1. Fetch Games and Users (to calculate popularity)
        const games = await database.getGames();
        const users = await database.getAllUsers(); 

        // 2. Calculate Popularity (Count Sales)
        const salesCount = {};
        users.forEach(u => {
            if(u.history) {
                u.history.forEach(order => {
                    order.items.forEach(item => {
                        salesCount[item.id] = (salesCount[item.id] || 0) + 1;
                    });
                });
            }
        });

        // 3. Sort by Popularity (Sales Descending)
        const popularGames = [...games].map(g => ({
            ...g,
            sales: salesCount[g.id] || 0
        })).sort((a, b) => b.sales - a.sales);

        // 4. Cache for search
        app.cachedGames = popularGames;

        // 5. Render to Main Grid
        app.renderGameList(popularGames, 'games-grid');
    },

    // Helper to render "Anker-style" Cards (Center Button + Bottom Info)
    renderGameList: (gamesList, containerId) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        
        if(gamesList.length === 0) {
            container.innerHTML = '<p style="color:#aaa; width:100%; text-align:center;">No games found.</p>';
            return;
        }

        container.innerHTML = gamesList.map(g => `
            <div class="game-card">
                <img src="${g.img || 'https://placehold.co/200x150?text=No+Image'}" alt="${g.title}">
                
                <button class="center-cart-btn" onclick="app.addToCart(${g.id})">
                    Add to Cart
                </button>

                <div class="game-info-bottom">
                    <h3>${g.title}</h3>
                    <span class="price">$${g.price}</span>
                </div>
            </div>
        `).join('');
    },

    // --- CART LOGIC ---
    addToCart: async (gameId) => {
        const games = await database.getGames();
        const game = games.find(g => g.id === gameId);
        
        // VALIDATION: Check if game is already in the cart
        const alreadyInCart = app.currentUser.cart.some(item => item.id === gameId);

        if (alreadyInCart) {
            alert(`${game.title} is already in your cart!`);
            return;
        }
        
        app.currentUser.cart.push(game);
        await database.saveUser(app.currentUser);
        app.updateDashboardUI();
        alert(`${game.title} added to cart!`);
    },

    removeFromCart: async (index) => {
        app.currentUser.cart.splice(index, 1);
        await database.saveUser(app.currentUser);
        app.renderCart();
        app.updateDashboardUI();
    },

    updateDashboardUI: () => {
        if(app.currentUser && document.getElementById('cart-count')) {
            document.getElementById('cart-count').innerText = app.currentUser.cart.length;
        }
    },

    renderCart: () => {
        const container = document.getElementById('cart-items');
        if(!container) return;
        let total = 0;
        
        if(!app.currentUser.cart || app.currentUser.cart.length === 0) {
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
        if(document.getElementById('total-price')) document.getElementById('total-price').innerText = total.toFixed(2);
    },

    // --- PAYMENT & CHECKOUT ---
    openPaymentModal: () => {
        if (!app.currentUser.cart || app.currentUser.cart.length === 0) return alert("Cart is empty");
        const total = document.getElementById('total-price').innerText;
        document.getElementById('checkout-total').innerText = '$' + total;
        document.getElementById('payment-modal').classList.remove('hidden');
        app.togglePaymentFields();
    },

    togglePaymentFields: () => {
        const method = document.getElementById('payment-method').value;
        const container = document.getElementById('payment-fields');
        if(!container) return;
        let html = '';
        const inputStyle = "width:100%; padding:10px; margin-bottom:10px; background:#27272a; border:1px solid #333; color:white; border-radius:6px;";

        if (method === 'gcash' || method === 'paymaya') {
            html = `
                <label style="color:#aaa; font-size:0.8rem;">Mobile Number (09XXXXXXXXX)</label>
                <input type="number" id="pay-number" placeholder="09123456789" style="${inputStyle}">
            `;
        } else if (method === 'card') {
            html = `
                <label style="color:#aaa; font-size:0.8rem;">Card Number</label>
                <input type="text" id="card-num" placeholder="XXXX-XXXX-XXXX-XXXX" style="${inputStyle}">
                <div style="display:flex; gap:10px;">
                    <input type="text" placeholder="MM/YY" style="${inputStyle}">
                    <input type="text" placeholder="CVC" style="${inputStyle}">
                </div>
            `;
        }
        container.innerHTML = html;
    },

    processPayment: async () => {
        const method = document.getElementById('payment-method').value;
        if (!method) return alert("Please select a payment method");

        // STEP 1: PHONE VALIDATION
        if (method === 'gcash' || method === 'paymaya') {
            const number = document.getElementById('pay-number').value;
            const phPhoneRegex = /^09\d{9}$/; 
            if (!phPhoneRegex.test(number)) {
                alert(`Invalid ${method === 'gcash' ? 'GCash' : 'PayMaya'} number!\n\nMust start with '09' and contain exactly 11 digits.`);
                return;
            }
        }

        // STEP 2: OWNERSHIP VALIDATION
        const userHistory = app.currentUser.history || [];
        const currentCartIds = app.currentUser.cart.map(item => item.id);
        const ownedGameIds = userHistory.flatMap(order => order.items.map(item => item.id));
        const duplicatePurchase = currentCartIds.find(id => ownedGameIds.includes(id));

        if (duplicatePurchase) {
            const game = app.currentUser.cart.find(item => item.id === duplicatePurchase);
            document.getElementById('payment-modal').classList.add('hidden');
            alert(`TRANSACTION CANCELLED: You already own the game "${game.title}". Please remove it from your cart before checking out.`);
            return; 
        }

        // STEP 3: PROCESS SUCCESS
        const total = parseFloat(document.getElementById('checkout-total').innerText.replace('$', ''));
        const purchaseRecord = { 
            date: new Date().toLocaleString(), 
            items: app.currentUser.cart, 
            total: total,
            paymentMethod: method
        };

        app.currentUser.history.push(purchaseRecord);
        app.currentUser.cart = [];
        
        await database.saveUser(app.currentUser);
        
        // --- FIX: UPDATE UI IMMEDIATELY ---
        app.updateDashboardUI(); // Updates the Navbar Badge to 0
        app.renderCart();        // Clears the cart list view
        // ----------------------------------

        document.getElementById('payment-modal').classList.add('hidden');
        alert(`Payment successful via ${method.toUpperCase()}!`);
        app.showDashboard();
    },

    // --- NAVIGATION ---
    hideAll: () => document.querySelectorAll('.main-content').forEach(el => el.classList.add('hidden')),
    
    showShop: () => {
        app.hideAll();
        document.getElementById('shop-section').classList.remove('hidden');
        // Do NOT re-render to avoid losing scroll position or state
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

    showAdmin: () => {
        if(app.currentUser.role !== 'admin') return;
        document.getElementById('admin-section').classList.remove('hidden');
        app.renderAdminPanel();
    },

    // --- DASHBOARD LOGIC (User History) ---
    renderUserDashboard: () => {
        const user = app.currentUser;
        if(!document.getElementById('dash-username')) return;

        document.getElementById('dash-username').innerText = user.username;
        document.getElementById('stat-cart-count').innerText = user.cart ? user.cart.length : 0;

        let totalGames = 0;
        let totalSpent = 0;
        let historyHTML = '<p style="color:#666;">You haven\'t bought any games yet.</p>';

        if(user.history && user.history.length > 0) {
            user.history.forEach(order => {
                totalGames += order.items.length;
                totalSpent += order.total;
            });

            const reversedHistory = [...user.history].reverse();
            historyHTML = reversedHistory.map(order => `
                <div class="history-card">
                    <div class="history-header">
                        <span>${order.date}</span>
                        <span style="color:#facc15; font-weight:bold;">${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}</span>
                    </div>
                    <div>Total: <strong style="color:white">$${order.total.toFixed(2)}</strong></div>
                    <ul class="history-items">
                        ${order.items.map(item => `<li>• ${item.title}</li>`).join('')}
                    </ul>
                </div>
            `).join('');
        }

        document.getElementById('stat-count').innerText = totalGames;
        document.getElementById('stat-spent').innerText = '$' + totalSpent.toFixed(2);
        document.getElementById('user-purchase-history').innerHTML = historyHTML;
    },

    // --- ADMIN LOGIC ---
    handleGameForm: async (e) => {
        e.preventDefault();
        const title = document.getElementById('new-game-title').value;
        const price = parseFloat(document.getElementById('new-game-price').value);
        const fileInput = document.getElementById('new-game-img');
        const file = fileInput.files[0];
        const editId = document.getElementById('edit-game-id').value;
        const gameId = editId ? Number(editId) : Date.now();

        const processSave = async (imgUrl) => {
            // If editing and no new image, keep old image
            let finalImgUrl = imgUrl;
            if (!finalImgUrl && editId) {
                const currentGames = await database.getGames();
                const oldGame = currentGames.find(g => g.id == editId);
                finalImgUrl = oldGame ? oldGame.img : '';
            }

            const gameData = { 
                id: gameId,
                title, 
                price, 
                img: finalImgUrl 
            };
            
            await database.saveGameToDB(gameData);
            alert(editId ? "Game Updated!" : "Game Added!");
            app.cancelEdit();
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

    startEdit: async (id) => {
        const games = await database.getGames();
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

    deleteGame: async (id) => {
        if(confirm("Delete this game?")) {
            await database.deleteGameFromDB(id);
            app.renderAdminPanel();
        }
    },

    deleteUser: async (username) => {
        if(confirm(`Delete user "${username}"?`)) {
            await database.deleteUserFromDB(username);
            app.renderAdminPanel();
        }
    },

    renderAdminPanel: async () => {
        const adminGameList = document.getElementById('admin-game-list');
        const adminUserList = document.getElementById('admin-user-list');
        if(!adminGameList) return;

        const games = await database.getGames();
        adminGameList.innerHTML = games.map(g => `
            <li style="padding:5px 0; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${g.img || 'https://placehold.co/50'}" style="width:30px; height:30px; object-fit:cover; border-radius:4px;">
                    <span>${g.title} ($${g.price})</span>
                </div>
                <div style="display:flex; gap:10px;">
                    <span class="edit-btn" onclick="app.startEdit(${g.id})" title="Edit Game" style="cursor:pointer; color:#3498db;">
                        <i class="fas fa-pen"></i>
                    </span>
                    <span class="delete-btn" onclick="app.deleteGame(${g.id})" title="Delete Game">
                        <i class="fas fa-trash"></i>
                    </span>
                </div>
            </li>
        `).join('');

        const users = await database.getAllUsers();
        adminUserList.innerHTML = users.filter(u => u.role !== 'admin').map(u => `
            <div class="user-history-item">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${u.username}</strong>
                    <span class="delete-btn" onclick="app.deleteUser('${u.username}')" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </span>
                </div>
                <div style="font-size:0.8rem; color:#aaa; margin-left:10px;">
                    History: ${u.history ? u.history.length : 0} purchases
                </div>
            </div>
        `).join('');
    },

    // --- OTHER CORE FUNCTIONS ---
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

    toggleAuthMode: () => {
        app.isRegistering = !app.isRegistering;
        document.getElementById('auth-title').innerText = app.isRegistering ? "Create Account" : "Log in to continue";
        document.querySelector('.btn-primary').innerText = app.isRegistering ? "Sign Up" : "Log in";
        document.getElementById('auth-switch-text').innerText = app.isRegistering ? "Already have an account? Log in" : "Create an account";
    },

    handleAuth: async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = username.includes('@') ? username : username + "@fatboy.com"; 
        const pass = document.getElementById('password').value;

        try {
            if (app.isRegistering) {
                const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
                await database.saveUser({
                    uid: userCredential.user.uid,
                    username: username,
                    email: email,
                    role: 'user', 
                    cart: [],
                    history: []
                });
                alert("Account created! Logging in...");
                window.location.href = 'user_dashboard.html';
            } else {
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                const userData = await database.getUser(userCredential.user.uid);
                if (userData.role === 'admin') {
                    window.location.href = 'admin_dashboard.html';
                } else {
                    window.location.href = 'user_dashboard.html';
                }
            }
        } catch (error) {
            alert("Error: " + error.message);
        }
    },

    logout: () => {
        auth.signOut();
        window.location.href = 'index.html';
    }
};

// Start App
app.init();