import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ButtonHandler,
  SelectMenuHandler,
  ModalHandler,
} from "../types/Component.js";
import { Logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isScriptFile = (file: string) =>
  (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts");

// Recursively discovers all handler files in a directory
const collectFiles = async (dir: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectFiles(fullPath)));
      } else if (entry.isFile() && isScriptFile(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  } catch {
    // Directory might not exist yet
    return [];
  }
};

/**
 * Registry managing all button, select menu, and modal component handlers.
 */
export class ComponentRegistry {
  private buttons: ButtonHandler[] = [];
  private selectMenus: SelectMenuHandler[] = [];
  private modals: ModalHandler[] = [];

  constructor(private logger: Logger) {}

  /**
   * Discovers and registers component modules from src/components/{buttons,selectMenus,modals}.
   */
  async loadAll(): Promise<void> {
    const componentsDir = path.resolve(__dirname, "../components");

    // 1. Load Button handlers
    const buttonFiles = await collectFiles(path.join(componentsDir, "buttons"));
    for (const file of buttonFiles) {
      const module = await import(pathToFileURL(file).href);
      if (module.default) {
        this.buttons.push(module.default);
        this.logger.debug("Loaded button component", { file: path.basename(file) });
      }
    }

    // 2. Load Select Menu handlers
    const selectFiles = await collectFiles(path.join(componentsDir, "selectMenus"));
    for (const file of selectFiles) {
      const module = await import(pathToFileURL(file).href);
      if (module.default) {
        this.selectMenus.push(module.default);
        this.logger.debug("Loaded select menu component", { file: path.basename(file) });
      }
    }

    // 3. Load Modal handlers
    const modalFiles = await collectFiles(path.join(componentsDir, "modals"));
    for (const file of modalFiles) {
      const module = await import(pathToFileURL(file).href);
      if (module.default) {
        this.modals.push(module.default);
        this.logger.debug("Loaded modal component", { file: path.basename(file) });
      }
    }
  }

  /**
   * Matches a Button interaction's customId against registered button handlers (exact string or RegExp).
   */
  findButton(customId: string): ButtonHandler | undefined {
    return this.buttons.find((handler) =>
      typeof handler.customId === "string"
        ? handler.customId === customId
        : handler.customId.test(customId)
    );
  }

  /**
   * Matches a Select Menu interaction's customId against registered select menu handlers.
   */
  findSelectMenu(customId: string): SelectMenuHandler | undefined {
    return this.selectMenus.find((handler) =>
      typeof handler.customId === "string"
        ? handler.customId === customId
        : handler.customId.test(customId)
    );
  }

  /**
   * Matches a Modal submission's customId against registered modal handlers.
   */
  findModal(customId: string): ModalHandler | undefined {
    return this.modals.find((handler) =>
      typeof handler.customId === "string"
        ? handler.customId === customId
        : handler.customId.test(customId)
    );
  }
}
