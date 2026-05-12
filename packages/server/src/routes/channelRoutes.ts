import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";
import { channelCache } from "../middleware/cache.js";
import { serviceIdSchema, parsePageBody } from "../schemas/common.js";

const channelQuerySchema = z.object({
  serviceId: serviceIdSchema,
  url: z.string().url(),
});

const channelTabQuerySchema = z.object({
  serviceId: serviceIdSchema,
  url: z.string().url(),
  tab: z.string().min(1),
});

const channelTabNextPageSchema = z.object({
  serviceId: serviceIdSchema,
  url: z.string().url(),
  tab: z.string().min(1),
  pageBody: z.string().min(1),
});

export async function registerChannelRoutes(server: FastifyInstance): Promise<void> {
  server.get("/channel", async (request) => {
    const query = channelQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const cacheKey = `channel:${query.serviceId}:${query.url}`;

    const info = await channelCache.getOrSet(cacheKey, () =>
      service.getChannelInfo(query.url)
    );

    return { info };
  });

  server.get("/channel/tab", async (request) => {
    const query = channelTabQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const cacheKey = `channel-tab:${query.serviceId}:${query.url}:${query.tab}`;

    const info = await channelCache.getOrSet(cacheKey, () =>
      service.getChannelTabInfo(query.url, query.tab)
    );

    return { info };
  });

  server.post("/channel/tab/next", async (request) => {
    const body = channelTabNextPageSchema.parse(request.body);
    const service = NewPipeExtractor.getService(body.serviceId as ServiceId);
    const page = parsePageBody(body.pageBody);

    const info = await service.getChannelTabNextPage(body.url, body.tab, page);

    return { info };
  });
}
