import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type LoadedModule<T> = {
  // Path relative to the scanned directory, always with "/" separators
  file: string;
  value: T;
};

// Source (.ts via tsx) or compiled (.js) modules; skips declarations, source maps and tests
const isModuleFile = (name: string) =>
  /\.(ts|js|mts|mjs)$/.test(name) && !/\.d\.[mc]?ts$/.test(name) && !/\.(test|spec)\./.test(name);

const collectFiles = async (dir: string): Promise<string[]> => {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(fullPath)));
    else if (entry.isFile() && isModuleFile(entry.name)) files.push(fullPath);
  }
  return files.sort();
};

/**
 * Recursively imports every module in `dir` and validates its default export.
 * Throws with the file name when a module has no default export or the wrong shape,
 * so a broken file fails at startup instead of at the first interaction.
 */
export const loadModules = async <T>(
  dir: string,
  isValid: (value: unknown) => value is T,
  kind: string
): Promise<LoadedModule<T>[]> => {
  const loaded: LoadedModule<T>[] = [];

  for (const fullPath of await collectFiles(dir)) {
    const file = path.relative(dir, fullPath).split(path.sep).join("/");
    const module = (await import(pathToFileURL(fullPath).href)) as { default?: unknown };

    if (!isValid(module.default)) {
      throw new Error(`Invalid ${kind} module "${file}": expected a default export of a ${kind}.`);
    }
    loaded.push({ file, value: module.default });
  }

  return loaded;
};

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
