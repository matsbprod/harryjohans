// netlify/functions/artikel-ladda-upp.mjs
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const { filename, contentType, data } = JSON.parse(event.body || '{}');
    if (!data) return { statusCode: 400, body: JSON.stringify({ error: 'Ingen bilddata mottagen' }) };

    const buffer = Buffer.from(data, 'base64');
    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'jpg';
    const key = 'hero-' + randomUUID() + '.' + ext;

    const store = getStore('artikel-bilder');
    await store.set(key, buffer, {
      metadata: { contentType: contentType || 'image/jpeg' }
    });

    const url = '/.netlify/functions/artikel-bild?key=' + encodeURIComponent(key);

    return { statusCode: 200, body: JSON.stringify({ url }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Uppladdningen misslyckades' }) };
  }
};
