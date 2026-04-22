// Best-effort client IP. On Vercel, `x-real-ip` is set by the platform and
// cannot be spoofed by clients. `x-forwarded-for` *can* be set by the client,
// so we only fall back to it when `x-real-ip` is missing (e.g. local dev).
export function getClientIp(req) {
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
