import { ParsingError } from "../../core/errors.js";

// ─── Signature timestamp ─────────────────────────────────────────────────────

const STS_REGEX = /signatureTimestamp[=:](\d+)/;

/**
 * Extracts the signature timestamp from YouTube's base JS player code.
 * This timestamp is required in player InnerTube requests to get valid stream URLs.
 */
export function getSignatureTimestamp(playerCode: string): number {
  const match = STS_REGEX.exec(playerCode);
  if (!match?.[1]) {
    throw new ParsingError("Could not extract signature timestamp from player code");
  }
  return parseInt(match[1], 10);
}

// ─── Signature deobfuscation ────────────────────────────────────────────────

/**
 * Patterns to find the name of the signature deobfuscation function.
 * These patterns are taken from NewPipeExtractor's YoutubeSignatureUtils.java.
 */
const DEOBFUSCATION_FUNCTION_NAME_REGEXES: RegExp[] = [
  /\b(?:[a-zA-Z0-9_$]+)&&\((?:[a-zA-Z0-9_$]+)=([a-zA-Z0-9_$]{2,})\((\d+,)decodeURIComponent\((?:[a-zA-Z0-9_$]+)\)\)/,
  /\b(?:[a-zA-Z0-9_$]+)&&\((?:[a-zA-Z0-9_$]+)=([a-zA-Z0-9_$]{2,})\(decodeURIComponent\((?:[a-zA-Z0-9_$]+)\)\)/,
  /\bm=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(h\.s\)\)/,
  /\bc&&\(c=([a-zA-Z0-9$]{2,})\(decodeURIComponent\(c\)\)/,
  /(?:\b|[^a-zA-Z0-9$])([a-zA-Z0-9$]{2,})\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)/,
  /([\w$]+)\s*=\s*function\((\w+)\)\{\s*\2=\s*\2\.split\(""\)\s*;/,
];

/**
 * Extracts the complete signature deobfuscation code from the player.
 * Returns a self-contained JS function named "deobfuscate" that takes
 * an obfuscated signature and returns the deobfuscated one.
 */
export function getSignatureDeobfuscationCode(playerCode: string): string {
  // Step 1: Find the deobfuscation function name and any additional params
  let functionName: string | null = null;
  let additionalParams = "";

  for (const regex of DEOBFUSCATION_FUNCTION_NAME_REGEXES) {
    const match = regex.exec(playerCode);
    if (match?.[1]) {
      functionName = match[1];
      if (match[2]) {
        additionalParams = match[2];
      }
      break;
    }
  }

  if (!functionName) {
    throw new ParsingError(
      "Could not find signature deobfuscation function name in player code"
    );
  }

  // Step 2: Extract the deobfuscation function body
  const deobfuscationFunction = extractFunction(playerCode, functionName);

  // Step 3: Extract the global array variable (e.g., var X='...'.split(";"))
  let globalVar = "";
  const globalArrayMatch = /(var [A-Za-z]=['"'].*['"'].split\("[;{]"\))/.exec(playerCode);
  if (globalArrayMatch?.[1]) {
    globalVar = globalArrayMatch[1] + ";";
  }

  // Step 4: Extract the helper object (contains swap, splice, reverse operations)
  const helperObjNameMatch = /[;,]([A-Za-z0-9_$]{2,})\[../.exec(deobfuscationFunction);
  let helperObject = "";
  if (helperObjNameMatch?.[1]) {
    const helperName = helperObjNameMatch[1];
    const helperRegex = new RegExp(
      "(var " + escapeRegex(helperName) + "=\\{[\\s\\S]+?\\}\\};)"
    );
    const helperMatch = helperRegex.exec(playerCode);
    if (helperMatch?.[1]) {
      helperObject = helperMatch[1].replace(/\n/g, "");
    }
  }

  // Step 5: Build the callable wrapper function
  const callerFunction = `function deobfuscate(a){return ${functionName}(${additionalParams}a);}`;

  return `${globalVar}${helperObject}${deobfuscationFunction};${callerFunction}`;
}

// ─── Throttling parameter (n) deobfuscation ────────────────────────────────

const THROTTLING_PARAM_REGEX = /[&?]n=([^&]+)/;

/**
 * Patterns to find the throttling parameter deobfuscation function name.
 * From NewPipeExtractor's YoutubeThrottlingParameterUtils.java.
 */
const THROTTLING_FUNCTION_NAME_REGEXES: RegExp[] = [
  // m85=function( ... return Y[45]
  /([A-Za-z0-9_$]{2,})=function.*return [A-Z]\[\d+\]/,
  // a.D&&(b="nn"[+a.D],...c=SDa[0](c),...SDa.length||Wma("")
  /[a-zA-Z0-9$_]="nn"\[\+[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\],[a-zA-Z0-9$_]+\([a-zA-Z0-9$_]+\),[a-zA-Z0-9$_]+=[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\[[a-zA-Z0-9$_]+\]\|\|null\)&&\([a-zA-Z0-9$_]+=([a-zA-Z0-9$_]+)\[(\d+)\]/,
  /[a-zA-Z0-9$_]="nn"\[\+[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\],[a-zA-Z0-9$_]+\([a-zA-Z0-9$_]+\),[a-zA-Z0-9$_]+=[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\[[a-zA-Z0-9$_]+\]\|\|null\).+\|\|([a-zA-Z0-9$_]+)\(""\)/,
  // ,Vb(m),W=m.j[c]||null)&&(W=cvb[0](W),m.set(c,W)
  /,[a-zA-Z0-9$_]+\([a-zA-Z0-9$_]+\),[a-zA-Z0-9$_]+=[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\[[a-zA-Z0-9$_]+\]\|\|null\)&&\(\b[a-zA-Z0-9$_]+=([a-zA-Z0-9$_]+)\[(\d+)\]\([a-zA-Z0-9$_]\),[a-zA-Z0-9$_]+\.set\((?:"n+"|[a-zA-Z0-9$_]+),[a-zA-Z0-9$_]+\)/,
  // a.D&&(b="nn"[+a.D],c=a.get(b))&&(c=rDa[0](c),...rDa.length||rma("")
  /[a-zA-Z0-9$_]="nn"\[\+[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\],[a-zA-Z0-9$_]+=[a-zA-Z0-9$_]+\.get\([a-zA-Z0-9$_]+\)\).+\|\|([a-zA-Z0-9$_]+)\(""\)/,
  /[a-zA-Z0-9$_]="nn"\[\+[a-zA-Z0-9$_]+\.[a-zA-Z0-9$_]+\],[a-zA-Z0-9$_]+=[a-zA-Z0-9$_]+\.get\([a-zA-Z0-9$_]+\)\)&&\([a-zA-Z0-9$_]+=([a-zA-Z0-9$_]+)\[(\d+)\]/,
  // (b=String.fromCharCode(110),c=a.get(b))&&(c=BDa[0](c)
  /\([a-zA-Z0-9$_]=String\.fromCharCode\(110\),[a-zA-Z0-9$_]=[a-zA-Z0-9$_]\.get\([a-zA-Z0-9$_]\)\)&&\([a-zA-Z0-9$_]=([a-zA-Z0-9$_]+)(?:\[(\d+)\])?\([a-zA-Z0-9$_]\)/,
  // .get("n"))&&(b=Yva[0](b)
  /\.get\("n"\)\)&&\([a-zA-Z0-9$_]=([a-zA-Z0-9$_]+)(?:\[(\d+)\])?\([a-zA-Z0-9$_]\)/,
];

const FUNCTION_ARGUMENTS_REGEX = /=\s*function\s*\(\s*([^)]*)\s*\)/;
const EARLY_RETURN_REGEX_TEMPLATE =
  ";\\s*if\\s*\\(\\s*typeof\\s+[a-zA-Z0-9$_]+\\s*===?\\s*[\"']undefined[\"']\\s*\\)\\s*return\\s+%s;";

/**
 * Gets the throttling parameter deobfuscation function name from the player code.
 */
export function getThrottlingDeobfuscationFunctionName(playerCode: string): string {
  for (const regex of THROTTLING_FUNCTION_NAME_REGEXES) {
    const match = regex.exec(playerCode);
    if (match?.[1]) {
      const functionName = match[1];

      // Some patterns capture an array name + index (e.g. SDa[0])
      if (match[2] !== undefined) {
        const arrayNum = parseInt(match[2], 10);
        return resolveFunctionFromArray(playerCode, functionName, arrayNum);
      }

      return functionName;
    }
  }

  throw new ParsingError(
    "Could not find throttling deobfuscation function name in player code"
  );
}

/**
 * Resolves a function name from an array declaration in the player code.
 * E.g. var SDa = [funcA, funcB]; => SDa[0] resolves to "funcA"
 */
function resolveFunctionFromArray(
  playerCode: string,
  arrayName: string,
  index: number
): string {
  const arrayPattern = new RegExp(
    "var " + escapeRegex(arrayName) + "\\s*=\\s*\\[(.+?)\\][;,]"
  );
  const arrayMatch = arrayPattern.exec(playerCode);
  if (!arrayMatch?.[1]) {
    throw new ParsingError(
      `Could not find array declaration for ${arrayName}`
    );
  }

  const names = arrayMatch[1].split(",").map((n) => n.trim());
  if (index >= names.length) {
    throw new ParsingError(
      `Array index ${index} out of bounds for ${arrayName}`
    );
  }

  return names[index]!;
}

/**
 * Extracts the throttling parameter deobfuscation function code.
 */
export function getThrottlingDeobfuscationCode(
  playerCode: string,
  functionName: string
): string {
  const func = extractFunction(playerCode, functionName);
  return fixupThrottlingFunction(func, functionName);
}

/**
 * Extracts the throttling parameter from a streaming URL, if present.
 */
export function getThrottlingParameterFromUrl(url: string): string | null {
  // Quick check for performance
  if (!url.includes("&n=") && !url.includes("?n=")) {
    return null;
  }

  const match = THROTTLING_PARAM_REGEX.exec(url);
  return match?.[1] ?? null;
}

/**
 * Removes the early return check from the throttling function.
 * In newer player code, the function checks for an external variable
 * which is always undefined when running standalone, causing early return.
 */
function fixupThrottlingFunction(func: string, _functionName: string): string {
  const argsMatch = FUNCTION_ARGUMENTS_REGEX.exec(func);
  if (!argsMatch?.[1]) {
    return func;
  }

  const firstArg = argsMatch[1].split(",")[0]?.trim();
  if (!firstArg) {
    return func;
  }

  const earlyReturnPattern = new RegExp(
    EARLY_RETURN_REGEX_TEMPLATE.replace("%s", escapeRegex(firstArg)),
    "s"
  );

  return func.replace(earlyReturnPattern, ";");
}

// ─── Shared utilities ────────────────────────────────────────────────────────

/**
 * Extracts a complete function definition from the player code by name.
 * Uses brace counting to find the matching closing brace.
 */
function extractFunction(playerCode: string, functionName: string): string {
  const functionBase = functionName + "=function";
  const startIndex = playerCode.indexOf(functionBase);

  if (startIndex === -1) {
    throw new ParsingError(
      `Could not find function "${functionName}" in player code`
    );
  }

  // Find the opening brace
  const braceStart = playerCode.indexOf("{", startIndex);
  if (braceStart === -1) {
    throw new ParsingError(
      `Could not find opening brace for function "${functionName}"`
    );
  }

  // Count braces to find the matching closing brace
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;

  for (let i = braceStart; i < playerCode.length; i++) {
    const char = playerCode[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        const functionBody = playerCode.substring(startIndex, i + 1);
        // Prepend "var " to make it a proper declaration
        return "var " + functionBody;
      }
    }
  }

  throw new ParsingError(
    `Could not find matching closing brace for function "${functionName}"`
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
