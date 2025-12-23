import { Collection, REST, RESTPostAPIApplicationCommandsResult, Routes } from "discord.js";
import { SlashCommandActionData } from "../types";

export async function deploySlashCommands({commands, clientId, guildId, token}: {
    clientId: string;
    guildId: string;
    commands:  Collection<string, SlashCommandActionData>
    token: string
  }) {
    const slashCommands = Array.from(commands.values()).map((slash) =>
      slash.data.toJSON(),
    );

    console.log(
      `Started refreshing ${slashCommands.length} application (/) commands.`,
    );

    const rest = new REST().setToken(token);
    const data = (await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: slashCommands },
    )) as RESTPostAPIApplicationCommandsResult[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  }