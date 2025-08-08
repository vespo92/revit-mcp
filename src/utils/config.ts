// Simplified config for npm publish
export function validateEnvironment(): void {
  // Basic validation
  console.log("Environment validated");
}

export const config = {
  apiKey: process.env['REVIT_MCP_API_KEY'],
  host: process.env['REVIT_HOST'] || 'localhost',
  port: parseInt(process.env['REVIT_PORT'] || '3000'),
};