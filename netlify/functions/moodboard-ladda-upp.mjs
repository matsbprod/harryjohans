import { getStore } from "@netlify/blobs";
import { updateLayout } from "./_lib/moodboard-store.mjs";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST /.netlify/functions/moodboard-ladda-upp
// Body: { bild: "<base64>", contentType: "image/jpeg" | "video/mp4" ..., x, y, w }
// Sparar filen i store "moodboard-bilder" och lägger till en post i layouten.
export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Metod ej tillåten", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Ogiltig JSON", { status: 400 });
  }

  const { bild, contentType, x, y, w } = body;
  if (!bild || !contentType) {
    return new Response("Saknar bilddata", { status: 400 });
  }

  const id = genId();
  const bytes = Uint8Array.from(atob(bild), (c) => c.charCodeAt(0));

  const bildStore = getStore("moodboard-bilder");
  await bildStore.set(id, bytes, { metadata: { contentType } });

  const { result: item } = await updateLayout((layout) => {
    const nextZ = layout.length ? Math.max(...layout.map((i) => i.z || 0)) + 1 : 1;
    const newItem = {
      id,
      type: contentType.indexOf("video/") === 0 ? "video" : "image",
      x: typeof x === "number" ? x : 40,
      y: typeof y === "number" ? y : 40,
      w: typeof w === "number" ? w : 260,
      z: nextZ
    };
    layout.push(newItem);
    return newItem;
  });

  return new Response(JSON.stringify(item), {
    headers: { "content-type": "application/json" }
  });
};
