// netlify/functions/marga-gh.js
// GET /api/marga-gh?path=BILDER/... → listar innehåll i GitHub-repot matsbprod/marga
// Token används server-side → 5000 anrop/timme istället för 60

const GITHUB_REPO = "matsbprod/marga";

export default async function handler(req) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" };

  if (req.headers.get("x-marga-password") !== process.env.MARGA_PASSWORD) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers });
  }

  const url = new URL(req.url);
  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");

  const ghHeaders = { Accept: "application/vnd.github.v3+json" };
  if (process.env.MARGA_GITHUB_TOKEN) ghHeaders.Authorization = `token ${process.env.MARGA_GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${encoded}`, { headers: ghHeaders });
  const body = await res.text();
  return new Response(body, { status: res.status, headers });
}

export const config = { path: "/api/marga-gh" };
