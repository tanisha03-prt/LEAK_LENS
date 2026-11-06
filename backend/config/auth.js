import dotenv from 'dotenv';
dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || 'leaklens_super_secure_jwt_token_secret_key_2026';
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@leaklens.internal').toLowerCase();
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@LeakLens2026!';
export const ADMIN_NAME = process.env.ADMIN_NAME || 'Estate General Manager';
export const ADMIN_PHONE = process.env.ADMIN_PHONE || '+91 99000 11223';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
