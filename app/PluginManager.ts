import { GrotCore } from ".";
import { Plugin } from "./types";

export class PluginManager {
  private plugins: Array<Plugin>;
  private core: GrotCore;

  public constructor(core: GrotCore) {
    this.core = core;
    this.plugins = new Array<Plugin>();
  }

  registerPlugin(plugin: Plugin) {
    const requiredIntents = plugin.requiredIntents;

    for (const requiredIntent of requiredIntents || []) {
      this.core.addIntent(requiredIntent);
    }

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

    console.log(`✅ Plugin loaded: ${plugin.name}`);
    this.plugins.push(plugin);
  }

  migratePlugins() {
    const database = this.core.getDatabaseManager();

    for (const plugin of this.plugins) {
      database.migrate(plugin.name, plugin.migrationsPath);
    }
  }

  initializePlugins() {
    for (const plugin of this.plugins) {
      plugin.initialize(
        this.core,
        this.core.getScopedServiceProvider(plugin.name),
      );
    }
  }
}
