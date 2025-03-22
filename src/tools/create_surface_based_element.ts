import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSurfaceBasedElementTool(server: McpServer) {
  server.tool(
    "create_surface_based_element",
    "Create a surface-based element in Revit such as floors, ceilings, or roofs. Requires a family type ID, boundary points, and a level ID.All units are in millimeters (mm).",
    {
      familyTypeId: z.string().describe("The ID of the family type to create"),
      boundaryPoints: z
        .array(
          z.object({
            x: z.number().describe("X coordinate"),
            y: z.number().describe("Y coordinate"),
            z: z.number().optional().describe("Z coordinate (optional)"),
          })
        )
        .min(3)
        .describe(
          "The boundary points defining the perimeter of the surface (minimum 3 points)"
        ),
      levelId: z.string().describe("The ID of the level for the element"),
      structural: z
        .boolean()
        .optional()
        .describe("Whether the element is structural (for structural floors)"),
      slope: z
        .number()
        .optional()
        .describe("Slope angle in degrees (for sloped floors or roofs)"),
      height: z.number().optional().describe("Height offset from the level"),
    },
    async (args, extra) => {
      const params = {
        familyTypeId: args.familyTypeId,
        boundaryPoints: args.boundaryPoints.map((point) => ({
          x: point.x,
          y: point.y,
          z: point.z || 0,
        })),
        levelId: args.levelId,
        structural: args.structural || false,
        slope: args.slope || 0,
        height: args.height || 0,
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand(
            "create_surface_based_element",
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
              text: `Create surface-based element failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        };
      }
    }
  );
}
