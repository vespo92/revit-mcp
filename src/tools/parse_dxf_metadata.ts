import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs/promises";
import DxfParser from "dxf-parser";

/**
 * Tool: parse_dxf_metadata
 *
 * Extracts metadata and structure information from a DXF file without importing it.
 * Useful for previewing file contents and understanding structure before import.
 *
 * @param filePath - Path to the DXF file to analyze
 * @param includeEntityCounts - Include counts of each entity type (default: true)
 * @param includeLayerInfo - Include detailed layer information (default: true)
 * @param includeBounds - Calculate and include drawing bounds (default: true)
 * @param sampleEntities - Number of sample entities to include (default: 0)
 */
export function registerParseDxfMetadataTool(server: McpServer) {
  server.tool(
    "parse_dxf_metadata",
    "Extract metadata and structure information from AutoCAD DXF file without importing. Useful for previewing file contents.",
    {
      filePath: z.string().describe("Path to the DXF file to analyze"),
      includeEntityCounts: z.boolean().optional().default(true).describe("Include counts of each entity type"),
      includeLayerInfo: z.boolean().optional().default(true).describe("Include detailed layer information"),
      includeBounds: z.boolean().optional().default(true).describe("Calculate and include drawing bounds"),
      sampleEntities: z.number().optional().default(0).describe("Number of sample entities to include in output")
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

        const metadata: any = {
          success: true,
          fileName: args.filePath.split(/[\\/]/).pop(),
          fileSize: Buffer.byteLength(dxfContent, "utf-8"),
          header: {
            acadVersion: dxf.header?.$ACADVER || "Unknown",
            units: getUnitsFromHeader(dxf.header),
            insertionBase: dxf.header?.$INSBASE,
            extents: {
              min: dxf.header?.$EXTMIN,
              max: dxf.header?.$EXTMAX
            }
          },
          totalEntities: dxf.entities.length,
          totalBlocks: Object.keys(dxf.blocks || {}).length
        };

        // Entity counts by type
        if (args.includeEntityCounts) {
          const entityCounts: Record<string, number> = {};
          for (const entity of dxf.entities) {
            entityCounts[entity.type] = (entityCounts[entity.type] || 0) + 1;
          }
          metadata.entityCounts = entityCounts;
        }

        // Layer information
        if (args.includeLayerInfo) {
          const layerInfo: Record<string, any> = {};
          const layerCounts: Record<string, number> = {};

          for (const entity of dxf.entities) {
            const layerName = entity.layer || "0";
            layerCounts[layerName] = (layerCounts[layerName] || 0) + 1;
          }

          // Add layer definitions
          if (dxf.tables && dxf.tables.layer) {
            for (const [layerName, layerDef] of Object.entries(dxf.tables.layer.layers || {})) {
              layerInfo[layerName] = {
                color: (layerDef as any).color,
                frozen: (layerDef as any).frozen,
                visible: (layerDef as any).visible,
                entityCount: layerCounts[layerName] || 0
              };
            }
          }

          // Add counts for layers without definitions
          for (const [layerName, count] of Object.entries(layerCounts)) {
            if (!layerInfo[layerName]) {
              layerInfo[layerName] = {
                entityCount: count
              };
            }
          }

          metadata.layers = layerInfo;
          metadata.totalLayers = Object.keys(layerInfo).length;
        }

        // Calculate drawing bounds
        if (args.includeBounds && dxf.entities.length > 0) {
          const bounds = calculateDrawingBounds(dxf.entities);
          metadata.calculatedBounds = bounds;
          metadata.dimensions = {
            width: bounds.max.x - bounds.min.x,
            height: bounds.max.y - bounds.min.y,
            depth: bounds.max.z - bounds.min.z
          };
        }

        // Sample entities
        if (args.sampleEntities > 0) {
          metadata.sampleEntities = dxf.entities
            .slice(0, args.sampleEntities)
            .map((entity: any) => ({
              type: entity.type,
              layer: entity.layer,
              color: entity.color,
              handle: entity.handle
            }));
        }

        // Block information
        if (dxf.blocks && Object.keys(dxf.blocks).length > 0) {
          metadata.blocks = Object.keys(dxf.blocks).map((blockName) => ({
            name: blockName,
            entityCount: dxf.blocks[blockName]?.entities?.length || 0
          }));
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify(metadata, null, 2)
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
 * Get units from DXF header
 */
function getUnitsFromHeader(header: any): string {
  if (!header || !header.$INSUNITS) {
    return "Unknown";
  }

  const unitsMap: Record<number, string> = {
    0: "Unitless",
    1: "Inches",
    2: "Feet",
    3: "Miles",
    4: "Millimeters",
    5: "Centimeters",
    6: "Meters",
    7: "Kilometers",
    8: "Microinches",
    9: "Mils",
    10: "Yards",
    11: "Angstroms",
    12: "Nanometers",
    13: "Microns",
    14: "Decimeters",
    15: "Decameters",
    16: "Hectometers",
    17: "Gigameters",
    18: "Astronomical units",
    19: "Light years",
    20: "Parsecs"
  };

  return unitsMap[header.$INSUNITS] || `Custom (${header.$INSUNITS})`;
}

/**
 * Calculate the bounding box of all entities
 */
function calculateDrawingBounds(entities: any[]): any {
  const bounds = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity }
  };

  const updateBounds = (point: any) => {
    if (point.x !== undefined) {
      bounds.min.x = Math.min(bounds.min.x, point.x);
      bounds.max.x = Math.max(bounds.max.x, point.x);
    }
    if (point.y !== undefined) {
      bounds.min.y = Math.min(bounds.min.y, point.y);
      bounds.max.y = Math.max(bounds.max.y, point.y);
    }
    if (point.z !== undefined) {
      bounds.min.z = Math.min(bounds.min.z, point.z);
      bounds.max.z = Math.max(bounds.max.z, point.z);
    }
  };

  for (const entity of entities) {
    // Handle different entity types
    if (entity.vertices) {
      entity.vertices.forEach(updateBounds);
    }
    if (entity.center) {
      updateBounds(entity.center);
      // For circles and arcs, also consider the radius
      if (entity.radius) {
        updateBounds({ x: entity.center.x + entity.radius, y: entity.center.y + entity.radius, z: entity.center.z });
        updateBounds({ x: entity.center.x - entity.radius, y: entity.center.y - entity.radius, z: entity.center.z });
      }
    }
    if (entity.startPoint) {
      updateBounds(entity.startPoint);
    }
    if (entity.endPoint) {
      updateBounds(entity.endPoint);
    }
    if (entity.position) {
      updateBounds(entity.position);
    }
  }

  // Handle case where no points were found
  if (!isFinite(bounds.min.x)) {
    bounds.min = { x: 0, y: 0, z: 0 };
    bounds.max = { x: 0, y: 0, z: 0 };
  }

  return bounds;
}
