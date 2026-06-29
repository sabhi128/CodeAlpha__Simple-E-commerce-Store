const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-super-secret-key-change-it-in-production';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate JWT token from cookie
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    res.status(400).json({ error: 'Invalid or expired token.' });
  }
}

// Optional middleware to attach user if logged in
function optionalAuthenticate(req, res, next) {
  const token = req.cookies.auth_token;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      res.clearCookie('auth_token');
    }
  }
  next();
}

// --- AUTHENTICATION API ---

// Register
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please provide all details' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.run(
    `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
    [username, email, hash],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username or Email already exists.' });
        }
        return res.status(500).json({ error: err.message });
      }
      // Auto login on successful registration
      const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
      res.status(201).json({ message: 'User registered successfully', username });
    }
  );
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter all details' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ message: 'Logged in successfully', username: user.username });
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out successfully' });
});

// Get current user details
app.get('/api/auth/me', optionalAuthenticate, (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, username: req.user.username });
});


// --- PRODUCTS API ---

// Get all products
app.get('/api/products', (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM products';
  const params = [];

  if (category || search) {
    query += ' WHERE';
    const filters = [];
    if (category) {
      filters.push(' category = ?');
      params.push(category);
    }
    if (search) {
      filters.push(' (name LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    query += filters.join(' AND');
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get product details by id
app.get('/api/products/:id', (req, res) => {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  });
});


// --- ORDERS API ---

// Create Order (Checkout)
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { cart, shipping_address } = req.body;
  if (!cart || cart.length === 0 || !shipping_address) {
    return res.status(400).json({ error: 'Missing cart items or shipping address.' });
  }

  try {
    // We run the order placement transactionally
    db.serialize(() => {
      // Calculate total
      let totalAmount = 0;
      const productIds = cart.map(item => item.product_id);
      
      db.all(`SELECT * FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds, (err, products) => {
        if (err) return res.status(500).json({ error: 'Database error reading products.' });
        
        const productsMap = {};
        products.forEach(p => { productsMap[p.id] = p; });

        // Validate stock and calculate total
        for (const item of cart) {
          const product = productsMap[item.product_id];
          if (!product) {
            return res.status(400).json({ error: `Product with ID ${item.product_id} not found.` });
          }
          if (product.stock < item.quantity) {
            return res.status(400).json({ error: `Insufficient stock for ${product.name}.` });
          }
          totalAmount += product.price * item.quantity;
        }

        // Insert Order
        db.run(
          `INSERT INTO orders (user_id, total_amount, shipping_address) VALUES (?, ?, ?)`,
          [req.user.id, totalAmount, shipping_address],
          function (err) {
            if (err) return res.status(500).json({ error: 'Failed to create order.' });
            
            const orderId = this.lastID;
            const insertItemStmt = db.prepare(`INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`);
            const updateStockStmt = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

            cart.forEach(item => {
              const product = productsMap[item.product_id];
              insertItemStmt.run(orderId, item.product_id, item.quantity, product.price);
              updateStockStmt.run(item.quantity, item.product_id);
            });

            insertItemStmt.finalize();
            updateStockStmt.finalize();

            res.status(201).json({ message: 'Order processed successfully.', orderId, total: totalAmount });
          }
        );
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user orders (Order History)
app.get('/api/orders/history', authenticateToken, (req, res) => {
  db.all(
    `SELECT o.id, o.status, o.total_amount, o.shipping_address, o.created_at,
     GROUP_CONCAT(p.name || ' (x' || oi.quantity || ')') as items
     FROM orders o
     JOIN order_items oi ON o.id = oi.order_id
     JOIN products p ON oi.product_id = p.id
     WHERE o.user_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Serve frontend routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
