import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { v4 as uuidv4 } from 'uuid';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.NEON_DATABASE_URL;
if (!connectionString) {
  console.error('[db] NEON_DATABASE_URL is not set');
  process.exit(1);
}

export const pool = new Pool({ connectionString });

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  address         TEXT UNIQUE NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id              SERIAL PRIMARY KEY,
  bucket_key      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_key_time
  ON rate_limit_events (bucket_key, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  code_hash       TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets (LOWER(email));

CREATE TABLE IF NOT EXISTS profiles (
  address         TEXT PRIMARY KEY,
  username        TEXT NOT NULL,
  bio             TEXT DEFAULT '',
  display_name    TEXT DEFAULT '',
  avatar_blob_id  TEXT,
  avatar_url      TEXT,
  banner_blob_id  TEXT,
  banner_url      TEXT,
  website         TEXT DEFAULT '',
  location        TEXT DEFAULT '',
  twitter         TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts (
  id              TEXT PRIMARY KEY,
  post_object_id  TEXT,
  tx_digest       TEXT,
  blob_id         TEXT,
  blob_object_id  TEXT,
  blob_url        TEXT,
  media_blob_id   TEXT,
  media_url       TEXT,
  media_type      TEXT,
  media_mime      TEXT,
  owner           TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS likes (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  owner       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, owner)
);

CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  post_id     TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  owner       TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  sender      TEXT NOT NULL,
  receiver    TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
  follower    TEXT NOT NULL,
  following   TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower, following)
);

