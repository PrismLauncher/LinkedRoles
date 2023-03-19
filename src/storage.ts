import { Pool } from 'pg';

/**
 * OAuth2 inherently requires storing access tokens, refresh tokens, and
 * expiration times to ensure the bot service can continue to make 
 * authenticated calls to Discord on behalf of a given user.
 */

export interface StorageProvider {
  setData(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  getData<T>(key: string): Promise<T>;
  deleteData(key: string): Promise<void>;
}

export interface DiscordData {
  access_token: string;
  expires_at: number;
  refresh_token: string;
}

export interface GithubData {
  code_verifier: string;
  access_token: string;
  expires_at: number;
  refresh_token: string;
  discord_user_id: string;
}

interface StateData {
  codeVerifier: string;
  discordUserId: string;
}

export async function storeDiscordTokens(userId: string, data: DiscordData) {
  await client.setData(`discord-${userId}`, data);
}

export async function getDiscordTokens(userId: string) {
  const data = await client.getData<DiscordData>(`discord-${userId}`);
  return data;
}

export async function storeGithubTokens(userId: string, data: GithubData) {
  await client.setData(`github-${userId}`, data);
}

export async function getGithubTokens(userId: string) {
  const data = await client.getData<GithubData>(`github-${userId}`);
  return data;
}

export async function storeStateData(state: string, data: StateData) {
  await client.setData(`state-${state}`, data, 60);
}

export async function getStateData(state: string) {
  const data = await client.getData<StateData>(`state-${state}`);
  return data;
}

export async function deleteDiscordTokens(userId: string) {
  await client.deleteData(`discord-${userId}`);
}

export async function deleteGithubTokens(userId: string) {
  await client.deleteData(`github-${userId}`);
}

export async function getLinkedGithubUserId(discordUserId: string) {
  const data = await client.getData<string>(`discord-link-${discordUserId}`);
  return data;
}

export async function setLinkedGithubUserId(
  discordUserId: string,
  githubUserId: string
) {
  await client.setData(`discord-link-${discordUserId}`, githubUserId);
}

export async function deleteLinkedGithubUser(discordUserId: string) {
  await client.deleteData(`discord-link-${discordUserId}`);
}

/**
 * Postgres storage provider.
 */
export class PostgresClient implements StorageProvider {
  async getClient() {
    const pool = new Pool({
      user: 'me',
      host: 'localhost',
      database: 'api',
      password: 'password',
      port: 5432,
    });
  }

  async setData(key: string, data: unknown, ttlSeconds?: number) {
    const client = await this.getClient();
    const options = ttlSeconds ? { EX: ttlSeconds } : undefined;
    await client.set(key, JSON.stringify(data), options);
  }

  async getData<T>(key: string) {
    const client = await this.getClient();
    const data = await client.get(key);
    return JSON.parse(data) as T;
  }

  async deleteData(key: string) {
    const client = await this.getClient();
    await client.del(key);
  }
}

let client: StorageProvider;
if (process.env.DATABASE_TYPE === 'postgres') {
  client = new PostgresClient();
}