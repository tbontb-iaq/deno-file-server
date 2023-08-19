import { existsSync } from "https://deno.land/std@0.197.0/fs/mod.ts";

function fileExists(path: string | URL, isReadable = true) {
  return existsSync(path, { isFile: true, isReadable });
}

export { fileExists };
