import { getStore } from "@netlify/blobs";

const MAX_ATTEMPTS = 8;

// Läser layouten, kör mutator(layout) som får ändra arrayen direkt
// (push/splice/ändra ett objekts fält), och skriver tillbaka med ett
// villkorat anrop (onlyIfMatch/onlyIfNew) så att två nästan samtidiga
// sparningar aldrig tyst skriver över varandra. Om något annat anrop
// hinner skriva emellan läser vi om färsk data och försöker igen.
export async function updateLayout(mutator) {
  const layoutStore = getStore("moodboard-layout");

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const entry = await layoutStore.getWithMetadata("items", { type: "json" });
    const layout = entry ? entry.data || [] : [];
    const etag = entry ? entry.etag : undefined;

    const result = mutator(layout);
    const serialized = JSON.stringify(layout);

    const writeResult = etag
      ? await layoutStore.set("items", serialized, { onlyIfMatch: etag })
      : await layoutStore.set("items", serialized, { onlyIfNew: true });

    if (writeResult.modified) {
      return { layout, result };
    }
    // Någon annan skrev emellan — försök igen med färsk data.
  }

  throw new Error("Kunde inte spara — för många samtidiga ändringar.");
}
