import type { OAuthClientRow } from "./types";

export interface IOAuthClientsRepository {
  create(clientId: string, clientName: string | null, redirectUris: string[]): Promise<OAuthClientRow>;
  findById(clientId: string): Promise<OAuthClientRow | null>;
}

export class OAuthClientsRepository implements IOAuthClientsRepository {
  constructor(private readonly db: D1Database) {}

  async create(clientId: string, clientName: string | null, redirectUris: string[]): Promise<OAuthClientRow> {
    const row = await this.db
      .prepare(
        `INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
         VALUES (?, ?, ?)
         RETURNING client_id, client_name, redirect_uris, created_at`
      )
      .bind(clientId, clientName, JSON.stringify(redirectUris))
      .first<OAuthClientRow>();
    return row!;
  }

  async findById(clientId: string): Promise<OAuthClientRow | null> {
    const row = await this.db
      .prepare("SELECT client_id, client_name, redirect_uris, created_at FROM oauth_clients WHERE client_id = ?")
      .bind(clientId)
      .first<OAuthClientRow>();
    return row ?? null;
  }
}
