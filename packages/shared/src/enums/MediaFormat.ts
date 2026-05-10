/**
  * Describes the type of media format.
  * Mirrors org.schabi.newpipe.extractor.MediaFormat.
  */
export enum MediaFormat {
  Mpeg4 = "MPEG_4",
  V3gpp = "V3GPP",
  WebM = "WEBM",
  M4a = "M4A",
  Webma = "WEBMA",
  WebmaOpus = "WEBMA_OPUS",
  Ogg = "OGG",
  Opus = "OPUS",
  Mp3 = "MP3",
  Flac = "FLAC",
  Aac = "AAC",
}

export const MEDIA_FORMAT_LABELS: Readonly<Record<MediaFormat, string>> = {
  [MediaFormat.Mpeg4]: "MPEG-4",
  [MediaFormat.V3gpp]: "3GPP",
  [MediaFormat.WebM]: "WebM",
  [MediaFormat.M4a]: "M4A",
  [MediaFormat.Webma]: "WebM Audio",
  [MediaFormat.WebmaOpus]: "WebM Opus",
  [MediaFormat.Ogg]: "OGG",
  [MediaFormat.Opus]: "Opus",
  [MediaFormat.Mp3]: "MP3",
  [MediaFormat.Flac]: "FLAC",
  [MediaFormat.Aac]: "AAC",
} as const;
