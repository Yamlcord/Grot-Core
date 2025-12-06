import { Client, GatewayIntentBits } from "discord.js";

export interface Plugin {
  name: string;
  dependencies?: Array<string>;
  requiredIntents?: GatewayIntentBits[];
  initialize(core: GrotCore): void;
}

export class GrotCore {
  private plugins: Array<Plugin>;
  private client: Client;
  private intents: Set<GatewayIntentBits>;

  public constructor() {
    this.plugins = new Array<Plugin>();
    this.intents = new Set<GatewayIntentBits>();
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

  public run() {
    this.client = new Client({
      intents: Array.from(this.intents),
    });

    this.plugins.forEach((plugin) => {
      plugin.initialize(this);
      console.log(`Plugin ${plugin.name} initialized`);
    });

    this.client.login(process.env.DISCORD_TOKEN);
  }
}