CREATE TABLE IF NOT EXISTS notifications (
  id            TEXT PRIMARY KEY,
  recipient     TEXT NOT NULL,
  type          TEXT NOT NULL,
  actor_address TEXT NOT NULL,
  post_id       TEXT,
  excerpt       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  read_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_owner    ON posts(owner);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post     ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post  ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair  ON messages(sender, receiver);
CREATE INDEX IF NOT EXISTS idx_follows_follower   ON follows(follower);
CREATE INDEX IF NOT EXISTS idx_follows_following  ON follows(following);
CREATE INDEX IF NOT EXISTS idx_notifications_rec  ON notifications(recipient, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profession TEXT DEFAULT '';
`;

// ─── Row → object mapping ────────────────────────────────────────────────────
function rowToPost(r) {
  if (!r) return null;
  return {
    id: r.id, postObjectId: r.post_object_id, txDigest: r.tx_digest,
    blobId: r.blob_id, blobObjectId: r.blob_object_id, blobUrl: r.blob_url,
    mediaBlobId: r.media_blob_id, mediaUrl: r.media_url, mediaType: r.media_type, mediaMime: r.media_mime,
    owner: r.owner, title: r.title, content: r.content, isDeleted: r.is_deleted,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToProfile(r) {
  if (!r) return null;
  return {
    address: r.address, username: r.username, bio: r.bio || '',
    displayName: r.display_name || '', avatarBlobId: r.avatar_blob_id, avatarUrl: r.avatar_url,
    bannerBlobId: r.banner_blob_id, bannerUrl: r.banner_url,
    website: r.website || '', location: r.location || '', twitter: r.twitter || '',
    profession: r.profession || '',
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToComment(r) {
  if (!r) return null;
  return {
    id: r.id, postId: r.post_id, owner: r.owner, content: r.content,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToLike(r) {
  if (!r) return null;
  return {
    id: r.id, postId: r.post_id, owner: r.owner,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToMessage(r) {
  if (!r) return null;
  return {
    id: r.id, sender: r.sender, receiver: r.receiver, content: r.content,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToUser(r) {
  if (!r) return null;
  return {
    id: r.id, username: r.username, email: r.email, passwordHash: r.password_hash,
    address: r.address, emailVerified: !!r.email_verified_at,
    emailVerifyToken: r.email_verify_token,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function rowToNotification(r) {
  if (!r) return null;
  return {
    id: r.id, recipient: r.recipient, type: r.type,
    actorAddress: r.actor_address, postId: r.post_id, excerpt: r.excerpt,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    readAt: r.read_at ? (r.read_at instanceof Date ? r.read_at.toISOString() : r.read_at) : null,
  };
}

// ─── Posts ───────────────────────────────────────────────────────────────────
export async function getPosts() {
  const { rows } = await pool.query(`SELECT * FROM posts WHERE is_deleted = false ORDER BY created_at DESC`);
  return rows.map(rowToPost);
}

export async function getPostById(id) {
  const { rows } = await pool.query(`SELECT * FROM posts WHERE id = $1`, [id]);
  return rowToPost(rows[0]);
}

export async function savePost(post) {
  const id = post.id || uuidv4();
  await pool.query(
    `INSERT INTO posts (id, post_object_id, tx_digest, blob_id, blob_object_id, blob_url,
       media_blob_id, media_url, media_type, media_mime,
       owner, title, content, is_deleted, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (id) DO UPDATE SET
       post_object_id = EXCLUDED.post_object_id, tx_digest = EXCLUDED.tx_digest,
       blob_id = EXCLUDED.blob_id, blob_object_id = EXCLUDED.blob_object_id,
       blob_url = EXCLUDED.blob_url, media_blob_id = EXCLUDED.media_blob_id,
       media_url = EXCLUDED.media_url, media_type = EXCLUDED.media_type,
       media_mime = EXCLUDED.media_mime, title = EXCLUDED.title,
       content = EXCLUDED.content, is_deleted = EXCLUDED.is_deleted`,
    [
      id, post.postObjectId, post.txDigest, post.blobId, post.blobObjectId, post.blobUrl,
      post.mediaBlobId || null, post.mediaUrl || null, post.mediaType || null, post.mediaMime || null,
      post.owner, post.title, post.content, post.isDeleted || false,
      post.createdAt || new Date().toISOString(),
    ]
  );
  return getPostById(id);
}

export async function updatePost(id, fields) {
  const map = {
    title: 'title', content: 'content', blobId: 'blob_id', blobUrl: 'blob_url',
    mediaBlobId: 'media_blob_id', mediaUrl: 'media_url', mediaType: 'media_type',
    mediaMime: 'media_mime', isDeleted: 'is_deleted',
  };
  const sets = []; const vals = []; let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (map[k]) { sets.push(`${map[k]} = $${i++}`); vals.push(v); }
  }
  if (!sets.length) return getPostById(id);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE posts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  return rowToPost(rows[0]);
}

// ─── Profiles ────────────────────────────────────────────────────────────────
export async function getProfile(address) {
  const { rows } = await pool.query(`SELECT * FROM profiles WHERE address = $1`, [address]);
  return rowToProfile(rows[0]);
}

export async function saveProfile(address, profile) {
  const existing = await getProfile(address);
  const merged = { ...(existing || {}), ...profile, address };
  await pool.query(
    `INSERT INTO profiles (address, username, bio, display_name, avatar_blob_id, avatar_url,
       banner_blob_id, banner_url, website, location, twitter, profession, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
     ON CONFLICT (address) DO UPDATE SET
       username = EXCLUDED.username, bio = EXCLUDED.bio, display_name = EXCLUDED.display_name,
       avatar_blob_id = COALESCE(EXCLUDED.avatar_blob_id, profiles.avatar_blob_id),
       avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
       banner_blob_id = COALESCE(EXCLUDED.banner_blob_id, profiles.banner_blob_id),
       banner_url = COALESCE(EXCLUDED.banner_url, profiles.banner_url),
       website = EXCLUDED.website, location = EXCLUDED.location, twitter = EXCLUDED.twitter,
       profession = EXCLUDED.profession, updated_at = NOW()`,
    [
      address, merged.username || '', merged.bio || '', merged.displayName || '',
      merged.avatarBlobId || null, merged.avatarUrl || null,
      merged.bannerBlobId || null, merged.bannerUrl || null,
      merged.website || '', merged.location || '', merged.twitter || '',
      merged.profession || '',
    ]
  );
  return getProfile(address);
}

export async function getAllProfiles() {
  const { rows } = await pool.query(`SELECT * FROM profiles`);
  const map = {};
  for (const r of rows) map[r.address] = rowToProfile(r);
  return map;
}

// ─── Comments ────────────────────────────────────────────────────────────────
export async function getComments(postId) {
  const { rows } = await pool.query(`SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC`, [postId]);
  return rows.map(rowToComment);
}

export async function saveComment(comment) {
  const id = comment.id || uuidv4();
  await pool.query(`INSERT INTO comments (id, post_id, owner, content, created_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, comment.postId, comment.owner, comment.content, comment.createdAt || new Date().toISOString()]);
  return { ...comment, id };
}

// ─── Likes ───────────────────────────────────────────────────────────────────
export async function getLikes(postId) {
  const { rows } = await pool.query(`SELECT * FROM likes WHERE post_id = $1`, [postId]);
  return rows.map(rowToLike);
}

export async function hasLiked(postId, owner) {
  const { rows } = await pool.query(`SELECT 1 FROM likes WHERE post_id = $1 AND owner = $2`, [postId, owner]);
  return rows.length > 0;
}

export async function saveLike(like) {
  const id = like.id || uuidv4();
  await pool.query(
    `INSERT INTO likes (id, post_id, owner, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (post_id, owner) DO NOTHING`,
    [id, like.postId, like.owner, like.createdAt || new Date().toISOString()]
  );
  return { ...like, id };
}

export async function removeLike(postId, owner) {
  await pool.query(`DELETE FROM likes WHERE post_id = $1 AND owner = $2`, [postId, owner]);
}

// ─── Messages ────────────────────────────────────────────────────────────────
export async function getMessages(address) {
  const { rows } = await pool.query(
    `SELECT * FROM messages WHERE sender = $1 OR receiver = $1 ORDER BY created_at ASC`, [address]
  );
  return rows.map(rowToMessage);
}

export async function getConversation(a, b) {
  const { rows } = await pool.query(
    `SELECT * FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$2 AND receiver=$1) ORDER BY created_at ASC`,
    [a, b]
  );
  return rows.map(rowToMessage);
}

export async function saveMessage(message) {
  const id = message.id || uuidv4();
  await pool.query(`INSERT INTO messages (id, sender, receiver, content, created_at) VALUES ($1,$2,$3,$4,$5)`,
    [id, message.sender, message.receiver, message.content, message.createdAt || new Date().toISOString()]);
  return { ...message, id };
}

// ─── Follows ─────────────────────────────────────────────────────────────────
export async function createFollow(follower, following) {
  await pool.query(
    `INSERT INTO follows (follower, following) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [follower, following]
  );
}

export async function deleteFollow(follower, following) {
  await pool.query(`DELETE FROM follows WHERE follower=$1 AND following=$2`, [follower, following]);
}

export async function isFollowing(follower, following) {
  const { rows } = await pool.query(
    `SELECT 1 FROM follows WHERE follower=$1 AND following=$2`, [follower, following]
  );
  return rows.length > 0;
}

export async function getFollowerCount(address) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM follows WHERE following=$1`, [address]);
  return rows[0].c;
}

export async function getFollowingCount(address) {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM follows WHERE follower=$1`, [address]);
  return rows[0].c;
}

export async function getFollowers(address) {
  const { rows } = await pool.query(
    `SELECT follower AS address, created_at FROM follows WHERE following=$1 ORDER BY created_at DESC`, [address]
  );
  return rows;
}

export async function getFollowing(address) {
  const { rows } = await pool.query(
    `SELECT following AS address, created_at FROM follows WHERE follower=$1 ORDER BY created_at DESC`, [address]
  );
  return rows;
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function createNotification({ recipient, type, actorAddress, postId, excerpt }) {
  if (recipient === actorAddress) return; // don't notify yourself
  const id = uuidv4();
  await pool.query(
    `INSERT INTO notifications (id, recipient, type, actor_address, post_id, excerpt) VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, recipient, type, actorAddress, postId || null, excerpt || null]
  );
}

