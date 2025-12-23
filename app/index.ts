import { Client, GatewayIntentBits, Events, IntentsBitField } from "discord.js";
import { Kysely } from "kysely";
import { ActionTypes, RunOptions, Plugin, ActionData, GrotOptions, DatabaseType } from "./types";
import { ActionRegistry } from "./ActionRegistry";
import { Database } from "./Database";
import { deploySlashCommands } from "./scripts/DeployCommands";
import { PluginManager } from "./PluginManager";


export class GrotCore {
  private client: Client | undefined;
  private intents: Set<GatewayIntentBits>;
  private database: Database;
  private pluginManager: PluginManager;
  private actionRegistry: ActionRegistry;

  public constructor(options?: GrotOptions) {
    this.intents = new Set<GatewayIntentBits>(options?.intents);
    this.database = new Database();
    this.pluginManager = new PluginManager(this);
    this.actionRegistry = new ActionRegistry();
  }

  public addIntent(intent: GatewayIntentBits) {
    this.intents.add(intent)
  }

  public useDatabase(databaseType: DatabaseType = DatabaseType.SQLITE) {
    this.database.init(databaseType, process.env.DB_FILE_NAME || "default");
  }

  public getDatabaseManager() {
    return this.database
  }

  public getDatabase<T>(): Kysely<T> {
    return this.database.getDatabase<T>();
  }

  public registerInteraction<T extends ActionData>(data: T) {
    this.actionRegistry.set(data)
  }

  public registerPlugin(plugin: Plugin): Error | void | undefined {
    this.pluginManager.registerPlugin(plugin);
  }

  public getClient() {
    return this.client;
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

    const clientId = options?.clientId ?? process.env.BOT_ID;
    const guildId = options?.guildId ?? process.env.GUILD_ID;    const token = options?.token ?? process.env.DISCORD_TOKEN
    

    if (!clientId || !guildId || !token) {
      throw Error(
        `[ERROR] Missing environment variables (token, clientId, guildId). Please set them in .env or pass them as arguments`,
      );
    }
    console.log("Migrate plugins");
    this.pluginManager.migratePlugins();

    console.log("Initializing plugins");
    this.pluginManager.initializePlugins();

    console.log("Delpoy slash commands");
    deploySlashCommands({commands: this.actionRegistry.getSlashCommands(), clientId, guildId, token});

    this.setupInteractionHandler();

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
