import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";

// create a server instance
const server = new McpServer({
  name: "revit-mcp",
  version: "1.0.0",
});

// register all tools
registerAllTools(server);

// start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Server running...");
}

main().catch((error) => {
  console.error("Error starting server:", error);
  process.exit(1);
});
