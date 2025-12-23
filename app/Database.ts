import { Kysely, Migrator, SqliteDialect } from "kysely";
import SQLite from "better-sqlite3";
import { ESMFileMigrationProvider } from "./providers/ESMFileMigrationProvider";
import { DatabaseType } from "./types";

export class Database {
  private db?: Kysely<any>;

  public init(database: DatabaseType = DatabaseType.SQLITE, filename = "default.db") {
    switch (database) {
      case DatabaseType.SQLITE:
        this.db = new Kysely<any>({
          dialect: new SqliteDialect({
            database: new SQLite(filename),
          }),
        });

        break;
    }
  }

  public getDatabase<T>(): Kysely<T> {
    if (!this.db)
      throw new Error("Database not initialized");
    return this.db as Kysely<T>;
  }

  public async migrate(name?: string, migration?: string) {
    if (!this.db) return

    const migrator = new Migrator({
      db: this.db,
      migrationTableName: `__migrations_${name || 'default'}`,
      provider: new ESMFileMigrationProvider(migration || './migrations'),
    });

    await migrator.migrateToLatest();
  }
}
