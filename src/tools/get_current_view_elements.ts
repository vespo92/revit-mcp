import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RevitClientConnection } from "../RevitClientConnection.js";

export function registerGetCurrentViewElementsTool(server: McpServer) {
  server.tool(
    "get_current_view_elements",
    "Get elements from the current active view in Revit. You can filter by model categories (like Walls, Floors) or annotation categories (like Dimensions, Text). Use includeHidden to show/hide invisible elements and limit to control the number of returned elements.",
    {
      modelCategoryList: z
        .array(z.string())
        .optional()
        .describe(
          "List of Revit model category names (e.g., 'OST_Walls', 'OST_Doors', 'OST_Floors')"
        ),
      annotationCategoryList: z
        .array(z.string())
        .optional()
        .describe(
          "List of Revit annotation category names (e.g., 'OST_Dimensions', 'OST_WallTags', 'OST_TextNotes')"
        ),
      includeHidden: z
        .boolean()
        .optional()
        .describe("Whether to include hidden elements in the results"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of elements to return"),
    },
    async (args, extra) => {
      const params = {
        modelCategoryList: args.modelCategoryList || [],
        annotationCategoryList: args.annotationCategoryList || [],
        includeHidden: args.includeHidden || false,
        limit: args.limit || 100,
      };
      const revitClient = new RevitClientConnection("localhost", 8080);

      try {
        await new Promise<void>((resolve, reject) => {
          if (revitClient.isConnected) {
            resolve();
            return;
          }

          const onConnect = () => {
            revitClient.socket.removeListener("connect", onConnect);
            revitClient.socket.removeListener("error", onError);
            resolve();
          };
          const onError = (error: any) => {
            revitClient.socket.removeListener("connect", onConnect);
            revitClient.socket.removeListener("error", onError);
            reject(new Error("connect to revit client failed"));
          };

          revitClient.socket.on("connect", onConnect);
          revitClient.socket.on("error", onError);

          revitClient.connect();

          setTimeout(() => {
            revitClient.socket.removeListener("connect", onConnect);
            revitClient.socket.removeListener("error", onError);
            reject(new Error("连接到Revit客户端失败"));
          }, 5000);
        });

        const response = await revitClient.sendCommand(
          "get_current_view_elements",
          params
        );

        return {
          content: [
            {
              type: "text",
              text: `获取当前视图元素成功！\n元素数量: ${
                response.elements?.length || 0
              }`,
            },
            {
              type: "text",
              text: JSON.stringify(response.elements, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `获取当前视图元素失败: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      } finally {
        revitClient.disconnect();
      }
    }
  );
}
