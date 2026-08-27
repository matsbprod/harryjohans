// netlify/functions/artikel-hamta.js
const { getStore } = require('@netlify/blobs');

exports.handler = async () => {
  try {
    const store = getStore('artikel');
    const data = await store.get('content', { type: 'json' });
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
