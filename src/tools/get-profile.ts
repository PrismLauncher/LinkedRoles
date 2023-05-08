import * as storage from '../storage.js';
import * as github from '../github.js';

/**
 * Fetch the current user profile for github.
 */

const [userId] = process.argv.slice(2);
if (!userId) {
  throw Error('Github UserID required.');
}
const data = await storage.getGithubTokens(userId);
const profile = await github.getProfile(userId, data);
console.log(profile);
