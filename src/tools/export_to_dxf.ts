import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import fs from "fs/promises";
import DxfWriter from "dxf-writer";

/**
 * Tool: export_to_dxf
 *
 * Exports Revit elements to a DXF (Drawing Exchange Format) file for use in AutoCAD.
 * Supports exporting views, selected elements, or elements by category.
 *
 * @param outputPath - Path where the DXF file will be saved
 * @param exportMode - 'current_view' | 'selected' | 'by_category'
 * @param categories - Categories to export (when using 'by_category' mode)
 * @param viewName - Name of the view to export (when using 'current_view' mode)
 * @param includeAnnotations - Include text notes and dimensions (default: true)
 * @param scaleFactor - Scale factor for coordinate conversion (default: 1.0)
 * @param simplifyGeometry - Simplify complex curves to line segments (default: false)
 * @param layerByCategory - Organize elements by Revit category as DXF layers (default: true)
 */
export function registerExportToDxfTool(server: McpServer) {
  server.tool(
    "export_to_dxf",
    "Export Revit elements to AutoCAD DXF file. Supports exporting views, selected elements, or elements by category.",
    {
      outputPath: z.string().describe("Path where the DXF file will be saved"),
      exportMode: z.enum(["current_view", "selected", "by_category"]).describe("Export mode: current_view, selected, or by_category"),
      categories: z.array(z.string()).optional().describe("Categories to export (when using 'by_category' mode)"),
      viewName: z.string().optional().describe("Name of the view to export (when using 'current_view' mode)"),
      includeAnnotations: z.boolean().optional().default(true).describe("Include text notes and dimensions"),
      scaleFactor: z.number().optional().default(1.0).describe("Scale factor for coordinate conversion"),
      simplifyGeometry: z.boolean().optional().default(false).describe("Simplify complex curves to line segments"),
      layerByCategory: z.boolean().optional().default(true).describe("Organize elements by Revit category as DXF layers")
    },
    async (args) => {
      try {
        // Get elements from Revit based on export mode
        const elementsResponse = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_elements_for_dxf_export", {
            exportMode: args.exportMode,
            categories: args.categories,
            viewName: args.viewName,
            includeAnnotations: args.includeAnnotations,
            simplifyGeometry: args.simplifyGeometry
          });
        });

        if (!elementsResponse.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: elementsResponse.error || "Failed to get elements from Revit"
              })
            }]
          };
        }

        // Create DXF file
        const dxf = new DxfWriter();
        let exportedCount = 0;

        // Add layers based on categories
        const layers = new Set<string>();
        for (const element of elementsResponse.elements) {
          const layerName = args.layerByCategory ? element.category : "0";
          layers.add(layerName);
        }

        // Define layers
        for (const layerName of layers) {
          dxf.addLayer(layerName, DxfWriter.ACI.WHITE, "CONTINUOUS");
        }

        // Convert and add elements to DXF
        for (const element of elementsResponse.elements) {
          const layerName = args.layerByCategory ? element.category : "0";
          const added = addRevitElementToDxf(dxf, element, layerName, args.scaleFactor);
          if (added) {
            exportedCount++;
          }
        }

        // Write DXF file
        const dxfString = dxf.toDxfString();
        await fs.writeFile(args.outputPath, dxfString, "utf-8");

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              outputPath: args.outputPath,
              totalElements: elementsResponse.elements.length,
              exportedElements: exportedCount,
              layers: Array.from(layers),
              fileSize: Buffer.byteLength(dxfString, "utf-8")
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
 * Add a Revit element to the DXF drawing
 */
function addRevitElementToDxf(dxf: any, element: any, layer: string, scale: number): boolean {
  const scalePoint = (point: any) => ({
    x: point.x * scale,
    y: point.y * scale,
    z: (point.z || 0) * scale
  });

  try {
    switch (element.geometryType) {
      case "Line":
        if (element.startPoint && element.endPoint) {
          const start = scalePoint(element.startPoint);
          const end = scalePoint(element.endPoint);
          dxf.drawLine(start.x, start.y, start.z, end.x, end.y, end.z, layer);
          return true;
        }
        break;

      case "Arc":
        if (element.center && element.radius) {
          const center = scalePoint(element.center);
          dxf.drawArc(
            center.x,
            center.y,
            center.z,
            element.radius * scale,
            element.startAngle || 0,
            element.endAngle || 360,
            layer
          );
          return true;
        }
        break;

      case "Circle":
        if (element.center && element.radius) {
          const center = scalePoint(element.center);
          dxf.drawCircle(center.x, center.y, center.z, element.radius * scale, layer);
          return true;
        }
        break;

      case "Polyline":
        if (element.points && element.points.length > 1) {
          const points = element.points.map(scalePoint);
          dxf.drawPolyline(points, layer, element.closed || false);
          return true;
        }
        break;

      case "Text":
        if (element.position && element.text) {
          const pos = scalePoint(element.position);
          dxf.drawText(
            pos.x,
            pos.y,
            pos.z,
            element.height * scale || 10,
            0, // rotation
            element.text,
            layer
          );
          return true;
        }
        break;

      case "Rectangle":
        if (element.corners && element.corners.length === 4) {
          const corners = element.corners.map(scalePoint);
          dxf.drawPolyline([...corners, corners[0]], layer, true);
          return true;
        }
        break;

      default:
        // Unsupported geometry type
        return false;
    }
  } catch (error) {
    console.error(`Failed to add element to DXF: ${error}`);
    return false;
  }

  return false;
}
