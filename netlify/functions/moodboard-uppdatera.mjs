import { getStore } from "@netlify/blobs";

// POST /.netlify/functions/moodboard-uppdatera
// Body: { id, x, y, w, z }
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

  const { id, x, y, w, z } = body;
  if (!id) {
    return new Response("Saknar id", { status: 400 });
  }

  const layoutStore = getStore("moodboard-layout");
  const layout = (await layoutStore.get("items", { type: "json" })) || [];
  const item = layout.find((i) => i.id === id);

  if (!item) {
    return new Response("Hittades inte", { status: 404 });
  }

  if (typeof x === "number") item.x = x;
  if (typeof y === "number") item.y = y;
  if (typeof w === "number") item.w = w;
  if (typeof z === "number") item.z = z;

  await layoutStore.set("items", JSON.stringify(layout));

  return new Response(JSON.stringify(item), {
    headers: { "content-type": "application/json" }
  });
};
