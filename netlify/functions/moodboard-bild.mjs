import { getStore } from "@netlify/blobs";

// GET /.netlify/functions/moodboard-bild?id=xxxx
// Strömmar tillbaka bildens råa bytes med rätt content-type.
export default async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response("Saknar id", { status: 400 });
  }

  const bildStore = getStore("moodboard-bilder");
  const result = await bildStore.getWithMetadata(id, { type: "arrayBuffer" });

  if (!result) {
    return new Response("Bilden hittades inte", { status: 404 });
  }

  return new Response(result.data, {
    headers: {
      "content-type": result.metadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
};
