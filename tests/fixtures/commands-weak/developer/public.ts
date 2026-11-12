import { SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../../../../src/types/Command.js";

export default defineSlashCommand({
  data: new SlashCommandBuilder().setName("weak").setDescription("weaker than its folder"),
  access: "public",
  async execute() {},
});
