const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function initDb() {
  if (!connectionString || connectionString.includes('ep-xyz.neon.tech')) {
    console.warn('\n⚠️ WARNING: DATABASE_URL is not set or contains placeholder value in backend/.env.');
    console.warn('Please update DATABASE_URL with your Neon PostgreSQL connection string from https://neon.tech!\n');
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        current_streak INT NOT NULL DEFAULT 0,
        best_streak INT NOT NULL DEFAULT 0,
        last_completed_day VARCHAR(50),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS collectibles (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL CHECK(type IN ('cat', 'piece')),
        name VARCHAR(255) NOT NULL,
        detail TEXT,
        image_url VARCHAR(255) NOT NULL,
        order_index INT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_collectibles (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collectible_id INT NOT NULL REFERENCES collectibles(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        duration_min INT NOT NULL,
        intention TEXT,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reward_type VARCHAR(50),
        reward_id INT
      );
    `);

    // Seed 12 cats and 12 pieces if collectibles table is empty
    const countRes = await pool.query('SELECT COUNT(*) as count FROM collectibles');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
      const cats = [
        ['cat', 'Mochi', 'Naps in sunbeams, ignores everyone', 'assets/cats/mochi.png', 1],
        ['cat', 'Biscuit', 'Judges your life choices silently', 'assets/cats/biscuit.png', 2],
        ['cat', 'Luna', 'Watches the night sky with curiosity', 'assets/cats/luna.png', 3],
        ['cat', 'Oliver', 'Always ready for a gentle purr', 'assets/cats/oliver.png', 4],
        ['cat', 'Cleo', 'Sits like royalty on cozy cushions', 'assets/cats/cleo.png', 5],
        ['cat', 'Simba', 'Brave little explorer of quiet corners', 'assets/cats/simba.png', 6],
        ['cat', 'Peanut', 'Small, playful, and loves cardboards', 'assets/cats/peanut.png', 7],
        ['cat', 'Whiskers', 'Master of peaceful cat naps', 'assets/cats/whiskers.png', 8],
        ['cat', 'Jasper', 'Quietly observes the room from above', 'assets/cats/jasper.png', 9],
        ['cat', 'Hazel', 'Loves warm tea steam and quiet rooms', 'assets/cats/hazel.png', 10],
        ['cat', 'Willow', 'Soft purrs that soothe your stress', 'assets/cats/willow.png', 11],
        ['cat', 'Ziggy', 'Chases dust motes in gentle light', 'assets/cats/ziggy.png', 12],
      ];

      const pieces = [
        ['piece', 'A soft rug', 'Warms up the floor', 'assets/pieces/rug.png', 1],
        ['piece', 'Oak Coffee Table', 'Sturdy surface for warm tea', 'assets/pieces/coffee_table.png', 2],
        ['piece', 'Armchair', 'Plush seat for quiet reading', 'assets/pieces/armchair.png', 3],
        ['piece', 'Floor Lamp', 'Casts a warm, soothing glow', 'assets/pieces/lamp.png', 4],
        ['piece', 'Plant Stand', 'Holds lush green houseplants', 'assets/pieces/plant_stand.png', 5],
        ['piece', 'Cushion', 'Soft accent for cozy corners', 'assets/pieces/cushion.png', 6],
        ['piece', 'Bookcase', 'Filled with peaceful stories', 'assets/pieces/bookcase.png', 7],
        ['piece', 'Tea Set', 'Ceramic teapot and two cups', 'assets/pieces/tea_set.png', 8],
        ['piece', 'Wall Clock', 'Ticks softly in rhythm with your breath', 'assets/pieces/clock.png', 9],
        ['piece', 'Cat Bed', 'Warm fleece nest for furry friends', 'assets/pieces/cat_bed.png', 10],
        ['piece', 'Knit Blanket', 'Handmade throw for chilly afternoons', 'assets/pieces/blanket.png', 11],
        ['piece', 'Golden Bell', 'Chimes gently with the breeze', 'assets/pieces/golden_bell.png', 12],
      ];


      for (const item of [...cats, ...pieces]) {
        await pool.query(
          `INSERT INTO collectibles (type, name, detail, image_url, order_index) VALUES ($1, $2, $3, $4, $5)`,
          item
        );
      }
      console.log('✅ Collectibles catalog seeded into Neon PostgreSQL database.');
    }
    console.log('✅ Neon PostgreSQL database schema initialized.');
  } catch (err) {
    console.error('❌ Error initializing Neon database:', err.message);
  }
}

module.exports = {
  pool,
  query,
  initDb
};
