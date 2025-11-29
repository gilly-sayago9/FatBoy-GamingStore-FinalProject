const app = {
  // STATE
  currentUser: null,
  isRegistering: false,
  cachedGames: [],
  SwalMixin: Swal.mixin({
    toast: true,
    icon: "success",
    timer: 3000,
    showConfirmButton: false,
    showCloseButton: true, // Added visible close button
    background: "#18181b",
    color: "#ffffff",
    customClass: {
      popup: "swal-dark-mode-popup",
      confirmButton: "swal-button-primary",
      closeButton: "swal-close-button-custom",
    },
    confirmButtonColor: "#facc15",
    cancelButtonColor: "#ef4444",
    didOpen: (toast) => {
      toast.addEventListener("mouseenter", Swal.stopTimer);
      toast.addEventListener("mouseleave", Swal.resumeTimer);
    },
  }),

  // --- HELPER: OPTIMIZE CLOUDINARY URLS ---
  getOptimizedUrl: (url, width = 400) => {
    if (!url) return "https://placehold.co/200x150?text=No+Image";
    if (url.includes("cloudinary.com")) {
      return url.replace(
        "/upload/",
        `/upload/w_${width},c_fill,q_auto,f_auto/`,
      );
    }
    return url;
  },

  // --- INITIALIZATION ---
  init: () => {
    firebase.auth().onAuthStateChanged(async (firebaseUser) => {
      // ONLY redirect if user exists AND email is verified
      if (firebaseUser && firebaseUser.emailVerified) {
        app.redirectUser(firebaseUser.uid);
      }
      // If user exists but NOT verified, prevent auto-login on dashboard
      else if (
        window.location.pathname.includes("dashboard") ||
        window.location.pathname.includes("admin")
      ) {
        window.location.href = "index.html";
      }
    });
  },

  redirectUser: async (uid) => {
    const userData = await database.getUser(uid);
    if (userData) {
      app.currentUser = userData;
      const path = window.location.pathname;
      if (userData.role === "admin" && !path.includes("admin_dashboard")) {
        window.location.href = "admin_dashboard.html";
      } else if (
        userData.role !== "admin" &&
        !path.includes("user_dashboard")
      ) {
        window.location.href = "user_dashboard.html";
      } else {
        app.initPage();
      }
    }
  },

  initPage: () => {
    const path = window.location.pathname;
    const video = document.getElementById("bg-video");
    if (video) video.pause();

    if (path.includes("user_dashboard")) {
      app.checkUserRole("user", app.currentUser.uid);
      app.renderGames();
      app.updateDashboardUI();
      app.showShop();
    } else if (path.includes("admin_dashboard")) {
      app.checkUserRole("admin", app.currentUser.uid);
      if (window.admin) window.admin.init();
    }
  },

  checkUserRole: async (requiredRole, uid) => {
    const userData = await database.getUser(uid);
    app.currentUser = userData;

    if (userData.role !== requiredRole) {
      window.location.href =
        userData.role === "admin"
          ? "admin_dashboard.html"
          : "user_dashboard.html";
      return;
    }
    if (document.getElementById("cart-count")) {
      document.getElementById("cart-count").innerText =
        app.currentUser.cart.length;
    }
  },

  // --- AUTHENTICATION LOGIC ---

  toggleAuthMode: () => {
    app.isRegistering = !app.isRegistering;

    document.getElementById("auth-title").innerText = app.isRegistering
      ? "Create Account"
      : "Log in to continue";
    document.querySelector(".btn-primary").innerText = app.isRegistering
      ? "Sign Up"
      : "Log in";
    document.getElementById("auth-switch-text").innerText = app.isRegistering
      ? "Already have an account? Log in"
      : "Create an account";

    const emailGroup = document.getElementById("email-group");
    const confirmGroup = document.getElementById("confirm-password-group");
    const loginLabel = document.getElementById("login-label");
    const loginInput = document.getElementById("login-input");

    // Clear messages
    app.showError("");
    app.showSuccess("");

    if (app.isRegistering) {
      emailGroup.classList.remove("hidden");
      confirmGroup.classList.remove("hidden");
      loginLabel.innerText = "Username";
      loginInput.placeholder = "Choose a unique username";
      document.getElementById("email").setAttribute("required", "true");
      document
        .getElementById("confirm-password")
        .setAttribute("required", "true");
    } else {
      emailGroup.classList.add("hidden");
      confirmGroup.classList.add("hidden");
      loginLabel.innerText = "Username or Email";
      loginInput.placeholder = "Enter username or email";
      document.getElementById("email").removeAttribute("required");
      document.getElementById("confirm-password").removeAttribute("required");
    }
  },

  // Helper: Show Error
  showError: (msg) => {
    const el = document.getElementById("login-error");
    if (!el) return;
    el.innerText = msg;
    msg ? el.classList.remove("hidden") : el.classList.add("hidden");
  },

  // Helper: Show Success
  showSuccess: (msg) => {
    const el = document.getElementById("auth-success");
    if (!el) return;
    el.innerText = msg;
    msg ? el.classList.remove("hidden") : el.classList.add("hidden");
  },

  handleAuth: async (e) => {
    e.preventDefault();
    app.showError("");
    app.showSuccess("");

    const loginInput = document.getElementById("login-input").value.trim();
    const password = document.getElementById("password").value;

    try {
      if (app.isRegistering) {
        // --- 1. REGISTRATION ---
        const email = document.getElementById("email").value.trim();
        const confirmPass = document.getElementById("confirm-password").value;
        const username = loginInput;

        if (password !== confirmPass)
          throw new Error("Passwords do not match!");
        if (username.length < 3)
          throw new Error("Username must be at least 3 characters.");

        const passwordRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(password)) {
          throw new Error(
            "Password must be 8+ chars with 1 uppercase, 1 number, and 1 special char.",
          );
        }

        const existingUser = await database.findUserByUsername(username);
        if (existingUser) throw new Error("Username is already taken.");

        // Create User
        const userCredential = await firebase
          .auth()
          .createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Save Profile
        await database.saveUser({
          uid: user.uid,
          username: username,
          email: email,
          role: "user",
          cart: [],
          history: [],
        });

        // Send Verification Email
        await user.sendEmailVerification();

        // Sign Out Immediately (Require Login)
        await firebase.auth().signOut();

        // Notify User
        app.showSuccess(
          "Account created! Verification email sent. Please check your inbox before logging in.",
        );

        // Auto-switch to login mode
        setTimeout(() => {
          if (app.isRegistering) app.toggleAuthMode();
        }, 3000);
      } else {
        // --- 2. LOGIN ---
        let emailToLogin = loginInput;

        if (!loginInput.includes("@")) {
          const userData = await database.findUserByUsername(loginInput);
          if (!userData) throw new Error("Username not found.");
          emailToLogin = userData.email;
        }

        const userCredential = await firebase
          .auth()
          .signInWithEmailAndPassword(emailToLogin, password);
        const user = userCredential.user;

        // Check Verification
        if (!user.emailVerified) {
          await firebase.auth().signOut();
          throw new Error(
            "Please verify your email address before logging in.",
          );
        }

        app.showSuccess("Login Successful! Redirecting...");

        setTimeout(() => {
          app.redirectUser(user.uid);
        }, 1000);
      }
    } catch (error) {
      app.showError(error.message.replace("Firebase: ", ""));
    }
  },

  logout: () => {
    firebase.auth().signOut();
    window.location.href = "index.html";
  },

  // ... [SEARCH, SHOP, CART LOGIC] ...

  handleSearch: () => {
    const query = document.getElementById("search-input").value.toLowerCase();
    if (query.length > 0) {
      document.getElementById("browsing-view").classList.add("hidden");
      document.getElementById("search-view").classList.remove("hidden");
      const filteredGames = app.cachedGames.filter((game) =>
        game.title.toLowerCase().includes(query),
      );
      app.renderGameList(filteredGames, "search-results-grid");
    } else {
      app.clearSearch();
    }
  },

  clearSearch: () => {
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = "";
    document.getElementById("browsing-view").classList.remove("hidden");
    document.getElementById("search-view").classList.add("hidden");
  },

  renderGames: async () => {
    const games = await database.getGames();
    const users = await database.getAllUsers();
    const salesCount = {};

    users.forEach((u) => {
      if (u.history) {
        u.history.forEach((order) => {
          order.items.forEach((item) => {
            salesCount[item.id] = (salesCount[item.id] || 0) + 1;
          });
        });
      }
    });

    const popularGames = [...games]
      .map((g) => ({
        ...g,
        sales: salesCount[g.id] || 0,
      }))
      .sort((a, b) => b.sales - a.sales);

    app.cachedGames = popularGames;
    app.renderGameList(popularGames, "games-grid");
  },

 // --- RENDER WITH HOVER AND LIBRARY CHECK ---
    renderGameList: (gamesList, containerId, isLibrary = false) => { 
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
                
                ${isLibrary ? '' : `
                    <button class="center-cart-btn" onclick="app.addToCart(${g.id})">
                        Add to Cart
                    </button>
                `}

                <div class="game-info-bottom">
                    <h3>${g.title}</h3>
                    ${isLibrary ? '' : `<span class="price">$${g.price}</span>`}
                </div>
            </div>
            `;
        }).join('');
    },

  addToCart: async (gameId) => {
    const games = await database.getGames();
    const game = games.find((g) => g.id === gameId);
    const alreadyInCart = app.currentUser.cart.some(
      (item) => item.id === gameId,
    );

    if (alreadyInCart) {
      app.SwalMixin.fire({
        icon: "warning",
        title: "Already in Cart",
        text: `${game.title} is already in your cart!`,
        position: "top-end",
      });
      return;
    }

    app.currentUser.cart.push(game);
    await database.saveUser(app.currentUser);
    app.updateDashboardUI();
    app.SwalMixin.fire({
      icon: "success",
      title: "Added!",
      text: `${game.title} added to cart!`,
      position: "top-end",
    });
  },

  removeFromCart: async (index) => {
    const result = await Swal.fire({
      title: "Remove Item?",
      text: "Are you sure you want to remove this item?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, remove it!",
      cancelButtonText: "No, keep it",
      background: "#18181b",
      color: "#ffffff",
    });

    if (result.isConfirmed) {
      app.currentUser.cart.splice(index, 1);
      await database.saveUser(app.currentUser);
      app.renderCart();
      app.updateDashboardUI();
      app.SwalMixin.fire({
        icon: "info",
        title: "Removed!",
        text: "Item removed from cart.",
        position: "top-end",
      });
    }
  },

  updateDashboardUI: () => {
    if (app.currentUser && document.getElementById("cart-count")) {
      document.getElementById("cart-count").innerText =
        app.currentUser.cart.length;
    }
  },

  renderCart: () => {
    const container = document.getElementById("cart-items");
    if (!container) return;
    let total = 0;

    if (!app.currentUser.cart || app.currentUser.cart.length === 0) {
      container.innerHTML = "<p>Cart is empty.</p>";
    } else {
      container.innerHTML = app.currentUser.cart
        .map((item, index) => {
          total += item.price;
          return `
                <div style="padding:10px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${item.img || "https://placehold.co/50"}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">
                        <span>${item.title}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:15px;">
                        <span>$${item.price}</span>
                        <span class="delete-btn" onclick="app.removeFromCart(${index})" title="Remove Item">
                            <i class="fas fa-times"></i>
                        </span>
                    </div>
                </div>`;
        })
        .join("");
    }
    if (document.getElementById("total-price"))
      document.getElementById("total-price").innerText = total.toFixed(2);
  },

  // --- PAYMENT LOGIC (With Email Fallback) ---
  openPaymentModal: () => {
    if (!app.currentUser.cart || app.currentUser.cart.length === 0)
      return Swal.fire({
        icon: "error",
        title: "Error",
        text: "Your cart is empty!",
      });

    const total = document.getElementById("total-price").innerText;
    document.getElementById("checkout-total").innerText = "$" + total;
    document.getElementById("payment-modal").classList.remove("hidden");
    app.togglePaymentFields();
  },

  togglePaymentFields: () => {
    const method = document.getElementById("payment-method").value;
    const container = document.getElementById("payment-fields");
    if (!container) return;
    let html = "";
    const inputStyle =
      "width:100%; padding:10px; margin-bottom:10px; background:#27272a; border:1px solid #333; color:white; border-radius:6px;";

    if (method === "gcash" || method === "paymaya") {
      html = `<label style="color:#aaa; font-size:0.8rem;">Mobile Number</label><input type="number" id="pay-number" placeholder="09XXXXXXXXX" style="${inputStyle}">`;
    } else if (method === "card") {
      html = `<label style="color:#aaa; font-size:0.8rem;">Card Number</label><input type="text" id="card-num" placeholder="XXXX-XXXX-XXXX-XXXX" style="${inputStyle}"><div style="display:flex; gap:10px;"><input type="text" placeholder="MM/YY" style="${inputStyle}"><input type="text" placeholder="CVC" style="${inputStyle}"></div>`;
    }
    container.innerHTML = html;
  },

  processPayment: async () => {
    const method = document.getElementById("payment-method").value;

    if (!method)
      return Swal.fire({
        icon: "error",
        title: "Error",
        text: "Please select a payment method.",
      });

    if (method === "gcash" || method === "paymaya") {
      const number = document.getElementById("pay-number").value;
      if (!/^09\d{9}$/.test(number))
        return Swal.fire({
          icon: "error",
          title: "Validation Error",
          text: `Invalid ${method.toUpperCase()} number!`,
        });
    }

    const currentCartIds = app.currentUser.cart.map((item) => item.id);
    const ownedGameIds = (app.currentUser.history || []).flatMap((order) =>
      order.items.map((item) => item.id),
    );
    const duplicate = currentCartIds.find((id) => ownedGameIds.includes(id));

    if (duplicate) {
      const game = app.currentUser.cart.find((item) => item.id === duplicate);
      document.getElementById("payment-modal").classList.add("hidden");
      return Swal.fire({
        icon: "error",
        title: "Transaction Failed",
        text: `You already own "${game.title}".`,
      });
    }

    const total = parseFloat(
      document.getElementById("checkout-total").innerText.replace("$", ""),
    );
    const dateStr = new Date().toLocaleString();
    const orderId = Math.floor(10000000 + Math.random() * 90000000);

    // Generate Dark Mode Receipt
    const itemsHtml = app.currentUser.cart
      .map(
        (item) => `
            <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 15px 0;">
                    <div style="font-weight: bold; color: #ffffff; font-size: 14px;">${item.title}</div>
                    <div style="font-size: 12px; color: #71717a;">Game</div>
                </td>
                <td style="text-align: right; padding: 15px 0; color: #ffffff; font-weight: 500;">$${item.price}</td>
            </tr>
        `,
      )
      .join("");

    // Save to Firebase
    const purchaseRecord = {
      orderId: orderId,
      date: dateStr,
      items: app.currentUser.cart,
      total: total,
      paymentMethod: method,
    };

    app.currentUser.history.push(purchaseRecord);
    app.currentUser.cart = [];
    await database.saveUser(app.currentUser);

    // Send Email Receipt
    const btn = document.querySelector("#payment-modal .btn-primary");
    const originalText = btn.innerText;
    btn.innerText = "Sending Receipt...";

    // --- ROBUST EMAIL CHECK ---
    let userEmail = app.currentUser.email;
    if (!userEmail && firebase.auth().currentUser) {
      userEmail = firebase.auth().currentUser.email;
    }

    if (!userEmail || userEmail.trim() === "") {
      userEmail = await Swal.fire({
        title: "Email Missing",
        text: "We couldn't find your email address. Please enter it to receive your receipt.",
        input: "email",
        showCancelButton: true,
        confirmButtonText: "Send Receipt",
        background: "#18181b",
        color: "#ffffff",
      }).then((result) => (result.isConfirmed ? result.value : null));
    }

    try {
      if (userEmail && userEmail.trim() !== "") {
        await emailjs.send("service_jh2cxyl", "template_5cwdrep", {
          to_name: app.currentUser.username || "Gamer",
          to_email: userEmail,
          order_id: orderId,
          order_date: dateStr,
          order_items_html: itemsHtml,
          total_cost: total.toFixed(2),
        });
        Swal.fire({
          icon: "success",
          title: "Payment Complete",
          text: `Receipt sent to ${userEmail}`,
        });
      } else {
        Swal.fire({
          icon: "info",
          title: "Payment Complete",
          text: "No receipt sent (email declined or cancelled).",
        });
      }
    } catch (error) {
      console.error("Email Failed:", error);

      Swal.fire({
        icon: "error",
        title: "Payment Complete",
        text: `Receipt email failed. Error: ${error.text || error.message}`,
      });
    } finally {
      btn.innerText = originalText;
      app.updateDashboardUI();
      app.renderCart();
      document.getElementById("payment-modal").classList.add("hidden");
      app.showDashboard();
    }
  },

  // --- NAVIGATION ---
  hideAll: () =>
    document
      .querySelectorAll(".main-content")
      .forEach((el) => el.classList.add("hidden")),
  showShop: () => {
    app.hideAll();
    document.getElementById("shop-section").classList.remove("hidden");
  },
  showCart: () => {
    app.hideAll();
    document.getElementById("cart-section").classList.remove("hidden");
    app.renderCart();
  },
  showDashboard: () => {
    app.hideAll();
    document.getElementById("dashboard-section").classList.remove("hidden");
    app.renderUserDashboard();
  },

  showLibrary: () => {
    app.hideAll();
    console.log("being called")
    document.getElementById("library-section").classList.remove("hidden");
    app.renderUserLibrary();
  },

  renderUserLibrary: async () => {
    const user = app.currentUser;
    const history = user.history || [];

    const ownedIds = new Set();
    history.forEach((order) => {
      order.items.forEach((item) => {
        ownedIds.add(item.id);
      });
    });

    const libraryGrid = document.getElementById("library-grid");
    if (ownedIds.size === 0) {
      libraryGrid.innerHTML =
        '<p style="text-align:center; color:#aaa; padding: 40px;">Your library is empty. Go buy some games!</p>';
      return;
    }

    const allGames = await database.getGames();
    const libraryGames = allGames.filter((game) => ownedIds.has(game.id));

    // RENDER LIBRARY: Sets isLibrary flag to TRUE
    app.renderGameList(libraryGames, "library-grid", true);
  },
  renderUserDashboard: () => {
    const user = app.currentUser;
    if (!document.getElementById("dash-username")) return;
    document.getElementById("dash-username").innerText = user.username;
    document.getElementById("stat-cart-count").innerText = user.cart
      ? user.cart.length
      : 0;
    let totalGames = 0;
    let totalSpent = 0;
    let historyHTML =
      '<p style="color:#666;">You haven\'t bought any games yet.</p>';
    if (user.history && user.history.length > 0) {
      user.history.forEach((order) => {
        totalGames += order.items.length;
        totalSpent += order.total;
      });
      historyHTML = [...user.history]
        .reverse()
        .map(
          (order) => `
                <div class="history-card">
                    <div class="history-header"><span>${order.date}</span><span style="color:#facc15;">${order.paymentMethod ? order.paymentMethod.toUpperCase() : "N/A"}</span></div>
                    <div>Total: <strong style="color:white">$${order.total.toFixed(2)}</strong></div>
                    <ul class="history-items">${order.items.map((item) => `<li>• ${item.title}</li>`).join("")}</ul>
                </div>`,
        )
        .join("");
    }
    document.getElementById("stat-count").innerText = totalGames;
    document.getElementById("stat-spent").innerText =
      "$" + totalSpent.toFixed(2);
    document.getElementById("user-purchase-history").innerHTML = historyHTML;
  },

  toggleVideoSound: () => {
    const video = document.getElementById("bg-video");
    const icon = document.querySelector(".sound-icon");
    if (!video) return;
    video.muted = !video.muted;
    if (video.muted) {
      icon.classList.remove("fa-volume-high");
      icon.classList.add("fa-volume-mute");
      icon.style.color = "white";
    } else {
      icon.classList.remove("fa-volume-mute");
      icon.classList.add("fa-volume-high");
      icon.style.color = "#facc15";
    }
  },
};

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  const toggleIcons = document.querySelectorAll(".toggle-password");
  toggleIcons.forEach((icon) => {
    icon.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      const inputElement = document.getElementById(targetId);
      if (inputElement) {
        const type =
          inputElement.getAttribute("type") === "password"
            ? "text"
            : "password";
        inputElement.setAttribute("type", type);
        this.classList.toggle("fa-eye");
        this.classList.toggle("fa-eye-slash");
      }
    });
  });
  app.init();
});


