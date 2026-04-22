import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { uploadToWalrus, readFromWalrus, walrusBlobUrl, validateWalrusBlob } from './services/walrus.service.js';
import { WALRUS_PUBLISHER, WALRUS_EPOCHS } from './config.js';
import { suiCreatePost, suiCreateProfile, suiAddComment, suiLikePost, suiSendMessage, senderAddress } from './services/sui.service.js';
import {
  initDb,
  getPosts, getPostById, savePost, updatePost,
  getProfile, saveProfile, getAllProfiles,
  getComments, saveComment,
  getLikes, hasLiked, saveLike, removeLike,
  getMessages, getConversation, saveMessage,
  createFollow, deleteFollow, isFollowing, getFollowerCount, getFollowingCount, getFollowers, getFollowing,
  createNotification, getNotifications, markNotificationsRead, getUnreadNotificationCount,
} from './data/db.js';
import {
  requireAuth, signup, login, getCurrentUser,
  requestPasswordReset, resetPassword, verifyEmail, resendVerification,
} from './services/auth.service.js';
import { getClientIp } from './utils/clientIp.js';

export { senderAddress };

let dbReady = null;
export function ensureDb() {
  if (!dbReady) dbReady = initDb().catch((e) => { dbReady = null; throw e; });
  return dbReady;
}

