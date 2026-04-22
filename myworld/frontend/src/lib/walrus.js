// Browser-side Walrus uploader. Sending media straight from the browser to
// Walrus avoids the 4.5MB request body limit on Vercel serverless functions.
//
// We fetch publisher / epochs from /api/config (cached), then PUT the file to
// the Walrus publisher with XMLHttpRequest so we can report upload progress.

const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

let configPromise = null;
function getConfig() {
  if (!configPromise) {
    configPromise = fetch(`${API_ORIGIN}/api/config`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load Walrus config');
        return r.json();
      })
      .catch((e) => { configPromise = null; throw e; });
  }
  return configPromise;
}

/**
 * Upload a File/Blob directly to Walrus.
 * @param {File|Blob} file
 * @param {{ onProgress?: (fraction: number) => void }} [opts]
 * @returns {Promise<{ blobId: string, mediaMime: string }>}
 */
export async function uploadFileToWalrus(file, { onProgress } = {}) {
  const { walrusPublisher, walrusEpochs } = await getConfig();
  const url = `${walrusPublisher}/v1/blobs?epochs=${walrusEpochs}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          const blobId =
            json?.newlyCreated?.blobObject?.blobId ||
            json?.alreadyCertified?.blobId;
          if (!blobId) return reject(new Error('Walrus response missing blobId'));
          resolve({ blobId, mediaMime: file.type || 'application/octet-stream' });
        } catch (err) {
          reject(new Error('Walrus returned invalid JSON'));
        }
      } else {
        reject(new Error(`Walrus upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Walrus upload network error'));
    xhr.send(file);
  });
}
