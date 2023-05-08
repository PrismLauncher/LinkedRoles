import crypto from 'crypto';
import { request } from 'gaxios';
import * as storage from './storage.js';

/**
 * Code specific to communicating with the Github API.
 */

export interface OAuthTokens {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
  user_id: string;
}

export interface WebhookBody {
  collectionType: string; // body
  date: string; // 2022-11-18
  ownerId: string; // 29H3VW
  ownerType: string; // user
  subscriptionId: string; // 940311281653645353
}

export interface ProfileData {
  user: {
    aboutMe: string;
    iscoder: string;
  };
}

/**
 * The following methods all facilitate OAuth2 communication with Github.
 * See https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
 * for more details.
 */

/**
 * Generate a url which users will use to approve the current bot for access to
 * their Github account, along with the set of required scopes.
 */
export function getOAuthUrl() {
  const state = crypto.randomBytes(20).toString('hex');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', process.env.GITHUB_REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set(
    'scope',
    'read:user'
  );
  return { state, url: url.toString() };
}

/**
 * Given an OAuth2 code from the scope approval page, make a request to Github's
 * OAuth2 service to retreive an access token, refresh token, and expiration.
 */
export async function getOAuthTokens(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
  });
  const r = await request<OAuthTokens>({
    url: 'https://github.com/login/oauth/access_token',
    body: body.toString(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return r.data;
}

// ################################################################
// CODE BELOW THIS POINT NEEDS TO BE CHANGED TO WORK WITH GITHUB
// ################################################################


/**
 * The initial token request comes with both an access token and a refresh
 * token.  Check if the access token has expired, and if it has, use the
 * refresh token to acquire a new, fresh access token.
 *
 * See https://dev.fitbit.com/build/reference/web-api/authorization/refresh-token/.
 */
async function getAccessToken(userId: string, data: storage.GithubData) {
  if (Date.now() > data.expires_at) {
    console.log('token expired, fetching a new one');
    const url = 'https://github.com/login/oauth/access_token';
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
    });
    const authCode = Buffer.from(
      `${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`
    ).toString('base64');
    const r = await request<OAuthTokens>({
      url,
      body,
      method: 'POST',
      headers: {
        Authorization: `Basic ${authCode}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const tokens = r.data;
    console.log(`new access token: ${tokens.access_token}`);
    data.access_token = tokens.access_token;
    data.expires_at = Date.now() + tokens.expires_in * 1000;
    await storage.storeGithubTokens(userId, data);
    return tokens.access_token;
  }
  return data.access_token;
}

/**
 * Revoke the given user's Github refresh token.
 * See https://dev.fitbit.com/build/reference/web-api/authorization/revoke-token.
 * @param userId The Github User ID
 */
export async function revokeAccess(userId: string) {
  const url = 'https://api.fitbit.com/oauth2/revoke';

  // Revoke the refresh token. It would appear that revoking the refresh token
  // also revokes all associated access tokens for this implementation of the
  // OAuth2 API.
  try {
    const tokens = await storage.getGithubTokens(userId);
    const accessToken = await getAccessToken(userId, tokens);

    await request({
      url,
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID,
        token: tokens.refresh_token,
      }),
      headers: {
        authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch (e) {
    // if revoking the token fails, remove the tokens from our storage and
    // move on.
    console.error(e);
  }

  // remove the tokens from storage
  await storage.deleteGithubTokens(userId);
}

/*
 * Each user registration requires the setup of a single subscription which
 * enables webhook delivery for that user.
 * See https://dev.fitbit.com/build/reference/web-api/subscription/create-subscription/.
 */
export async function createSubscription(
  userId: string,
  data: storage.GithubData
) {
  // POST /1/user/[user-id]/[collection-path]/apiSubscriptions/[subscription-id].json
  const url = `https://api.fitbit.com/1/user/-/apiSubscriptions/${data.discord_user_id}.json`;
  const token = await getAccessToken(userId, data);
  await request({
    url,
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

/**
 * List all available subscriptions for the given user.
 */
export async function listSubscriptions(
  userId: string,
  data: storage.GithubData
) {
  // GET /1/user/[user-id]/[collection-path]/apiSubscriptions.json
  const url = 'https://api.fitbit.com/1/user/-/apiSubscriptions.json';
  const token = await getAccessToken(userId, data);
  const res = await request({
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
}

/**
 * Fetch the user profile for the current user.
 */
export async function getProfile(userId: string, data: storage.GithubData) {
  // /1/user/[user-id]/profile.json
  const url = `https://api.fitbit.com/1/user/-/profile.json`;
  const token = await getAccessToken(userId, data);
  const res = await request<ProfileData>({
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.data;
}