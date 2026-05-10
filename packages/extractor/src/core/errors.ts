/**
  * Base class for all extraction errors.
  */
export class ExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
  * The content was not found (404 or equivalent).
  */
export class ContentNotAvailableError extends ExtractionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ContentNotAvailableError";
  }
}

/**
  * The content requires an age-verified or logged-in account.
  */
export class AgeRestrictedContentError extends ExtractionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AgeRestrictedContentError";
  }
}

/**
  * The extractor encountered geo-restricted content.
  */
export class GeoRestrictedContentError extends ExtractionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "GeoRestrictedContentError";
  }
}

/**
  * A required parser/pattern has changed and extraction failed.
  */
export class ParsingError extends ExtractionError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ParsingError";
  }
}

/**
  * The service is rate-limiting requests (e.g., CAPTCHA).
  */
export class ReCaptchaError extends ExtractionError {
  public readonly captchaUrl: string;

  constructor(message: string, captchaUrl: string, cause?: unknown) {
    super(message, cause);
    this.name = "ReCaptchaError";
    this.captchaUrl = captchaUrl;
  }
}
