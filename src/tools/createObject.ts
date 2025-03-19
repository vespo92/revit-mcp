import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RevitClientConnection } from "../RevitClientConnection.js";

// 辅助函数：获取类型的中文名称
export function getChineseTypeName(type: string): string {
  const nameMap: Record<string, string> = {
    WALL: "墙体",
    DOOR: "门",
    WINDOW: "窗",
    FLOOR: "楼板",
  };
  return nameMap[type] || type;
}

export function registerCreateObjectTool(server: McpServer) {
  server.tool(
    "create_object",
    "create revit object",
    {
      objectType: z
        .enum(["WALL", "DOOR", "WINDOW", "FLOOR"])
        .describe("建筑元素类型 (WALL-墙, DOOR-门, WINDOW-窗, FLOOR-楼板)"),
      name: z.string().optional().describe("元素名称"),
      location: z
        .array(z.number())
        .length(3)
        .optional()
        .describe("位置坐标 [x, y, z]"),
      // 墙体参数
      length: z
        .number()
        .positive()
        .optional()
        .describe("墙体长度 (适用于 WALL)"),
      height: z
        .number()
        .positive()
        .optional()
        .describe("高度 (适用于 WALL, DOOR, WINDOW)"),
      width: z
        .number()
        .positive()
        .optional()
        .describe("宽度/厚度 (适用于 WALL, FLOOR)"),
      // 门窗参数
      hostWallId: z
        .string()
        .optional()
        .describe("所在墙体ID (适用于 DOOR, WINDOW)"),
      openingWidth: z
        .number()
        .positive()
        .optional()
        .describe("开口宽度 (适用于 DOOR, WINDOW)"),
      sillHeight: z.number().optional().describe("窗台高度 (仅适用于 WINDOW)"),
      // 楼板参数
      thickness: z
        .number()
        .positive()
        .optional()
        .describe("楼板厚度 (适用于 FLOOR)"),
      outline: z
        .array(z.tuple([z.number(), z.number()]))
        .optional()
        .describe("楼板轮廓点坐标数组 [[x1,y1], [x2,y2], ...] (适用于 FLOOR)"),
      level: z.number().optional().describe("楼层标高 (适用于 FLOOR)"),
    },
    async (args, extra) => {
      try {
        // 设置默认位置
        const location = args.location || [0, 0, 0];

        // 基础参数
        const params: Record<string, any> = {
          type: args.objectType,
          location,
        };

        if (args.name) {
          params.name = args.name;
        }

        // 根据不同类型设置特定参数
        switch (args.objectType) {
          case "WALL":
            params.length = args.length || 3.0;
            params.height = args.height || 2.7;
            params.width = args.width || 0.2;
            break;

          case "DOOR":
            params.hostWallId = args.hostWallId;
            params.openingWidth = args.openingWidth || 0.9;
            params.height = args.height || 2.1;

            if (!args.hostWallId) {
              return {
                content: [
                  {
                    type: "text",
                    text: "创建门需要指定所在墙体ID (hostWallId)",
                  },
                ],
                isError: true,
              };
            }
            break;

          case "WINDOW":
            params.hostWallId = args.hostWallId;
            params.openingWidth = args.openingWidth || 1.2;
            params.height = args.height || 1.5;
            params.sillHeight = args.sillHeight || 0.9;

            if (!args.hostWallId) {
              return {
                content: [
                  {
                    type: "text",
                    text: "创建窗需要指定所在墙体ID (hostWallId)",
                  },
                ],
                isError: true,
              };
            }
            break;

          case "FLOOR":
            params.thickness = args.thickness || 0.2;
            params.level = args.level || 0;

            if (args.outline) {
              params.outline = args.outline;
            } else {
              // 默认创建一个矩形楼板
              params.width = args.width || 5.0;
              params.length = args.length || 5.0;
            }
            break;
        }

        // 发送命令到Revit
        const revitClient = new RevitClientConnection("localhost", 8080);
        if (revitClient.connect()) {
          revitClient.sendCommand(JSON.stringify(params));
        } else {
          return {
            content: [{ type: "text", text: "Revit客户端连接失败" }],
            isError: true,
          };
        }
        // const result = await sendCommand("create_object", params);

        return {
          content: [
            {
              type: "text",
              text: `已创建${getChineseTypeName(args.objectType)}：${
                args.name || "未命名" + args.objectType
              }，参数：${JSON.stringify(params)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `创建对象时出错：${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
