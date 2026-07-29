import * as SecureStore from 'expo-secure-store';

/**
 * Clerk token cache backed by SecureStore. Tracks every key it has seen so
 * the local session can be wiped completely when it becomes invalid
 * (e.g. a stale session from an older build causing "Session already exists").
 */
const seenKeys = new Set<string>(['__clerk_client_jwt']);

export const tokenCache = {
  async getToken(key: string) {
    seenKeys.add(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    seenKeys.add(key);
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
};

/** Delete every cached Clerk token from SecureStore. */
export async function clearClerkTokenCache() {
  for (const key of seenKeys) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  }
}
