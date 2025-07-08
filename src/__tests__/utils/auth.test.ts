import { AuthManager, AuthConfig, createAuthMiddleware } from '../../utils/auth';

describe('AuthManager', () => {
  let authConfig: AuthConfig;
  let authManager: AuthManager;

  beforeEach(() => {
    authConfig = {
      apiKey: 'test-api-key-that-is-at-least-32-characters-long',
      allowedClients: ['client1', 'client2'],
      rateLimit: {
        maxRequests: 5,
        windowMs: 1000 // 1 second for testing
      }
    };
    authManager = new AuthManager(authConfig);
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', () => {
      expect(authManager.validateApiKey(authConfig.apiKey)).toBe(true);
    });

    it('should reject incorrect API key', () => {
      expect(authManager.validateApiKey('wrong-key')).toBe(false);
    });
  });

  describe('validateClient', () => {
    it('should validate allowed clients', () => {
      expect(authManager.validateClient('client1')).toBe(true);
      expect(authManager.validateClient('client2')).toBe(true);
    });

    it('should reject unauthorized clients', () => {
      expect(authManager.validateClient('client3')).toBe(false);
    });

    it('should allow any client when no restrictions are set', () => {
      const openAuthManager = new AuthManager({
        apiKey: authConfig.apiKey
      });
      expect(openAuthManager.validateClient('any-client')).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = authManager.checkRateLimit('test-client');
        expect(result.allowed).toBe(true);
        expect(result.remainingRequests).toBe(4 - i);
      }
    });

    it('should reject requests exceeding rate limit', () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        authManager.checkRateLimit('test-client');
      }

      // Next request should be rejected
      const result = authManager.checkRateLimit('test-client');
      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBeUndefined();
    });

    it('should reset rate limit after window expires', async () => {
      // Fill up the rate limit
      for (let i = 0; i < 5; i++) {
        authManager.checkRateLimit('test-client');
      }

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should allow requests again
      const result = authManager.checkRateLimit('test-client');
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });
  });

  describe('generateApiKey', () => {
    it('should generate a 64-character hex string', () => {
      const apiKey = AuthManager.generateApiKey();
      expect(apiKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique keys', () => {
      const keys = new Set();
      for (let i = 0; i < 100; i++) {
        keys.add(AuthManager.generateApiKey());
      }
      expect(keys.size).toBe(100);
    });
  });

  describe('hashForLogging', () => {
    it('should return 8-character hash', () => {
      const hash = AuthManager.hashForLogging('test-data');
      expect(hash).toHaveLength(8);
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should produce consistent hashes', () => {
      const data = 'test-data';
      const hash1 = AuthManager.hashForLogging(data);
      const hash2 = AuthManager.hashForLogging(data);
      expect(hash1).toBe(hash2);
    });
  });
});

describe('createAuthMiddleware', () => {
  let authManager: AuthManager;
  let middleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    authManager = new AuthManager({
      apiKey: 'test-api-key-that-is-at-least-32-characters-long',
      allowedClients: ['client1'],
      rateLimit: {
        maxRequests: 5,
        windowMs: 1000
      }
    });
    middleware = createAuthMiddleware(authManager);
  });

  it('should authenticate valid requests', async () => {
    const result = await middleware(
      { apiKey: 'test-api-key-that-is-at-least-32-characters-long', clientId: 'client1' },
      {}
    );
    expect(result.authenticated).toBe(true);
    expect(result.clientId).toBe('client1');
    expect(result.remainingRequests).toBe(4);
  });

  it('should reject invalid API key', async () => {
    await expect(
      middleware({ apiKey: 'wrong-key', clientId: 'client1' }, {})
    ).rejects.toThrow('Invalid API key');
  });

  it('should reject unauthorized client', async () => {
    await expect(
      middleware(
        { apiKey: 'test-api-key-that-is-at-least-32-characters-long', clientId: 'client2' },
        {}
      )
    ).rejects.toThrow('Unauthorized client');
  });

  it('should enforce rate limits', async () => {
    const args = { apiKey: 'test-api-key-that-is-at-least-32-characters-long', clientId: 'client1' };
    
    // Make 5 requests (the limit)
    for (let i = 0; i < 5; i++) {
      await middleware(args, {});
    }

    // 6th request should fail
    await expect(middleware(args, {})).rejects.toThrow('Rate limit exceeded');
  });
});