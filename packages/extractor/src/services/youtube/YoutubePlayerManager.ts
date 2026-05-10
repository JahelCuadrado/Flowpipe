import type { Downloader } from "../../core/types.js";
import { ParsingError } from "../../core/errors.js";
import { fetchPlayerCode } from "./YoutubeJavaScriptExtractor.js";
import {
  getSignatureTimestamp,
  getSignatureDeobfuscationCode,
  getThrottlingDeobfuscationFunctionName,
  getThrottlingDeobfuscationCode,
  getThrottlingParameterFromUrl,
} from "./YoutubeSignatureUtils.js";

// ─── Cache ───────────────────────────────────────────────────────────────────

let cachedPlayerCode: string | null = null;
let cachedSignatureTimestamp: number | null = null;
let cachedSigDeobfCode: string | null = null;
let cachedThrottleFuncName: string | null = null;
let cachedThrottleDeobfCode: string | null = null;
const throttlingParamCache = new Map<string, string>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Gets the signature timestamp needed for player requests.
 */
export async function getPlayerSignatureTimestamp(
  downloader: Downloader,
  videoId = ""
): Promise<number> {
  if (cachedSignatureTimestamp !== null) {
    return cachedSignatureTimestamp;
  }

  await ensurePlayerCode(downloader, videoId);

  cachedSignatureTimestamp = getSignatureTimestamp(cachedPlayerCode!);
  return cachedSignatureTimestamp;
}

/**
 * Deobfuscates a signature from a streaming URL's signatureCipher.
 */
export async function deobfuscateSignature(
  downloader: Downloader,
  videoId: string,
  obfuscatedSignature: string
): Promise<string> {
  await ensurePlayerCode(downloader, videoId);

  if (!cachedSigDeobfCode) {
    cachedSigDeobfCode = getSignatureDeobfuscationCode(cachedPlayerCode!);
  }

  try {
    const result = runJavaScript(
      cachedSigDeobfCode,
      "deobfuscate",
      obfuscatedSignature
    );
    return result ?? "";
  } catch (error) {
    throw new ParsingError(
      `Failed to deobfuscate signature: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deobfuscates the throttling parameter (n) in a streaming URL.
 * Returns the URL with the corrected n parameter, or the original URL if no n parameter exists.
 *
 * Without deobfuscation, YouTube throttles download speed to ~50 KB/s.
 */
export async function deobfuscateStreamUrl(
  downloader: Downloader,
  videoId: string,
  streamingUrl: string
): Promise<string> {
  const obfuscatedN = getThrottlingParameterFromUrl(streamingUrl);
  if (!obfuscatedN) {
    return streamingUrl;
  }

  // Check cache first
  const cachedResult = throttlingParamCache.get(obfuscatedN);
  if (cachedResult) {
    return streamingUrl.replace(obfuscatedN, cachedResult);
  }

  await ensurePlayerCode(downloader, videoId);

  if (!cachedThrottleFuncName) {
    cachedThrottleFuncName = getThrottlingDeobfuscationFunctionName(cachedPlayerCode!);
  }

  if (!cachedThrottleDeobfCode) {
    cachedThrottleDeobfCode = getThrottlingDeobfuscationCode(
      cachedPlayerCode!,
      cachedThrottleFuncName
    );
  }

  try {
    const deobfuscatedN = runJavaScript(
      cachedThrottleDeobfCode,
      cachedThrottleFuncName,
      obfuscatedN
    );

    if (!deobfuscatedN) {
      throw new Error("Deobfuscated n-parameter is empty");
    }

    throttlingParamCache.set(obfuscatedN, deobfuscatedN);
    return streamingUrl.replace(obfuscatedN, deobfuscatedN);
  } catch (error) {
    throw new ParsingError(
      `Failed to deobfuscate throttling parameter: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Clears all caches, forcing re-fetch of player code on next use.
 */
export function clearAllCaches(): void {
  cachedPlayerCode = null;
  cachedSignatureTimestamp = null;
  cachedSigDeobfCode = null;
  cachedThrottleFuncName = null;
  cachedThrottleDeobfCode = null;
  throttlingParamCache.clear();
}

// ─── Internal helpers ────────────────────────────────────────────────────────

async function ensurePlayerCode(downloader: Downloader, videoId: string): Promise<void> {
  if (!cachedPlayerCode) {
    cachedPlayerCode = await fetchPlayerCode(downloader, videoId);
  }
}

/**
 * Runs a JavaScript function using the Function constructor.
 * Works in both Node.js and browser environments.
 * The executed code is YouTube's player.js cipher — not user input.
 */
function runJavaScript(
  code: string,
  functionName: string,
  ...args: string[]
): string | null {
  const argsStr = args.map((a) => JSON.stringify(a)).join(",");
  const wrappedCode = `${code}\nreturn ${functionName}(${argsStr});`;

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const executor = new Function(wrappedCode);
  const result: unknown = executor();

  if (result === null || result === undefined) {
    return null;
  }

  return String(result);
}
