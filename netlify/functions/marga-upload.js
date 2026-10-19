// netlify/functions/marga-upload.js
// POST → laddar upp en fil till GitHub-repot matsbprod/marga
// Token lagras som MARGA_GITHUB_TOKEN env-variabel, syns aldrig i klienten

const GITHUB_REPO = "matsbprod/marga";

export default async function handler(req) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Marga-Password",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  // Auth
  const pw = req.headers.get("x-marga-password");
  if (pw !== process.env.MARGA_PASSWORD) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const token = process.env.MARGA_GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: "GitHub token not configured" }), { status: 500, headers });
  }

  try {
    const { path, content, message } = await req.json();
    if (!path || !content) {
      return new Response(JSON.stringify({ error: "path och content krävs" }), { status: 400, headers });
    }

    // Kolla om filen redan finns (för att få SHA vid uppdatering)
    const checkRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      { headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" } }
    );
    const sha = checkRes.ok ? (await checkRes.json()).sha : undefined;

    // Ladda upp
    const uploadRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message: message || `Uppladdning: ${path}`,
          content,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      return new Response(JSON.stringify({ error: err.message }), { status: uploadRes.status, headers });
    }

    const result = await uploadRes.json();
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`;
    return new Response(JSON.stringify({ ok: true, url: rawUrl, sha: result.content?.sha }), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
}

export const config = { path: "/api/marga-upload" };
