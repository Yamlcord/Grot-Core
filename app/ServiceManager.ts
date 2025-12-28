import { Collection } from "discord.js";
import { BaseService } from "./types";

export class ServiceManager {
  services: Collection<string, BaseService>;

  public constructor() {
    this.services = new Collection();
  }

  public provide<T extends BaseService>(name: string, service: T) {
    this.services.set(name, service);
  }

  public getService(key: string) {
    return this.services.get(key);
  }
}
