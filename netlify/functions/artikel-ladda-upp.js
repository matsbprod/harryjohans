// netlify/functions/artikel-ladda-upp.js
const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { filename, contentType, data } = JSON.parse(event.body || '{}');
    if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Ingen bilddata mottagen' }) };

    const buffer = Buffer.from(data, 'base64');
    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'jpg';
    const key = 'hero-' + crypto.randomUUID() + '.' + ext;

    const store = getStore('artikel-bilder');
    await store.set(key, buffer, {
      metadata: { contentType: contentType || 'image/jpeg' }
    });

    // Publik hämtningsväg — se separat routingfunktion `artikel-bild.js`
    // (eller byt till ett eget upload-till-CDN-steg om ni redan har ett,
    // t.ex. samma R2-bucket ni satte upp för videogriden).
    const url = '/.netlify/functions/artikel-bild?key=' + encodeURIComponent(key);

    return { statusCode: 200, body: JSON.stringify({ url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Uppladdningen misslyckades' }) };
  }
};
