import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  Events,
  RESTPostAPIApplicationCommandsResult,
} from "discord.js";

import { ESMFileMigrationProvider } from "./providers/ESMFileMigrationProvider";

import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator } from "kysely";
import {
  ActionTypes,
  ActionTypeMap,
  RunOptions,
  Plugin,
  ActionData
} from "./types";
import { ActionRegistry } from "./ActionRegistry";

export type GrotOptions = {
  intents: GatewayIntentBits[];
};

export enum DatabaseType {
  SQLITE = 1,
}

export class GrotCore {
  private plugins: Array<Plugin>;
  private client: Client | undefined;
  private intents: Set<GatewayIntentBits>;
  private database: Kysely<any> | undefined;

  private actionRegistry: ActionRegistry;

  public constructor(options?: GrotOptions) {
    this.plugins = new Array<Plugin>();
    this.intents = new Set<GatewayIntentBits>(options?.intents);

    this.actionRegistry = new ActionRegistry();
  }

  public useDatabase(database: DatabaseType = DatabaseType.SQLITE) {
    switch (database) {
      case DatabaseType.SQLITE:
        this.database = new Kysely<any>({
          dialect: new SqliteDialect({
            database: new SQLite("default.db"),
          }),
        });
    }
  }

  public getDatabase<T>(): Kysely<T> {
    return this.database as Kysely<T>;
  }

  public registerInteraction<T extends ActionData>(data: T) {
    this.actionRegistry.set(data)
  }

  public registerPlugin(plugin: Plugin): Error | void | undefined {
    plugin.requiredIntents?.forEach((intent) => {
      this.intents.add(intent);
    });

    for (const dependency of plugin.dependencies || []) {
      const dependencyPlugin = this.plugins.find(
        (registeredPlugin) => registeredPlugin.name === dependency,
      );

      if (!dependencyPlugin) {
        return new Error(
          `${dependency} coudln't be found but it's required for ${plugin.name}`,
        );
      }
    }

    this.plugins.push(plugin);
    console.log(`✅ Plugin loaded: ${plugin.name}`);
  }

  public getClient() {
    return this.client;
  }

  private async deployCommands({
    clientId,
    guildId,
  }: {
    clientId: string;
    guildId: string;
  }) {
    const slashRegistry = this.actionRegistry.getSlashCommands();
    const slashCommands = Array.from(slashRegistry.values()).map((slash) =>
      slash.data.toJSON(),
    );

    console.log(
      `Started refreshing ${slashCommands.length} application (/) commands.`,
    );

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    const data = (await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: slashCommands },
    )) as RESTPostAPIApplicationCommandsResult[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`,
    );
  }

  public setupInteractionHandler() {
    this.client?.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (interaction.isButton()) {
          const [name] = interaction.customId.split("$");
          const action = this.actionRegistry.get(ActionTypes.Button, name);
          action?.execute(interaction);
          return;
        }

        if (interaction.isChatInputCommand()) {
          const name = interaction.commandName;
          const action = this.actionRegistry.get(ActionTypes.SlashCommand, name);
          action?.execute(interaction);
          return;
        }

        if (interaction.isStringSelectMenu()) {
          const [name] = interaction.customId.split("$");
          const action = this.actionRegistry.get(ActionTypes.SelectMenu, name);
          action?.execute(interaction);
          return;
        }
      } catch (error) {
        console.error("There was an error", error);
      }
    });
  }

  public async run(options?: RunOptions) {
    this.client = new Client({
      intents: Array.from(this.intents),
    });

    console.log("Initializing plugins");
    for (const plugin of this.plugins) {

      if (this.database) {
        const migrator = new Migrator({
          db: this.database,
          migrationTableName: `__migrations_${plugin.name}`,
          provider: new ESMFileMigrationProvider(plugin.migrationsPath),
        });
        const migrationResult = await migrator.migrateUp();
        console.log(`Running migrations for plugin: ${plugin.name}`);
        console.log(migrationResult);
      }

      console.log(`Initializing plugin: ${plugin.name}`);
      plugin.initialize(this);
    }

    const clientId = options?.clientId ?? process.env.BOT_ID;
    const guildId = options?.guildId ?? process.env.GUILD_ID;
    const token = options?.token ?? process.env.DISCORD_TOKEN;

    if (!clientId || !guildId || !token) {
      throw Error(
        `[ERROR] Missing environment variables (token, clientId, guildId). Please set them in .env or pass them as arguments`,
      );
    }

    this.deployCommands({ clientId, guildId });
    this.setupInteractionHandler();

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
