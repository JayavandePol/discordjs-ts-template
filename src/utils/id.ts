import crypto from "node:crypto";

export const createErrorId = (): string => {
  return crypto.randomBytes(6).toString("hex");
};
