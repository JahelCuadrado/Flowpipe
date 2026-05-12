import { z } from "zod";

/**
 * Shared Zod schema for the service identifier.
 * Maps to ServiceId enum (0-4).
 */
export const serviceIdSchema = z.coerce.number().int().min(0).max(4);

/**
 * Validated schema for the Page pagination token.
 * Ensures JSON.parse results conform to expected structure.
 */
export const pageSchema = z.object({
  url: z.string(),
  id: z.string().optional(),
  ids: z.array(z.string()).optional(),
  cookies: z.record(z.string()).optional(),
  body: z.string().optional(),
});

/**
 * Parses a JSON string into a validated Page object.
 * Prevents prototype pollution and malformed data from reaching downstream services.
 */
export function parsePageBody(rawJson: string): z.infer<typeof pageSchema> {
  const parsed: unknown = JSON.parse(rawJson);
  return pageSchema.parse(parsed);
}
