// Simplified error handling for npm publish
export class RevitMCPError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'RevitMCPError';
  }
}

export class ConnectionError extends RevitMCPError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
  }
}

export class ValidationError extends RevitMCPError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}