import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateObjectTool } from "./createObject.js";

export function registerAllTools(server: McpServer) {
  registerCreateObjectTool(server);
}
