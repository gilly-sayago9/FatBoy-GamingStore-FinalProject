
### 🎯 Key Technologies

| Technology | Role in System |
| :--- | :--- |
| **Firebase** | **Backend & Data:** Provides Authentication (User Accounts) and **Firestore** for data storage (Game Catalog, Carts, and History). |
| **Cloudinary** | **File Storage:** Manages all heavy media assets (images, GIFs) and automatically resizes/optimizes them for fast delivery. |
| **EmailJS** | **Transactional Mail:** Used to send automatic, branded Dark Mode **Order Confirmation Receipts** to the user's email after a successful payment. |

### 🌟 Key Features

| Category | Feature |
| :--- | :--- |
| **🔒 Security & Auth** | **Mandatory Email Verification** is required before the first login. The system enforces a **Strong Password Policy** (8+ chars, 1 uppercase, 1 number, 1 special character) and allows login via **Username** or **Email Address**. |
| **🛍️ Storefront** | **Dynamic Previews:** Game cards feature **Hover Image/GIF Previews** served instantly via Cloudinary. |
| **💳 Checkout & Receipts** | A seamless payment flow that sends a **Dark Mode Email Receipt** via EmailJS. The logic includes a robust fallback to **prompt the user for their email** if the address is missing from their profile. |
| **📊 Admin Dashboard** | Provides **Real-Time Analytics** with **Dynamic Neon Charts** for instant sales monitoring and full **CRUD** management over all game assets and user accounts. |
