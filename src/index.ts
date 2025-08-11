import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerTools } from "./tools/register.js";
import { validateEnvironment } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { setupGracefulShutdown } from "./utils/shutdown.js";

// Validate environment variables on startup
validateEnvironment();

// Create server instance with proper version
const server = new McpServer({
  name: "revit-mcp",
  version: "2.0.0",
});

// Start server with enhanced error handling
async function main(): Promise<void> {
  try {
    // Register all tools
    await registerTools(server);
    logger.info("Tools registered successfully");

    // Connect to transport layer
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    // Setup graceful shutdown handlers
    setupGracefulShutdown(server);
    
    logger.info("Revit MCP Server v2.0.0 started successfully");
  } catch (error) {
    logger.error("Failed to start Revit MCP Server", error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
  process.exit(1);
});

// Start the server
main().catch((error) => {
  logger.error("Fatal error starting Revit MCP Server:", error);
  process.exit(1);
});
