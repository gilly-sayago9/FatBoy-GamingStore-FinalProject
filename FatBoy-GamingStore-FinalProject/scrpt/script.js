const app = {
    // STATE
    currentUser: null,
    isRegistering: false,
    cachedGames: [],

    // --- HELPER: OPTIMIZE CLOUDINARY URLS ---
    getOptimizedUrl: (url, width = 400) => {
        if (!url) return 'https://placehold.co/200x150?text=No+Image';
        if (url.includes('cloudinary.com')) {
            // w_400: Resize, q_auto: Optimize quality, f_auto: Best format
            return url.replace('/upload/', `/upload/w_${width},c_fill,q_auto,f_auto/`);
        }
        return url; 
    },

    // --- INITIALIZATION ---
    init: () => {
        auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userData = await database.getUser(firebaseUser.uid);
                if(userData) {
                    app.currentUser = userData;
                    app.initPage();
                }
            } else if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin')) {
                window.location.href = 'index.html';
            }
        });
    },

    initPage: () => {
        const path = window.location.pathname;
        const video = document.getElementById('bg-video');
        if(video) video.pause(); 
        
        if (path.includes('user_dashboard')) {
            app.checkUserRole('user', app.currentUser.uid);
            app.renderGames();
            app.updateDashboardUI();
            app.showShop();
        } else if (path.includes('admin_dashboard')) {
            app.checkUserRole('admin', app.currentUser.uid);
            if(window.admin) window.admin.init(); 
        }
    },

    checkUserRole: async (requiredRole, uid) => {
        const userData = await database.getUser(uid);
        app.currentUser = userData;

        if (userData.role !== requiredRole) {
            window.location.href = userData.role === 'admin' ? 'admin_dashboard.html' : 'user_dashboard.html';
            return;
        }
        if (document.getElementById('cart-count')) {
            document.getElementById('cart-count').innerText = app.currentUser.cart.length;
        }
    },

    handleSearch: () => {
        const query = document.getElementById('search-input').value.toLowerCase();
        if (query.length > 0) {
            document.getElementById('browsing-view').classList.add('hidden');
            document.getElementById('search-view').classList.remove('hidden');
            const filteredGames = app.cachedGames.filter(game => game.title.toLowerCase().includes(query));
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

    renderGames: async () => {
        const games = await database.getGames();
        const users = await database.getAllUsers(); 
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

        const popularGames = [...games].map(g => ({
            ...g,
            sales: salesCount[g.id] || 0
        })).sort((a, b) => b.sales - a.sales);

        app.cachedGames = popularGames;
        app.renderGameList(popularGames, 'games-grid');
    },

    // --- RENDER WITH HOVER ---
    renderGameList: (gamesList, containerId) => {
        const container = document.getElementById(containerId);
        if(!container) return;
        
        if(gamesList.length === 0) {
            container.innerHTML = '<p style="color:#aaa; width:100%; text-align:center;">No games found.</p>';
            return;
        }

        container.innerHTML = gamesList.map(g => {
            const mainImg = app.getOptimizedUrl(g.img, 400); 
            const hoverImg = app.getOptimizedUrl(g.hoverImg, 400); 

            return `
            <div class="game-card">
                <div class="image-wrapper">
                    <img src="${mainImg}" alt="${g.title}" class="main-img">
                    ${g.hoverImg ? `<img src="${hoverImg}" class="hover-img" alt="${g.title} Hover">` : ''}
                </div>
                
                <button class="center-cart-btn" onclick="app.addToCart(${g.id})">
                    Add to Cart
                </button>

                <div class="game-info-bottom">
                    <h3>${g.title}</h3>
                    <span class="price">$${g.price}</span>
                </div>
            </div>
            `;
        }).join('');
    },

    addToCart: async (gameId) => {
        const games = await database.getGames();
        const game = games.find(g => g.id === gameId);
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
            html = `<label style="color:#aaa; font-size:0.8rem;">Mobile Number</label><input type="number" id="pay-number" placeholder="09XXXXXXXXX" style="${inputStyle}">`;
        } else if (method === 'card') {
            html = `<label style="color:#aaa; font-size:0.8rem;">Card Number</label><input type="text" id="card-num" placeholder="XXXX-XXXX-XXXX-XXXX" style="${inputStyle}"><div style="display:flex; gap:10px;"><input type="text" placeholder="MM/YY" style="${inputStyle}"><input type="text" placeholder="CVC" style="${inputStyle}"></div>`;
        }
        container.innerHTML = html;
    },

    processPayment: async () => {
        const method = document.getElementById('payment-method').value;
        if (!method) return alert("Please select a payment method");

        if (method === 'gcash' || method === 'paymaya') {
            const number = document.getElementById('pay-number').value;
            if (!/^09\d{9}$/.test(number)) return alert(`Invalid ${method.toUpperCase()} number!`);
        }

        const currentCartIds = app.currentUser.cart.map(item => item.id);
        const ownedGameIds = (app.currentUser.history || []).flatMap(order => order.items.map(item => item.id));
        const duplicate = currentCartIds.find(id => ownedGameIds.includes(id));

        if (duplicate) {
            const game = app.currentUser.cart.find(item => item.id === duplicate);
            document.getElementById('payment-modal').classList.add('hidden');
            return alert(`You already own "${game.title}".`); 
        }

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
        
        app.updateDashboardUI();
        app.renderCart();
        document.getElementById('payment-modal').classList.add('hidden');
        alert(`Payment successful via ${method.toUpperCase()}!`);
        app.showDashboard();
    },

    hideAll: () => document.querySelectorAll('.main-content').forEach(el => el.classList.add('hidden')),
    showShop: () => { app.hideAll(); document.getElementById('shop-section').classList.remove('hidden'); },
    showCart: () => { app.hideAll(); document.getElementById('cart-section').classList.remove('hidden'); app.renderCart(); },
    showDashboard: () => { app.hideAll(); document.getElementById('dashboard-section').classList.remove('hidden'); app.renderUserDashboard(); },

    renderUserDashboard: () => {
        const user = app.currentUser;
        if(!document.getElementById('dash-username')) return;
        document.getElementById('dash-username').innerText = user.username;
        document.getElementById('stat-cart-count').innerText = user.cart ? user.cart.length : 0;
        let totalGames = 0; let totalSpent = 0;
        let historyHTML = '<p style="color:#666;">You haven\'t bought any games yet.</p>';
        if(user.history && user.history.length > 0) {
            user.history.forEach(order => { totalGames += order.items.length; totalSpent += order.total; });
            historyHTML = [...user.history].reverse().map(order => `
                <div class="history-card">
                    <div class="history-header"><span>${order.date}</span><span style="color:#facc15;">${order.paymentMethod ? order.paymentMethod.toUpperCase() : 'N/A'}</span></div>
                    <div>Total: <strong>$${order.total.toFixed(2)}</strong></div>
                    <ul class="history-items">${order.items.map(item => `<li>• ${item.title}</li>`).join('')}</ul>
                </div>`).join('');
        }
        document.getElementById('stat-count').innerText = totalGames;
        document.getElementById('stat-spent').innerText = '$' + totalSpent.toFixed(2);
        document.getElementById('user-purchase-history').innerHTML = historyHTML;
    },

    toggleVideoSound: () => {
        const video = document.getElementById('bg-video');
        const icon = document.querySelector('.sound-icon');
        if(!video) return;
        video.muted = !video.muted;
        if (video.muted) {
            icon.classList.remove('fa-volume-high'); icon.classList.add('fa-volume-mute'); icon.style.color = 'white';
        } else {
            icon.classList.remove('fa-volume-mute'); icon.classList.add('fa-volume-high'); icon.style.color = '#facc15';
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
                    uid: userCredential.user.uid, username: username, email: email, role: 'user', cart: [], history: []
                });
                alert("Account created!"); window.location.href = 'user_dashboard.html';
            } else {
                const userCredential = await auth.signInWithEmailAndPassword(email, pass);
                const userData = await database.getUser(userCredential.user.uid);
                window.location.href = userData.role === 'admin' ? 'admin_dashboard.html' : 'user_dashboard.html';
            }
        } catch (error) { alert("Error: " + error.message); }
    },

    logout: () => { auth.signOut(); window.location.href = 'index.html'; }
};
app.init();