// netlify/functions/marga-delete.js
// Tar bort filer (eller ett helt kort = en mapp) ur GitHub-repot matsbprod/marga i EN commit.
//   POST /api/marga-delete   body: { paths: ["BILDER/4. Skrov/IMG_5483.jpeg"], message: "..." }
//                            eller { folder: "BILDER/4. Skrov/Spant 12", message: "..." }
// Filerna finns kvar i repots historik och kan återställas därifrån.
// Om en lista (mapp) skulle bli helt tom läggs en tom .gitkeep in, så att listan finns kvar i appen.
// Kräver miljövariablerna MARGA_PASSWORD och MARGA_GITHUB_TOKEN (Contents: Read and write).

const GITHUB_REPO = "matsbprod/marga";
const BRANCH = "main";
const ALLOWED = ["BILDER/", "PDF/", "3D-modeller/"];   // allt annat i repot (index.html m.m.) är skyddat
const MAX_FILES = 300;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const clean = p => String(p || "").replace(/^\/+|\/+$/g, "");
const allowed = p => p && !p.includes("..") && ALLOWED.some(a => p.startsWith(a));
const parentOf = p => (p.lastIndexOf("/") < 0 ? "" : p.slice(0, p.lastIndexOf("/")));
// Ett kort (mapp) får tas bort, men inte en hel lista: BILDER/<lista>/<kort> eller PDF/<kort>
const isCardFolder = p => (p.startsWith("BILDER/") ? p.split("/").length >= 3 : p.split("/").length >= 2);

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
  if (req.headers.get("x-marga-password") !== process.env.MARGA_PASSWORD) return json({ error: "Unauthorized" }, 401);
  if (!process.env.MARGA_GITHUB_TOKEN) return json({ error: "MARGA_GITHUB_TOKEN saknas" }, 500);

  const body = await req.json().catch(() => ({}));
  const folder = clean(body.folder);
  const paths = Array.isArray(body.paths) ? body.paths.map(clean).filter(Boolean) : [];
  if (!folder && !paths.length) return json({ error: "Inget att ta bort" }, 400);
  if (folder && (!allowed(folder + "/") || !isCardFolder(folder))) return json({ error: "Den mappen får inte tas bort härifrån" }, 403);
  if (paths.some(p => !allowed(p))) return json({ error: "Sökvägen får inte tas bort härifrån" }, 403);

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${head.tree.sha}?recursive=1`);
      const blobs = tree.tree.filter(e => e.type === "blob").map(e => e.path);
      const blobSet = new Set(blobs);

      const remove = new Set(paths.filter(p => blobSet.has(p)));
      if (folder) blobs.filter(p => p.startsWith(folder + "/")).forEach(p => remove.add(p));
      if (!remove.size) return json({ error: "Hittade inget att ta bort — har det redan tagits bort?" }, 404);
      if (remove.size > MAX_FILES) return json({ error: `För många filer (${remove.size})` }, 413);

      // Behåll listorna: lägg en .gitkeep i mappar som annars blir helt tomma
      const keep = new Set();
      const dirsToCheck = new Set([...remove].map(parentOf));
      if (folder) { dirsToCheck.delete(folder); [...dirsToCheck].forEach(d => { if (d.startsWith(folder + "/") || d === folder) dirsToCheck.delete(d); }); dirsToCheck.add(parentOf(folder)); }
      for (const d of dirsToCheck) {
        if (!d || !ALLOWED.some(a => (d + "/").startsWith(a))) continue;
        const left = blobs.some(p => p.startsWith(d + "/") && !remove.has(p));
        if (!left) keep.add(`${d}/.gitkeep`);
      }

      const entries = [
        ...[...remove].filter(p => !keep.has(p)).map(p => ({ path: p, mode: "100644", type: "blob", sha: null })),
        ...[...keep].map(p => ({ path: p, mode: "100644", type: "blob", content: "" })),
      ];
      const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
      const message = String(body.message || (folder ? `Tar bort ${folder}` : `Tar bort ${remove.size} fil(er)`)).slice(0, 200);
      const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
      try {
        await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return json({ ok: true, removed: [...remove], commit: commit.sha });
      } catch (e) {
        if (attempt === 1 || e.status !== 422) throw e;   // någon annan hann committa — försök igen
      }
    }
  } catch (e) {
    return json({ error: e.message }, e.status === 401 || e.status === 403 ? 403 : 502);
  }
  return json({ error: "Kunde inte ta bort" }, 502);
}

export const config = { path: "/api/marga-delete" };
