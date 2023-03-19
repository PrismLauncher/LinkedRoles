import * as storage from './storage';
import * as github from './github';
import * as discord from './discord';

/**
 * Shared utility function. For a given Github UserId, fetch profile metadata,
 * transform it, and push it to the Discord metadata endpoint.
 */
export async function updateMetadata(userId: string) {
  const githubTokens = await storage.getGithubTokens(userId);
  const discordTokens = await storage.getDiscordTokens(
    githubTokens.discord_user_id
  );

  // Fetch the user profile data from Github
  let metadata: Record<string, string>;
  try {
    const profile = await github.getProfile(userId, githubTokens);
    // Transform the data from the profile, and grab only the bits of data used by Discord.
    metadata = {
      ispackager: profile.user.isPackager,
      iscoder: profile.user.isCoder,
      isdocumentation: profile.user.isDocumentation,
      istranslator: profile.user.isTranslator,
    };
  } catch (e) {
    e.message = `Error fetching Github profile data: ${e.message}`;
    console.error(e);
    // If fetching the profile data for the Github user fails for any reason,
    // ensure metadata on the Discord side is nulled out. This prevents cases
    // where the user revokes the Github app permissions, and is left with
    // stale verified role data.
    metadata = {
        ispackager: undefined,
        iscoder: undefined,
        isdocumentation: undefined,
        istranslator: undefined,
    };
  }

  // Push the data to Discord.
  await discord.pushMetadata(userId, discordTokens, metadata);
}