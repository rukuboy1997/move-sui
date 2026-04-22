import { WALRUS_PUBLISHER, WALRUS_AGGREGATOR, WALRUS_EPOCHS } from '../config.js';

/**
 * Upload arbitrary content to Walrus.
 * @param {string|Buffer} content - text or binary buffer
 * @param {string} contentType - mime type (default octet-stream)
 */
export async function uploadToWalrus(content, contentType = 'application/octet-stream') {
  const body = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${WALRUS_EPOCHS}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });

  if (!res.ok) throw new Error(`Walrus upload failed: ${res.status} ${await res.text()}`);

  const json = await res.json();

  let blobId, blobObjectId, cost;
  if (json.newlyCreated) {
    blobId = json.newlyCreated.blobObject.blobId;
    blobObjectId = json.newlyCreated.blobObject.id;
    cost = json.newlyCreated.cost;
  } else if (json.alreadyCertified) {
    blobId = json.alreadyCertified.blobId;
    blobObjectId = null;
    cost = 0;
  } else {
    throw new Error('Unexpected Walrus response: ' + JSON.stringify(json));
  }

  return { blobId, blobObjectId, cost };
}

export async function readFromWalrus(blobId) {
  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Walrus read failed: ${res.status}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString('utf8');
}

export function walrusBlobUrl(blobId) {
  return `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
}

// Detect MIME from the first few bytes ("magic numbers"). Walrus stores blobs
// as opaque bytes and the aggregator doesn't preserve the original
// Content-Type, so we sniff the actual file signature instead of trusting
// either the client or the aggregator's headers.
function sniffMime(buf) {
  if (!buf || buf.length < 4) return null;
  const b = buf;
  // ── Images ─────────────────────────────────────────────────────────────
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  // <svg or <?xml followed by svg
  const head = b.slice(0, Math.min(b.length, 256)).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  // ── Video ──────────────────────────────────────────────────────────────
  // ISO BMFF (mp4, m4v, mov): bytes 4-7 == 'ftyp'
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = b.slice(8, 12).toString('ascii').toLowerCase();
    if (brand.startsWith('qt')) return 'video/quicktime';
    return 'video/mp4';
  }
  // WebM / Matroska: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm';
  return null;
}

/**
 * Verify a client-supplied blobId actually exists in Walrus and that its
 * real bytes match one of the allowed MIME prefixes. Returns the sniffed
 * MIME string. Throws on missing blob / disallowed type.
 *
 * Stops authenticated users from attaching fake or wrong-type blob IDs to
 * their posts/profiles when the browser uploads directly to Walrus.
 *
 * @param {string} blobId
 * @param {string[]} allowedMimePrefixes  e.g. ['image/'] or ['image/', 'video/']
 */
export async function validateWalrusBlob(blobId, allowedMimePrefixes) {
  if (!blobId || typeof blobId !== 'string') throw new Error('Invalid blobId');
  const url = walrusBlobUrl(blobId);
  // Grab the first 512 bytes — enough for any signature we care about, and
  // tiny enough not to noticeably impact the request budget.
  const res = await fetch(url, { headers: { Range: 'bytes=0-511' } });
  if (!res.ok && res.status !== 206) throw new Error('Walrus blob not found');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('Walrus blob is empty');
  const sniffed = sniffMime(buf);
  if (!sniffed) throw new Error('Could not detect file type of blob');
  const ok = allowedMimePrefixes.some((p) => sniffed.startsWith(p));
  if (!ok) throw new Error(`Walrus blob has disallowed type: ${sniffed}`);
  return sniffed;
}
