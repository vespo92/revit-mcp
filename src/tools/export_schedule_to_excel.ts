import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import ExcelJS from "exceljs";

/**
 * Tool: export_schedule_to_excel
 *
 * Exports Revit schedules to Excel format. Supports single schedules or multiple schedules
 * to separate worksheets. Includes formatting, formulas, and conditional formatting.
 *
 * @param outputPath - Path where the Excel file will be saved
 * @param scheduleNames - Array of schedule names to export
 * @param includeFormatting - Apply formatting from Revit schedule (default: true)
 * @param includeFormulas - Include calculated values as formulas (default: false)
 * @param freezeHeaders - Freeze header rows (default: true)
 * @param autoFilter - Enable auto-filter on columns (default: true)
 * @param includeTitle - Include schedule title (default: true)
 * @param worksheetMode - 'separate' | 'combined' (default: 'separate')
 */
export function registerExportScheduleToExcelTool(server: McpServer) {
  server.tool(
    "export_schedule_to_excel",
    "Export Revit schedules to Excel format. Supports single or multiple schedules with formatting.",
    {
      outputPath: z.string().describe("Path where the Excel file will be saved"),
      scheduleNames: z.array(z.string()).describe("Array of schedule names to export"),
      includeFormatting: z.boolean().optional().default(true).describe("Apply formatting from Revit schedule"),
      includeFormulas: z.boolean().optional().default(false).describe("Include calculated values as formulas"),
      freezeHeaders: z.boolean().optional().default(true).describe("Freeze header rows"),
      autoFilter: z.boolean().optional().default(true).describe("Enable auto-filter on columns"),
      includeTitle: z.boolean().optional().default(true).describe("Include schedule title"),
      worksheetMode: z.enum(["separate", "combined"]).optional().default("separate").describe("Worksheet mode: separate sheets or combined")
    },
    async (args) => {
      try {
        // Get schedule data from Revit
        const scheduleDataResponse = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_schedules_data", {
            scheduleNames: args.scheduleNames,
            includeFormatting: args.includeFormatting,
            includeFormulas: args.includeFormulas
          });
        });

        if (!scheduleDataResponse.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: scheduleDataResponse.error || "Failed to get schedule data from Revit"
              })
            }]
          };
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Revit MCP";
        workbook.created = new Date();

        let totalRows = 0;

        // Add schedules to workbook
        for (const scheduleData of scheduleDataResponse.schedules) {
          const worksheetName = scheduleData.name.substring(0, 31); // Excel limit
          const worksheet = workbook.addWorksheet(worksheetName);

          let currentRow = 1;

          // Add title if requested
          if (args.includeTitle) {
            const titleRow = worksheet.getRow(currentRow);
            titleRow.getCell(1).value = scheduleData.name;
            titleRow.getCell(1).font = { size: 14, bold: true };
            titleRow.height = 20;
            currentRow += 2;
          }

          // Add headers
          const headerRow = worksheet.getRow(currentRow);
          scheduleData.headers.forEach((header: string, index: number) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFD3D3D3" }
            };
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
          });

          if (args.freezeHeaders) {
            worksheet.views = [{
              state: "frozen",
              ySplit: currentRow
            }];
          }

          currentRow++;

          // Add data rows
          for (const rowData of scheduleData.rows) {
            const dataRow = worksheet.getRow(currentRow);
            rowData.forEach((value: any, index: number) => {
              const cell = dataRow.getCell(index + 1);

              // Handle different value types
              if (typeof value === "object" && value !== null) {
                if (value.formula) {
                  cell.value = { formula: value.formula };
                } else {
                  cell.value = value.value;
                }

                // Apply formatting if provided
                if (args.includeFormatting && value.format) {
                  applyExcelFormatting(cell, value.format);
                }
              } else {
                cell.value = value;
              }

              // Add borders
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
              };
            });
            currentRow++;
            totalRows++;
          }

          // Auto-fit columns
          worksheet.columns.forEach((column, _index) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
              const cellValue = cell.value ? cell.value.toString() : "";
              maxLength = Math.max(maxLength, cellValue.length);
            });
            column.width = Math.min(Math.max(maxLength + 2, 10), 50);
          });

          // Enable auto-filter if requested
          if (args.autoFilter) {
            const headerRowNum = args.includeTitle ? 3 : 1;
            worksheet.autoFilter = {
              from: { row: headerRowNum, column: 1 },
              to: { row: headerRowNum, column: scheduleData.headers.length }
            };
          }
        }

        // Write file
        await workbook.xlsx.writeFile(args.outputPath);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              outputPath: args.outputPath,
              scheduleCount: scheduleDataResponse.schedules.length,
              totalRows,
              schedules: scheduleDataResponse.schedules.map((s: any) => ({
                name: s.name,
                rows: s.rows.length,
                columns: s.headers.length
              }))
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
 * Apply Excel cell formatting
 */
function applyExcelFormatting(cell: any, format: any) {
  if (format.numberFormat) {
    cell.numFmt = format.numberFormat;
  }

  if (format.font) {
    cell.font = format.font;
  }

  if (format.fill) {
    cell.fill = format.fill;
  }

  if (format.alignment) {
    cell.alignment = format.alignment;
  }
}
