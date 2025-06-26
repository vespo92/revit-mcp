import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withRevitConnection } from "../utils/ConnectionManager.js";

export function registerElevatorAutomationTool(server: McpServer) {
  server.tool(
    "elevator_automation",
    "Comprehensive elevator design automation tool for creating elevator shafts, doors, equipment, and associated elements across multiple floors. Handles complete elevator system creation including shaft walls, doors, equipment placement, and opening creation.",
    {
      data: z.object({
        action: z
          .enum([
            "create_shaft",
            "place_doors",
            "duplicate_to_floors",
            "create_machine_room",
            "analyze_existing",
            "create_opening"
          ])
          .describe("The elevator automation action to perform"),
        
        shaftParameters: z
          .object({
            location: z.object({
              x: z.number().describe("X coordinate of shaft center in mm"),
              y: z.number().describe("Y coordinate of shaft center in mm")
            }),
            dimensions: z.object({
              width: z.number().describe("Shaft width in mm"),
              depth: z.number().describe("Shaft depth in mm")
            }),
            baseLevelId: z.number().describe("ElementId of the base level"),
            topLevelId: z.number().describe("ElementId of the top level"),
            wallThickness: z.number().default(200).describe("Shaft wall thickness in mm"),
            createPit: z.boolean().default(true).describe("Create elevator pit"),
            pitDepth: z.number().default(1500).describe("Pit depth in mm below base level")
          })
          .optional()
          .describe("Parameters for creating elevator shaft (required for 'create_shaft' action)"),
        
        doorParameters: z
          .object({
            shaftId: z.number().optional().describe("ElementId of existing shaft to add doors to"),
            doorTypeId: z.number().describe("ElementId of door type to use"),
            levelIds: z.array(z.number()).describe("ElementIds of levels where doors should be placed"),
            openingSide: z.enum(["front", "rear", "left", "right"]).default("front"),
            offset: z.number().default(0).describe("Offset from shaft center in mm")
          })
          .optional()
          .describe("Parameters for placing elevator doors (required for 'place_doors' action)"),
        
        duplicationParameters: z
          .object({
            sourceElementIds: z.array(z.number()).describe("ElementIds to duplicate"),
            fromLevelId: z.number().describe("Source level ElementId"),
            toLevelIds: z.array(z.number()).describe("Target level ElementIds"),
            includeOpenings: z.boolean().default(true).describe("Include shaft openings in floors"),
            adjustHosted: z.boolean().default(true).describe("Adjust hosted elements to new levels")
          })
          .optional()
          .describe("Parameters for duplicating elevator elements to other floors"),
        
        machineRoomParameters: z
          .object({
            shaftLocation: z.object({
              x: z.number(),
              y: z.number()
            }),
            roomDimensions: z.object({
              width: z.number().describe("Machine room width in mm"),
              depth: z.number().describe("Machine room depth in mm"),
              height: z.number().default(2500).describe("Machine room height in mm")
            }),
            topLevelId: z.number().describe("ElementId of top level"),
            includeEquipment: z.boolean().default(true).describe("Place typical equipment")
          })
          .optional()
          .describe("Parameters for creating machine room above shaft"),
        
        analysisParameters: z
          .object({
            boundingBox: z.object({
              min: z.object({ x: z.number(), y: z.number() }),
              max: z.object({ x: z.number(), y: z.number() })
            }).optional().describe("Area to search for elevators"),
            searchRadius: z.number().default(5000).describe("Search radius from center in mm")
          })
          .optional()
          .describe("Parameters for analyzing existing elevators in the model"),

        openingParameters: z
          .object({
            shaftBounds: z.object({
              min: z.object({ x: z.number(), y: z.number() }),
              max: z.object({ x: z.number(), y: z.number() })
            }),
            levelIds: z.array(z.number()).describe("Level ElementIds where openings are needed"),
            margin: z.number().default(50).describe("Additional margin around shaft in mm")
          })
          .optional()
          .describe("Parameters for creating floor openings for elevator shaft")
      })
    },
    async (args, extra) => {
      const params = {
        action: args.data.action,
        ...args.data
      };

      try {
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("elevator_automation", params);
        });

        // Format response based on action
        let message = `Elevator automation: ${args.data.action} completed successfully!\n\n`;

        switch (args.data.action) {
          case "create_shaft":
            const shaftResult = response as { shaftWallIds: number[], pitId?: number };
            message += `Created shaft with ${shaftResult.shaftWallIds.length} walls\n`;
            if (shaftResult.pitId) {
              message += `Pit created with ID: ${shaftResult.pitId}\n`;
            }
            break;

          case "place_doors":
            const doorResult = response as { placedDoorIds: number[], failedLevels: number[] };
            message += `Placed ${doorResult.placedDoorIds.length} doors\n`;
            if (doorResult.failedLevels.length > 0) {
              message += `Failed to place doors at levels: ${doorResult.failedLevels.join(", ")}\n`;
            }
            break;

          case "duplicate_to_floors":
            const dupResult = response as { 
              duplicatedCount: number, 
              byLevel: { [key: number]: number[] } 
            };
            message += `Duplicated ${dupResult.duplicatedCount} elements\n`;
            Object.entries(dupResult.byLevel).forEach(([level, ids]) => {
              message += `- Level ${level}: ${ids.length} elements\n`;
            });
            break;

          case "analyze_existing":
            const analysis = response as {
              elevatorCount: number,
              elevators: Array<{
                id: number,
                type: string,
                levels: number[],
                dimensions: { width: number, depth: number }
              }>
            };
            message += `Found ${analysis.elevatorCount} elevators:\n`;
            analysis.elevators.forEach(elev => {
              message += `- ID: ${elev.id}, Type: ${elev.type}, Serves ${elev.levels.length} levels\n`;
              message += `  Dimensions: ${elev.dimensions.width}mm x ${elev.dimensions.depth}mm\n`;
            });
            break;

          case "create_machine_room":
            const roomResult = response as { 
              roomId: number, 
              wallIds: number[], 
              equipmentIds?: number[] 
            };
            message += `Created machine room ID: ${roomResult.roomId}\n`;
            message += `Walls created: ${roomResult.wallIds.length}\n`;
            if (roomResult.equipmentIds) {
              message += `Equipment placed: ${roomResult.equipmentIds.length} items\n`;
            }
            break;

          case "create_opening":
            const openingResult = response as {
              openingIds: number[],
              modifiedFloors: number[]
            };
            message += `Created ${openingResult.openingIds.length} openings\n`;
            message += `Modified ${openingResult.modifiedFloors.length} floors\n`;
            break;
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
              text: `Elevator automation failed: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    }
  );
}