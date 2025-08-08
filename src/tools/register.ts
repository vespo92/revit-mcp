import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";

export async function registerTools(server: McpServer): Promise<void> {
  // Get the directory path of the current file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Read all files in the tools directory
  const files = fs.readdirSync(__dirname);

  // Filter for .ts or .js files, excluding index and register files
  const toolFiles = files.filter(
    (file) =>
      (file.endsWith(".ts") || file.endsWith(".js")) &&
      file !== "index.ts" &&
      file !== "index.js" &&
      file !== "register.ts" &&
      file !== "register.js" &&
      !file.includes(".deprecated") &&
      !file.includes(".test")
  );

  logger.info(`Found ${toolFiles.length} tools to register`);

  // Dynamically import and register each tool
  for (const file of toolFiles) {
    try {
      // Build import path
      const importPath = `./${file.replace(/\.(ts|js)$/, ".js")}`;

      // Dynamically import the module
      const module = await import(importPath);

      // Find and execute the registration function
      const registerFunctionName = Object.keys(module).find(
        (key) => key.startsWith("register") && typeof module[key] === "function"
      );

      if (registerFunctionName) {
        await module[registerFunctionName](server);
        logger.info(`Registered tool: ${file}`);
      } else {
        logger.warn(`Warning: No registration function found in file ${file}`);
      }
    } catch (error) {
      logger.error(`Error registering tool ${file}:`, error);
      // Continue registering other tools even if one fails
    }
  }

  logger.info("Tool registration completed");
}
