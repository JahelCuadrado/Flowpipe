import { Capacitor, registerPlugin } from "@capacitor/core";

interface BackgroundPlaybackPlugin {
  start(options: { title: string; artist: string }): Promise<void>;
  stop(): Promise<void>;
  updateMetadata(options: { title: string; artist: string }): Promise<void>;
}

const NativePlugin = Capacitor.isNativePlatform()
  ? registerPlugin<BackgroundPlaybackPlugin>("BackgroundPlayback")
  : null;

/**
 * Manages the native Android foreground service that keeps audio playing
 * in the background. No-ops on web/browser platforms.
 */
export const BackgroundPlayback = {
  async start(title: string, artist: string): Promise<void> {
    if (!NativePlugin) return;
    await NativePlugin.start({ title, artist });
  },

  async stop(): Promise<void> {
    if (!NativePlugin) return;
    await NativePlugin.stop();
  },

  async updateMetadata(title: string, artist: string): Promise<void> {
    if (!NativePlugin) return;
    await NativePlugin.updateMetadata({ title, artist });
  },
};
