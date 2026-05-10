import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import {
  ExtractionError,
  ContentNotAvailableError,
  AgeRestrictedContentError,
  GeoRestrictedContentError,
  ReCaptchaError,
  ParsingError,
} from "@newpipe/extractor";

interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly statusCode: number;
}

/**
  * Centralized error handler that maps extraction errors
  * to appropriate HTTP status codes without exposing internals.
  */
export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // Log the actual error for debugging
  request.log.error({ err: error }, "Request error: %s", error.message);

  const response = mapErrorToResponse(error);

  reply.status(response.statusCode).send({
    error: response.error,
    code: response.code,
  });
}

function mapErrorToResponse(error: FastifyError | Error): ErrorResponse {
  if (error instanceof ContentNotAvailableError) {
    return {
      error: "The requested content is not available.",
      code: "CONTENT_NOT_AVAILABLE",
      statusCode: 404,
    };
  }

  if (error instanceof AgeRestrictedContentError) {
    return {
      error: "This content is age-restricted.",
      code: "AGE_RESTRICTED",
      statusCode: 403,
    };
  }

  if (error instanceof GeoRestrictedContentError) {
    return {
      error: "This content is not available in your region.",
      code: "GEO_RESTRICTED",
      statusCode: 451,
    };
  }

  if (error instanceof ReCaptchaError) {
    return {
      error: "Rate limited. Please try again later.",
      code: "RATE_LIMITED",
      statusCode: 429,
    };
  }

  if (error instanceof ParsingError) {
    return {
      error: "Failed to parse content. The service may have changed.",
      code: "PARSING_ERROR",
      statusCode: 502,
    };
  }

  if (error instanceof ExtractionError) {
    return {
      error: "An extraction error occurred.",
      code: "EXTRACTION_ERROR",
      statusCode: 500,
    };
  }

  // Fastify validation errors
  if ("validation" in error) {
    return {
      error: "Invalid request parameters.",
      code: "VALIDATION_ERROR",
      statusCode: 400,
    };
  }

  // Unknown errors — never expose internal details
  console.error("Unhandled error:", error);
  return {
    error: "An internal server error occurred.",
    code: "INTERNAL_ERROR",
    statusCode: 500,
  };
}