export async function getNotifications(recipient) {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE recipient=$1 ORDER BY created_at DESC LIMIT 50`, [recipient]
  );
  return rows.map(rowToNotification);
}

export async function markNotificationsRead(recipient) {
  await pool.query(
    `UPDATE notifications SET read_at=NOW() WHERE recipient=$1 AND read_at IS NULL`, [recipient]
  );
}

export async function getUnreadNotificationCount(recipient) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM notifications WHERE recipient=$1 AND read_at IS NULL`, [recipient]
  );
  return rows[0].c;
}

// ─── Users (auth) ─────────────────────────────────────────────────────────────
export async function getUserByUsername(username) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE LOWER(username) = LOWER($1)`, [username]);
  return rowToUser(rows[0]);
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const { rows } = await pool.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  return rowToUser(rows[0]);
}

export async function getUserByAddress(address) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE address = $1`, [address]);
  return rowToUser(rows[0]);
}

export async function getUserByVerifyToken(token) {
  const { rows } = await pool.query(`SELECT * FROM users WHERE email_verify_token = $1`, [token]);
  return rowToUser(rows[0]);
}

export async function createUser({ id, username, email, passwordHash, address }) {
  await pool.query(`INSERT INTO users (id, username, email, password_hash, address) VALUES ($1,$2,$3,$4,$5)`,
    [id, username, email || null, passwordHash, address]);
  return getUserByAddress(address);
}

export async function setEmailVerifyToken(userId, token) {
  await pool.query(`UPDATE users SET email_verify_token=$1 WHERE id=$2`, [token, userId]);
}

export async function verifyEmailToken(token) {
  const { rowCount } = await pool.query(
    `UPDATE users SET email_verified_at=NOW(), email_verify_token=NULL WHERE email_verify_token=$1 AND email_verified_at IS NULL`,
    [token]
  );
  return rowCount === 1;
}

export async function createPasswordReset({ email, codeHash, expiresAt }) {
  await pool.query(`UPDATE password_resets SET used_at=NOW() WHERE LOWER(email)=LOWER($1) AND used_at IS NULL`, [email]);
  await pool.query(`INSERT INTO password_resets (email, code_hash, expires_at) VALUES ($1,$2,$3)`, [email, codeHash, expiresAt]);
}

