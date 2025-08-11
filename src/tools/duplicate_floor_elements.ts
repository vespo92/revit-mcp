import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerDuplicateFloorElementsTool(server: McpServer) {
  server.tool(
    "duplicate_floor_elements",
    "Duplicate all elements from one floor to another floor or multiple floors. Perfect for creating repetitive floor layouts in buildings with elevators. This tool copies walls, doors, furniture, MEP elements, and other components while maintaining their relative positions.",
    {
      data: z.object({
        sourceLevelId: z
          .number()
          .describe("The ElementId of the source level/floor to copy elements from"),
        targetLevelIds: z
          .array(z.number())
          .describe("Array of ElementIds for target levels/floors to copy elements to"),
        elementFilter: z
          .object({
            categories: z
              .array(z.string())
              .optional()
              .describe("Optional list of element categories to include (e.g., ['OST_Walls', 'OST_Doors', 'OST_Furniture']). If not specified, all elements will be copied."),
            excludeCategories: z
              .array(z.string())
              .optional()
              .describe("Optional list of element categories to exclude from duplication"),
            boundingBox: z
              .object({
                min: z.object({
                  x: z.number(),
                  y: z.number()
                }),
                max: z.object({
                  x: z.number(),
                  y: z.number()
                })
              })
              .optional()
              .describe("Optional bounding box in plan view (X,Y coordinates) to limit duplication to specific area")
          })
          .optional()
          .describe("Optional filters to control which elements are duplicated"),
        options: z
          .object({
            updateHostedElements: z
              .boolean()
              .default(true)
              .describe("Update hosted elements (doors, windows) to reference the new level"),
            copyNonHostedOnly: z
              .boolean()
              .default(false)
              .describe("Only copy elements that are not hosted (furniture, equipment)"),
            includeAnnotations: z
              .boolean()
              .default(false)
              .describe("Include annotations and dimensions in the duplication"),
            groupBeforeCopy: z
              .boolean()
              .default(false)
              .describe("Create a group before copying for easier management")
          })
          .optional()
          .describe("Additional options for the duplication process")
      })
    },
    async (args, extra) => {
      const params = {
        sourceLevelId: args.data.sourceLevelId,
        targetLevelIds: args.data.targetLevelIds,
        elementFilter: args.data.elementFilter || {},
        options: args.data.options || {
          updateHostedElements: true,
          copyNonHostedOnly: false,
          includeAnnotations: false,
          groupBeforeCopy: false
        }
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("duplicate_floor_elements", params);
        });

        // Format the response for better readability
        const result = response as {
          success: boolean;
          duplicatedCount: number;
          duplicatedElements: Array<{
            targetLevelId: number;
            elementIds: number[];
            groupId?: number;
          }>;
          errors?: string[];
        };

        let message = `Floor duplication ${result.success ? 'successful' : 'failed'}!\n`;
        message += `Total elements duplicated: ${result.duplicatedCount}\n\n`;

        if (result.duplicatedElements) {
          message += "Duplication details:\n";
          result.duplicatedElements.forEach(level => {
            message += `- Level ${level.targetLevelId}: ${level.elementIds.length} elements`;
            if (level.groupId) {
              message += ` (Group ID: ${level.groupId})`;
            }
            message += "\n";
          });
        }

        if (result.errors && result.errors.length > 0) {
          message += "\nErrors encountered:\n";
          result.errors.forEach(error => {
            message += `- ${error}\n`;
          });
        }

        return {
          content: [
            {
              type: "text",
              text: message
            },
            {
              type: "text", 
              text: `\nDetailed response:\n${JSON.stringify(response, null, 2)}`
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Floor duplication failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}