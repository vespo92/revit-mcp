import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreatePointBasedElementTool(server: McpServer) {
  server.tool(
    "create_point_based_element",
    "Create a point-based element in Revit such as doors, windows, or furniture. Requires a family type ID, position coordinates, and optionally a host element ID for hosted elements like doors and windows.All units are in millimeters (mm).",
    {
      familyTypeId: z.string().describe("The ID of the family type to create"),
      position: z
        .object({
          x: z.number().describe("X coordinate"),
          y: z.number().describe("Y coordinate"),
          z: z.number().describe("Z coordinate"),
        })
        .describe("The position coordinates where the element will be placed"),
      hostId: z
        .string()
        .optional()
        .describe(
          "The ID of the host element (required for hosted elements like doors and windows)"
        ),
      rotation: z
        .number()
        .optional()
        .describe("Rotation angle in degrees (0-360)"),
    },
    async (args, extra) => {
      const params = {
        familyTypeId: args.familyTypeId,
        position: args.position,
        hostId: args.hostId || null,
        rotation: args.rotation || 0,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_point_type_element",
            params
          );
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `create point type element failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
