import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
} from 'discord-interactions';
import * as storage from './storage.js';
import { DISCONNECT, GET_PROFILE } from './commands';
import * as github from './github';
import * as discord from './discord';
import { updateMetadata } from './common';

/**
 * Main HTTP server used for the bot.
 */

const app = express();
app.use(bodyParser.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/', (req, res) => {
  // Just a happy little route to show our server is up.
  res.send('👋');
});

/**
 * Main entry point for bot slash commands. It uses the `verifyKeyMiddleware`
 * to validate request signatures, and returns relevent slash command data.
 */
app.post(
  '/',
  verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY!),
  async (request, response) => {
    const message = request.body;
    if (message.type === InteractionType.PING) {
      console.log('Handling Ping request');
      response.json({
        type: InteractionResponseType.PONG,
      });
    } else if (message.type === InteractionType.APPLICATION_COMMAND) {
      console.log(`Handling application command: ${message.data.name}`);
      switch (message.data.name.toLowerCase()) {
        /**
         * DISCONNECT
         * Revokes all tokens to both Discord and Github, while clearing out
         * all associated data:
         * 1. Push empty Metadata to Discord to null out the verified role
         * 2. Revoke Discord OAuth2 tokens
         * 3. Fetch the Github UserId using the Discord UserId
         * 4. Revoke Github OAuth2 tokens
         * 5. Let the user know the slash command worked
         */
        case DISCONNECT.name.toLowerCase(): {
          const userId = message.member.user.id;
          let cleanedUp = false;
          const discordTokens = await storage.getDiscordTokens(userId);

          if (discordTokens) {
            cleanedUp = true;

            // 1. Push empty Metadata to Discord to null out the verified role
            await discord.pushMetadata(userId, discordTokens, {});

            // 2. Revoke Discord OAuth2 tokens
            await discord.revokeAccess(userId);
          }

          // 3. Fetch the Github UserId using the Discord UserId
          const githubUserId = await storage.getLinkedGithubUserId(userId);
          if (githubUserId) {
            cleanedUp = true;

            // 4. Revoke Github OAuth2 tokens
            await github.revokeAccess(githubUserId);
            await storage.deleteLinkedGithubUser(userId);
          }

          // 5. Let the user know the slash command worked
          if (cleanedUp) {
            response.send({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: 'Github account disconnected.',
              },
            });
          } else {
            sendNoConnectionFound(response);
          }
          break;
        }
        case GET_PROFILE.name.toLowerCase(): {
          /**
           * GET PROFILE
           * If the user has a linked Github account, fetch the profile data.
           */
          const userId = message.member.user.id;
          const githubUserId = await storage.getLinkedGithubUserId(userId);
          if (!githubUserId) {
            return sendNoConnectionFound(response);
          }

          const githubTokens = await storage.getGithubTokens(githubUserId);
          if (!githubTokens) {
            return sendNoConnectionFound(response);
          }
          const profile = await github.getProfile(githubUserId, githubTokens);
          const metadata = {
            averagedailysteps: profile.user.averageDailySteps,
            ambassador: profile.user.ambassador,
            membersince: profile.user.memberSince,
            iscoach: profile.user.isCoach,
          };
          response.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '```' + JSON.stringify(metadata) + '```',
            },
          });
          break;
        }
        default:
          console.error('Unknown Command');
          response.status(400).send({ error: 'Unknown Type' });
          break;
      }
    } else {
      console.error('Unknown Type');
      response.status(400).send({ error: 'Unknown Type' });
    }
  }
);

/**
 * Route configured in the Discord developer console which facilitates the
 * connection between Discord and Github. To start the flow, generate the OAuth2
 * consent dialog url for Discord, and send the user there.
 */
app.get('/verified-role', async (req, res) => {
  const { url, state } = discord.getOAuthUrl();

  // Store the signed state param in the user's cookies so we can verify
  // the value later. See:
  // https://discord.com/developers/docs/topics/oauth2#state-and-security
  res.cookie('clientState', state, { maxAge: 1000 * 60 * 5, signed: true });

  // Send the user to the Discord owned OAuth2 authorization endpoint
  res.redirect(url);
});

