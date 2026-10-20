// netlify/functions/marga-bigupload.js
// Uppladdning av stora filer (t.ex. .3dm) till GitHub-repot matsbprod/marga.
// Netlify tillåter max ~6 MB per anrop, så webbläsaren skickar filen i bitar:
//   PUT  /api/marga-bigupload?id=<uppladdnings-id>&i=<bitnummer>   (binär kropp, ≤ 4,5 MB)
//   POST /api/marga-bigupload?id=<id>&n=<antal bitar>&path=<sökväg i repot>&message=<text>
// Bitarna mellanlagras i Netlify Blobs, sätts ihop här och committas med Git Data API
// (fungerar för filer upp till GitHubs gräns på 100 MB, och skriver över befintlig fil med samma namn).
// Kräver miljövariablerna MARGA_PASSWORD och MARGA_GITHUB_TOKEN (Contents: Read and write).

import { getStore } from "@netlify/blobs";

const GITHUB_REPO = "matsbprod/marga";
const BRANCH = "main";
const MAX_CHUNK = 5 * 1024 * 1024;
const MAX_TOTAL = 95 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Marga-Password",
  "Content-Type": "application/json",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors });

async function gh(path, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.MARGA_GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `GitHub HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.headers.get("x-marga-password") !== process.env.MARGA_PASSWORD) return json({ error: "Unauthorized" }, 401);
  if (!process.env.MARGA_GITHUB_TOKEN) return json({ error: "MARGA_GITHUB_TOKEN saknas" }, 500);

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!/^[a-z0-9-]{8,64}$/i.test(id)) return json({ error: "Ogiltigt uppladdnings-id" }, 400);
  const store = getStore({ name: "marga-uploads", consistency: "strong" });

  // ── 1. Ta emot en bit ──
  if (req.method === "PUT") {
    const i = Number(url.searchParams.get("i"));
    if (!Number.isInteger(i) || i < 0 || i > 40) return json({ error: "Ogiltigt bitnummer" }, 400);
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > MAX_CHUNK) return json({ error: "Biten är tom eller för stor" }, 413);
    await store.set(`${id}/${i}`, buf);
    return json({ ok: true, i, bytes: buf.byteLength });
  }

  // ── 2. Sätt ihop och committa ──
  if (req.method === "POST") {
    const n = Number(url.searchParams.get("n"));
    const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");
    const message = url.searchParams.get("message") || `Laddar upp ${path}`;
    if (!Number.isInteger(n) || n < 1 || n > 40) return json({ error: "Ogiltigt antal bitar" }, 400);
    if (!path || path.includes("..")) return json({ error: "Ogiltig sökväg" }, 400);

    const parts = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const part = await store.get(`${id}/${i}`, { type: "arrayBuffer" });
      if (!part) return json({ error: `Bit ${i + 1} av ${n} saknas — försök igen` }, 409);
      parts.push(Buffer.from(part));
      total += part.byteLength;
      if (total > MAX_TOTAL) return json({ error: "Filen är större än 95 MB" }, 413);
    }
    const content = Buffer.concat(parts).toString("base64");

    try {
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content, encoding: "base64" }) });
      // Två försök om någon annan hann committa samtidigt
      let commit;
      for (let attempt = 0; attempt < 2; attempt++) {
        const ref = await gh(`/git/ref/heads/${BRANCH}`);
        const head = await gh(`/git/commits/${ref.object.sha}`);
        const tree = await gh("/git/trees", {
          method: "POST",
          body: JSON.stringify({ base_tree: head.tree.sha, tree: [{ path, mode: "100644", type: "blob", sha: blob.sha }] }),
        });
        commit = await gh("/git/commits", {
          method: "POST",
          body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }),
        });
        try {
          await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
          break;
        } catch (e) {
          if (attempt === 1 || e.status !== 422) throw e;
        }
      }
      for (let i = 0; i < n; i++) await store.delete(`${id}/${i}`).catch(() => {});
      return json({ ok: true, path, bytes: total, commit: commit.sha });
    } catch (e) {
      return json({ error: e.message }, e.status === 401 || e.status === 403 ? 403 : 502);
    }
  }

  return json({ error: "Metoden stöds inte" }, 405);
}

export const config = { path: "/api/marga-bigupload" };
