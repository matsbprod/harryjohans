import { getStore } from "@netlify/blobs";

// GET /.netlify/functions/moodboard-hamta
// Returnerar layouten: [{id, x, y, w, z}, ...]
export default async () => {
  const layoutStore = getStore("moodboard-layout");
  const layout = (await layoutStore.get("items", { type: "json" })) || [];

  return new Response(JSON.stringify(layout), {
    headers: { "content-type": "application/json" }
  });
};
