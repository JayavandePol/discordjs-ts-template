import crypto from "node:crypto";

export const createErrorId = (): string => {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
};
