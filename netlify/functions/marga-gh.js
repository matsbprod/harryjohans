// netlify/functions/marga-gh.js
// GET /api/marga-gh?path=BILDER/... → listar innehåll i GitHub-repot matsbprod/marga
// ?tree=1 → hela filträdet, alltid färskt (ingen cache), så att nya uppladdningar syns direkt
// Token används server-side → 5000 anrop/timme istället för 60
// CORS öppet så att även stockholmsbatsnickeri.se/marga kan anropa

const GITHUB_REPO = "matsbprod/marga";

export default async function handler(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Marga-Password",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.headers.get("x-marga-password") !== process.env.MARGA_PASSWORD) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers });
  }

  const url = new URL(req.url);
  const ghHeaders = { Accept: "application/vnd.github.v3+json" };
  if (process.env.MARGA_GITHUB_TOKEN) ghHeaders.Authorization = `token ${process.env.MARGA_GITHUB_TOKEN}`;

  // ?tree=1 → hela repots filträd i ett enda anrop
  // Hämtar först senaste commit på main (färskt) och sedan just det trädet — "main" direkt kan visa ett träd som är upp till en minut gammalt
  if (url.searchParams.get("tree")) {
    const noStore = { ...headers, "Cache-Control": "no-store" };
    let treeRef = "main";
    try {
      const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/ref/heads/main`, { headers: { ...ghHeaders, "Cache-Control": "no-cache" } });
      if (r.ok) { const d = await r.json(); if (d && d.object && d.object.sha) treeRef = d.object.sha; }
    } catch (e) { /* använd main */ }
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/git/trees/${treeRef}?recursive=1`, { headers: ghHeaders });
    return new Response(await res.text(), { status: res.status, headers: noStore });
  }

  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encoded}`, { headers: ghHeaders });
  const body = await res.text();
  return new Response(body, { status: res.status, headers });
}

export const config = { path: "/api/marga-gh" };
