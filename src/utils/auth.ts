import crypto from "crypto";
import { z } from "zod";

// Authentication configuration schema
export const AuthConfigSchema = z.object({
  apiKey: z.string().min(32).describe("API key for authentication"),
  allowedClients: z.array(z.string()).optional().describe("List of allowed client IDs"),
  rateLimit: z.object({
    maxRequests: z.number().default(100),
    windowMs: z.number().default(60000) // 1 minute
  }).optional()
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

// In-memory rate limiting store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export class AuthManager {
  private apiKey: string;
  private allowedClients: Set<string>;
  private rateLimit: { maxRequests: number; windowMs: number };

  constructor(config: AuthConfig) {
    this.apiKey = config.apiKey;
    this.allowedClients = new Set(config.allowedClients || []);
    this.rateLimit = config.rateLimit || { maxRequests: 100, windowMs: 60000 };
  }

  /**
   * Validate API key
   */
  validateApiKey(providedKey: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(this.apiKey),
      Buffer.from(providedKey)
    );
  }

  /**
   * Validate client ID if client restrictions are enabled
   */
  validateClient(clientId?: string): boolean {
    if (this.allowedClients.size === 0) {
      return true; // No client restrictions
    }
    return clientId ? this.allowedClients.has(clientId) : false;
  }

  /**
   * Check rate limit for a client
   */
  checkRateLimit(clientId: string): { allowed: boolean; remainingRequests?: number } {
    const now = Date.now();
    const clientData = rateLimitStore.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // Reset rate limit window
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + this.rateLimit.windowMs
      });
      return { allowed: true, remainingRequests: this.rateLimit.maxRequests - 1 };
    }

    if (clientData.count >= this.rateLimit.maxRequests) {
      return { allowed: false };
    }

    clientData.count++;
    return { 
      allowed: true, 
      remainingRequests: this.rateLimit.maxRequests - clientData.count 
    };
  }

  /**
   * Generate a new API key
   */
  static generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash sensitive data for logging
   */
  static hashForLogging(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  }
}

// Middleware for authentication
export function createAuthMiddleware(authManager: AuthManager) {
  return async (args: any, extra: any) => {
    const apiKey = args.apiKey || extra.apiKey;
    const clientId = args.clientId || extra.clientId || 'default';

    // Validate API key
    if (!apiKey || !authManager.validateApiKey(apiKey)) {
      throw new Error('Invalid API key');
    }

    // Validate client
    if (!authManager.validateClient(clientId)) {
      throw new Error('Unauthorized client');
    }

    // Check rate limit
    const rateLimitCheck = authManager.checkRateLimit(clientId);
    if (!rateLimitCheck.allowed) {
      throw new Error('Rate limit exceeded');
    }

    // Log access (hash sensitive data)
    console.log(`API Access: Client ${clientId}, Key hash: ${AuthManager.hashForLogging(apiKey)}, Remaining requests: ${rateLimitCheck.remainingRequests}`);

    return { authenticated: true, clientId, remainingRequests: rateLimitCheck.remainingRequests };
  };
}