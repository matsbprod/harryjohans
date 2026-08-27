// netlify/functions/artikel-hamta.mjs
import { getStore } from '@netlify/blobs';

export const handler = async (event) => {
  try {
    const id = (event.queryStringParameters && event.queryStringParameters.id) || '1';
    const store = getStore('artikel');
    const data = await store.get('content-' + id, { type: 'json' });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || null)
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunde inte hämta artikeln' }) };
  }
};
