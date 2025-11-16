import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import fs from "fs/promises";
import DxfParser from "dxf-parser";
import ExcelJS from "exceljs";

/**
 * Tool: coordinate_with_autocad
 *
 * Coordinates Revit model with AutoCAD drawings. Compares geometries,
 * identifies discrepancies, and generates coordination reports.
 *
 * @param dxfFilePath - Path to AutoCAD DXF file for comparison
 * @param revitCategories - Revit categories to compare
 * @param comparisonMode - Type of comparison to perform
 * @param tolerance - Coordinate tolerance for matching (default: 0.01)
 * @param generateReport - Generate Excel coordination report (default: true)
 * @param reportPath - Path for coordination report (if generateReport is true)
 * @param autoSync - Automatically sync matching elements (default: false)
 */
export function registerCoordinateWithAutocadTool(server: McpServer) {
  server.tool(
    "coordinate_with_autocad",
    "Coordinate Revit model with AutoCAD drawings. Compare geometries and generate coordination reports.",
    {
      dxfFilePath: z.string().describe("Path to AutoCAD DXF file for comparison"),
      revitCategories: z.array(z.string()).describe("Revit categories to compare (e.g., ['Walls', 'Doors'])"),
      comparisonMode: z.enum(["geometry", "location", "dimensions", "full"]).describe("Type of comparison"),
      tolerance: z.number().optional().default(0.01).describe("Coordinate tolerance for matching"),
      generateReport: z.boolean().optional().default(true).describe("Generate Excel coordination report"),
      reportPath: z.string().optional().describe("Path for coordination report Excel file"),
      autoSync: z.boolean().optional().default(false).describe("Automatically sync matching elements")
    },
    async (args) => {
      try {
        // Read and parse DXF file
        const dxfContent = await fs.readFile(args.dxfFilePath, "utf-8");
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

        // Get Revit elements for comparison
        const revitDataResponse = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("get_elements_for_coordination", {
            categories: args.revitCategories,
            includeGeometry: true,
            includeLocation: true,
            includeDimensions: true
          });
        });

        if (!revitDataResponse.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Failed to get Revit elements"
              })
            }]
          };
        }

        // Perform comparison
        const comparison = compareRevitWithDxf(
          revitDataResponse.elements,
          dxf.entities,
          args.comparisonMode,
          args.tolerance
        );

        // Generate report if requested
        if (args.generateReport && args.reportPath) {
          await generateCoordinationReport(
            args.reportPath,
            comparison,
            args.dxfFilePath,
            revitDataResponse.projectName
          );
        }

        // Auto-sync if requested
        let syncResults = null;
        if (args.autoSync && comparison.matches.length > 0) {
          const syncResponse = await withRevitConnection(async (revitClient) => {
            return await revitClient.sendCommand("sync_with_autocad", {
              matches: comparison.matches,
              tolerance: args.tolerance
            });
          });
          syncResults = syncResponse;
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              summary: {
                totalRevitElements: comparison.totalRevitElements,
                totalDxfEntities: comparison.totalDxfEntities,
                matches: comparison.matches.length,
                discrepancies: comparison.discrepancies.length,
                revitOnly: comparison.revitOnly.length,
                dxfOnly: comparison.dxfOnly.length
              },
              reportGenerated: args.generateReport,
              reportPath: args.reportPath,
              syncPerformed: args.autoSync,
              syncResults,
              details: {
                matches: comparison.matches.slice(0, 10), // First 10 matches
                discrepancies: comparison.discrepancies.slice(0, 10) // First 10 discrepancies
              }
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
 * Compare Revit elements with DXF entities
 */
function compareRevitWithDxf(
  revitElements: any[],
  dxfEntities: any[],
  mode: string,
  tolerance: number
): any {
  const matches: any[] = [];
  const discrepancies: any[] = [];
  const revitOnly: any[] = [];
  const dxfOnly: any[] = [];

  const matchedDxfIndices = new Set<number>();

  // Compare each Revit element with DXF entities
  for (const revitElement of revitElements) {
    let bestMatch: any = null;
    let bestMatchScore = 0;
    let bestMatchIndex = -1;

    for (let i = 0; i < dxfEntities.length; i++) {
      if (matchedDxfIndices.has(i)) {
        continue;
      }

      const score = calculateMatchScore(revitElement, dxfEntities[i], mode, tolerance);

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestMatch = dxfEntities[i];
        bestMatchIndex = i;
      }
    }

    if (bestMatchScore > 0.7) { // 70% match threshold
      matchedDxfIndices.add(bestMatchIndex);
      matches.push({
        revitElement: {
          id: revitElement.id,
          category: revitElement.category,
          location: revitElement.location
        },
        dxfEntity: {
          type: bestMatch.type,
          layer: bestMatch.layer
        },
        matchScore: bestMatchScore,
        differences: findDifferences(revitElement, bestMatch, tolerance)
      });

      if (bestMatchScore < 1.0) {
        discrepancies.push({
          revitElementId: revitElement.id,
          issue: "Geometry mismatch",
          matchScore: bestMatchScore,
          differences: findDifferences(revitElement, bestMatch, tolerance)
        });
      }
    } else {
      revitOnly.push({
        id: revitElement.id,
        category: revitElement.category,
        location: revitElement.location
      });
    }
  }

  // Find DXF entities without Revit matches
  for (let i = 0; i < dxfEntities.length; i++) {
    if (!matchedDxfIndices.has(i)) {
      dxfOnly.push({
        type: dxfEntities[i].type,
        layer: dxfEntities[i].layer,
        location: getDxfEntityLocation(dxfEntities[i])
      });
    }
  }

  return {
    totalRevitElements: revitElements.length,
    totalDxfEntities: dxfEntities.length,
    matches,
    discrepancies,
    revitOnly,
    dxfOnly
  };
}

