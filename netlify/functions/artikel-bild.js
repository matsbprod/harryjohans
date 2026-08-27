// netlify/functions/artikel-bild.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  try {
    const key = event.queryStringParameters && event.queryStringParameters.key;
    if (!key) return { statusCode: 400, body: 'Saknar key' };

    const store = getStore('artikel-bilder');
    const result = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!result) return { statusCode: 404, body: 'Bilden hittades inte' };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': (result.metadata && result.metadata.contentType) || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      },
      body: Buffer.from(result.data).toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: 'Kunde inte hämta bilden' };
  }
};
