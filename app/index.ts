import { Client, GatewayIntentBits, Events } from "discord.js";
import { Kysely } from "kysely";
import { ActionTypes, RunOptions, Plugin, ActionData} from "./types";
import { ActionRegistry } from "./ActionRegistry";
import { Database } from "./Database";
import { deploySlashCommands } from "./scripts/DeployCommands";

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
  private database: Database;

  private actionRegistry: ActionRegistry;

  public constructor(options?: GrotOptions) {
    this.plugins = new Array<Plugin>();
    this.intents = new Set<GatewayIntentBits>(options?.intents);
    this.database = new Database();
    this.actionRegistry = new ActionRegistry();
  }

  public useDatabase(databaseType: DatabaseType = DatabaseType.SQLITE) {
    this.database.init(databaseType, process.env.DB_FILE_NAME || "default");
  }

  public getDatabase<T>(): Kysely<T> {
    return this.database.getDatabase<T>();
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
      this.database.migrate(plugin.name, plugin.migrationsPath)

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

    deploySlashCommands({
      commands: this.actionRegistry.getSlashCommands(), 
      clientId, 
      guildId 
    });

    this.setupInteractionHandler();

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
