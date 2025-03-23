import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerCreateSurfaceBasedElementTool(server: McpServer) {
  server.tool(
    "create_surface_based_element",
    "Create one or more surface-based elements in Revit such as floors, ceilings, or roofs. Supports batch creation with detailed parameters including family type ID, boundary lines, thickness, and level information. All units are in millimeters (mm).",
    {
      data: z
        .array(
          z.object({
            name: z
              .string()
              .describe("Description of the element (e.g., floor, ceiling)"),
            familyTypeId: z
              .number()
              .describe("The ID of the family type to create"),
            boundary: z
              .object({
                outerLoop: z
                  .array(
                    z.object({
                      P0: z.object({
                        X: z.number().describe("X coordinate of start point"),
                        Y: z.number().describe("Y coordinate of start point"),
                        Z: z.number().describe("Z coordinate of start point"),
                      }),
                      P1: z.object({
                        X: z.number().describe("X coordinate of end point"),
                        Y: z.number().describe("Y coordinate of end point"),
                        Z: z.number().describe("Z coordinate of end point"),
                      }),
                    })
                  )
                  .min(3)
                  .describe("Array of line segments defining the boundary"),
              })
              .describe("Boundary definition with outer loop"),
            Thickness: z.number().describe("Thickness of the element"),
            BaseLevel: z.number().describe("Base level height"),
            BaseOffset: z.number().describe("Offset from the base level"),
          })
        )
        .describe("Array of surface-based elements to create"),
    },
    async (args, extra) => {
      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("create_surface_based_element", {
            params: args,
          });
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
