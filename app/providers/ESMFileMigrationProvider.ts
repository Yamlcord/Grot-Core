// migrationProvider.ts
import path from "node:path";
import { promises as fs } from "node:fs";
import { pathToFileURL } from "node:url";
import { Migration, MigrationProvider } from "kysely";

export class ESMFileMigrationProvider implements MigrationProvider {
  private migrationsFolder: string;
  public constructor(migrationsFolder: string) {
    this.migrationsFolder = migrationsFolder;
  }
  async getMigrations(): Promise<Record<string, Migration>> {
    const files = await fs.readdir(this.migrationsFolder);
    const migrations: Record<string, any> = {};

    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const fullPath = path.join(this.migrationsFolder, file);
      const url = pathToFileURL(fullPath).href;
      migrations[file] = await import(url);
    }

    return migrations;
  }
}
