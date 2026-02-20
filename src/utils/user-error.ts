import { IntegrationApplication } from "discord.js";

/**
 * A custom error type that represents a predictable, user-facing failure.
 * Used for validation errors, permission denials, or "expected" failures.
 *
 * When thrown:
 * 1. The message is sent back to the user directly (ephemeral).
 * 2. It is NOT logged to the database as a system crash.
 * 3. It DOES NOT send an alert to the error log channel.
 *
 * @example
 * ```ts
 * if (balance < amount) {
 *   throw new UserError("You do not have enough funds for this transaction.");
 * }
 * ```
 */
export class UserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UserError";
    }
}
