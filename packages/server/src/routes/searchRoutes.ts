import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";
import { searchCache } from "../middleware/cache.js";

const searchQuerySchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  q: z.string().min(1).max(500),
  contentFilter: z.string().optional(),
  sortFilter: z.string().optional(),
});

const searchNextPageSchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  q: z.string().min(1).max(500),
  contentFilter: z.string().optional(),
  sortFilter: z.string().optional(),
  pageBody: z.string().min(1),
});

const suggestionsQuerySchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  q: z.string().min(1).max(500),
});

export async function registerSearchRoutes(server: FastifyInstance): Promise<void> {
  server.get("/search", async (request) => {
    const query = searchQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const cacheKey = `search:${query.serviceId}:${query.q}:${query.contentFilter ?? ""}:${query.sortFilter ?? ""}`;

    const result = await searchCache.getOrSet(cacheKey, () =>
      service.search(query.q, {
        contentFilters: query.contentFilter ? [query.contentFilter] : [],
        sortFilter: query.sortFilter ?? null,
      })
    );

    return { result };
  });

  server.post("/search/next", async (request) => {
    const body = searchNextPageSchema.parse(request.body);
    const service = NewPipeExtractor.getService(body.serviceId as ServiceId);
    const page = JSON.parse(body.pageBody) as import("@newpipe/shared").Page;

    const result = await service.searchNextPage(
      body.q,
      {
        contentFilters: body.contentFilter ? [body.contentFilter] : [],
        sortFilter: body.sortFilter ?? null,
      },
      page
    );

    return { result };
  });

  server.get("/suggestions", async (request) => {
    const query = suggestionsQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const cacheKey = `suggestions:${query.serviceId}:${query.q}`;

    const suggestions = await searchCache.getOrSet(
      cacheKey,
      () => service.getSearchSuggestions(query.q),
      60
    );

    return { suggestions };
  });
}
