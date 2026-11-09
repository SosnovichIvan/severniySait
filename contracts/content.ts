import { z } from "zod";
const divisionUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (url) => url === "" || (/^https?:\/\//i.test(url) && URL.canParse(url)),
    "Укажите ссылку с http:// или https://",
  );
export const divisionInput = z.object({
  name: z.string().trim().min(2).max(120),
  id: z.string().min(1).max(200).optional(),
  region: z.enum(["Москва", "Московская область", "Другой регион"]).optional(),
  type: z.enum(["city", "district"]).optional(),
  archived: z.boolean().optional(),
  url: divisionUrl,
  published: z.boolean().optional(),
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
export const divisionSaveInput = divisionInput
  .omit({ id: true, archived: true })
  .refine(
    (division) =>
      division.region !== "Другой регион" &&
      !(
        division.type === "district" && division.region === "Московская область"
      ),
    "Выберите Москву для округа или Московскую область для города.",
  );
export const channelInput = z.object({
  name: z.string().trim().min(1).max(100),
  note: z.string().trim().max(300),
  short: z.string().trim().min(1).max(4),
  url: divisionUrl.refine((url) => url !== "", "Укажите ссылку"),
  published: z.boolean(),
});
export const channelSchema = channelInput.extend({ id: z.string() });
export type ChannelRecord = z.infer<typeof channelSchema>;
export const publicationInput = z.object({ published: z.boolean() });
export const publicationKind = z.enum([
  "events",
  "media",
  "divisions",
  "channels",
]);
export type PublicationKind = z.infer<typeof publicationKind>;
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
  channels: z.array(channelSchema).optional(),
  divisions: z.array(divisionInput).optional(),
  events: z.array(eventSchema),
  media: z.array(mediaSchema),
});
export type EventRecord = z.infer<typeof eventSchema>;
export type MediaRecord = z.infer<typeof mediaSchema>;
export type Content = z.infer<typeof contentSchema>;
export const deploymentVersion = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
export const deploymentInput = z.object({
  scheduledAt: z.iso.datetime({ offset: true }),
});
export const deploymentSchema = deploymentInput.extend({
  version: deploymentVersion,
  id: z.string(),
  createdAt: z.string(),
  status: z.enum(["scheduled", "running", "succeeded", "failed", "cancelled"]),
  detail: z.string(),
});
export type DeploymentRecord = z.infer<typeof deploymentSchema>;
export const deploymentsSchema = z.object({
  enabled: z.boolean(),
  currentVersion: z.string(),
  jobs: z.array(deploymentSchema),
});

export const contentTarget = z.object({
  kind: publicationKind,
  id: z.string().min(1).max(200),
});
export type ContentTarget = z.infer<typeof contentTarget>;
export const contentUpdateInput = deploymentInput.extend({
  targets: z.array(contentTarget).min(1).max(100),
});
export const contentUpdateSchema = deploymentSchema
  .omit({ version: true })
  .extend({ count: z.number().int().positive() });
export type ContentUpdate = z.infer<typeof contentUpdateSchema>;
export const contentUpdatesSchema = z.object({
  jobs: z.array(contentUpdateSchema),
  drafts: z.array(contentTarget.extend({ title: z.string() })),
});
