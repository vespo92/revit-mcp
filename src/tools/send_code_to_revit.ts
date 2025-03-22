import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RevitClientConnection } from "../RevitClientConnection.js";

export function registerSendCodeToRevitTool(server: McpServer) {
  server.tool(
    "send_code_to_revit",
    "Send code to Revit for execution",
    {
      code: z.string().describe("The code to send to Revit"),
      parameters: z
        .array(z.any())
        .optional()
        .describe("Execution parameters (array of objects)"),
    },
    async (args, extra) => {
      const params = { code: args.code, parameters: args.parameters };
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
            reject(new Error("连接到Revit客户端失败"));
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
          "sendCodeToRevit",
          params
        );

        return {
          content: [
            {
              type: "text",
              text: `代码执行成功！\n结果: ${response.result}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: "Failed to send code to Revit",
            },
          ],
        };
      } finally {
        revitClient.disconnect();
      }
    }
  );
}
