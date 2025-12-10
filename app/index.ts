import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  GatewayIntentBits,
  Message,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";

export enum MessageTypes {
  PlainText = 0,
  Embed = 1,
  ComponentsV2 = 2,
}

export interface Plugin {
  name: string;
  dependencies?: Array<string>;
  requiredIntents?: GatewayIntentBits[];
  initialize(core: GrotCore): void;
}

export enum ActionTypes {
  SlashCommand = 0,
  PrefixCommand = 1,
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

export type ButtonActionData = {};
export type SelectMenuActionData = {};
export type ModalActionData = {};

export type ActionData = SlashCommandActionData | PrefixCommandActionData;
// | ButtonActionData
// | SelectMenuActionData
// | ModalActionData;

export class GrotCore {
  private plugins: Array<Plugin>;
  private client: Client;
  private intents: Set<GatewayIntentBits>;

  private actionRegistry: {
    commands: {
      slash: Collection<string, SlashCommandActionData>;
      prefix: Collection<string, PrefixCommandActionData>;
    };
    buttons: Collection<string, ButtonActionData>;
  };

  public constructor() {
    this.plugins = new Array<Plugin>();
    this.intents = new Set<GatewayIntentBits>();

    this.actionRegistry = {
      commands: {
        slash: new Collection<string, SlashCommandActionData>(),
        prefix: new Collection<string, PrefixCommandActionData>(),
      },
      buttons: new Collection<string, ButtonActionData>(),
    };
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
    console.log(`Plugin loaded: ${plugin.name}`);
  }

  public getClient() {
    return this.client;
  }

  private async deployCommands() {
    const slashRegistry = this.actionRegistry.commands.slash;
    const slashCommands = Array.from(slashRegistry.values()).map((slash) =>
      slash.data.toJSON(),
    );

    console.log(
      `Started refreshing ${slashCommands.length} application (/) commands.`,
    );

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.BOT_ID!,
        process.env.GUILD_ID!,
      ),
      { body: slashCommands },
    );

    console.log(`Successfully reloaded application (/) commands.`);
  }

  public run() {
    this.client = new Client({
      intents: Array.from(this.intents),
    });

    console.log("Initializing plugins");
    this.plugins.forEach((plugin) => {
      plugin.initialize(this);
    });

    console.log(`Command registration`);
    this.deployCommands();

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
