import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateLineBasedElementTool(server: McpServer) {
  server.tool(
    "create_line_based_element",
    "Create a line-based element in Revit such as walls, beams, or pipes. Requires a family type ID, start and end points. All units are in millimeters (mm).",
    {
      familyTypeId: z.string().describe("The ID of the family type to create"),
      startPoint: z
        .object({
          x: z.number().describe("X coordinate of start point"),
          y: z.number().describe("Y coordinate of start point"),
          z: z.number().describe("Z coordinate of start point"),
        })
        .describe("The start point coordinates of the line-based element"),
      endPoint: z
        .object({
          x: z.number().describe("X coordinate of end point"),
          y: z.number().describe("Y coordinate of end point"),
          z: z.number().describe("Z coordinate of end point"),
        })
        .describe("The end point coordinates of the line-based element"),
      structuralUsage: z
        .boolean()
        .optional()
        .describe(
          "Whether the element is structural (for beams, columns, etc.)"
        ),
      width: z
        .number()
        .optional()
        .describe("Width/thickness of the element (e.g., wall thickness)"),
      height: z
        .number()
        .optional()
        .describe("Height of the element (e.g., wall height)"),
    },
    async (args, extra) => {
      const params = {
        familyTypeId: args.familyTypeId,
        startPoint: args.startPoint,
        endPoint: args.endPoint,
        structuralUsage: args.structuralUsage || false,
        width: args.width || 0,
        height: args.height || 0,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_line_based_element",
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
              text: `Create line-based element failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
