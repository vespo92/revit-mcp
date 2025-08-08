// Simplified shutdown handler for npm publish
export function setupGracefulShutdown(server: any): void {
  process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
  });
}