import type { MediaRecord } from "../../../../contracts/content";
/** Unknown dates remain at the end in either direction; input is never mutated. */
export function sortMedia(items: MediaRecord[], order: "asc" | "desc") {
  return [...items].sort((a, b) => {
    if (!a.eventDate) return b.eventDate ? 1 : 0;
    if (!b.eventDate) return -1;
    const compared = a.eventDate.localeCompare(b.eventDate);
    return order === "asc" ? compared : -compared;
  });
}