/**
 * Calculate match score between Revit element and DXF entity
 */
function calculateMatchScore(revitElement: any, dxfEntity: any, mode: string, tolerance: number): number {
  let score = 0;
  let criteria = 0;

  // Location comparison
  if (mode === "location" || mode === "full") {
    const revitLoc = revitElement.location;
    const dxfLoc = getDxfEntityLocation(dxfEntity);

    if (revitLoc && dxfLoc) {
      const distance = Math.sqrt(
        Math.pow(revitLoc.x - dxfLoc.x, 2) +
        Math.pow(revitLoc.y - dxfLoc.y, 2) +
        Math.pow((revitLoc.z || 0) - (dxfLoc.z || 0), 2)
      );

      if (distance <= tolerance) {
        score += 1;
      } else if (distance <= tolerance * 10) {
        score += 0.5;
      }
      criteria += 1;
    }
  }

  // Geometry comparison
  if (mode === "geometry" || mode === "full") {
    const geometryMatch = compareGeometry(revitElement, dxfEntity, tolerance);
    score += geometryMatch;
    criteria += 1;
  }

  // Dimensions comparison
  if (mode === "dimensions" || mode === "full") {
    const dimensionsMatch = compareDimensions(revitElement, dxfEntity, tolerance);
    score += dimensionsMatch;
    criteria += 1;
  }

  return criteria > 0 ? score / criteria : 0;
}

/**
 * Get location from DXF entity
 */
function getDxfEntityLocation(entity: any): any {
  if (entity.center) {
    return entity.center;
  }
  if (entity.position) {
    return entity.position;
  }
  if (entity.startPoint) {
    return entity.startPoint;
  }
  if (entity.vertices && entity.vertices.length > 0) {
    return entity.vertices[0];
  }
  return null;
}

/**
 * Compare geometry between Revit and DXF
 */
function compareGeometry(revitElement: any, dxfEntity: any, tolerance: number): number {
  // Simplified geometry comparison
  // In a real implementation, this would be more sophisticated
  const revitType = revitElement.geometryType?.toLowerCase() || "";
  const dxfType = dxfEntity.type?.toLowerCase() || "";

  if (revitType.includes("line") && dxfType.includes("line")) {
    return 1.0;
  }
  if (revitType.includes("arc") && dxfType.includes("arc")) {
    return 1.0;
  }
  if (revitType.includes("circle") && dxfType.includes("circle")) {
    return 1.0;
  }

  return 0.3; // Partial match for different types
}

/**
 * Compare dimensions
 */