/**
 * Route configured in the Discord developer console, the redirect Url to which
 * the user is sent after approving the bot for their Discord account. This
 * completes a few steps:
 * 1. Uses the code to acquire Discord OAuth2 tokens
 * 2. Uses the Discord Access Token to fetch the user profile
 * 3. Stores the OAuth2 Discord Tokens in Postgres
 * 4. Generates an OAuth2 consent dialog url for Github, and redirects the user.
 */
app.get('/discord-oauth-callback', async (req, res) => {
  try {
    // 1. Uses the code and state to acquire Discord OAuth2 tokens
    const code = req.query['code'] as string;
    const discordState = req.query['state'] as string;

    // make sure the state parameter exists
    const { clientState } = req.signedCookies;
    if (clientState !== discordState) {
      console.error('State verification failed.');
      return res.sendStatus(403);
    }

    const tokens = await discord.getOAuthTokens(code);

    // 2. Uses the Discord Access Token to fetch the user profile
    const meData = await discord.getUserData(tokens);
    const userId = meData.user.id;
    await storage.storeDiscordTokens(userId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    });

    // start the Github OAuth2 flow by generating a new OAuth2 Url
    const { url, codeVerifier, state } = github.getOAuthUrl();

    // store the code verifier and state arguments required by the Github url
    await storage.storeStateData(state, {
      discordUserId: userId,
      codeVerifier,
    });

    // send the user to the Github OAuth2 consent dialog screen
    res.redirect(url);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

/**
 * Route configured in the Github developer console, the redirect Url to which
 * the user is sent after approvingv the bot for their Github account.
 * 1. Use the state in the querystring to fetch the code verifier and challenge
 * 2. Use the code in the querystring to acquire Github OAuth2 tokens
 * 3. Store the Github tokens in Postgres
 * 4. Create a new subscription to ensure webhook events are sent for the current user
 * 5. Fetch Github profile metadata, and push it to the Discord metadata service
 */
app.get('/github-oauth-callback', async (req, res) => {
  try {
    // 1. Use the state in the querystring to fetch the code verifier and challenge
    const state = req.query['state'] as string;
    const { discordUserId, codeVerifier } = await storage.getStateData(state);

    // 2. Use the code in the querystring to acquire Github OAuth2 tokens
    const code = req.query['code'] as string;
    const tokens = await github.getOAuthTokens(code, codeVerifier);

    // 3. Store the Github tokens in Postgres
    const userId = tokens.user_id;
    const data = {
      discord_user_id: discordUserId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
      code_verifier: codeVerifier,
    };
    await storage.storeGithubTokens(userId, data);

    // 4. Create a new subscription to ensure webhook events are sent for the current user
    await github.createSubscription(userId, data);

    // 5. Fetch Github profile metadata, and push it to the Discord metadata service
    await updateMetadata(userId);

    await storage.setLinkedGithubUserId(discordUserId, userId);

    res.send('You did it!  Now go back to Discord.');
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

/**
 * Route configured in the Github developer console, the route where user
 * events are sent. This is used once for url verification by the Github API.
 * Note: this is a `GET`, and the actual webhook is a `POST`
 * Verify subscriber as explained in:
 * https://dev.fitbit.com/build/reference/web-api/developer-guide/using-subscriptions/#Verifying-a-Subscriber
 */
app.get('/github-webhook', async (req, res) => {
  const verify = req.query['verify'] as string;
  console.log(req.url);
  if (verify === process.env.FITBIT_SUBSCRIBER_VERIFY) {
    console.log(`verified: ${verify}`);
    res.sendStatus(204);
  } else {
    res.sendStatus(404);
  }
});

/**
 * Route configured in the Github developer console, the route where user events are sent.
 * Takes a few steps:
 * 1. Fetch the Discord and Github tokens from storage (Postgres)
 * 2. Fetch the user profile data from Github and send it to Discord
 */
app.post('/github-webhook', async (req, res) => {
  try {
    const body = req.body as github.WebhookBody;

    // 1. Fetch the Discord and Github tokens from storage (Postgres)
    const userId = body.ownerId;
    await updateMetadata(userId);

    // 2. Fetch the user profile data from Github, and push it to Discord
    res.sendStatus(204);
  } catch (e) {
    res.sendStatus(500);
  }
});

function sendNoConnectionFound(response) {
  return response.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: `🥴 no Github connection info found.  Visit ${process.env.VERIFICATION_URL} to set it up.`,
    },
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});