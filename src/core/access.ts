import { type BaseInteraction, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import type { Config } from "../config/config.js";
import type { AccessLevel } from "../types/Command.js";

const RANK: Record<AccessLevel, number> = { public: 0, admin: 1, developer: 2 };

// Folder name -> minimum access level for everything inside it
const FOLDER_ACCESS: Record<string, AccessLevel> = {
  developer: "developer",
  administrator: "admin",
};

export type AccessTarget = {
  access?: AccessLevel;
  permissions?: bigint;
};

export type AccessResult = { allowed: true } | { allowed: false; reason: string };

/**
 * Minimum access level implied by a file's folders (e.g. "developer/errors.ts" -> "developer").
 * Near-misses like "developers/" or "admin/" throw instead of silently becoming public.
 */
export const folderAccess = (file: string): AccessLevel => {
  let level: AccessLevel = "public";
  for (const segment of file.split("/").slice(0, -1)) {
    const exact = FOLDER_ACCESS[segment];
    if (exact) {
      if (RANK[exact] > RANK[level]) level = exact;
    } else if (/^(dev|admin)/i.test(segment)) {
      throw new Error(
        `"${file}": folder "${segment}" looks like an access folder. Use "developer/" or "administrator/".`
      );
    }
  }
  return level;
};

/**
 * Combines the folder level with the module's own `access`. The folder sets the minimum:
 * a module may make itself stricter, never weaker.
 */
export const resolveAccess = (file: string, declared: AccessLevel | undefined): AccessLevel => {
  const minimum = folderAccess(file);
  if (!declared) return minimum;
  if (RANK[declared] < RANK[minimum]) {
    throw new Error(`"${file}": access "${declared}" is weaker than its folder's "${minimum}".`);
  }
  return declared;
};

/** Permissions required for an "admin" command or component (default: Administrator). */
export const adminPermissions = (target: AccessTarget): bigint =>
  target.permissions ?? PermissionFlagsBits.Administrator;

/**
 * Developers are the users in DEV_USER_IDS. DEV_ROLE_ID only counts inside the dev guild
 * (GUILD_ID), so a role in some other server can't grant access to developer tools.
 */
export const isDeveloper = (interaction: BaseInteraction, config: Config): boolean => {
  if (config.devUserIds.includes(interaction.user.id)) return true;
  if (!config.devRoleId || !config.guildId || interaction.guildId !== config.guildId) return false;
  return interaction.inCachedGuild() && interaction.member.roles.cache.has(config.devRoleId);
};

/**
 * The one access check, used for commands, autocomplete and components.
 */
export const checkAccess = (target: AccessTarget, interaction: BaseInteraction, config: Config): AccessResult => {
  const access = target.access ?? "public";

  if (access === "developer" && !isDeveloper(interaction, config)) {
    return { allowed: false, reason: "This is restricted to the bot developers." };
  }

  if (access === "admin") {
    if (!interaction.inGuild()) {
      return { allowed: false, reason: "This can only be used inside a server." };
    }
    const required = adminPermissions(target);
    if (!interaction.memberPermissions?.has(required)) {
      const names = new PermissionsBitField(required).toArray().join(", ");
      return { allowed: false, reason: `You need the following permissions: ${names}.` };
    }
  }

  return { allowed: true };
};
