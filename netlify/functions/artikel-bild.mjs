// netlify/functions/artikel-bild.mjs
import { getStore } from '@netlify/blobs';

export default async (req) => {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (!key) return new Response('Saknar key', { status: 400 });

    const store = getStore('artikel-bilder');
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result) return new Response('Bilden hittades inte', { status: 404 });

    return new Response(result.data, {
      headers: {
        'Content-Type': (result.metadata && result.metadata.contentType) || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    console.error(err);
    return new Response('Kunde inte hämta bilden', { status: 500 });
  }
};
