import { z } from "zod";
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
});
export const contentSchema = z.object({
  events: z.array(eventSchema),
  media: z.array(mediaSchema),
});
export type EventRecord = z.infer<typeof eventSchema>;
export type MediaRecord = z.infer<typeof mediaSchema>;
export type Content = z.infer<typeof contentSchema>;
