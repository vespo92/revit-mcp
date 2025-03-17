import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeleteObjectTool(server: McpServer) {
  server.tool(
    "deleteObject",
    "delete revit object",
    {
      objectId: z.string().describe("object id"),
    },
    async (args, extra) => {
      console.log("deleteObject", args);
      return {
        content: [{ type: "text", text: "delete object success" }],
      };
    }
  );
}
