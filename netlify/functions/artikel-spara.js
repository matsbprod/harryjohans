// netlify/functions/artikel-spara.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  try {
    const payload = JSON.parse(event.body || '{}');
    const store = getStore('artikel');
    await store.setJSON('content', {
      headline:  payload.headline  || '',
      byline:    payload.byline    || '',
      body:      payload.body      || '',
      pullquote: payload.pullquote || '',
      caption:   payload.caption   || '',
      imageUrl:  payload.imageUrl  || null,
      updated:   new Date().toISOString()
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Kunde inte spara artikeln' }) };
  }
};
