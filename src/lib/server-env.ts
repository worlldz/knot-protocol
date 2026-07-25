import { isHex, type Hex } from "viem";

export function cleanEnvValue(value: string | undefined) {
  const cleaned = value?.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return undefined;
  const quote = cleaned[0];
  if ((quote === "\"" || quote === "'") && cleaned.endsWith(quote)) {
    return cleaned.slice(1, -1).trim() || undefined;
  }
  return cleaned;
}

export function getEnvValue(name: string) {
  return cleanEnvValue(process.env[name]);
}

export function getFirstHexEnv(...names: string[]) {
  for (const name of names) {
    const value = getEnvValue(name);
    if (value && isHex(value)) return value as Hex;
  }
  return undefined;
}
