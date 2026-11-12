import { Events } from "discord.js";
import { defineEvent } from "../../../src/types/Event.js";

export default defineEvent({
  name: Events.InteractionCreate,
  async execute() {
    throw new Error("listener failed");
  },
});
