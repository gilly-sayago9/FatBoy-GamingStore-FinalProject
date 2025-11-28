# 📋 Project Changelog

### 🚀 Update v3.1.0 - Contact Integration & Enhanced Security
*(Current Build)*
* **Contact System:** Integrated **EmailJS** to enable real-time email functionality for the "Contact Us" form.
* **Smart Validation:** Implemented regex enforcement for PH mobile numbers (`09...`) and inventory checks to prevent duplicate purchases.
* **UI/UX Consistency:** Standardized the Dark & Gold theme across all modals, inputs, and email templates.
* **Status:** 🟢 **Production Ready** - Core functionality, database integration, and deployment standards met.

---

### ☁️ Version 3.0.0 - Cloud Migration & Architecture
* **Cloud Persistence:** Migrated from LocalStorage to **Firebase Firestore** for robust data management (Users, Games, History).
* **Architecture Refactor:** Split the codebase from a Single Page Application into distinct, secure pages (`index.html`, `user_dashboard.html`, `admin_dashboard.html`).
* **Payment Simulation:** Added a Checkout Modal supporting mock GCash, PayMaya, and Credit Card inputs.
* **Admin Access:** Implemented role-based routing (Admins are automatically redirected to their specific dashboard upon login).

> **🔑 ADMIN ACCESS INSTRUCTIONS**
>
> To access the administrative panel, you must first **register** an account and then manually grant the role in the cloud database.
>
> | Credential | Value | Note |
> | :--- | :--- | :--- |
> | **Username** | `admin` | Used to form the login email |
> | **Password** | `admin123` | *Set this during registration* |
>
> **Crucial Step:** After registering, go to **Firestore > users** and manually change the `role` field for this user document from `"user"` to **`"admin"`**.

---

### 🛠️ Version 2.0.0 - Admin Management & CRUD
* **Admin Dashboard:** Launched full **CRUD (Create, Read, Update, Delete)** capabilities for game inventory.
* **Image Handling:** Added support for uploading game cover images via File Input (converted to Base64/Storage).
* **User Management:** Added ability for Admins to view all registered users and delete accounts.
* **Cart Logic:** Implemented "Remove Item" functionality and dynamic total calculation.

---

### 📦 Version 1.0.0 - Initial Prototype
* **Project Setup:** Initial HTML/CSS structure established with a responsive dark-themed layout.
* **Authentication Simulation:** Basic Login/Register forms created using browser **LocalStorage**.
* **Shop Interface:** Grid layout for displaying game products.
* **Database:** Initialized mock data structure for Games and Users.
