/**
  * Represents a thumbnail or avatar image with resolution metadata.
  */
export interface ImageInfo {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly estimatedResolutionLevel: ImageResolutionLevel;
}

export enum ImageResolutionLevel {
  Low = "LOW",
  Medium = "MEDIUM",
  High = "HIGH",
  Unknown = "UNKNOWN",
}
