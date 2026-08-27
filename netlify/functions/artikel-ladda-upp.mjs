// netlify/functions/artikel-ladda-upp.mjs
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    const { filename, contentType, data } = await req.json();
    if (!data) {
      return new Response(JSON.stringify({ error: 'Ingen bilddata mottagen' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const buffer = Buffer.from(data, 'base64');
    const ext = (filename && filename.includes('.')) ? filename.split('.').pop() : 'jpg';
    const key = 'hero-' + randomUUID() + '.' + ext;

    const store = getStore('artikel-bilder');
    await store.set(key, buffer, {
      metadata: { contentType: contentType || 'image/jpeg' }
    });

    const url = '/.netlify/functions/artikel-bild?key=' + encodeURIComponent(key);

    return new Response(JSON.stringify({ url }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Uppladdningen misslyckades' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
