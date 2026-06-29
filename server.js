const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { pool, dbInitPromise } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-super-secret-key-change-it-in-production';

app.use(express.json());
app.use(cookieParser());

// Block requests until the database schemas and seeding have finished initialization
app.use(async (req, res, next) => {
  try {
    await dbInitPromise;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database initialization failed: ' + err.message });
  }
});

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
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please provide all details' });
  }

  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [username, email, hash]
    );
    const userId = result.rows[0].id;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.status(201).json({ message: 'User registered successfully', username });
  } catch (err) {
    if (err.message.includes('unique') || err.message.includes('UNIQUE') || err.message.includes('duplicate key')) {
      return res.status(400).json({ error: 'Username or Email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter all details' });
  }

  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('auth_token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ message: 'Logged in successfully', username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
app.get('/api/products', async (req, res) => {
  const { category, search } = req.query;
  let query = 'SELECT * FROM products';
  const params = [];

  if (category || search) {
    query += ' WHERE';
    const filters = [];
    if (category) {
      params.push(category);
      filters.push(` category = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      filters.push(` (name ILIKE $${params.length - 1} OR description ILIKE $${params.length})`);
    }
    query += filters.join(' AND');
  }

  query += ' ORDER BY id ASC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get product details by id
app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    const product = result.rows[0];
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// --- ORDERS API ---

// Create Order (Checkout)
app.post('/api/orders', authenticateToken, async (req, res) => {
  const { cart, shipping_address } = req.body;
  if (!cart || cart.length === 0 || !shipping_address) {
    return res.status(400).json({ error: 'Missing cart items or shipping address.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate total
    let totalAmount = 0;
    const productIds = cart.map(item => item.product_id);
    
    const productsResult = await client.query(
      `SELECT * FROM products WHERE id IN (${productIds.map((_, i) => `$${i + 1}`).join(',')})`,
      productIds
    );
    const products = productsResult.rows;
    const productsMap = {};
    products.forEach(p => { productsMap[p.id] = p; });

    // Validate stock and calculate total
    for (const item of cart) {
      const product = productsMap[item.product_id];
      if (!product) {
        throw new Error(`Product with ID ${item.product_id} not found.`);
      }
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}.`);
      }
      totalAmount += product.price * item.quantity;
    }

    // Insert Order
    const orderResult = await client.query(
      `INSERT INTO orders (user_id, total_amount, shipping_address) VALUES ($1, $2, $3) RETURNING id`,
      [req.user.id, totalAmount, shipping_address]
    );
    const orderId = orderResult.rows[0].id;

    // Insert Order Items and Update Stocks
    for (const item of cart) {
      const product = productsMap[item.product_id];
      
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)`,
        [orderId, item.product_id, item.quantity, product.price]
      );
      
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Order processed successfully.', orderId, total: totalAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get user orders (Order History)
app.get('/api/orders/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.status, o.total_amount, o.shipping_address, o.created_at,
       STRING_AGG(p.name || ' (x' || oi.quantity || ')', ', ') as items
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
