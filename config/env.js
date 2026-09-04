require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  // Postgres (Supabase). DATABASE_URL is the Supabase connection string —
  // use the "Transaction pooler" (port 6543) URI for serverless (Vercel);
  // it appends ?sslmode=require itself, but we also force ssl below since
  // some hosts strip query strings from env vars.
  db: {
    url: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL !== 'false',
    poolMax: Number(process.env.DB_POOL_MAX || (process.env.VERCEL ? 1 : 10))
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  },
  superAdmin: {
    name: process.env.SUPER_ADMIN_NAME || 'Platform Super Admin',
    username: process.env.SUPER_ADMIN_USERNAME || 'superadmin',
    email: process.env.SUPER_ADMIN_EMAIL || 'superadmin@platform.local',
    password: process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@123'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'uploads'
  }
};
