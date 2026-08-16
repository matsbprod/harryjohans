import { updateLayout } from "./_lib/moodboard-store.mjs";

// POST /.netlify/functions/moodboard-uppdatera
// Body: { id, x, y, w, h, z, text, color }
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

  const { id, x, y, w, h, z, text, color } = body;
  if (!id) {
    return new Response("Saknar id", { status: 400 });
  }

  let found = false;
  const { result: item } = await updateLayout((layout) => {
    const item = layout.find((i) => i.id === id);
    if (!item) return null;
    found = true;

    if (typeof x === "number") item.x = x;
    if (typeof y === "number") item.y = y;
    if (typeof w === "number") item.w = w;
    if (typeof h === "number") item.h = h;
    if (typeof z === "number") item.z = z;
    if (typeof text === "string") item.content = text;
    if (typeof color === "string") item.color = color;

    return item;
  });

  if (!found) {
    return new Response("Hittades inte", { status: 404 });
  }

  return new Response(JSON.stringify(item), {
    headers: { "content-type": "application/json" }
  });
};
