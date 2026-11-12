import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ButtonHandler,
  COLLECTOR_PREFIX,
  type ModalHandler,
  type SelectMenuHandler,
} from "../types/Component.js";
import type { Logger } from "../utils/logger.js";
import { resolveAccess } from "./access.js";
import { isObject, loadModules } from "./module-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AnyHandler = ButtonHandler | SelectMenuHandler | ModalHandler;

const isHandler = (value: unknown): value is AnyHandler =>
  isObject(value) &&
  (typeof value.customId === "string" || value.customId instanceof RegExp) &&
  typeof value.execute === "function";

// RegExp.test() with the g or y flag is stateful (lastIndex), which makes matching flaky
const withoutStatefulFlags = (pattern: RegExp) =>
  pattern.global || pattern.sticky ? new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")) : pattern;

const matches = (handler: AnyHandler, customId: string) =>
  typeof handler.customId === "string" ? handler.customId === customId : handler.customId.test(customId);

/**
 * Registry of button, select menu and modal handlers loaded from
 * src/components/{buttons,selectMenus,modals}.
 */
export class ComponentRegistry {
  private buttons: ButtonHandler[] = [];
  private selectMenus: SelectMenuHandler[] = [];
  private modals: ModalHandler[] = [];

  constructor(
    private logger: Logger,
    private componentsDir = path.resolve(__dirname, "../components")
  ) {}

  async loadAll(): Promise<void> {
    this.buttons = await this.load<ButtonHandler>("buttons");
    this.selectMenus = await this.load<SelectMenuHandler>("selectMenus");
    this.modals = await this.load<ModalHandler>("modals");
  }

  /** True for customIds owned by a message collector rather than a registered handler. */
  isCollectorOwned(customId: string): boolean {
    return customId.startsWith(COLLECTOR_PREFIX);
  }

  findButton(customId: string): ButtonHandler | undefined {
    return this.buttons.find((handler) => matches(handler, customId));
  }

  findSelectMenu(customId: string): SelectMenuHandler | undefined {
    return this.selectMenus.find((handler) => matches(handler, customId));
  }

  findModal(customId: string): ModalHandler | undefined {
    return this.modals.find((handler) => matches(handler, customId));
  }

  private async load<T extends AnyHandler>(folder: string): Promise<T[]> {
    const dir = path.join(this.componentsDir, folder);
    const handlers: T[] = [];
    const exactIds = new Set<string>();

    for (const { file, value } of await loadModules(dir, isHandler, `${folder} handler`)) {
      const handler = value as T;
      handler.access = resolveAccess(file, handler.access);
      if (typeof handler.customId === "string") {
        if (handler.customId.startsWith(COLLECTOR_PREFIX)) {
          throw new Error(`"${file}": customIds starting with "${COLLECTOR_PREFIX}" are reserved for collectors.`);
        }
        if (exactIds.has(handler.customId)) {
          throw new Error(`Duplicate ${folder} customId "${handler.customId}" in "${file}".`);
        }
        exactIds.add(handler.customId);
      } else {
        handler.customId = withoutStatefulFlags(handler.customId);
      }

      handlers.push(handler);
      this.logger.debug(`Loaded ${folder} handler`, { file });
    }

    return handlers;
  }
}
