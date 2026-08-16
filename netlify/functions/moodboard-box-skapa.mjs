import { updateLayout } from "./_lib/moodboard-store.mjs";

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// POST /.netlify/functions/moodboard-box-skapa
// Body: { title, x, y, w, h, color }
// En ram/bakgrundsruta för att gruppera ett kapitel — ingen bild-blob.
// Hamnar som standard bakom allt annat innehåll (lägst z).
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

  const { title, x, y, w, h, color } = body;

  const { result: item } = await updateLayout((layout) => {
    const minZ = layout.length ? Math.min(...layout.map((i) => i.z || 0)) : 1;
    const newItem = {
      id: genId(),
      type: "box",
      content: typeof title === "string" ? title : "",
      color: typeof color === "string" ? color : "#4d7ea8",
      x: typeof x === "number" ? x : 40,
      y: typeof y === "number" ? y : 40,
      w: typeof w === "number" ? w : 420,
      h: typeof h === "number" ? h : 320,
      z: Math.min(0, minZ - 1)
    };
    layout.push(newItem);
    return newItem;
  });

  return new Response(JSON.stringify(item), {
    headers: { "content-type": "application/json" }
  });
};
