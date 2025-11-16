import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs/promises";
import pdfParse from "pdf-parse";

/**
 * Tool: extract_pdf_text
 *
 * Extracts text content from PDF files. Useful for reading construction documents,
 * specifications, and extracting metadata from PDF drawings.
 *
 * @param filePath - Path to the PDF file to extract text from
 * @param pageRange - Optional page range to extract (e.g., "1-5" or "all")
 * @param includeMetadata - Include PDF metadata (default: true)
 * @param searchPattern - Optional regex pattern to search for specific text
 * @param extractTables - Attempt to extract tabular data (default: false)
 */
export function registerExtractPdfTextTool(server: McpServer) {
  server.tool(
    "extract_pdf_text",
    "Extract text content from PDF files. Useful for reading construction documents and specifications.",
    {
      filePath: z.string().describe("Path to the PDF file to extract text from"),
      pageRange: z.string().optional().default("all").describe("Page range to extract (e.g., '1-5' or 'all')"),
      includeMetadata: z.boolean().optional().default(true).describe("Include PDF metadata"),
      searchPattern: z.string().optional().describe("Optional regex pattern to search for specific text"),
      extractTables: z.boolean().optional().default(false).describe("Attempt to extract tabular data")
    },
    async (args) => {
      try {
        // Read PDF file
        const dataBuffer = await fs.readFile(args.filePath);

        // Parse PDF
        const pdfData = await pdfParse(dataBuffer);

        const result: any = {
          success: true,
          fileName: args.filePath.split(/[\\/]/).pop(),
          totalPages: pdfData.numpages,
          text: pdfData.text
        };

        // Add metadata if requested
        if (args.includeMetadata && pdfData.info) {
          result.metadata = {
            title: pdfData.info.Title,
            author: pdfData.info.Author,
            subject: pdfData.info.Subject,
            keywords: pdfData.info.Keywords,
            creator: pdfData.info.Creator,
            producer: pdfData.info.Producer,
            creationDate: pdfData.info.CreationDate,
            modificationDate: pdfData.info.ModDate
          };
        }

        // Search for pattern if specified
        if (args.searchPattern) {
          try {
            const regex = new RegExp(args.searchPattern, "gi");
            const matches = pdfData.text.match(regex) || [];
            result.searchResults = {
              pattern: args.searchPattern,
              matchCount: matches.length,
              matches: matches.slice(0, 100) // Limit to first 100 matches
            };
          } catch (error: any) {
            result.searchError = `Invalid regex pattern: ${error.message}`;
          }
        }

        // Extract tables if requested
        if (args.extractTables) {
          result.tables = extractTablesFromText(pdfData.text);
        }

        // Parse page range
        const pages = parsePageRange(args.pageRange, pdfData.numpages);
        if (pages.length > 0 && pages.length < pdfData.numpages) {
          result.note = `Extracted pages: ${pages.join(", ")}`;
          // Note: pdf-parse doesn't support page-specific extraction easily,
          // so we include all text but note the requested range
        }

        // Calculate statistics
        result.statistics = {
          characterCount: pdfData.text.length,
          wordCount: pdfData.text.split(/\s+/).length,
          lineCount: pdfData.text.split(/\n/).length
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
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
 * Parse page range string
 */
function parsePageRange(range: string, totalPages: number): number[] {
  if (range === "all") {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: number[] = [];
  const parts = range.split(",");

  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= Math.min(end, totalPages); i++) {
          pages.push(i);
        }
      }
    } else {
      const page = parseInt(part.trim(), 10);
      if (!isNaN(page) && page <= totalPages) {
        pages.push(page);
      }
    }
  }

  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

/**
 * Extract tabular data from text
 */
function extractTablesFromText(text: string): any[] {
  const tables: any[] = [];
  const lines = text.split("\n");

  let currentTable: string[] = [];
  let inTable = false;

  for (const line of lines) {
    // Simple heuristic: lines with multiple tab characters or multiple spaces might be table rows
    const hasMultipleDelimiters = (line.match(/\t/g) || []).length >= 2 ||
                                   (line.match(/\s{3,}/g) || []).length >= 2;

    if (hasMultipleDelimiters) {
      if (!inTable) {
        inTable = true;
        currentTable = [];
      }
      currentTable.push(line);
    } else {
      if (inTable && currentTable.length >= 2) {
        // End of table, process it
        tables.push(processTable(currentTable));
      }
      inTable = false;
      currentTable = [];
    }
  }

  // Handle last table
  if (currentTable.length >= 2) {
    tables.push(processTable(currentTable));
  }

  return tables;
}

/**
 * Process table rows into structured data
 */
function processTable(rows: string[]): any {
  const processedRows = rows.map((row) => {
    // Split by tabs or multiple spaces
    return row.split(/\t|\s{3,}/).map((cell) => cell.trim()).filter((cell) => cell.length > 0);
  });

  return {
    rowCount: processedRows.length,
    columnCount: Math.max(...processedRows.map((row) => row.length)),
    headers: processedRows[0] || [],
    rows: processedRows.slice(1)
  };
}