export function buildApp() {
  const app = express();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  const corsOptions = {
    origin: true, credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.options(/.*/, cors(corsOptions));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '10mb' }));

  app.use(async (req, res, next) => {
    try { await ensureDb(); next(); }
    catch (err) { next(err); }
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      const result = await signup({ username, email, password });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Signup failed' }); }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const result = await login({ username, password });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Login failed' }); }
  });

  app.get('/api/auth/me', getCurrentUser);

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = req.body || {};
      const ip = getClientIp(req);
      const result = await requestPasswordReset({ email, ip });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Request failed' }); }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { email, code, newPassword } = req.body || {};
      const ip = getClientIp(req);
      const result = await resetPassword({ email, code, newPassword, ip });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Reset failed' }); }
  });

  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = req.body || {};
      const result = await verifyEmail({ token });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Verification failed' }); }
  });

  app.post('/api/auth/resend-verify', requireAuth, async (req, res) => {
    try {
      const result = await resendVerification({ userId: req.userAddress });
      res.json(result);
    } catch (err) { res.status(400).json({ error: err.message || 'Resend failed' }); }
  });

  // ─── Health ────────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', wallet: senderAddress, timestamp: new Date().toISOString() });
  });

  app.get('/api/config', (req, res) => {
    res.json({
      walrusPublisher: WALRUS_PUBLISHER,
      walrusAggregator: walrusBlobUrl('').replace(/\/v1\/blobs\/?$/, ''),
      walrusEpochs: WALRUS_EPOCHS,
    });
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function truncateAddr(addr) {
    if (!addr) return 'Unknown';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }
  function defaultProfile(addr) {
    return { address: addr, username: truncateAddr(addr), bio: '', displayName: '', avatarUrl: null, profession: '' };
  }
  function detectMediaType(mime) {
    if (!mime) return null;
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    return null;
  }

  // ─── Feed ──────────────────────────────────────────────────────────────────
  app.get('/api/feed', async (req, res) => {
    try {
      const posts = await getPosts();
      const profiles = await getAllProfiles();
      const enriched = await Promise.all(posts.map(async p => {
        const likes = await getLikes(p.id);
        const comments = await getComments(p.id);
        const profile = profiles[p.owner] || defaultProfile(p.owner);
        return { ...p, likes: likes.length, commentCount: comments.length, profile };
      }));
      res.json(enriched);
    } catch (err) {
      console.error('feed error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Post CRUD ─────────────────────────────────────────────────────────────
  app.post('/api/post', requireAuth, upload.single('media'), async (req, res) => {
    try {
      const { title, content } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'title and content required' });
      const effectiveOwner = req.userAddress;
      const { blobId, blobObjectId } = await uploadToWalrus(content, 'text/plain');
      let mediaBlobId = null, mediaUrl = null, mediaType = null, mediaMime = null;
      if (req.body.mediaBlobId) {
        mediaBlobId = String(req.body.mediaBlobId);
        try { mediaMime = await validateWalrusBlob(mediaBlobId, ['image/', 'video/']); }
        catch (err) { return res.status(400).json({ error: err.message }); }
        mediaType = detectMediaType(mediaMime);
        if (!mediaType) return res.status(400).json({ error: 'Only image/* or video/* media is allowed' });
        mediaUrl = walrusBlobUrl(mediaBlobId);
      } else if (req.file) {
        mediaMime = req.file.mimetype;
        mediaType = detectMediaType(mediaMime);
        if (!mediaType) return res.status(400).json({ error: 'Only image/* or video/* media is allowed' });
        const mediaUpload = await uploadToWalrus(req.file.buffer, mediaMime);
        mediaBlobId = mediaUpload.blobId;
        mediaUrl = walrusBlobUrl(mediaBlobId);
      }
      const suiResult = await suiCreatePost(blobId, title);
      const postObjectId = suiResult.effects?.created?.[0]?.reference?.objectId || null;
      const txDigest = suiResult.digest;
      const saved = await savePost({
        id: uuidv4(), postObjectId, txDigest, blobId, blobObjectId,
        blobUrl: walrusBlobUrl(blobId), mediaBlobId, mediaUrl, mediaType, mediaMime,
        owner: effectiveOwner, title, content, isDeleted: false,
        createdAt: new Date().toISOString(),
      });
      res.json(saved);
    } catch (err) {
      console.error('create_post error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/post/:id', async (req, res) => {
    const post = await getPostById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    let content = post.content;
    if (!content && post.blobId) { try { content = await readFromWalrus(post.blobId); } catch {} }
    const likes = await getLikes(post.id);
    const comments = await getComments(post.id);
    const profile = (await getProfile(post.owner)) || defaultProfile(post.owner);
    res.json({ ...post, content, likes: likes.length, comments, profile });
  });

  app.put('/api/post/:id', async (req, res) => {
    try {
      const { title, content } = req.body;
      const post = await getPostById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Not found' });
      const { blobId } = await uploadToWalrus(content, 'text/plain');
      const updated = await updatePost(req.params.id, { title, content, blobId, blobUrl: walrusBlobUrl(blobId) });
      res.json(updated);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/post/:id', async (req, res) => {
    const updated = await updatePost(req.params.id, { isDeleted: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });

  // ─── Like ──────────────────────────────────────────────────────────────────
  app.post('/api/post/:id/like', requireAuth, async (req, res) => {
    try {
      const effectiveOwner = req.userAddress;
      const postId = req.params.id;
      const post = await getPostById(postId);
      if (!post) return res.status(404).json({ error: 'Not found' });
      if (await hasLiked(postId, effectiveOwner)) {
        await removeLike(postId, effectiveOwner);
        const likes = await getLikes(postId);
        res.json({ liked: false, likes: likes.length });
      } else {
        if (post.postObjectId) { try { await suiLikePost(post.postObjectId); } catch {} }
        await saveLike({ id: uuidv4(), postId, owner: effectiveOwner, createdAt: new Date().toISOString() });
        // Notify post owner
        const actorProfile = (await getProfile(effectiveOwner)) || defaultProfile(effectiveOwner);
        await createNotification({
          recipient: post.owner, type: 'like', actorAddress: effectiveOwner,
          postId, excerpt: `liked your post "${post.title.slice(0, 50)}"`,
        });
        const likes = await getLikes(postId);
        res.json({ liked: true, likes: likes.length });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/post/:id/likes', async (req, res) => {
    const likes = await getLikes(req.params.id);
    res.json({ count: likes.length, likes });
  });

  // ─── Comment ───────────────────────────────────────────────────────────────
  app.post('/api/post/:id/comment', requireAuth, async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'content required' });
      const effectiveOwner = req.userAddress;
      const postId = req.params.id;
      const post = await getPostById(postId);
      if (!post) return res.status(404).json({ error: 'Not found' });
      if (post.postObjectId) { try { await suiAddComment(post.postObjectId, content); } catch {} }
      const comment = await saveComment({ id: uuidv4(), postId, owner: effectiveOwner, content, createdAt: new Date().toISOString() });
      // Notify post owner
      await createNotification({
        recipient: post.owner, type: 'comment', actorAddress: effectiveOwner,
        postId, excerpt: content.slice(0, 80),
      });
      const profile = (await getProfile(effectiveOwner)) || defaultProfile(effectiveOwner);
      res.json({ ...comment, profile });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/post/:id/comments', async (req, res) => {
    const profiles = await getAllProfiles();
    const comments = await getComments(req.params.id);
    res.json(comments.map(c => ({ ...c, profile: profiles[c.owner] || defaultProfile(c.owner) })));
  });

  // ─── Profile ───────────────────────────────────────────────────────────────
  app.post('/api/profile', requireAuth, upload.fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
  ]), async (req, res) => {
    try {
      const { username, bio, displayName, website, location, twitter, profession } = req.body;
      if (!username) return res.status(400).json({ error: 'username required' });
      const effectiveAddress = req.userAddress;
      const update = {
        username, bio: bio || '', displayName: displayName || '',
        website: website || '', location: location || '', twitter: twitter || '',
        profession: profession || '',
      };
      if (req.body.avatarBlobId) {
        update.avatarBlobId = String(req.body.avatarBlobId);
        try { await validateWalrusBlob(update.avatarBlobId, ['image/']); }
        catch (err) { return res.status(400).json({ error: `Avatar: ${err.message}` }); }
        update.avatarUrl = walrusBlobUrl(update.avatarBlobId);
      } else if (req.files?.avatar?.[0]) {
        const f = req.files.avatar[0];
        if (!f.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Avatar must be an image' });
        const { blobId } = await uploadToWalrus(f.buffer, f.mimetype);
        update.avatarBlobId = blobId; update.avatarUrl = walrusBlobUrl(blobId);
      }
      if (req.body.bannerBlobId) {
        update.bannerBlobId = String(req.body.bannerBlobId);
        try { await validateWalrusBlob(update.bannerBlobId, ['image/']); }
        catch (err) { return res.status(400).json({ error: `Banner: ${err.message}` }); }
        update.bannerUrl = walrusBlobUrl(update.bannerBlobId);
      } else if (req.files?.banner?.[0]) {
        const f = req.files.banner[0];
        if (!f.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Banner must be an image' });
        const { blobId } = await uploadToWalrus(f.buffer, f.mimetype);
        update.bannerBlobId = blobId; update.bannerUrl = walrusBlobUrl(blobId);
      }
      try { await suiCreateProfile(username, bio || ''); } catch {}
      const profile = await saveProfile(effectiveAddress, update);
      res.json(profile);
    } catch (err) {
      console.error('profile error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/profile/:address', async (req, res) => {
    const targetAddr = req.params.address;
    const profile = await getProfile(targetAddr);
    const allPosts = await getPosts();
    const posts = allPosts.filter(p => p.owner === targetAddr);
    const enrichedPosts = await Promise.all(posts.map(async p => {
      const likes = await getLikes(p.id);
      const comments = await getComments(p.id);
      return { ...p, likes: likes.length, commentCount: comments.length };
    }));
    const totalLikes = enrichedPosts.reduce((acc, p) => acc + p.likes, 0);
    const [followerCount, followingCount] = await Promise.all([
      getFollowerCount(targetAddr),
      getFollowingCount(targetAddr),
    ]);
    res.json({
      address: targetAddr,
      ...(profile || defaultProfile(targetAddr)),
      posts: enrichedPosts, totalLikes, postCount: enrichedPosts.length,
      followerCount, followingCount,
    });
  });

  app.get('/api/profiles', async (req, res) => {
    const profiles = await getAllProfiles();
    res.json(Object.values(profiles));
  });

  // ─── Follows ───────────────────────────────────────────────────────────────
  app.post('/api/follow', requireAuth, async (req, res) => {
    try {
      const follower = req.userAddress;
      const { following } = req.body;
      if (!following) return res.status(400).json({ error: 'following address required' });
      if (follower === following) return res.status(400).json({ error: 'Cannot follow yourself' });
      await createFollow(follower, following);
      await createNotification({
        recipient: following, type: 'follow', actorAddress: follower,
        excerpt: 'started following you',
      });
      res.json({ ok: true, following: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/follow/:address', requireAuth, async (req, res) => {
    try {
      const follower = req.userAddress;
      const following = req.params.address;
      await deleteFollow(follower, following);
      res.json({ ok: true, following: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/follow/status/:address', requireAuth, async (req, res) => {
    try {
      const following = await isFollowing(req.userAddress, req.params.address);
      res.json({ following });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/profile/:address/followers', async (req, res) => {
    try {
      const followers = await getFollowers(req.params.address);
      const profiles = await getAllProfiles();
      res.json(followers.map(f => ({ ...f, profile: profiles[f.address] || defaultProfile(f.address) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/profile/:address/following', async (req, res) => {
    try {
      const following = await getFollowing(req.params.address);
      const profiles = await getAllProfiles();
      res.json(following.map(f => ({ ...f, profile: profiles[f.address] || defaultProfile(f.address) })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Notifications ─────────────────────────────────────────────────────────
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const notifications = await getNotifications(req.userAddress);
      const profiles = await getAllProfiles();
      res.json(notifications.map(n => ({
        ...n,
        actorProfile: profiles[n.actorAddress] || defaultProfile(n.actorAddress),
      })));
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/notifications/read', requireAuth, async (req, res) => {
    try {
      await markNotificationsRead(req.userAddress);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const count = await getUnreadNotificationCount(req.userAddress);
      res.json({ count });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ─── Messages ──────────────────────────────────────────────────────────────
  app.post('/api/message', requireAuth, async (req, res) => {
    try {
      const { receiver, content } = req.body;
      if (!receiver || !content) return res.status(400).json({ error: 'receiver and content required' });
      const effectiveSender = req.userAddress;
      try { await suiSendMessage(receiver, content); } catch {}
      const message = await saveMessage({
        id: uuidv4(), sender: effectiveSender, receiver, content,
        createdAt: new Date().toISOString(),
      });
      res.json(message);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/messages/:address', async (req, res) => {
    const messages = await getMessages(req.params.address);
    const profiles = await getAllProfiles();
    const enriched = messages.map(m => ({
      ...m,
      senderProfile: profiles[m.sender] || defaultProfile(m.sender),
      receiverProfile: profiles[m.receiver] || defaultProfile(m.receiver),
    }));
    res.json(enriched);
  });

  app.get('/api/conversation', async (req, res) => {
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ error: 'a and b addresses required' });
    const messages = await getConversation(a, b);
    res.json(messages);
  });

  // ─── Stats ─────────────────────────────────────────────────────────────────
  app.get('/api/stats', async (req, res) => {
    const posts = await getPosts();
    const profiles = await getAllProfiles();
    let totalLikes = 0, totalComments = 0;
    for (const p of posts) {
      totalLikes += (await getLikes(p.id)).length;
      totalComments += (await getComments(p.id)).length;
    }
    res.json({
      totalPosts: posts.length,
      totalProfiles: Object.keys(profiles).length,
      totalLikes, totalComments, walletAddress: senderAddress,
    });
  });

  return app;
}
