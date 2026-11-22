// netlify/functions/marga-tokentest.js
// Diagnostik: kontrollerar MARGA_GITHUB_TOKEN utan att visa den.
//   Öppna i webbläsaren:  https://harryjohans.se/api/marga-tokentest?pw=marga2025
// Visar längd, början/slut-tecken, om det finns mellanslag/radbrytningar,
// och vad GitHub svarar för repot matsbprod/marga. Kan tas bort när felet är löst.

const GITHUB_REPO = "matsbprod/marga";

export default async function handler(req) {
  const url = new URL(req.url);
  const pw = url.searchParams.get("pw") || req.headers.get("x-marga-password");
  const out = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });
  if (pw !== process.env.MARGA_PASSWORD) return out({ error: "Unauthorized" }, 401);

  const raw = process.env.MARGA_GITHUB_TOKEN;
  if (!raw) return out({ token: "SAKNAS — MARGA_GITHUB_TOKEN är inte satt för funktioner i denna deploy" });

  const token = raw.trim();
  const info = {
    langd: raw.length,
    borjar_med: raw.slice(0, 11),
    slutar_med: "…" + token.slice(-4),
    har_mellanslag_eller_radbrytning: /\s/.test(raw),
    ser_ut_som_fine_grained: token.startsWith("github_pat_"),
    ser_ut_som_classic: token.startsWith("ghp_"),
    deploy_context: process.env.CONTEXT || "okänd",
  };

  async function test(t) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${t}`, "User-Agent": "marga-tokentest" },
    });
    const d = await r.json().catch(() => ({}));
    return {
      status: r.status,
      meddelande: d.message || "OK",
      skrivratt: d.permissions ? !!d.permissions.push : "okänt",
      token_gar_ut: r.headers.get("github-authentication-token-expiration") || "inget datum",
    };
  }

  info.github_som_den_ar = await test(raw);
  if (info.har_mellanslag_eller_radbrytning) info.github_utan_mellanslag = await test(token);
  return out(info);
}

export const config = { path: "/api/marga-tokentest" };
