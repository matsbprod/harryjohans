import { getStore } from "@netlify/blobs";

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

  const layoutStore = getStore("moodboard-layout");
  const layout = (await layoutStore.get("items", { type: "json" })) || [];
  const next = layout.filter((i) => i.id !== id);
  await layoutStore.set("items", JSON.stringify(next));

  const bildStore = getStore("moodboard-bilder");
  await bildStore.delete(id);

  return new Response(JSON.stringify({ ok: true }));
};
