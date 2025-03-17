import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateObjectTool } from "./createObject.js";
import { registerDeleteObjectTool } from "./deleteObject.js";
import { registerCreateWallTool } from "./createWall.js";

export function registerAllTools(server: McpServer) {
  // registerCreateObjectTool(server);
  registerCreateWallTool(server);
  registerDeleteObjectTool(server);
}
