import { updateMetadata } from '../common.js';

/**
 * Fetch the current user profile for Github.
 */

const [userId] = process.argv.slice(2);
if (!userId) {
  throw Error('Github UserID required.');
}
await updateMetadata(userId);

console.log('Metadata pushed!');
