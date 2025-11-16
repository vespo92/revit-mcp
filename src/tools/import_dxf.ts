import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import fs from "fs/promises";
import DxfParser from "dxf-parser";

/**
 * Tool: import_dxf
 *
 * Imports a DXF (Drawing Exchange Format) file and converts it to Revit elements.
 * Supports lines, polylines, circles, arcs, and text entities.
 *
 * @param filePath - Path to the DXF file to import
 * @param targetLevel - Revit level name to place elements on
 * @param scaleFactor - Scale factor for coordinate conversion (default: 1.0)
 * @param layerFilter - Optional array of layer names to import (imports all if not specified)
 * @param coordinateOffset - Optional X,Y,Z offset to apply to all coordinates
 * @param createDetailLines - Create detail lines instead of model lines (default: false)
 */
export function registerImportDxfTool(server: McpServer) {
  server.tool(
    "import_dxf",
    "Import AutoCAD DXF file and convert entities to Revit elements. Supports lines, polylines, circles, arcs, and text.",
    {
      filePath: z.string().describe("Path to the DXF file to import"),
      targetLevel: z.string().describe("Revit level name to place elements on (e.g., 'Level 1')"),
      scaleFactor: z.number().optional().default(1.0).describe("Scale factor for coordinate conversion"),
      layerFilter: z.array(z.string()).optional().describe("Optional array of layer names to import (imports all if not specified)"),
      coordinateOffset: z.object({
        x: z.number(),
        y: z.number(),
        z: z.number()
      }).optional().describe("Optional X,Y,Z offset to apply to all coordinates"),
      createDetailLines: z.boolean().optional().default(false).describe("Create detail lines instead of model lines")
    },
    async (args) => {
      try {
        // Read and parse the DXF file
        const dxfContent = await fs.readFile(args.filePath, "utf-8");
        const parser = new DxfParser();
        const dxf = parser.parseSync(dxfContent);

        if (!dxf) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Failed to parse DXF file"
              })
            }]
          };
        }

        // Extract entities and convert to Revit-compatible format
        const entitiesToImport: any[] = [];
        const layers = args.layerFilter || [];
        const offset = args.coordinateOffset ?? { x: 0, y: 0, z: 0 };

        for (const entity of dxf.entities) {
          // Filter by layer if specified
          if (layers.length > 0 && !layers.includes(entity.layer)) {
            continue;
          }

          const convertedEntity = convertDxfEntity(
            entity,
            args.scaleFactor,
            offset
          );

          if (convertedEntity) {
            entitiesToImport.push(convertedEntity);
          }
        }

        // Send to Revit for import
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("import_dxf", {
            entities: entitiesToImport,
            targetLevel: args.targetLevel,
            createDetailLines: args.createDetailLines,
            metadata: {
              fileName: args.filePath.split(/[\\/]/).pop(),
              totalEntities: dxf.entities.length,
              importedEntities: entitiesToImport.length,
              layers: Array.from(new Set(dxf.entities.map((e: any) => e.layer))),
              bounds: dxf.header?.$EXTMIN && dxf.header?.$EXTMAX ? {
                min: dxf.header.$EXTMIN,
                max: dxf.header.$EXTMAX
              } : null
            }
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              imported: entitiesToImport.length,
              total: dxf.entities.length,
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

/**
 * Convert a DXF entity to Revit-compatible format
 */
function convertDxfEntity(entity: any, scale: number, offset: { x?: number; y?: number; z?: number }) {
  const applyTransform = (point: any) => ({
    x: (point.x || 0) * scale + (offset.x || 0),
    y: (point.y || 0) * scale + (offset.y || 0),
    z: (point.z || 0) * scale + (offset.z || 0)
  });

  switch (entity.type) {
    case "LINE":
      return {
        type: "line",
        layer: entity.layer,
        start: applyTransform(entity.vertices[0]),
        end: applyTransform(entity.vertices[1]),
        color: entity.color
      };

    case "POLYLINE":
    case "LWPOLYLINE":
      return {
        type: "polyline",
        layer: entity.layer,
        vertices: entity.vertices.map(applyTransform),
        closed: entity.shape || false,
        color: entity.color
      };

    case "CIRCLE":
      return {
        type: "circle",
        layer: entity.layer,
        center: applyTransform(entity.center),
        radius: entity.radius * scale,
        color: entity.color
      };

    case "ARC":
      return {
        type: "arc",
        layer: entity.layer,
        center: applyTransform(entity.center),
        radius: entity.radius * scale,
        startAngle: entity.startAngle,
        endAngle: entity.endAngle,
        color: entity.color
      };

    case "TEXT":
    case "MTEXT":
      return {
        type: "text",
        layer: entity.layer,
        position: applyTransform(entity.startPoint || entity.position),
        text: entity.text,
        height: entity.height * scale,
        rotation: entity.rotation || 0,
        color: entity.color
      };

    case "INSERT":
      return {
        type: "block",
        layer: entity.layer,
        position: applyTransform(entity.position),
        name: entity.name,
        scale: {
          x: entity.xScale * scale,
          y: entity.yScale * scale,
          z: entity.zScale * scale
        },
        rotation: entity.rotation || 0
      };

    default:
      // Unsupported entity type
      return null;
  }
}
