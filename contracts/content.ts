import { z } from "zod";
import divisionCatalog from "./divisions.json" with { type: "json" };
const divisionUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (url) => url === "" || (/^https?:\/\//i.test(url) && URL.canParse(url)),
    "Укажите ссылку с http:// или https://",
  );
export const divisionInput = z.object({
  name: z
    .string()
    .refine(
      (name) => divisionCatalog.some((division) => division.name === name),
      "Неизвестное подразделение",
    ),
  url: divisionUrl,
  coordinator: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(300).optional(),
  vk: divisionUrl.optional(),
  max: divisionUrl.optional(),
  telegram: divisionUrl.optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email().or(z.literal("")))
    .optional(),
  website: divisionUrl.optional(),
});
export type DivisionLink = z.infer<typeof divisionInput>;
export const eventInput = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000),
  city: z.string().trim().min(2).max(100),
  startsAt: z.string().datetime({ offset: true }),
  published: z.boolean(),
});
export const mediaInput = z.object({
  eventDate: z.iso.date().or(z.literal("")).optional(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000),
  published: z.boolean(),
});
export const eventSchema = eventInput.extend({ id: z.string() });
export const mediaSchema = mediaInput.extend({
  id: z.string(),
  url: z.string(),
  kind: z.enum(["image", "video"]),
  images: z.array(z.object({ id: z.string(), url: z.string() })).optional(),
});
export const contentSchema = z.object({
  divisions: z.array(divisionInput).optional(),
  events: z.array(eventSchema),
  media: z.array(mediaSchema),
});
export type EventRecord = z.infer<typeof eventSchema>;
export type MediaRecord = z.infer<typeof mediaSchema>;
export type Content = z.infer<typeof contentSchema>;
