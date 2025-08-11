import crypto from "crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { withRevitConnection } from "../utils/ConnectionManager.js";


// Whitelist of allowed Revit API namespaces
const ALLOWED_NAMESPACES = [
  "Autodesk.Revit.DB",
  "Autodesk.Revit.UI",
  "System.Linq",
  "System.Collections.Generic"
];

// Blacklist of dangerous patterns
const DANGEROUS_PATTERNS = [
  /System\.IO/i,
  /System\.Diagnostics/i,
  /System\.Net/i,
  /System\.Reflection/i,
  /System\.Runtime/i,
  /Process\./i,
  /File\./i,
  /Directory\./i,
  /Assembly\./i,
  /AppDomain/i,
  /SecurityManager/i,
  /Process\.Start/i,
  /WebClient/i,
  /HttpClient/i,
  /Socket/i,
  /Registry/i,
  /Environment\.Exit/i,
  /Marshal\./i,
  /DllImport/i,
  /unsafe\s+/i,
  /fixed\s*\(/i
];

// Predefined safe code templates
const CODE_TEMPLATES = {
  duplicate_elements: `
    var elementIds = parameters[0] as List<ElementId>;
    var translation = parameters[1] as XYZ;
    
    using (Transaction t = new Transaction(doc, "Duplicate Elements"))
    {
        t.Start();
        var copiedIds = ElementTransformUtils.CopyElements(doc, elementIds, translation);
        t.Commit();
        return copiedIds.Select(id => id.IntegerValue).ToList();
    }
  `,
  
  get_element_parameters: `
    var elementId = (int)parameters[0];
    var element = doc.GetElement(new ElementId(elementId));
    if (element == null) return null;
    
    var paramData = new Dictionary<string, object>();
    foreach (Parameter param in element.Parameters)
    {
        if (param.HasValue && param.Definition != null)
        {
            paramData[param.Definition.Name] = param.AsValueString();
        }
    }
    return paramData;
  `,
  
  create_floor_plan: `
    var levelId = (int)parameters[0];
    var viewName = parameters[1] as string;
    
    var level = doc.GetElement(new ElementId(levelId)) as Level;
    if (level == null) return "Level not found";
    
    using (Transaction t = new Transaction(doc, "Create Floor Plan"))
    {
        t.Start();
        var viewPlan = ViewPlan.Create(doc, doc.GetDefaultElementTypeId(ElementTypeGroup.ViewTypeFloorPlan), level.Id);
        viewPlan.Name = viewName;
        t.Commit();
        return viewPlan.Id.IntegerValue;
    }
  `
};

function validateCode(code: string): { isValid: boolean; reason?: string } {
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return { 
        isValid: false, 
        reason: `Code contains prohibited pattern: ${pattern.source}` 
      };
    }
  }

  // Check for attempts to bypass validation
  if (code.includes("\\u") || code.includes("\\x") || code.includes("\\0")) {
    return { 
      isValid: false, 
      reason: "Code contains encoded characters" 
    };
  }

  // Limit code length
  if (code.length > 5000) {
    return { 
      isValid: false, 
      reason: "Code exceeds maximum length of 5000 characters" 
    };
  }

  return { isValid: true };
}

export function registerSendCodeToRevitSecureTool(server: McpServer) {
  server.tool(
    "send_code_to_revit_secure",
    "Execute pre-approved code templates or validated custom code in Revit. This is a secure version that validates all code before execution.",
    {
      data: z.object({
        template: z
          .enum(["duplicate_elements", "get_element_parameters", "create_floor_plan", "custom"])
          .describe("Choose a pre-approved template or 'custom' for validated custom code"),
        code: z
          .string()
          .optional()
          .describe("Custom C# code (only used when template='custom'). Must pass security validation."),
        parameters: z
          .array(z.any())
          .optional()
          .describe("Parameters to pass to the code"),
        apiKey: z
          .string()
          .describe("API key for authentication")
      })
    },
    async (args, extra) => {
      // Validate API key
      const validApiKey = process.env.REVIT_MCP_API_KEY;
      if (!validApiKey || args.data.apiKey !== validApiKey) {
        return {
          content: [{
            type: "text",
            text: "Authentication failed: Invalid API key"
          }]
        };
      }

      let codeToExecute: string;

      if (args.data.template === "custom") {
        if (!args.data.code) {
          return {
            content: [{
              type: "text",
              text: "Error: Custom code is required when template='custom'"
            }]
          };
        }

        // Validate custom code
        const validation = validateCode(args.data.code);
        if (!validation.isValid) {
          return {
            content: [{
              type: "text",
              text: `Code validation failed: ${validation.reason}`
            }]
          };
        }

        codeToExecute = args.data.code;
      } else {
        // Use pre-approved template
        codeToExecute = CODE_TEMPLATES[args.data.template];
        if (!codeToExecute) {
          return {
            content: [{
              type: "text",
              text: `Error: Unknown template '${args.data.template}'`
            }]
          };
        }
      }

      // Add execution ID for audit logging
      const executionId = crypto.randomUUID();
      
      const params = {
        code: codeToExecute,
        parameters: args.data.parameters || [],
        executionId: executionId,
        timestamp: new Date().toISOString()
      };

      try {
        // Log execution attempt
        console.log(`Code execution attempt: ${executionId} at ${params.timestamp}`);
        
        const response = await withRevitConnection(async (revitClient) => {
          return await revitClient.sendCommand("send_code_to_revit_secure", params);
        });

        return {
          content: [{
            type: "text",
            text: `Code execution successful!\nExecution ID: ${executionId}\nResult: ${JSON.stringify(response, null, 2)}`
          }]
        };
      } catch (error) {
        console.error(`Code execution failed: ${executionId}`, error);
        return {
          content: [{
            type: "text",
            text: `Code execution failed: ${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    }
  );
}