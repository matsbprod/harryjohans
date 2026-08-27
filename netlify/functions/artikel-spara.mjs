// netlify/functions/artikel-spara.mjs
import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  try {
    const payload = await req.json();
    const id = payload.id || '1';
    const store = getStore('artikel');
    await store.setJSON('content-' + id, {
      headline:     payload.headline     || '',
      byline:       payload.byline       || '',
      body:         payload.body         || '',
      pullquote:    payload.pullquote    || '',
      caption:      payload.caption      || '',
      imageUrl:     payload.imageUrl     || null,
      heroWidthPct: payload.heroWidthPct || 100,
      updated:      new Date().toISOString()
    });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Kunde inte spara artikeln' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
