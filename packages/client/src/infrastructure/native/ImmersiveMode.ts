import { registerPlugin } from "@capacitor/core";

interface ImmersiveModePlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
}

/**
 * Native plugin that hides all Android system bars (status + navigation)
 * and extends the WebView to the physical screen edges.
 */
const ImmersiveMode = registerPlugin<ImmersiveModePlugin>("ImmersiveMode");

export { ImmersiveMode };
export type { ImmersiveModePlugin };
