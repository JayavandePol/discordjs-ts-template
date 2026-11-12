import { SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../../../src/types/Command.js";

export default defineSlashCommand({
  data: new SlashCommandBuilder().setName("same").setDescription("duplicate name"),
  async execute() {},
});