export async function findActiveResetByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM password_resets WHERE LOWER(email)=LOWER($1) AND used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function claimReset(id) {
  const { rowCount } = await pool.query(
    `UPDATE password_resets SET used_at=NOW() WHERE id=$1 AND used_at IS NULL AND expires_at > NOW()`, [id]
  );
  return rowCount === 1;
}

export async function recordAndCheckRate(key, max, windowMs) {
  const cutoff = new Date(Date.now() - windowMs);
  const { rows } = await pool.query(
    `WITH pruned AS (DELETE FROM rate_limit_events WHERE bucket_key=$1 AND created_at<=$2),
     inserted AS (INSERT INTO rate_limit_events (bucket_key) VALUES ($1) RETURNING 1)
     SELECT COUNT(*)::int AS c FROM rate_limit_events WHERE bucket_key=$1 AND created_at>$2`,
    [key, cutoff]
  );
  return rows[0].c <= max;
}

export async function updateUserPassword(userId, passwordHash) {
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [passwordHash, userId]);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initDb() {
  await pool.query(SCHEMA_SQL);
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM posts`);
  if (rows[0].c === 0) {
    console.log('[db] empty — seeding initial data...');
    await seedInitialData();
  }
  console.log('[db] Postgres ready');
}

async function seedInitialData() {
  const OWNER = '0x2598d09dd5113dc4c2abd298c3c08597eb4d1848d5633667854a05535f4d66ed';
  const FAN1  = '0x1111000000000000000000000000000000000000000000000000000000000001';
  const FAN2  = '0x2222000000000000000000000000000000000000000000000000000000000002';

  await saveProfile(OWNER, { username: 'myWorld_Official', bio: 'The official myWorld account. Building the future of fan engagement on Sui blockchain.', displayName: 'myWorld', location: 'Decentralized', website: 'https://myworld.app', profession: 'Tech Entrepreneur' });
  await saveProfile(FAN1,  { username: 'StarFan_Alpha', bio: 'Day 1 supporter. Believer in decentralized social.', displayName: 'Alpha', profession: 'Content Creator' });
  await saveProfile(FAN2,  { username: 'CryptoFan_Beta', bio: 'Here for the culture and the blockchain.', displayName: 'Beta' });

  await savePost({ id: 'seed-post-1', postObjectId: '0x1fe99b7cba1e3db5657f1057f820290af2820ba4a3a7f8c140cfa5405668c589', txDigest: 'ckmeHkarz1LfHKR4eryP2UjswSFjKwVGsWciu6mrbt9', blobId: 'edezrmgxXdEXcGjKWnI-NWYOVBjFCAHXX5deNIbiT2k', blobObjectId: '0xe4924b2c5eea8695824f24af08517818ff74c5a2bb5666f83caa9ef9dfb14a42', owner: OWNER, title: 'Welcome to myWorld', content: 'This is the very first post on myWorld — a new era of fan engagement powered by the Sui blockchain and Walrus decentralized storage. Every post you see here is permanently stored on the decentralized web, owned by its creator, immutable and censorship-resistant. Welcome to the future.', blobUrl: 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/edezrmgxXdEXcGjKWnI-NWYOVBjFCAHXX5deNIbiT2k', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() });
  await savePost({ id: 'seed-post-2', owner: OWNER, title: 'Behind the Scenes', content: 'Not everything makes it to the main stage. This is where the real moments happen — unfiltered, unscripted, and directly to you. No middlemen. No algorithms deciding what you see. Just me and my world, now your world too.', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() });
  await savePost({ id: 'seed-post-3', owner: FAN1, title: 'Day 1 fan right here', content: 'Been following this journey from the very beginning. myWorld is everything I hoped it would be — direct, authentic, decentralized. Proud to be part of this community from day one.', createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() });

  await saveLike({ postId: 'seed-post-1', owner: FAN1 });
  await saveLike({ postId: 'seed-post-1', owner: FAN2 });
  await saveLike({ postId: 'seed-post-2', owner: FAN1 });
  await saveComment({ postId: 'seed-post-1', owner: FAN1, content: 'This is incredible. First post on a decentralized social platform — history in the making.', createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString() });
  await saveComment({ postId: 'seed-post-1', owner: FAN2, content: 'The future is here. No more centralized gatekeepers.', createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() });
  await saveMessage({ sender: FAN1, receiver: OWNER, content: 'Hey! Just joined myWorld. This is amazing!', createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() });
  await saveMessage({ sender: OWNER, receiver: FAN1, content: 'Welcome to myWorld! So glad you are here. Exciting things ahead.', createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString() });

  console.log('[db] seed complete');
}
