// Cooldown manager for tracking per-command, per-user execution limits in memory
export class CooldownManager {
  // Map of commandName -> (userId -> expiration timestamp in milliseconds)
  private cooldowns = new Map<string, Map<string, number>>();

  /**
   * Check if a user is currently on cooldown for a given command.
   * If on cooldown, returns the remaining time in seconds.
   * If not on cooldown, sets the expiration timestamp and returns null.
   *
   * @param commandName The name of the command
   * @param userId The Discord user ID
   * @param cooldownSeconds Cooldown duration in seconds
   * @returns Remaining cooldown duration in seconds, or null if permitted
   */
  public check(commandName: string, userId: string, cooldownSeconds: number): number | null {
    if (cooldownSeconds <= 0) return null;

    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;

    // Get or initialize the user map for this command
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Map<string, number>());
    }

    const timestamps = this.cooldowns.get(commandName)!;
    const expiration = timestamps.get(userId);

    // If an active cooldown timestamp exists in the future
    if (expiration && now < expiration) {
      const remainingSeconds = Math.ceil((expiration - now) / 1000);
      return remainingSeconds;
    }

    // Set new expiration timestamp
    timestamps.set(userId, now + cooldownMs);

    // Automatically clean up old map entry after cooldown expires to prevent memory growth
    setTimeout(() => {
      timestamps.delete(userId);
      if (timestamps.size === 0) {
        this.cooldowns.delete(commandName);
      }
    }, cooldownMs);

    return null;
  }
}
