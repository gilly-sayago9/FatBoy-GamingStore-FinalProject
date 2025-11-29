const admin = {
    charts: { sales: null, popularity: null },
    init: () => { admin.refreshAll(); admin.switchTab('overview'); },
    
    switchTab: (tabName) => {
        document.querySelectorAll('.sidebar-menu button').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`btn-${tabName}`);
        if(activeBtn) activeBtn.classList.add('active');
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        document.getElementById(`view-${tabName}`).classList.remove('hidden');
    },

    refreshAll: async () => {
        try {
            const users = await database.getAllUsers();
            const games = await database.getGames();
            admin.renderOverview(users, games);
            admin.renderGamesTable(games);
            admin.renderUsersTable(users);
        } catch (error) { console.error("Failed to load data:", error); }
    },

    renderOverview: (users, games) => {
        let totalRevenue = 0;
        const gameTitleMap = {};
        games.forEach(g => { gameTitleMap[g.id] = g.title; });
        const salesCount = {};
        
        users.forEach(u => {
            if(u.history) {
                u.history.forEach(order => {
                    totalRevenue += order.total;
                    order.items.forEach(item => {
                        const id = item.id;
                        const title = gameTitleMap[id] || item.title;
                        salesCount[title] = (salesCount[title] || 0) + 1;
                    });
                });
            }
        });

        let topGame = "None"; let maxSales = 0;
        for (const [title, count] of Object.entries(salesCount)) {
            if (count > maxSales) { maxSales = count; topGame = title; }
        }

        document.getElementById('stat-users').innerText = users.filter(u => u.role !== 'admin').length;
        document.getElementById('stat-revenue').innerText = '$' + totalRevenue.toFixed(2);
        document.getElementById('stat-games').innerText = games.length;
        document.getElementById('stat-top-game').innerText = topGame;

        admin.renderCharts(salesCount);
    },

    renderCharts: (salesData) => {
        const ctxSales = document.getElementById('salesChart').getContext('2d');
        const ctxPop = document.getElementById('popularityChart').getContext('2d');
        if(!ctxSales || !ctxPop) return;

        if (admin.charts.sales) admin.charts.sales.destroy();
        if (admin.charts.popularity) admin.charts.popularity.destroy();

        const labels = Object.keys(salesData);
        const data = Object.values(salesData);
        
        const generateNeonColors = (count) => {
            const colors = [];
            for (let i = 0; i < count; i++) {
                const hue = i * (360 / count);
                colors.push(`hsl(${hue}, 100%, 60%)`);
            }
            return colors;
        };
        const dynamicColors = generateNeonColors(labels.length);
        
        const gradientSales = ctxSales.createLinearGradient(0, 0, 0, 400);
        gradientSales.addColorStop(0, '#8b5cf6'); gradientSales.addColorStop(1, '#3b82f6');
        
        admin.charts.sales = new Chart(ctxSales, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Units Sold', data: data, backgroundColor: gradientSales, borderRadius: 6, barThickness: 40 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#333' }, ticks: { color: '#aaa' } }, x: { grid: { display: false }, ticks: { color: '#aaa' } } } }
        });

        admin.charts.popularity = new Chart(ctxPop, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: dynamicColors, borderColor: '#18181b', borderWidth: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff', padding: 20 } } }, cutout: '70%' }
        });
    },

    renderGamesTable: (games) => {
        const tbody = document.getElementById('games-table-body');
        if (games.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No games in inventory.</td></tr>'; return; }
        tbody.innerHTML = games.map(g => `<tr><td><img src="${g.img}" class="table-img" onerror="this.src='images/logo.png'"></td><td style="font-weight:600; color:white;">${g.title}</td><td>$${g.price}</td><td><button class="action-btn btn-edit" onclick="admin.editGame(${g.id})"><i class="fas fa-pen"></i></button><button class="action-btn btn-delete" onclick="admin.deleteGame(${g.id})"><i class="fas fa-trash"></i></button></td></tr>`).join('');
    },

    handleGameForm: async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save');
        const originalText = btn.innerText;
        btn.innerText = "Uploading...";
        btn.disabled = true;

        try {
            const idInput = document.getElementById('edit-game-id').value;
            const title = document.getElementById('game-title').value;
            const price = parseFloat(document.getElementById('game-price').value);
            const fileInput = document.getElementById('game-img');
            const hoverInput = document.getElementById('game-hover-img');
            const gameId = idInput ? Number(idInput) : Date.now();
            
            let imgUrl = '';
            if (fileInput.files[0]) { imgUrl = await database.uploadImage(fileInput.files[0]); }
            let hoverImgUrl = '';
            if (hoverInput.files[0]) { hoverImgUrl = await database.uploadImage(hoverInput.files[0]); }
            
            if (idInput) {
                const games = await database.getGames();
                const old = games.find(g => g.id == idInput);
                if (old) {
                    if (!imgUrl) imgUrl = old.img;
                    if (!hoverImgUrl) hoverImgUrl = old.hoverImg || ''; 
                }
            }

            await database.saveGameToDB({ id: gameId, title, price, img: imgUrl, hoverImg: hoverImgUrl });
            alert(idInput ? "Game Updated!" : "Game Added!");
            admin.resetGameForm();
            await admin.refreshAll();
        } catch (error) { alert("Error: " + error.message); } finally { btn.innerText = originalText; btn.disabled = false; }
    },

    editGame: async (id) => {
        const games = await database.getGames();
        const g = games.find(game => game.id === id);
        if(!g) return;
        document.getElementById('edit-game-id').value = g.id;
        document.getElementById('game-title').value = g.title;
        document.getElementById('game-price').value = g.price;
        document.getElementById('form-title').innerText = "Edit Game";
        document.getElementById('btn-save').innerText = "Update Game";
        document.getElementById('btn-cancel').classList.remove('hidden');
    },

    deleteGame: async (id) => {
        if(confirm("Delete this game?")) { await database.deleteGameFromDB(id); await admin.refreshAll(); }
    },

    resetGameForm: () => {
        document.querySelector('form').reset();
        document.getElementById('edit-game-id').value = "";
        document.getElementById('form-title').innerText = "Add / Edit Game";
        document.getElementById('btn-save').innerText = "Save Game";
        document.getElementById('btn-cancel').classList.add('hidden');
    },

    renderUsersTable: (users) => {
        const tbody = document.getElementById('users-table-body');
        const customers = users.filter(u => u.role !== 'admin');
        if (customers.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No registered users found.</td></tr>'; return; }
        tbody.innerHTML = customers.map(u => {
            const totalSpent = (u.history || []).reduce((sum, order) => sum + order.total, 0);
            return `<tr><td><div style="display:flex; align-items:center; gap:10px;"><div style="width:30px; height:30px; background:#3b82f6; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:bold;">${u.username.charAt(0).toUpperCase()}</div><span style="font-weight:600; color:white;">${u.username}</span></div></td><td><span class="user-badge">${u.role}</span></td><td>${u.history ? u.history.length : 0} Orders</td><td style="font-weight:bold;">$${totalSpent.toFixed(2)}</td><td><button class="action-btn btn-delete" onclick="admin.deleteUser('${u.username}')"><i class="fas fa-trash"></i></button></td></tr>`;
        }).join('');
    },

    deleteUser: async (username) => {
        if(confirm(`Permanently delete user "${username}"?`)) { await database.deleteUserFromDB(username); await admin.refreshAll(); }
    },

    logout: () => { auth.signOut().then(() => window.location.href = 'index.html'); }
};