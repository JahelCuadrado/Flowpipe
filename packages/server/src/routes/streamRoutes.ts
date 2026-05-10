import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";
import { streamCache } from "../middleware/cache.js";

const streamQuerySchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  url: z.string().url(),
});

export async function registerStreamRoutes(server: FastifyInstance): Promise<void> {
  server.get("/stream", async (request) => {
    const query = streamQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const cacheKey = `stream:${query.serviceId}:${query.url}`;

    const info = await streamCache.getOrSet(cacheKey, () =>
      service.getStreamInfo(query.url)
    );

    return { info };
  });
}
