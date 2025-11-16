import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";

/**
 * Tool: modify_element
 *
 * Modifies Revit element parameters, geometry, and properties.
 * Supports bulk modifications and multiple parameter updates.
 *
 * @param elementIds - Array of element IDs to modify
 * @param parameters - Parameters to modify with their new values
 * @param geometryModifications - Optional geometry changes (location, rotation, etc.)
 * @param typeModifications - Optional type-level modifications
 * @param createTransaction - Create a transaction (default: true)
 * @param validateOnly - Only validate changes without applying them (default: false)
 */
export function registerModifyElementTool(server: McpServer) {
  server.tool(
    "modify_element",
    "Modify Revit element parameters, geometry, and properties. Supports bulk modifications.",
    {
      elementIds: z.array(z.number()).describe("Array of element IDs to modify"),
      parameters: z.record(z.union([
        z.string(),
        z.number(),
        z.boolean()
      ])).optional().describe("Parameters to modify with their new values (parameter name: value)"),
      geometryModifications: z.object({
        moveBy: z.object({
          x: z.number(),
          y: z.number(),
          z: z.number()
        }).optional().describe("Move elements by offset"),
        rotateDegrees: z.number().optional().describe("Rotate elements by degrees (around Z-axis)"),
        rotateAroundPoint: z.object({
          point: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          degrees: z.number()
        }).optional().describe("Rotate around a specific point"),
        mirror: z.object({
          plane: z.enum(["XY", "XZ", "YZ"]),
          offset: z.number().optional()
        }).optional().describe("Mirror elements across a plane"),
        scale: z.object({
          factor: z.number(),
          origin: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional()
        }).optional().describe("Scale elements")
      }).optional().describe("Geometry modifications"),
      typeModifications: z.object({
        changeType: z.object({
          typeName: z.string()
        }).optional().describe("Change element type"),
        duplicateType: z.object({
          newTypeName: z.string(),
          modifyParameters: z.record(z.any()).optional()
        }).optional().describe("Duplicate type and apply modifications")
      }).optional().describe("Type-level modifications"),
      createTransaction: z.boolean().optional().default(true).describe("Create a transaction"),
      validateOnly: z.boolean().optional().default(false).describe("Only validate changes without applying them")
    },
    async (args) => {
      try {
        // Validate input
        if (!args.elementIds || args.elementIds.length === 0) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "No element IDs provided"
              })
            }]
          };
        }

        if (!args.parameters && !args.geometryModifications && !args.typeModifications) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "No modifications specified. Provide parameters, geometryModifications, or typeModifications."
              })
            }]
          };
        }

        // Send modification request to Revit
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("modify_element", {
            elementIds: args.elementIds,
            parameters: args.parameters,
            geometryModifications: args.geometryModifications,
            typeModifications: args.typeModifications,
            createTransaction: args.createTransaction,
            validateOnly: args.validateOnly
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: response.success !== false,
              mode: args.validateOnly ? "validation" : "modification",
              modifiedElements: response.modifiedCount || 0,
              failedElements: response.failedCount || 0,
              errors: response.errors || [],
              warnings: response.warnings || [],
              response
            }, null, 2)
          }]
        };

      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack
            })
          }]
        };
      }
    }
  );
}
