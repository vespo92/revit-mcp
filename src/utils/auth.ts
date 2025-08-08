// Simplified auth for npm publish
export function validateApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  return apiKey.length >= 32;
}

export const rateLimiter = {
  checkLimit: () => true,
  reset: () => {},
};