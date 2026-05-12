import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";
import { serviceIdSchema, parsePageBody } from "../schemas/common.js";

const commentsQuerySchema = z.object({
  serviceId: serviceIdSchema,
  url: z.string().url(),
});

const commentsNextPageSchema = z.object({
  serviceId: serviceIdSchema,
  url: z.string().url(),
  pageBody: z.string().min(1),
});

export async function registerCommentsRoutes(server: FastifyInstance): Promise<void> {
  server.get("/comments", async (request) => {
    const query = commentsQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const info = await service.getCommentsInfo(query.url);

    return { info };
  });

  server.post("/comments/next", async (request) => {
    const body = commentsNextPageSchema.parse(request.body);
    const service = NewPipeExtractor.getService(body.serviceId as ServiceId);
    const page = parsePageBody(body.pageBody);

    const info = await service.getCommentsNextPage(body.url, page);

    return { info };
  });
}
