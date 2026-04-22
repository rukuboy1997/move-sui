import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  getUserByUsername, getUserByEmail, getUserByAddress, getUserByVerifyToken,
  createUser, setEmailVerifyToken, verifyEmailToken,
  saveProfile, createPasswordReset, findActiveResetByEmail, claimReset, updateUserPassword,
  recordAndCheckRate,
} from '../data/db.js';
import { sendEmail, isEmailConfigured } from './email.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'myworld-dev-insecure-secret-change-in-prod';
const JWT_EXPIRES_IN = '30d';
const SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.warn('[auth] JWT_SECRET not set — using dev fallback. Set JWT_SECRET in production.');
}

function generateAddress() {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, address: user.address, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    address: user.address,
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
  };
}

export async function signup({ username, email, password }) {
  if (!username || username.length < 3) throw new Error('Username must be at least 3 characters');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  if (!/^[a-zA-Z0-9_]+$/.test(username)) throw new Error('Username can only contain letters, numbers and underscores');

  const existing = await getUserByUsername(username);
  if (existing) throw new Error('Username already taken');
  if (email) {
    const byEmail = await getUserByEmail(email);
    if (byEmail) throw new Error('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const address = generateAddress();
  const id = uuidv4();
  const user = await createUser({ id, username, email: email || null, passwordHash, address });

  await saveProfile(address, { username, bio: '', displayName: username });

  // Send email verification if email provided
  if (email) {
    const token = uuidv4();
    await setEmailVerifyToken(id, token);
    await sendVerificationEmail({ email, username, token });
  }

  return { user: publicUser(user), token: signToken(user) };
}

async function sendVerificationEmail({ email, username, token }) {
  const appUrl = process.env.APP_URL || 'https://myworld-app.vercel.app';
  const link = `${appUrl}/verify-email?token=${token}`;
  const subject = 'Verify your myWorld email';
  const text = `Hi @${username},\n\nPlease verify your email address by visiting:\n${link}\n\nThis link is valid for 7 days. If you didn't create a myWorld account, you can ignore this email.\n\n— myWorld`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:16px">
    <h2 style="margin-top:0">Verify your email</h2>
    <p>Hi <strong>@${username}</strong>, thanks for joining myWorld!</p>
    <p>Click the button below to verify your email address:</p>
    <a href="${link}" style="display:inline-block;background:#00bfff;color:#0a0a0a;padding:12px 28px;border-radius:9999px;font-weight:700;text-decoration:none;margin:12px 0">Verify Email</a>
    <p style="color:#888;font-size:13px;margin-top:20px">Or copy this link: ${link}</p>
    <p style="color:#666;font-size:12px;margin-top:32px">— myWorld</p>
  </div>`;
  try {
    await sendEmail({ to: email, subject, text, html });
  } catch (err) {
    console.error('[auth] verification email failed:', err.message);
  }
  if (!isEmailConfigured()) {
    console.log(`[auth] DEV verify link for ${email}: ${link}`);
  }
}

export async function verifyEmail({ token }) {
  if (!token) throw new Error('Invalid verification link');
  const ok = await verifyEmailToken(token);
  if (!ok) throw new Error('This verification link is invalid or has already been used');
  return { ok: true };
}

export async function resendVerification({ userId }) {
  const user = await getUserByAddress(userId);
  if (!user) throw new Error('User not found');
  if (user.emailVerified) throw new Error('Email is already verified');
  if (!user.email) throw new Error('No email address on file');
  const token = uuidv4();
  await setEmailVerifyToken(user.id, token);
  await sendVerificationEmail({ email: user.email, username: user.username, token });
  return { ok: true };
}

export async function login({ username, password }) {
  if (!username || !password) throw new Error('Username and password required');
  const user = await getUserByUsername(username);
  if (!user) throw new Error('Invalid username or password');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error('Invalid username or password');
  return { user: publicUser(user), token: signToken(user) };
}

function extractToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

async function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserByAddress(payload.address);
    return user;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    const user = await verifyToken(token);
    if (user) { req.user = user; req.userAddress = user.address; }
  }
  next();
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Sign in required' });
  const user = await verifyToken(token);
  if (!user) return res.status(401).json({ error: 'Invalid or expired session' });
  req.user = user;
  req.userAddress = user.address;
  next();
}

// ─── Forgot / Reset Password ─────────────────────────────────────────────────
const RESET_CODE_TTL_MIN = 15;
const GENERIC_RESET_ERROR = 'The verification code is invalid or has expired. Please request a new one.';
const DUMMY_HASH = bcrypt.hashSync('dummy-payload-for-constant-time-cmp', SALT_ROUNDS);
const checkRate = (key, max, windowMs) => recordAndCheckRate(key, max, windowMs);

function generateCode() {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

export async function requestPasswordReset({ email, ip }) {
  if (!email) throw new Error('Email is required');
  const emailKey = `forgot:email:${email.toLowerCase()}`;
  const ipKey = `forgot:ip:${ip || 'unknown'}`;
  const [emailOk, ipOk] = await Promise.all([
    checkRate(emailKey, 5, 15 * 60 * 1000),
    checkRate(ipKey, 20, 15 * 60 * 1000),
  ]);
  if (!emailOk || !ipOk) return { ok: true };

  const user = await getUserByEmail(email);
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);

  if (user) {
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MIN * 60 * 1000);
    await createPasswordReset({ email, codeHash, expiresAt });
    const subject = 'Your myWorld password reset code';
    const text = `Hi @${user.username},\n\nYour myWorld password reset code is: ${code}\n\nThis code expires in ${RESET_CODE_TTL_MIN} minutes.\n\n— myWorld`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:16px">
      <h2 style="margin-top:0">Reset your password</h2>
      <p>Hi <strong>@${user.username}</strong>, here's your verification code:</p>
      <div style="font-size:36px;font-weight:700;letter-spacing:8px;background:#1a1a1a;padding:20px;border-radius:12px;text-align:center;font-family:monospace">${code}</div>
      <p style="color:#888;font-size:13px;margin-top:20px">This code expires in ${RESET_CODE_TTL_MIN} minutes.</p>
      <p style="color:#666;font-size:12px;margin-top:32px">— myWorld</p>
    </div>`;
    try { await sendEmail({ to: email, subject, text, html }); } catch (err) { console.error('[auth] email send failed:', err.message); }
    if (!isEmailConfigured()) console.log(`[auth] DEV password reset code for ${email}: ${code}`);
  }
  return { ok: true };
}

export async function resetPassword({ email, code, newPassword, ip }) {
  if (!email || !code || !newPassword) throw new Error(GENERIC_RESET_ERROR);
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
  const emailKey = `reset:email:${email.toLowerCase()}`;
  const ipKey = `reset:ip:${ip || 'unknown'}`;
  const [emailOk, ipOk] = await Promise.all([
    checkRate(emailKey, 10, 15 * 60 * 1000),
    checkRate(ipKey, 30, 15 * 60 * 1000),
  ]);
  if (!emailOk || !ipOk) throw new Error('Too many attempts. Please try again later.');
  const user = await getUserByEmail(email);
  const reset = user ? await findActiveResetByEmail(email) : null;
  const candidateHash = reset?.code_hash || DUMMY_HASH;
  const codeMatches = await bcrypt.compare(code, candidateHash);
  if (!user || !reset || !codeMatches) throw new Error(GENERIC_RESET_ERROR);
  const claimed = await claimReset(reset.id);
  if (!claimed) throw new Error(GENERIC_RESET_ERROR);
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateUserPassword(user.id, passwordHash);
  return { user: publicUser(user), token: signToken(user) };
}

export async function getCurrentUser(req, res) {
  const token = extractToken(req);
  if (!token) return res.json({ user: null });
  const user = await verifyToken(token);
  res.json({ user: publicUser(user) });
}
