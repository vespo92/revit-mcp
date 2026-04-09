export function validateEnvironment(): void {
  const host = process.env['REVIT_HOST'] || 'localhost';
  const port = parseInt(process.env['REVIT_PORT'] || '60100');

  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid REVIT_PORT: ${process.env['REVIT_PORT']}`);
  }

  console.error(`[revit-mcp] Configured for ${host}:${port}`);
}

export const config = {
  apiKey: process.env['REVIT_MCP_API_KEY'],
  host: process.env['REVIT_HOST'] || 'localhost',
  port: parseInt(process.env['REVIT_PORT'] || '60100'),
  logLevel: process.env['LOG_LEVEL'] || 'info',
};
