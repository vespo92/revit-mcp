import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import ExcelJS from "exceljs";

/**
 * Tool: import_parameters_from_excel
 *
 * Imports parameter values from Excel file and updates Revit elements.
 * Supports bulk parameter updates based on element IDs or unique identifiers.
 *
 * @param filePath - Path to the Excel file to import
 * @param worksheetName - Name of the worksheet to import (optional, uses first sheet if not specified)
 * @param identifierColumn - Column name containing element identifiers (ID, Mark, or UniqueId)
 * @param identifierType - Type of identifier: 'ElementId' | 'Mark' | 'UniqueId'
 * @param parameterMapping - Map of Excel column names to Revit parameter names
 * @param skipHeaderRows - Number of header rows to skip (default: 1)
 * @param validateOnly - Only validate data without making changes (default: false)
 * @param createTransaction - Create a transaction for the import (default: true)
 */
export function registerImportParametersFromExcelTool(server: McpServer) {
  server.tool(
    "import_parameters_from_excel",
    "Import parameter values from Excel and update Revit elements. Supports bulk parameter updates.",
    {
      filePath: z.string().describe("Path to the Excel file to import"),
      worksheetName: z.string().optional().describe("Name of the worksheet to import (uses first sheet if not specified)"),
      identifierColumn: z.string().describe("Column name containing element identifiers"),
      identifierType: z.enum(["ElementId", "Mark", "UniqueId"]).describe("Type of identifier column"),
      parameterMapping: z.record(z.string()).describe("Map of Excel column names to Revit parameter names (JSON object)"),
      skipHeaderRows: z.number().optional().default(1).describe("Number of header rows to skip"),
      validateOnly: z.boolean().optional().default(false).describe("Only validate data without making changes"),
      createTransaction: z.boolean().optional().default(true).describe("Create a transaction for the import")
    },
    async (args) => {
      try {
        // Read Excel file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(args.filePath);

        // Get worksheet
        const worksheet = args.worksheetName
          ? workbook.getWorksheet(args.worksheetName)
          : workbook.worksheets[0];

        if (!worksheet) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Worksheet not found: ${args.worksheetName || "first sheet"}`
              })
            }]
          };
        }

        // Find header row
        const headerRow = worksheet.getRow(args.skipHeaderRows);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.value?.toString() || "";
        });

        // Find identifier column index
        const identifierColIndex = headers.indexOf(args.identifierColumn);
        if (identifierColIndex === -1) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Identifier column not found: ${args.identifierColumn}`
              })
            }]
          };
        }

        // Build parameter update data
        const updates: any[] = [];
        let rowCount = 0;

        worksheet.eachRow((row, rowNumber) => {
          // Skip header rows
          if (rowNumber <= args.skipHeaderRows) {
            return;
          }

          const identifier = row.getCell(identifierColIndex + 1).value?.toString();
          if (!identifier) {
            return; // Skip rows without identifier
          }

          const parameters: Record<string, any> = {};

          // Map Excel columns to Revit parameters
          for (const [excelColumn, revitParameter] of Object.entries(args.parameterMapping)) {
            const colIndex = headers.indexOf(excelColumn);
            if (colIndex !== -1) {
              const value = row.getCell(colIndex + 1).value;
              parameters[revitParameter] = convertExcelValue(value);
            }
          }

          if (Object.keys(parameters).length > 0) {
            updates.push({
              identifier,
              identifierType: args.identifierType,
              parameters
            });
            rowCount++;
          }
        });

        // Send to Revit for processing
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("import_parameters_from_data", {
            updates,
            validateOnly: args.validateOnly,
            createTransaction: args.createTransaction
          });
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              mode: args.validateOnly ? "validation" : "import",
              totalRows: rowCount,
              processedElements: response.processedCount || 0,
              failedElements: response.failedCount || 0,
              errors: response.errors || [],
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
 * Convert Excel cell value to appropriate type
 */
function convertExcelValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Handle Excel formula results
  if (typeof value === "object" && "result" in value) {
    return value.result;
  }

  // Handle date values
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle rich text
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((t: any) => t.text).join("");
  }

  return value;
}
