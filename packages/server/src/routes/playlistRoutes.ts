import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";

const playlistQuerySchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  url: z.string().url(),
});

const playlistNextPageSchema = z.object({
  serviceId: z.coerce.number().int().min(0).max(4),
  url: z.string().url(),
  pageBody: z.string().min(1),
});

export async function registerPlaylistRoutes(server: FastifyInstance): Promise<void> {
  server.get("/playlist", async (request) => {
    const query = playlistQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const info = await service.getPlaylistInfo(query.url);

    return { info };
  });

  server.post("/playlist/next", async (request) => {
    const body = playlistNextPageSchema.parse(request.body);
    const service = NewPipeExtractor.getService(body.serviceId as ServiceId);
    const page = JSON.parse(body.pageBody) as import("@newpipe/shared").Page;

    const result = await service.getPlaylistNextPage(body.url, page);

    return { result };
  });
}
