import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import ExcelJS from "exceljs";

/**
 * Tool: generate_quantity_takeoff
 *
 * Generates quantity takeoff reports from Revit elements and exports to Excel.
 * Includes material quantities, costs, and custom calculations.
 *
 * @param outputPath - Path where the Excel file will be saved
 * @param categories - Categories to include in takeoff
 * @param includeCategories - Include category summaries (default: true)
 * @param includeTypes - Include type summaries (default: true)
 * @param includeMaterials - Include material quantities (default: true)
 * @param costParameters - Parameter names containing cost data
 * @param quantityParameters - Parameter names for quantity calculations
 * @param groupBy - Grouping strategy: 'category' | 'type' | 'level' | 'phase'
 * @param includeFormulas - Add calculation formulas (default: true)
 * @param includeTotals - Add summary totals (default: true)
 */
export function registerGenerateQuantityTakeoffTool(server: McpServer) {
  server.tool(
    "generate_quantity_takeoff",
    "Generate quantity takeoff reports from Revit elements and export to Excel. Includes materials, costs, and calculations.",
    {
      outputPath: z.string().describe("Path where the Excel file will be saved"),
      categories: z.array(z.string()).describe("Categories to include in takeoff (e.g., ['Walls', 'Doors', 'Windows'])"),
      includeCategories: z.boolean().optional().default(true).describe("Include category summaries"),
      includeTypes: z.boolean().optional().default(true).describe("Include type summaries"),
      includeMaterials: z.boolean().optional().default(true).describe("Include material quantities"),
      costParameters: z.array(z.string()).optional().describe("Parameter names containing cost data"),
      quantityParameters: z.array(z.string()).optional().describe("Parameter names for quantity calculations"),
      groupBy: z.enum(["category", "type", "level", "phase"]).optional().default("category").describe("Grouping strategy"),
      includeFormulas: z.boolean().optional().default(true).describe("Add calculation formulas"),
      includeTotals: z.boolean().optional().default(true).describe("Add summary totals")
    },
    async (args) => {
      try {
        // Get quantity data from Revit
        const quantityDataResponse = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("generate_quantity_takeoff_data", {
            categories: args.categories,
            includeCategories: args.includeCategories,
            includeTypes: args.includeTypes,
            includeMaterials: args.includeMaterials,
            costParameters: args.costParameters,
            quantityParameters: args.quantityParameters,
            groupBy: args.groupBy
          });
        });

        if (!quantityDataResponse.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: quantityDataResponse.error || "Failed to get quantity data from Revit"
              })
            }]
          };
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Revit MCP";
        workbook.created = new Date();

        // Summary sheet
        const summarySheet = workbook.addWorksheet("Summary");
        createSummarySheet(summarySheet, quantityDataResponse.summary);

        // Detailed quantities sheet
        const detailSheet = workbook.addWorksheet("Detailed Quantities");
        createDetailedQuantitiesSheet(
          detailSheet,
          quantityDataResponse.details,
          args.includeFormulas,
          args.groupBy
        );

        // Materials sheet (if requested)
        if (args.includeMaterials && quantityDataResponse.materials) {
          const materialsSheet = workbook.addWorksheet("Materials");
          createMaterialsSheet(materialsSheet, quantityDataResponse.materials);
        }

        // Cost breakdown sheet (if cost parameters provided)
        if (args.costParameters && quantityDataResponse.costs) {
          const costsSheet = workbook.addWorksheet("Cost Breakdown");
          createCostBreakdownSheet(costsSheet, quantityDataResponse.costs, args.includeFormulas);
        }

        // Write file
        await workbook.xlsx.writeFile(args.outputPath);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              outputPath: args.outputPath,
              totalElements: quantityDataResponse.totalElements,
              categories: quantityDataResponse.summary.categories?.length || 0,
              worksheets: workbook.worksheets.map((ws) => ws.name)
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
 * Create summary worksheet
 */
function createSummarySheet(worksheet: ExcelJS.Worksheet, summaryData: any) {
  // Title
  const titleRow = worksheet.addRow(["Quantity Takeoff Summary"]);
  titleRow.getCell(1).font = { size: 16, bold: true };
  titleRow.height = 25;
  worksheet.addRow([]);

  // Project info
  if (summaryData.projectInfo) {
    worksheet.addRow(["Project Name:", summaryData.projectInfo.name]);
    worksheet.addRow(["Project Number:", summaryData.projectInfo.number]);
    worksheet.addRow(["Date:", new Date().toLocaleDateString()]);
    worksheet.addRow([]);
  }

  // Category summaries
  if (summaryData.categories) {
    const headerRow = worksheet.addRow(["Category", "Count", "Total Volume", "Total Area", "Total Length"]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" }
    };

    for (const category of summaryData.categories) {
      worksheet.addRow([
        category.name,
        category.count,
        category.totalVolume,
        category.totalArea,
        category.totalLength
      ]);
    }
  }

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : "";
      maxLength = Math.max(maxLength, cellValue.length);
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });
}

