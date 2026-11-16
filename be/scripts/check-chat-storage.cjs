// Upload only disposable fixtures, verify private delivery, and remove them afterwards.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dns').setDefaultResultOrder('ipv4first');
const axios = require('axios');
const { getCloudinary } = require('../dist/config/cloudinary');

(async () => {
  const cloud = getCloudinary();
  const fixtures = [
    ['text', Buffer.from('PreOnic disposable chat storage check')],
    ['image', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')],
  ];
  for (const [kind, bytes] of fixtures) {
    let publicId;
    try {
      const uploaded = await new Promise((resolve, reject) => {
        cloud.uploader.upload_stream({ folder: 'preonic/chat-checks', resource_type: 'raw', type: 'authenticated', timeout: 30000 },
          (error, result) => error ? reject(error) : resolve(result)).end(bytes);
      });
      publicId = uploaded.public_id;
      const url = cloud.url(publicId, { resource_type: 'raw', type: 'authenticated', sign_url: true, secure: true });
      const downloaded = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      if (!Buffer.from(downloaded.data).equals(bytes)) throw new Error('Downloaded content differs');
      const unsignedUrl = cloud.url(publicId, { resource_type: 'raw', type: 'authenticated', secure: true });
      const unsigned = await axios.get(unsignedUrl, { validateStatus: () => true, timeout: 30000 });
      if (unsigned.status < 400) throw new Error('Unsigned download should be denied');
      console.log(JSON.stringify({ kind, upload: 'ok', signedDownload: 'ok', unsignedDownload: 'denied' }));
    } finally {
      if (publicId) {
        const deleted = await cloud.uploader.destroy(publicId, { resource_type: 'raw', type: 'authenticated', invalidate: true });
        if (!['ok', 'not found'].includes(deleted.result)) throw new Error('Fixture cleanup failed');
        console.log(JSON.stringify({ kind, cleanup: 'ok' }));
      }
    }
  }
})().catch(error => {
  // Do not print SDK errors, request configs, URLs, or credentials.
  console.error(JSON.stringify({ storageCheck: 'failed', type: error.name || 'Error', code: error.code || error.http_code || error.response?.status || null }));
  process.exitCode = 1;
});
