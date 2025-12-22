import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  GatewayIntentBits,
  Message,
  SlashCommandBuilder,
  REST,
  Routes,
  ButtonBuilder,
  ButtonInteraction,
  Events,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  RESTPostAPIApplicationCommandsResult,
} from "discord.js";

import { ESMFileMigrationProvider } from "./providers/ESMFileMigrationProvider";

import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator } from "kysely";

export enum MessageTypes {
  PlainText = 0,
  Embed = 1,
  ComponentsV2 = 2,
}

export interface Plugin {
  name: string;
  dependencies?: Array<string>;
  requiredIntents?: GatewayIntentBits[];
  migrationsPath: string;
  initialize(core: GrotCore): void;
}

export enum ActionTypes {
  SlashCommand = "slash",
  PrefixCommand = "prefix",
  Button = "button",
  SelectMenu = "selectMenu",
  Modal = "modal",
}

export interface RunOptions {
  clientId: string;
  guildId: string;
  token: string;
}

export type SlashCommandActionData = {
  type: ActionTypes.SlashCommand;
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
};

export type PrefixCommandActionData = {
  type: ActionTypes.PrefixCommand;
  execute: (message: Message, ...params: any[]) => Promise<void> | void;
};

export type ButtonActionData = {
  type: ActionTypes.Button;
  name: string;
  view: (buttonBuilder: ButtonBuilder) => ButtonBuilder;
  execute: (interaction: ButtonInteraction) => Promise<void> | void;
};

export type SelectMenuActionData = {
  type: ActionTypes.SelectMenu;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void> | void;
};

export type ModalActionData = {
  type: ActionTypes.Modal;
  execute: (interaction: ModalSubmitInteraction) => Promise<void> | void;
};

type ActionTypeMap = {
  [ActionTypes.SlashCommand]: SlashCommandActionData;
  [ActionTypes.PrefixCommand]: PrefixCommandActionData;
  [ActionTypes.Button]: ButtonActionData;
  [ActionTypes.SelectMenu]: SelectMenuActionData;
  [ActionTypes.Modal]: ModalActionData;
};

export type ActionData =
  | SlashCommandActionData
  | PrefixCommandActionData
  | ButtonActionData
  | SelectMenuActionData
  | ModalActionData;

type ActionRegistry = {
  buttons: Collection<string, ButtonActionData>;
  selects: Collection<string, SelectMenuActionData>;
  modals: Collection<string, ModalActionData>;
  commands: {
    slash: Collection<string, SlashCommandActionData>;
    prefix: Collection<string, PrefixCommandActionData>;
  };
};

export type GrotOptions = {
  intents: GatewayIntentBits[];
};

export enum DatabaseType {
  SQLITE = 1,
}

export class GrotCore {
  private plugins: Array<Plugin>;
  private client: Client;
  private intents: Set<GatewayIntentBits>;
  private database: Kysely<any>;

  private actionRegistry: ActionRegistry;

  public constructor(options?: GrotOptions) {
    this.plugins = new Array<Plugin>();
    this.intents = new Set<GatewayIntentBits>(options?.intents);

    this.actionRegistry = {
      commands: {
        slash: new Collection<string, SlashCommandActionData>(),
        prefix: new Collection<string, PrefixCommandActionData>(),
      },
      buttons: new Collection<string, ButtonActionData>(),
      selects: new Collection<string, SelectMenuActionData>(),
      modals: new Collection<string, ModalActionData>(),
    };
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

  public registerInteraction<T extends ActionData>(interaction: T) {
    switch (interaction.type) {
      case ActionTypes.SlashCommand:
        this.actionRegistry.commands.slash.set(
          interaction.data.name,
          interaction,
        );
        break;
      case ActionTypes.PrefixCommand:
        console.log("You are trying to register slash command");
        break;
      case ActionTypes.Button:
        this.actionRegistry.buttons.set(interaction.name, interaction);
        break;
      case ActionTypes.SelectMenu:
        console.log("You are trying to register SelectMenu");
        break;
      case ActionTypes.Modal:
        console.log("You are trying to register Modal");
        break;
    }
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
    const slashRegistry = this.actionRegistry.commands.slash;
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

  private get registryMap(): {
    [K in keyof ActionTypeMap]: Collection<string, ActionTypeMap[K]>;
  } {
    return {
      [ActionTypes.Button]: this.actionRegistry.buttons,
      [ActionTypes.SlashCommand]: this.actionRegistry.commands.slash,
      [ActionTypes.PrefixCommand]: this.actionRegistry.commands.prefix,
      [ActionTypes.SelectMenu]: this.actionRegistry.selects,
      [ActionTypes.Modal]: this.actionRegistry.modals,
    };
  }

  getAction<T extends ActionTypes>(
    type: T,
    name: string,
  ): ActionTypeMap[T] | undefined {
    return this.registryMap[type]?.get(name);
  }

  public setupInteractionHandler() {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      try {
        if (interaction.isButton()) {
          const [name] = interaction.customId.split("$");
          const action = this.getAction(ActionTypes.Button, name);
          action?.execute(interaction);
          return;
        }

        if (interaction.isChatInputCommand()) {
          const name = interaction.commandName;
          const action = this.getAction(ActionTypes.SlashCommand, name);
          action?.execute(interaction);
          return;
        }

        if (interaction.isStringSelectMenu()) {
          const [name] = interaction.customId.split("$");
          const action = this.getAction(ActionTypes.SelectMenu, name);
          action?.execute(interaction);
          return;
        }
      } catch (error) {
        console.error("There was an error", error);
      }
    });
  }

  public run(options?: RunOptions) {
    this.client = new Client({
      intents: Array.from(this.intents),
    });

    console.log("Initializing plugins");
    for (const plugin of this.plugins) {
      const migrator = new Migrator({
        db: this.database,
        migrationTableName: `__migrations_${plugin.name}`,
        provider: new ESMFileMigrationProvider(plugin.migrationsPath),
      });
      console.log(`Running migrations for plugin: ${plugin.name}`);
      const migrationResult = await migrator.migrateUp();
      console.log(migrationResult);
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
