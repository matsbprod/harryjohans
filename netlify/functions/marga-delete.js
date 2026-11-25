// netlify/functions/marga-delete.js
// Tar bort eller byter namn på filer/kort i GitHub-repot matsbprod/marga, i EN commit per åtgärd.
//   POST /api/marga-delete   body: { paths: ["BILDER/4. Skrov/IMG_5483.jpeg"], message: "..." }
//                            eller { folder: "BILDER/4. Skrov/Spant 12", message: "..." }
//                            eller { rename: { from: "BILDER/4. Skrov/IMG_5483.jpeg", to: "BILDER/4. Skrov/Mall spant 12.jpeg" } }
//                            eller { rename: { from: "BILDER/4. Skrov/Spant 12", to: "BILDER/6. Inredning/Spant 12", move: true } }
//                            eller { archive: { path: "BILDER/4. Skrov/Spant 12" } }            → flyttar till ARKIV/BILDER/4. Skrov/Spant 12
//                            eller { archive: { path: "ARKIV/BILDER/4. Skrov/Spant 12", restore: true } } → tillbaka till ursprunglig plats
//   Namnbyte gäller en fil, ett kort (mapp) eller en lista under BILDER, inom samma mapp. Med move: true flyttas kortet till en annan lista
//   (BILDER/<lista> eller en toppmapp som PDF). Filinnehållet kopieras inte — bara sökvägen ändras.
// Filerna finns kvar i repots historik och kan återställas därifrån.
// Om en lista (mapp) skulle bli helt tom läggs en tom .gitkeep in, så att listan finns kvar i appen.
// Kräver miljövariablerna MARGA_PASSWORD och MARGA_GITHUB_TOKEN (Contents: Read and write).

const GITHUB_REPO = "matsbprod/marga";
const BRANCH = "main";
const ALLOWED = ["BILDER/", "PDF/", "3D-modeller/", "ARKIV/"];
const ARCHIVE = "ARKIV";
const POSTS = "BILDER/uppgifter";   // allt annat i repot (index.html m.m.) är skyddat
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
const isCardFolder = p => {
  if (p.startsWith(ARCHIVE + "/")) return isCardFolder(p.slice(ARCHIVE.length + 1));   // samma regler inne i arkivet
  return p.startsWith("BILDER/") ? p.split("/").length >= 3 : p.split("/").length >= 2;
};

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Metoden stöds inte" }, 405);
  if (req.headers.get("x-marga-password") !== process.env.MARGA_PASSWORD) return json({ error: "Unauthorized" }, 401);
  if (!process.env.MARGA_GITHUB_TOKEN) return json({ error: "MARGA_GITHUB_TOKEN saknas" }, 500);

  const body = await req.json().catch(() => ({}));
  if (body.rename) return rename(body);
  if (body.archive) return archive(body);
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
        if (!d || d === ARCHIVE || d.startsWith(ARCHIVE + "/") || !ALLOWED.some(a => (d + "/").startsWith(a))) continue;   // arkivet behöver inga tomma mappar
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

async function rename(body) {
  const from = clean(body.rename.from), to = clean(body.rename.to);
  if (!from || !to || from === to) return json({ error: "Ogiltigt namnbyte" }, 400);
  // Listan PDF (en egen toppmapp) byter namn genom att flyttas in bland listorna under BILDER
  const pdfToList = from === "PDF" && to.startsWith("BILDER/") && to.split("/").length === 2 && to !== "BILDER/uppgifter";
  if (!pdfToList && (!allowed(from) || !allowed(to))) return json({ error: "Den sökvägen får inte ändras härifrån" }, 403);
  const isMove = !!body.rename.move && parentOf(from) !== parentOf(to);
  const isListFolder = p => allowed(p + "/") && (p.startsWith("BILDER/") ? p.split("/").length === 2 : p.split("/").length === 1);
  if (!isMove && !pdfToList && parentOf(from) !== parentOf(to)) return json({ error: "Namnbyte måste ske i samma mapp" }, 400);
  if (isMove && (!isListFolder(parentOf(to)) || !isListFolder(parentOf(from)))) return json({ error: "Kort kan bara flyttas mellan listor" }, 400);
  if (isMove && (from.startsWith("BILDER/uppgifter/") || to.startsWith("BILDER/uppgifter/"))) return json({ error: "Postens filer flyttas inte härifrån" }, 403);
  if (/[\\:*?"<>|]/.test(to.slice(to.lastIndexOf("/") + 1))) return json({ error: "Namnet innehåller otillåtna tecken" }, 400);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${head.tree.sha}?recursive=1`);
      const blobs = tree.tree.filter(e => e.type === "blob");
      const exact = blobs.find(e => e.path === from);
      const moving = exact ? [exact] : blobs.filter(e => e.path.startsWith(from + "/"));
      if (!moving.length) return json({ error: "Hittade inte filen — har den redan bytt namn eller tagits bort?" }, 404);
      // Mappar: kort får byta namn, och listor under BILDER (inte Poster-listan)
      const isBilderList = p => p.startsWith("BILDER/") && p.split("/").length === 2 && p !== "BILDER/uppgifter";
      if (!exact && !isCardFolder(from) && !pdfToList && !(isBilderList(from) && isBilderList(to) && !isMove)) return json({ error: "Den listan kan inte byta namn härifrån" }, 403);
      if (!exact && (from === "BILDER/uppgifter" || to === "BILDER/uppgifter")) return json({ error: "Poster-listan kan inte byta namn" }, 403);
      if (isMove && !blobs.some(e => e.path.startsWith(parentOf(to) + "/"))) return json({ error: "Mållistan finns inte" }, 404);
      const lower = to.toLowerCase();
      if (blobs.some(e => e.path.toLowerCase() === lower || e.path.toLowerCase().startsWith(lower + "/"))) {
        // Tillåt bara om det är samma fil med annan skiftläge (t.ex. bild.JPG → bild.jpg)
        if (from.toLowerCase() !== lower) return json({ error: "Det finns redan något med det namnet" }, 409);
      }
      const entries = [];
      for (const e of moving) {
        const np = to + e.path.slice(from.length);
        entries.push({ path: e.path, mode: e.mode || "100644", type: "blob", sha: null });
        entries.push({ path: np, mode: e.mode || "100644", type: "blob", sha: e.sha });
      }
      // Flytt: lägg en .gitkeep i listan som kortet lämnar om den annars blir tom
      if (isMove) {
        const src = parentOf(from), movingSet = new Set(moving.map(e => e.path));
        if (!blobs.some(e => e.path.startsWith(src + "/") && !movingSet.has(e.path))) entries.push({ path: `${src}/.gitkeep`, mode: "100644", type: "blob", content: "" });
      }
      const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
      const message = String(body.message || (isMove ? `Flyttar ${from.split("/").pop()} till ${parentOf(to)}` : `Byter namn: ${from.split("/").pop()} → ${to.split("/").pop()}`)).slice(0, 200);
      const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
      try {
        await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return json({ ok: true, from, to, files: moving.length, commit: commit.sha });
      } catch (e) {
        if (attempt === 1 || e.status !== 422) throw e;
      }
    }
  } catch (e) {
    return json({ error: e.message }, e.status === 401 || e.status === 403 ? 403 : 502);
  }
  return json({ error: "Kunde inte byta namn" }, 502);
}

