import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { checkAccess, folderAccess, resolveAccess } from "../src/core/access.js";
import { DEV_ID, ROLE_ID, asGuildMember, fakeInteraction, testConfig } from "./helpers/fakes.js";

const check = (target: Parameters<typeof checkAccess>[0], overrides: Record<string, unknown>, env = {}) =>
  checkAccess(target, fakeInteraction("slash", overrides) as never, testConfig(env));

describe("folder access", () => {
  it("derives the minimum level from the folder", () => {
    expect(folderAccess("ping.ts")).toBe("public");
    expect(folderAccess("administrator/test.ts")).toBe("admin");
    expect(folderAccess("developer/errors.ts")).toBe("developer");
    expect(folderAccess("developer/tools/inspect.ts")).toBe("developer");
  });

  it("throws on folders that look like an access folder but are misspelled", () => {
    expect(() => folderAccess("developers/errors.ts")).toThrow("looks like an access folder");
    expect(() => folderAccess("admin/test.ts")).toThrow("looks like an access folder");
  });

  it("lets a module tighten its folder's level but never loosen it", () => {
    expect(resolveAccess("ping.ts", "developer")).toBe("developer");
    expect(resolveAccess("developer/errors.ts", undefined)).toBe("developer");
    expect(() => resolveAccess("developer/errors.ts", "public")).toThrow("weaker");
  });
});

describe("checkAccess", () => {
  it("allows public targets for everyone", () => {
    expect(check({}, {}).allowed).toBe(true);
  });

  it("allows developers listed in DEV_USER_IDS, anywhere", () => {
    expect(check({ access: "developer" }, { user: { id: DEV_ID } }).allowed).toBe(true);
    expect(check({ access: "developer" }, {}).allowed).toBe(false);
  });

  it("only honors DEV_ROLE_ID inside the dev guild", () => {
    const env = { DEV_ROLE_ID: ROLE_ID };
    const inDevGuild = asGuildMember(0n, [ROLE_ID]);
    expect(check({ access: "developer" }, inDevGuild, env).allowed).toBe(true);
    expect(check({ access: "developer" }, { ...inDevGuild, guildId: "666666666666666666" }, env).allowed).toBe(false);
  });

  it("requires a server and the configured permissions for admin targets", () => {
    expect(check({ access: "admin" }, {}).allowed).toBe(false);
    expect(check({ access: "admin" }, asGuildMember(PermissionFlagsBits.SendMessages)).allowed).toBe(false);
    expect(check({ access: "admin" }, asGuildMember(PermissionFlagsBits.Administrator)).allowed).toBe(true);

    const manageGuild = { access: "admin" as const, permissions: PermissionFlagsBits.ManageGuild };
    expect(check(manageGuild, asGuildMember(PermissionFlagsBits.ManageGuild)).allowed).toBe(true);
  });
});
