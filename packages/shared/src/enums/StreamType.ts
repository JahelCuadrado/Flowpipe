/**
  * Describes the type of media stream.
  * Mirrors org.schabi.newpipe.extractor.stream.StreamType.
  */
export enum StreamType {
  VideoStream = "VIDEO_STREAM",
  AudioStream = "AUDIO_STREAM",
  LiveStream = "LIVE_STREAM",
  AudioLiveStream = "AUDIO_LIVE_STREAM",
  PostLiveStream = "POST_LIVE_STREAM",
  PostLiveAudioStream = "POST_LIVE_AUDIO_STREAM",
  None = "NONE",
}
