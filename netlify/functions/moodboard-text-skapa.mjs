import { updateLayout } from "./_lib/moodboard-store.mjs";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST /.netlify/functions/moodboard-text-skapa
// Body: { text, x, y, w }
// Textinnehållet lagras direkt i layouten — ingen bild-blob behövs.
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

  const { text, x, y, w } = body;

  const { result: item } = await updateLayout((layout) => {
    const nextZ = layout.length ? Math.max(...layout.map((i) => i.z || 0)) + 1 : 1;
    const newItem = {
      id: genId(),
      type: "text",
      content: typeof text === "string" ? text : "",
      x: typeof x === "number" ? x : 40,
      y: typeof y === "number" ? y : 40,
      w: typeof w === "number" ? w : 220,
      z: nextZ
    };
    layout.push(newItem);
    return newItem;
  });

  return new Response(JSON.stringify(item), {
    headers: { "content-type": "application/json" }
  });
};
