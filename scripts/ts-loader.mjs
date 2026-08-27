// Lets plain `node` import the app's TypeScript modules directly, by
// resolving extensionless relative imports and the "@/..." alias.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  else if (spec.startsWith(".") && context.parentURL) spec = new URL(spec, context.parentURL).href;
  else return next(specifier, context);

  const p = fileURLToPath(spec);
  for (const cand of [p, `${p}.ts`, `${p}.tsx`, path.join(p, "index.ts")]) {
    if (existsSync(cand) && !cand.endsWith("/")) return next(pathToFileURL(cand).href, context);
  }
  return next(spec, context);
}
