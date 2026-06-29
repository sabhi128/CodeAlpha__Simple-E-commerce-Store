const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

// Connection configuration
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Setup schema tables
async function initDb() {
  if (!connectionString) {
    console.warn("WARNING: DATABASE_URL environment variable is missing. Skip DB initialization.");
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        category VARCHAR(100) NOT NULL,
        image_url TEXT NOT NULL,
        stock INTEGER DEFAULT 10
      )
    `);

    // Create Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'Pending',
        total_amount DOUBLE PRECISION NOT NULL,
        shipping_address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        price DOUBLE PRECISION NOT NULL
      )
    `);

    // Seed initial products if products count is 0
    const res = await client.query('SELECT COUNT(*) FROM products');
    const count = parseInt(res.rows[0].count, 10);
    
    if (count === 0) {
      console.log('Seeding initial premium products to PostgreSQL...');
      const seedProducts = [
        {
          name: "AeroPulse ANC Headphones",
          description: "Premium hybrid active noise-cancelling wireless over-ear headphones. Audio engineered for breathtaking clarity and deep resonance.",
          price: 299.99,
          category: "Audio",
          image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
          stock: 15
        },
        {
          name: "Chronos Active Smartwatch",
          description: "Next-gen titanium smartwatch with continuous biometric tracking, multi-sport precision tracking, and a gorgeous 1.4-inch AMOLED display.",
          price: 249.50,
          category: "Wearables",
          image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60",
          stock: 20
        },
        {
          name: "HaloSphere Smart Speaker",
          description: "Immersive 360° spatial audio engine with integrated smart assistant support, dynamic RGB ambient lighting, and elegant glass housing.",
          price: 129.00,
          category: "Smart Home",
          image_url: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=500&auto=format&fit=crop&q=60",
          stock: 8
        },
        {
          name: "AuraKey Mechanical Keyboard",
          description: "Gasket-mounted hot-swappable tactile keyboard with custom silent switches, walnut top casing, and frosted RGB diffuser.",
          price: 189.99,
          category: "Accessories",
          image_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60",
          stock: 12
        },
        {
          name: "Lumina Wireless Charger",
          description: "MagSafe-compatible 3-in-1 fast charger forged from aerospace-grade aluminum and walnut. Elevates any minimalist desktop setup.",
          price: 79.99,
          category: "Accessories",
          image_url: "/images/wireless_charger.png",
          stock: 25
        },
        {
          name: "SonicBuds Pro",
          description: "Microscopic true wireless earbuds with custom dynamic micro-drivers, IPX7 waterproofing, and a sleek modern aluminum charging capsule.",
          price: 149.99,
          category: "Audio",
          image_url: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop&q=60",
          stock: 30
        },
        {
          name: "Apex Monitor Mount",
          description: "Premium mechanical counter-balance monitor arm forged from aerospace aluminum. Restores space and offers perfect screen ergonomics.",
          price: 159.00,
          category: "Accessories",
          image_url: "https://images.unsplash.com/photo-1616440347437-b1c73416efc2?w=500&auto=format&fit=crop&q=60",
          stock: 10
        },
        {
          name: "ZenLight Mood Panel",
          description: "Modular magnetic LED light panels that synchronize colors dynamically with your monitor output or workspace acoustic sound waves.",
          price: 99.99,
          category: "Smart Home",
          image_url: "https://images.unsplash.com/photo-1565814329452-e1efa11c5b89?w=500&auto=format&fit=crop&q=60",
          stock: 14
        },
        {
          name: "SoundArc Studio Soundbar",
          description: "Cinema-grade 5.1 spatial soundbar utilizing custom acoustic guides and integrated subwoofer array. Wall-mountable premium mesh housing.",
          price: 349.99,
          category: "Audio",
          image_url: "/images/studio_soundbar.png",
          stock: 6
        },
        {
          name: "Velo Smart Vision Glasses",
          description: "Minimalist titanium eyewear integrated with micro-HUD notifications, bone conduction speakers, and transition light-filtering lenses.",
          price: 289.00,
          category: "Wearables",
          image_url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500&auto=format&fit=crop&q=60",
          stock: 8
        },
        {
          name: "DeskPad Felt Mat",
          description: "Premium double-layer merino wool desk mat with natural anti-slip cork base. Soft tactile workspace element optimizing mouse sensor performance.",
          price: 49.50,
          category: "Accessories",
          image_url: "/images/deskpad_mat.png",
          stock: 22
        },
        {
          name: "NeoDock 8-in-1 USB-C Hub",
          description: "Sleek aluminum desktop hub supporting dual 4K HDMI ports, Gigabit Ethernet, 100W PD charging, and high-speed SD card readers.",
          price: 119.99,
          category: "Accessories",
          image_url: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=500&auto=format&fit=crop&q=60",
          stock: 16
        }
      ];

      for (const p of seedProducts) {
        await client.query(
          `INSERT INTO products (name, description, price, category, image_url, stock) VALUES ($1, $2, $3, $4, $5, $6)`,
          [p.name, p.description, p.price, p.category, p.image_url, p.stock]
        );
      }
      console.log('PostgreSQL database seeded successfully.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing PostgreSQL tables:', err);
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb
};
