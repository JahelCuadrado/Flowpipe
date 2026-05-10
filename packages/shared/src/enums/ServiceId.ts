/**
  * Identifies the streaming service a resource belongs to.
  * Maps directly to the services supported by the extractor.
  */
export enum ServiceId {
  YouTube = 0,
  SoundCloud = 1,
  MediaCCC = 2,
  PeerTube = 3,
  Bandcamp = 4,
}

export const SERVICE_NAMES: Readonly<Record<ServiceId, string>> = {
  [ServiceId.YouTube]: "YouTube",
  [ServiceId.SoundCloud]: "SoundCloud",
  [ServiceId.MediaCCC]: "media.ccc.de",
  [ServiceId.PeerTube]: "PeerTube",
  [ServiceId.Bandcamp]: "Bandcamp",
} as const;