/**
 * Create detailed quantities worksheet
 */
function createDetailedQuantitiesSheet(
  worksheet: ExcelJS.Worksheet,
  details: any[],
  includeFormulas: boolean,
  groupBy: string
) {
  // Headers
  const headers = [
    "Category",
    "Type",
    "Mark",
    "Level",
    "Count",
    "Volume",
    "Area",
    "Length",
    "Unit Cost",
    "Total Cost"
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" }
  };
  headerRow.getCell(1).font = { ...headerRow.getCell(1).font, color: { argb: "FFFFFFFF" } };

  // Data rows
  let rowNumber = 2;
  for (const item of details) {
    const row = worksheet.addRow([
      item.category,
      item.type,
      item.mark,
      item.level,
      item.count,
      item.volume,
      item.area,
      item.length,
      item.unitCost
    ]);

    // Total cost formula
    if (includeFormulas && item.unitCost) {
      const cell = row.getCell(10);
      cell.value = { formula: `E${rowNumber}*I${rowNumber}` }; // Count * Unit Cost
    } else {
      row.getCell(10).value = item.totalCost;
    }

    rowNumber++;
  }

  // Totals row
  if (details.length > 0) {
    const totalsRow = worksheet.addRow([
      "TOTAL",
      "",
      "",
      "",
      { formula: `SUM(E2:E${rowNumber - 1})` },
      { formula: `SUM(F2:F${rowNumber - 1})` },
      { formula: `SUM(G2:G${rowNumber - 1})` },
      { formula: `SUM(H2:H${rowNumber - 1})` },
      "",
      { formula: `SUM(J2:J${rowNumber - 1})` }
    ]);
    totalsRow.font = { bold: true };
    totalsRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFEB9C" }
    };
  }

  // Number formatting
  worksheet.getColumn(6).numFmt = "#,##0.00"; // Volume
  worksheet.getColumn(7).numFmt = "#,##0.00"; // Area
  worksheet.getColumn(8).numFmt = "#,##0.00"; // Length
  worksheet.getColumn(9).numFmt = "$#,##0.00"; // Unit Cost
  worksheet.getColumn(10).numFmt = "$#,##0.00"; // Total Cost

  // Auto-filter
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length }
  };

  // Freeze header row
  worksheet.views = [{
    state: "frozen",
    ySplit: 1
  }];
}

/**
 * Create materials worksheet
 */
function createMaterialsSheet(worksheet: ExcelJS.Worksheet, materials: any[]) {
  // Headers
  const headerRow = worksheet.addRow(["Material", "Category", "Volume", "Area", "Mass"]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF70AD47" }
  };

  // Data rows
  for (const material of materials) {
    worksheet.addRow([
      material.name,
      material.category,
      material.volume,
      material.area,
      material.mass
    ]);
  }

  // Number formatting
  worksheet.getColumn(3).numFmt = "#,##0.00"; // Volume
  worksheet.getColumn(4).numFmt = "#,##0.00"; // Area
  worksheet.getColumn(5).numFmt = "#,##0.00"; // Mass
}

/**
 * Create cost breakdown worksheet
 */
function createCostBreakdownSheet(worksheet: ExcelJS.Worksheet, costs: any[], includeFormulas: boolean) {
  // Headers
  const headerRow = worksheet.addRow(["Category", "Item", "Quantity", "Unit", "Unit Cost", "Total Cost", "Percentage"]);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC000" }
  };

  // Data rows
  let rowNumber = 2;
  for (const cost of costs) {
    const row = worksheet.addRow([
      cost.category,
      cost.item,
      cost.quantity,
      cost.unit,
      cost.unitCost
    ]);

    // Total cost formula
    if (includeFormulas) {
      row.getCell(6).value = { formula: `C${rowNumber}*E${rowNumber}` };
    } else {
      row.getCell(6).value = cost.totalCost;
    }

    rowNumber++;
  }

  // Grand total
  const totalRow = worksheet.addRow([
    "GRAND TOTAL",
    "",
    "",
    "",
    "",
    { formula: `SUM(F2:F${rowNumber - 1})` },
    ""
  ]);
  totalRow.font = { bold: true, size: 12 };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFEB9C" }
  };

  // Add percentage formulas
  if (includeFormulas) {
    for (let i = 2; i < rowNumber; i++) {
      worksheet.getCell(`G${i}`).value = { formula: `F${i}/F$${rowNumber}` };
      worksheet.getCell(`G${i}`).numFmt = "0.00%";
    }
  }

  // Number formatting
  worksheet.getColumn(5).numFmt = "$#,##0.00"; // Unit Cost
  worksheet.getColumn(6).numFmt = "$#,##0.00"; // Total Cost
}
