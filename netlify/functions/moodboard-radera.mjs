import { getStore } from "@netlify/blobs";
import { updateLayout } from "./_lib/moodboard-store.mjs";

// POST /.netlify/functions/moodboard-radera
// Body: { id }
export default async (req) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return new Response("Metod ej tillåten", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Ogiltig JSON", { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return new Response("Saknar id", { status: 400 });
  }

  const { result: removedItem } = await updateLayout((layout) => {
    const idx = layout.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const [removed] = layout.splice(idx, 1);
    return removed;
  });

  // Text- och ramkort har ingen bild-blob att städa bort.
  if (!removedItem || (removedItem.type !== "text" && removedItem.type !== "box")) {
    const bildStore = getStore("moodboard-bilder");
    await bildStore.delete(id);
  }

  return new Response(JSON.stringify({ ok: true }));
};
