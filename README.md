# Lumina // Premium Full Stack Tech Store

Welcome to **Lumina**, a next-generation ambient e-commerce store built for Task 1 of the CodeAlpha Full Stack Developer Internship. Lumina is designed to feel like an elite tech brand, incorporating modern glassmorphism layouts, glowing ambient graphics, and buttery smooth animations.

---

## 🚀 Key Features

1. **Next-Gen Aesthetics**:
   - Deep dark-mode theme with floating background glows.
   - Smooth card transitions, zooming images, and hover shadow glow effects.
   - Dynamic page content slides and interactive detail modals.
2. **Account Authentication**:
   - Secure tabbed Register & Login layout.
   - Secure password hashing using `bcryptjs` and session retention using HTTP-only JSON Web Tokens (`jwt`).
3. **Cart & Local Persistence**:
   - Animated side-drawer cart displaying accurate items, pricing metadata, and free shipping checks.
   - Isolated cart states per user profile (`cart_${username}`) and guest state (`cart_guest`) in browser storage.
4. **Order Registry & Checkout**:
   - Confetti burst animation upon completing checkout.
   - Permanent transaction logging in database tables with catalog stock verification.
5. **Robust Local Backend**:
   - Built on **Express.js (Node.js)**.
   - Runs an SQLite database (`store.db`) with automatic table creation and premium product seeding on start.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom Variables, Keyframe Animations), Vanilla JavaScript (ES6 State Machine), Lucide Icons, Canvas Confetti.
- **Backend**: Node.js, Express.js, Cookie Parser.
- **Database**: SQLite (via `sqlite3` driver).
- **Security**: Cryptographic password hashing (`bcryptjs`), session credentials (`jsonwebtoken`).

---

## 📂 Project Structure

```text
CodeAlpha_simple e-commerce store_task1/
├── database.js          # SQLite3 database setup & seeding logic
├── server.js            # Express server entry point & REST API routes
├── package.json         # Node dependency configurations
├── public/              # Served frontend files
│   ├── css/
│   │   └── style.css    # Premium custom stylesheet
│   ├── js/
│   │   └── app.js       # Core state & API coordinator
│   ├── images/
│   │   └── wireless_charger.png # Local product image asset
│   └── index.html       # Single-Page Web App template
└── README.md            # Project instruction guide
```

---

## 💻 Installation & Setup

1. **Install Dependencies**:
   Open a terminal in the project directory and run:
   ```bash
   npm install
   ```

2. **Run the Server**:
   Start the Node server:
   ```bash
   npm start
   ```

3. **Open the App**:
   Navigate to the local port in your web browser:
   ```text
   http://localhost:3000
   ```

---

## 🧑‍💻 Seeding Mock Data
On the first server boot, `database.js` automatically creates the SQLite tables and seeds the product database with realistic tech items, custom descriptions, and high-quality image paths (including our premium locally stored wireless charger graphic). 

To reset or re-seed the catalog data, simply delete the generated `store.db` file from the workspace root and restart the server.
