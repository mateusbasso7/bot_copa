require("dotenv").config();

const { REST, Routes } = require("discord.js");
const { commands } = require("./commands");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error("Defina DISCORD_TOKEN, DISCORD_CLIENT_ID e DISCORD_GUILD_ID no arquivo .env.");
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands.map((command) => command.toJSON())
  });

  console.log(`Comandos registrados no servidor ${guildId}.`);
}

main().catch((error) => {
  console.error("Falha ao registrar comandos:", error);
  process.exitCode = 1;
});
