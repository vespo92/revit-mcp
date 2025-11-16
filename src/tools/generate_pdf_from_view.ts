import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { withRevitConnection } from "../utils/ConnectionManager.js";
import PDFDocument from "pdfkit";
import fs from "fs";

/**
 * Tool: generate_pdf_from_view
 *
 * Generates a PDF document from Revit views or sheets.
 * Can export single views, multiple views, or entire sheet sets.
 *
 * @param outputPath - Path where the PDF file will be saved
 * @param exportMode - 'current_view' | 'sheet' | 'multiple_views' | 'sheet_set'
 * @param viewNames - Array of view names to export (for 'multiple_views' mode)
 * @param sheetNumbers - Array of sheet numbers to export (for 'sheet' or 'sheet_set' mode)
 * @param includeTitle - Include title block information (default: true)
 * @param pageSize - PDF page size (default: 'ARCH_D')
 * @param orientation - 'landscape' | 'portrait' (default: 'landscape')
 * @param colorMode - 'color' | 'grayscale' | 'blackwhite' (default: 'color')
 * @param dpi - Resolution in DPI (default: 300)
 * @param includeMetadata - Include document metadata (default: true)
 */
export function registerGeneratePdfFromViewTool(server: McpServer) {
  server.tool(
    "generate_pdf_from_view",
    "Generate PDF document from Revit views or sheets. Supports single views, multiple views, or entire sheet sets.",
    {
      outputPath: z.string().describe("Path where the PDF file will be saved"),
      exportMode: z.enum(["current_view", "sheet", "multiple_views", "sheet_set"]).describe("Export mode"),
      viewNames: z.array(z.string()).optional().describe("Array of view names to export (for 'multiple_views' mode)"),
      sheetNumbers: z.array(z.string()).optional().describe("Array of sheet numbers to export"),
      includeTitle: z.boolean().optional().default(true).describe("Include title block information"),
      pageSize: z.string().optional().default("ARCH_D").describe("PDF page size (ARCH_D, ARCH_E, A3, A4, etc.)"),
      orientation: z.enum(["landscape", "portrait"]).optional().default("landscape").describe("Page orientation"),
      colorMode: z.enum(["color", "grayscale", "blackwhite"]).optional().default("color").describe("Color mode"),
      dpi: z.number().optional().default(300).describe("Resolution in DPI"),
      includeMetadata: z.boolean().optional().default(true).describe("Include document metadata")
    },
    async (args) => {
      try {
        // Request Revit to generate view images
        const viewDataResponse = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("export_views_for_pdf", {
            exportMode: args.exportMode,
            viewNames: args.viewNames,
            sheetNumbers: args.sheetNumbers,
            dpi: args.dpi,
            colorMode: args.colorMode
          });
        });

        if (!viewDataResponse.success) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: viewDataResponse.error || "Failed to export views from Revit"
              })
            }]
          };
        }

        // Create PDF document
        const pageSizes = getPageSizeDimensions(args.pageSize);
        const doc = new PDFDocument({
          size: args.pageSize,
          layout: args.orientation,
          margin: 0,
          info: args.includeMetadata ? {
            Title: viewDataResponse.projectName || "Revit Export",
            Author: viewDataResponse.author || "Revit MCP",
            Subject: `Revit ${args.exportMode} export`,
            Keywords: "Revit, BIM, Construction",
            CreationDate: new Date()
          } : {}
        });

        // Pipe to file
        const stream = doc.pipe(fs.createWriteStream(args.outputPath));

        let pageCount = 0;

        // Add views to PDF
        for (const viewData of viewDataResponse.views) {
          if (pageCount > 0) {
            doc.addPage();
          }

          // Add title block if requested
          if (args.includeTitle && viewData.titleBlock) {
            addTitleBlock(doc, viewData.titleBlock, pageSizes);
          }

          // Add view image
          if (viewData.imageData) {
            // Image data is base64 encoded
            const imageBuffer = Buffer.from(viewData.imageData, "base64");
            const imageOptions = calculateImagePlacement(
              viewData.width,
              viewData.height,
              pageSizes.width,
              pageSizes.height,
              args.includeTitle
            );

            doc.image(imageBuffer, imageOptions.x, imageOptions.y, {
              width: imageOptions.width,
              height: imageOptions.height
            });
          }

          // Add view name/sheet number
          doc.fontSize(10)
             .fillColor("black")
             .text(viewData.name || viewData.sheetNumber, 20, 20);

          pageCount++;
        }

        // Finalize PDF
        doc.end();

        // Wait for file to be written
        await new Promise((resolve, reject) => {
          stream.on("finish", () => resolve(undefined));
          stream.on("error", (err) => reject(err));
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              outputPath: args.outputPath,
              pageCount,
              views: viewDataResponse.views.map((v: any) => ({
                name: v.name,
                sheetNumber: v.sheetNumber
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
 * Get page size dimensions in points (72 points = 1 inch)
 */
function getPageSizeDimensions(pageSize: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "ARCH_D": { width: 36 * 72, height: 24 * 72 },
    "ARCH_E": { width: 48 * 72, height: 36 * 72 },
    "A4": { width: 595, height: 842 },
    "A3": { width: 842, height: 1191 },
    "A2": { width: 1191, height: 1684 },
    "A1": { width: 1684, height: 2384 },
    "LETTER": { width: 612, height: 792 },
    "LEGAL": { width: 612, height: 1008 },
    "TABLOID": { width: 792, height: 1224 }
  };

  return sizes[pageSize] || sizes["ARCH_D"];
}

/**
 * Add title block to PDF
 */
function addTitleBlock(doc: any, titleBlock: any, pageSize: { width: number; height: number }) {
  const margin = 20;
  const titleBlockHeight = 100;
  const y = pageSize.height - titleBlockHeight - margin;

  // Draw title block border
  doc.rect(margin, y, pageSize.width - 2 * margin, titleBlockHeight)
     .stroke();

  // Add title block fields
  let fieldY = y + 15;
  const fieldX = margin + 10;

  if (titleBlock.projectName) {
    doc.fontSize(12).font("Helvetica-Bold").text(`Project: ${titleBlock.projectName}`, fieldX, fieldY);
    fieldY += 20;
  }

  if (titleBlock.sheetNumber) {
    doc.fontSize(10).font("Helvetica").text(`Sheet: ${titleBlock.sheetNumber}`, fieldX, fieldY);
    fieldY += 15;
  }

  if (titleBlock.sheetName) {
    doc.fontSize(10).text(`Name: ${titleBlock.sheetName}`, fieldX, fieldY);
    fieldY += 15;
  }

  if (titleBlock.date) {
    doc.fontSize(8).text(`Date: ${titleBlock.date}`, fieldX, fieldY);
  }
}

/**
 * Calculate optimal image placement
 */
function calculateImagePlacement(
  imageWidth: number,
  imageHeight: number,
  pageWidth: number,
  pageHeight: number,
  hasTitleBlock: boolean
): { x: number; y: number; width: number; height: number } {
  const margin = 20;
  const titleBlockHeight = hasTitleBlock ? 120 : 0;

  const availableWidth = pageWidth - 2 * margin;
  const availableHeight = pageHeight - 2 * margin - titleBlockHeight;

  // Calculate scale to fit
  const scaleX = availableWidth / imageWidth;
  const scaleY = availableHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);

  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  // Center the image
  const x = (pageWidth - scaledWidth) / 2;
  const y = margin;

  return {
    x,
    y,
    width: scaledWidth,
    height: scaledHeight
  };
}