// Arkivera (flytta till ARKIV/<ursprunglig sökväg>) eller återställ därifrån. Gäller en fil eller ett kort (mapp).
async function archive(body) {
  const restore = !!body.archive.restore;
  const src = clean(body.archive.path);
  if (!src) return json({ error: "Ingen sökväg" }, 400);
  if (restore !== src.startsWith(ARCHIVE + "/")) return json({ error: restore ? "Det ligger inte i arkivet" : "Det ligger redan i arkivet" }, 400);
  const orig = restore ? src.slice(ARCHIVE.length + 1) : src;
  if (!allowed(orig) || orig.startsWith(ARCHIVE + "/")) return json({ error: "Den sökvägen kan inte arkiveras" }, 403);
  if (orig === POSTS || orig.startsWith(POSTS + "/")) return json({ error: "Posternas filer arkiveras inte härifrån" }, 403);
  const dst = restore ? orig : `${ARCHIVE}/${orig}`;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = await gh(`/git/ref/heads/${BRANCH}`);
      const head = await gh(`/git/commits/${ref.object.sha}`);
      const tree = await gh(`/git/trees/${head.tree.sha}?recursive=1`);
      const blobs = tree.tree.filter(e => e.type === "blob");
      const blobSet = new Map(blobs.map(e => [e.path, e]));
      const exact = blobSet.get(src);
      if (!exact && !isCardFolder(src)) return json({ error: "Hela listor kan inte arkiveras — arkivera korten" }, 403);
      const moving = exact ? [exact] : blobs.filter(e => e.path.startsWith(src + "/"));
      if (!moving.length) return json({ error: "Hittade inget — har det redan flyttats?" }, 404);
      if (moving.length > MAX_FILES) return json({ error: `För många filer (${moving.length})` }, 413);
      const entries = [];
      for (const e of moving) {
        const np = dst + e.path.slice(src.length);
        const there = blobSet.get(np);
        entries.push({ path: e.path, mode: e.mode || "100644", type: "blob", sha: null });
        if (there) {
          if (there.sha === e.sha || np.endsWith("/.gitkeep")) continue;     // samma fil finns redan där
          return json({ error: `Det finns redan en fil med namnet "${np.split("/").pop()}" ${restore ? "på den ursprungliga platsen" : "i arkivet"}` }, 409);
        }
        entries.push({ path: np, mode: e.mode || "100644", type: "blob", sha: e.sha });
      }
      // Kortet/listan som blir tom finns kvar (en .gitkeep), så att den inte försvinner från tavlan
      if (!restore) {
        const parent = parentOf(src), movingSet = new Set(moving.map(e => e.path));
        const isKeepable = parent && parent !== "BILDER" && allowed(parent + "/");
        if (isKeepable && !blobs.some(e => e.path.startsWith(parent + "/") && !movingSet.has(e.path)))
          entries.push({ path: `${parent}/.gitkeep`, mode: "100644", type: "blob", content: "" });
      }
      const name = src.split("/").pop();
      const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree: entries }) });
      const message = restore ? `Återställer ${name} från arkivet` : `Arkiverar ${name}`;
      const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
      try {
        await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        return json({ ok: true, from: src, to: dst, files: moving.length, commit: commit.sha });
      } catch (e) {
        if (attempt === 1 || e.status !== 422) throw e;
      }
    }
  } catch (e) {
    return json({ error: e.message }, e.status === 401 || e.status === 403 ? 403 : 502);
  }
  return json({ error: "Kunde inte flytta" }, 502);
}

export const config = { path: "/api/marga-delete" };
