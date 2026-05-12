import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ServiceId } from "@newpipe/shared";
import type { KioskType } from "@newpipe/shared";
import { NewPipeExtractor } from "@newpipe/extractor";
import { serviceIdSchema, parsePageBody } from "../schemas/common.js";

const VALID_KIOSK_TYPES = [
  "Trending",
  "Top 50",
  "New & hot",
  "Featured",
  "Radio",
  "Recent",
  "Live",
] as const;

const kioskQuerySchema = z.object({
  serviceId: serviceIdSchema,
  type: z.enum(VALID_KIOSK_TYPES),
});

const kioskNextPageSchema = z.object({
  serviceId: serviceIdSchema,
  type: z.enum(VALID_KIOSK_TYPES),
  pageBody: z.string().min(1),
});

export async function registerKioskRoutes(server: FastifyInstance): Promise<void> {
  server.get("/kiosk", async (request) => {
    const query = kioskQuerySchema.parse(request.query);
    const service = NewPipeExtractor.getService(query.serviceId as ServiceId);

    const info = await service.getKioskInfo(query.type as KioskType);

    return { info };
  });

  server.post("/kiosk/next", async (request) => {
    const body = kioskNextPageSchema.parse(request.body);
    const service = NewPipeExtractor.getService(body.serviceId as ServiceId);
    const page = parsePageBody(body.pageBody);

    const result = await service.getKioskNextPage(body.type as KioskType, page);

    return { result };
  });
}
