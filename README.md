# 🏗️ Revit MCP Server

[![npm version](https://img.shields.io/npm/v/revit-mcp.svg)](https://www.npmjs.com/package/revit-mcp)
[![npm downloads](https://img.shields.io/npm/dm/revit-mcp.svg)](https://www.npmjs.com/package/revit-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.7.0-green)](https://modelcontextprotocol.io)
[![Node.js Version](https://img.shields.io/node/v/revit-mcp.svg)](https://nodejs.org)
[![GitHub Stars](https://img.shields.io/github/stars/espocorp/revit-mcp)](https://github.com/espocorp/revit-mcp)
[![GitHub Issues](https://img.shields.io/github/issues/espocorp/revit-mcp)](https://github.com/espocorp/revit-mcp/issues)

**AI-Powered Revit Automation with AutoCAD, PDF, and Excel Integration**

A comprehensive TypeScript MCP (Model Context Protocol) server for Autodesk Revit with AutoCAD DXF, PDF, and Excel integration. Enable AI assistants like Claude to interact with and automate Revit, coordinate with AutoCAD drawings, generate reports, and manage data across multiple platforms through natural language.

## 🌟 Features

### Core Revit Automation
- 🤖 **AI-Native Integration**: Built specifically for AI assistants to understand and manipulate Revit models
- 🔧 **Comprehensive Tool Set**: 25+ specialized tools for creating, modifying, and analyzing Revit elements
- 🏢 **Advanced Automation**: Elevator systems, floor duplication, and intelligent element operations
- 🔍 **Smart Filtering**: AI-powered element querying with natural language understanding

### Cross-Platform Integration
- 📐 **AutoCAD DXF Support**: Import/export DXF files, parse metadata, coordinate with AutoCAD drawings
- 📄 **PDF Generation & Parsing**: Generate PDFs from Revit views/sheets, extract text from construction documents
- 📊 **Excel Integration**: Export schedules, import parameters, generate quantity takeoffs with formatting
- 🔄 **AutoCAD Coordination**: Compare Revit models with AutoCAD drawings, identify discrepancies, generate reports

### Security & Performance
- 🔐 **Secure Code Execution**: Validated and sandboxed code execution environment
- ⚡ **Real-time Communication**: WebSocket-based connection for instant feedback
- 📊 **Optional Caching**: Redis integration for performance optimization
- 🎯 **Type-Safe**: Full TypeScript implementation with comprehensive type definitions

## 📋 Requirements

- Node.js 18+ 
- Autodesk Revit with [revit-mcp-plugin](https://github.com/revit-mcp/revit-mcp-plugin) installed
- Claude Desktop or any MCP-compatible client

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/espocorp/revit-mcp.git
cd revit-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "revit-mcp": {
      "command": "node",
      "args": ["<path-to-project>/build/index.js"]
    }
  }
}
```

### Environment Variables (Optional)

Create a `.env` file for advanced features:

```env
# Security
REVIT_MCP_API_KEY=your-secure-api-key

# Redis (optional - for caching)
REDIS_PASSWORD=your-redis-password

# ChromaDB (optional - for vector search)
CHROMA_AUTH_TOKEN=your-chroma-token
```

## 🛠️ Available Tools

### Core Element Operations

| Tool | Description |
|------|-------------|
| `get_current_view_info` | Retrieve information about the active Revit view |
| `get_current_view_elements` | List all elements visible in the current view |
| `get_selected_elements` | Get details of currently selected elements |
| `get_available_family_types` | List all family types available in the project |

### Element Creation

| Tool | Description |
|------|-------------|
| `create_point_based_element` | Place elements at specific points (doors, windows, furniture) |
| `create_line_based_element` | Create linear elements (walls, beams, pipes) |
| `create_surface_based_element` | Generate surface elements (floors, ceilings, roofs) |
| `createWall` | Specialized wall creation with detailed parameters |

### Element Modification

| Tool | Description |
|------|-------------|
| `modify_element` | Update element properties and parameters |
| `delete_element` | Remove elements from the model |
| `operate_element` | Perform operations (hide, isolate, select) |
| `color_elements` | Apply color overrides based on parameter values |

### Advanced Features

| Tool | Description |
|------|-------------|
| `ai_element_filter` | Intelligent element querying with natural language |
| `duplicate_floor_elements` | Replicate entire floor layouts with smart filtering |
| `elevator_automation` | Complete elevator system design and placement |
| `tag_all_walls` | Automatically tag walls in views |
| `send_code_to_revit_secure` | Execute validated C# code in Revit |

### AutoCAD Integration

| Tool | Description |
|------|-------------|
| `import_dxf` | Import AutoCAD DXF files and convert to Revit elements |
| `export_to_dxf` | Export Revit elements to AutoCAD DXF format |
| `parse_dxf_metadata` | Extract metadata and structure from DXF files |
| `coordinate_with_autocad` | Compare Revit with AutoCAD, generate coordination reports |

### PDF Tools

| Tool | Description |
|------|-------------|
| `generate_pdf_from_view` | Generate PDF documents from Revit views or sheets |
| `extract_pdf_text` | Extract text content from PDF construction documents |

### Excel Integration

| Tool | Description |
|------|-------------|
| `export_schedule_to_excel` | Export Revit schedules to Excel with formatting |
| `import_parameters_from_excel` | Import parameter values from Excel for bulk updates |
| `generate_quantity_takeoff` | Generate material quantity takeoff reports in Excel |

### Module System

| Tool | Description |
|------|-------------|
| `search_modules` | Find available automation modules |
| `use_module` | Execute pre-built automation modules |

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph "AI Client"
        Claude[Claude Desktop]
    end
    
    subgraph "MCP Server"
        TS[TypeScript MCP Server]
        WS[WebSocket Client]
        CM[Connection Manager]
        Auth[Auth Module]
    end
    
    subgraph "Revit"
        Plugin[revit-mcp-plugin]
        API[Revit API]
        Model[BIM Model]
    end
    
    subgraph "Optional Services"
        Redis[(Redis Cache)]
        ChromaDB[(Vector DB)]
    end
    
    Claude <-->|MCP Protocol| TS
    TS --> WS
    WS <-->|WebSocket:60100| Plugin
    Plugin <--> API
    API <--> Model
    TS -.->|Optional| Redis
    TS -.->|Optional| ChromaDB
    CM --> WS
    Auth --> TS
```

## 📦 Development

### Scripts

```bash
# Development
npm run dev          # Watch mode for development
npm run build        # Build the project
npm run test         # Run tests
npm run lint         # Lint code
npm run format       # Format code

# Docker Services (Optional)
npm run docker:up    # Start Redis & ChromaDB
npm run docker:down  # Stop services
npm run docker:logs  # View service logs
```

### Project Structure

```
revit-mcp/
├── src/
│   ├── index.ts              # Main entry point
│   ├── tools/                # MCP tool implementations
│   │   ├── ai_element_filter.ts
│   │   ├── elevator_automation.ts
│   │   └── ...
│   ├── utils/                # Utility modules
│   │   ├── ConnectionManager.ts
│   │   ├── SocketClient.ts
│   │   ├── auth.ts
│   │   └── ...
│   └── types/                # TypeScript definitions
│       └── revit.ts
├── __tests__/                # Test files
├── docker-compose.yml        # Optional services
├── package.json
└── tsconfig.json
```

## 🔒 Security

This MCP server implements multiple security layers:

- **API Key Authentication**: Secure tool access with API keys
- **Code Validation**: Sandboxed execution environment for custom code
- **Pattern Blacklisting**: Prevents execution of dangerous code patterns
- **Rate Limiting**: Built-in protection against abuse
- **Secure WebSocket**: Encrypted communication with Revit

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Integration tests
npm run test:integration
```

## 📖 Example Usage

Once configured, you can interact with Revit through Claude:

### Basic Revit Operations
```
User: "Create a 10-foot wall at the origin"
Claude: I'll create a wall for you using the Revit MCP tools...
[Creates wall in Revit]

User: "Find all doors in the current view"
Claude: Let me query the elements in your current view...
[Returns list of doors with properties]

User: "Duplicate the 3rd floor layout to the 5th floor"
Claude: I'll help you duplicate the floor elements...
[Copies all elements with intelligent filtering]
```

### AutoCAD Integration
```
User: "Import the site plan DXF file and place it on the Site level"
Claude: I'll import the DXF file and convert the entities to Revit elements...
[Imports DXF with coordinate conversion]

User: "Compare my Revit model with the architect's latest DXF and generate a coordination report"
Claude: I'll analyze both files and create a coordination report in Excel...
[Generates detailed discrepancy report]

User: "Export the current floor plan to DXF for the MEP engineer"
Claude: I'll export the visible elements to DXF format...
[Creates DXF file with proper layering]
```

### PDF & Documentation
```
User: "Generate PDFs of all construction sheets and save them to the output folder"
Claude: I'll export all sheets to PDF with title blocks...
[Creates multi-page PDF document]

User: "Extract all text from the specifications PDF"
Claude: I'll parse the PDF and extract the text content...
[Returns structured text data]
```

### Excel Integration & Reporting
```
User: "Export the door schedule to Excel with formatting"
Claude: I'll create a formatted Excel file with your door schedule...
[Generates Excel with formulas and formatting]

User: "Generate a quantity takeoff for all walls, including materials and costs"
Claude: I'll create a comprehensive quantity takeoff report...
[Creates multi-sheet Excel with calculations]

User: "Import room numbers from the Excel file and update all rooms"
Claude: I'll read the Excel file and update the room parameters...
[Bulk updates parameters from Excel]
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [revit-mcp-plugin](https://github.com/revit-mcp/revit-mcp-plugin) - Revit plugin component
- [revit-mcp-commandset](https://github.com/revit-mcp/revit-mcp-commandset) - Command implementations

## 🔗 Related Projects

- **revit-mcp-plugin**: Revit plugin for receiving and executing commands
- **revit-mcp-commandset**: Extensible command sets for Revit operations
- **revit-mcp-python**: Python implementation (alternative)
- **revit-mcp-dotnet**: .NET implementation (alternative)

## 📞 Support

- 🐛 [Report Issues](https://github.com/espocorp/revit-mcp/issues)
- 💬 [Discussions](https://github.com/espocorp/revit-mcp/discussions)
- 📧 [Email Support](mailto:support@espocorp.com)
- 🌐 [Project Website](https://revit-mcp.com)

## 🚦 Status

![Build Status](https://img.shields.io/github/actions/workflow/status/espocorp/revit-mcp/ci.yml?branch=main)
![Last Commit](https://img.shields.io/github/last-commit/espocorp/revit-mcp)
![Open Issues](https://img.shields.io/github/issues-raw/espocorp/revit-mcp)
![Pull Requests](https://img.shields.io/github/issues-pr-raw/espocorp/revit-mcp)

---

<div align="center">
  <strong>Built with ❤️ by ESPO Corporation</strong>
  <br>
  <sub>Empowering AEC professionals with AI-driven automation</sub>
</div>