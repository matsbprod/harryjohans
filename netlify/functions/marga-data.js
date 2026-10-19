// netlify/functions/marga-data.js
// GET  → hämtar uppgiftsdata från Netlify Blobs
// POST → sparar uppgiftsdata till Netlify Blobs
// Skyddas av MARGA_PASSWORD env-variabel

import { getStore } from "@netlify/blobs";

const BLOB_KEY = "marga-tasks-v1";

export default async function handler(req) {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Marga-Password",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Auth
  const pw = req.headers.get("x-marga-password");
  if (pw !== process.env.MARGA_PASSWORD) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const store = getStore("marga");

  if (req.method === "GET") {
    try {
      const data = await store.get(BLOB_KEY, { type: "json" });
      return new Response(JSON.stringify(data ?? { tasks: [], gallery: [] }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ tasks: [], gallery: [] }), { status: 200, headers });
    }
  }

  if (req.method === "POST") {
    try {
      const body = await req.json();
      await store.setJSON(BLOB_KEY, body);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
}

export const config = { path: "/api/marga-data" };