function compareDimensions(revitElement: any, dxfEntity: any, tolerance: number): number {
  let score = 0;
  let count = 0;

  // Compare length if available
  if (revitElement.length && dxfEntity.length) {
    const diff = Math.abs(revitElement.length - dxfEntity.length);
    score += diff <= tolerance ? 1 : 0;
    count++;
  }

  // Compare radius if available
  if (revitElement.radius && dxfEntity.radius) {
    const diff = Math.abs(revitElement.radius - dxfEntity.radius);
    score += diff <= tolerance ? 1 : 0;
    count++;
  }

  return count > 0 ? score / count : 0.5;
}

/**
 * Find differences between matched elements
 */
function findDifferences(revitElement: any, dxfEntity: any, tolerance: number): string[] {
  const differences: string[] = [];

  // Location differences
  const revitLoc = revitElement.location;
  const dxfLoc = getDxfEntityLocation(dxfEntity);

  if (revitLoc && dxfLoc) {
    const distance = Math.sqrt(
      Math.pow(revitLoc.x - dxfLoc.x, 2) +
      Math.pow(revitLoc.y - dxfLoc.y, 2)
    );

    if (distance > tolerance) {
      differences.push(`Location offset: ${distance.toFixed(3)} units`);
    }
  }

  // Dimension differences
  if (revitElement.length && dxfEntity.length) {
    const diff = Math.abs(revitElement.length - dxfEntity.length);
    if (diff > tolerance) {
      differences.push(`Length difference: ${diff.toFixed(3)} units`);
    }
  }

  return differences;
}

/**
 * Generate coordination report in Excel
 */
async function generateCoordinationReport(
  outputPath: string,
  comparison: any,
  dxfFilePath: string,
  projectName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Revit MCP";
  workbook.created = new Date();

  // Summary sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRow(["AutoCAD-Revit Coordination Report"]).font = { size: 16, bold: true };
  summarySheet.addRow([]);
  summarySheet.addRow(["Project:", projectName]);
  summarySheet.addRow(["DXF File:", dxfFilePath.split(/[\\/]/).pop()]);
  summarySheet.addRow(["Date:", new Date().toLocaleDateString()]);
  summarySheet.addRow([]);
  summarySheet.addRow(["Total Revit Elements:", comparison.totalRevitElements]);
  summarySheet.addRow(["Total DXF Entities:", comparison.totalDxfEntities]);
  summarySheet.addRow(["Matches:", comparison.matches.length]);
  summarySheet.addRow(["Discrepancies:", comparison.discrepancies.length]);
  summarySheet.addRow(["Revit Only:", comparison.revitOnly.length]);
  summarySheet.addRow(["DXF Only:", comparison.dxfOnly.length]);

  // Discrepancies sheet
  const discSheet = workbook.addWorksheet("Discrepancies");
  const discHeaderRow = discSheet.addRow(["Revit Element ID", "Issue", "Match Score", "Differences"]);
  discHeaderRow.font = { bold: true };
  discHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFF0000" }
  };

  for (const disc of comparison.discrepancies) {
    discSheet.addRow([
      disc.revitElementId,
      disc.issue,
      (disc.matchScore * 100).toFixed(1) + "%",
      disc.differences.join("; ")
    ]);
  }

  // Revit Only sheet
  const revitOnlySheet = workbook.addWorksheet("Revit Only");
  const revitHeaderRow = revitOnlySheet.addRow(["Element ID", "Category", "Location"]);
  revitHeaderRow.font = { bold: true };

  for (const item of comparison.revitOnly) {
    revitOnlySheet.addRow([
      item.id,
      item.category,
      item.location ? `(${item.location.x.toFixed(2)}, ${item.location.y.toFixed(2)})` : "N/A"
    ]);
  }

  // DXF Only sheet
  const dxfOnlySheet = workbook.addWorksheet("DXF Only");
  const dxfHeaderRow = dxfOnlySheet.addRow(["Type", "Layer", "Location"]);
  dxfHeaderRow.font = { bold: true };

  for (const item of comparison.dxfOnly) {
    dxfOnlySheet.addRow([
      item.type,
      item.layer,
      item.location ? `(${item.location.x.toFixed(2)}, ${item.location.y.toFixed(2)})` : "N/A"
    ]);
  }

  await workbook.xlsx.writeFile(outputPath);
}
