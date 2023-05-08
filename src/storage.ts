import { createClient, RedisClientType } from 'redis';

/**
 * OAuth2 inherently requires storing access tokens, refresh tokens, and
 * expiration times to ensure the bot service can continue to make 
 * authenticated calls to Github and Discord on behalf of a given user.
 */

/**
 * Shared interface for both storage providers.
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
  access_token: string;
  expires_at: number;
  refresh_token: string;
  discord_user_id: string;
}

interface StateData {
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
 * Redis storage provider.  Very nice when developing locally with Redis.
 */
export class RedisClient implements StorageProvider {
  private _client: RedisClientType;

  async getClient() {
    if (!this._client) {
      this._client = createClient({ url: process.env.DATABASE_URL });
      this._client.on('error', (err) => {
        console.log('Redis Client Error', err);
      });
      await this._client.connect();
      return this._client;
    }
    if (!this._client.isOpen) {
      await this._client.connect();
    }
    return this._client;
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
if (process.env.DATABASE_TYPE === 'redis') {
  client = new RedisClient();
}