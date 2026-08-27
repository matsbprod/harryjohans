// netlify/functions/artikel-hamta.mjs
import { getStore } from '@netlify/blobs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id') || '1';
    const store = getStore('artikel');
    const data = await store.get('content-' + id, { type: 'json' });
    return new Response(JSON.stringify(data || null), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Kunde inte hämta artikeln' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
