# ESPO Platform Integration Guide for Revit MCP

This document explains how to integrate and use the Revit MCP server within the ESPO platform ecosystem.

## Overview

The Revit MCP server enables AI-powered automation of Revit workflows, allowing Claude and other AI assistants to interact with Autodesk Revit for building information modeling (BIM) tasks.

## Prerequisites

1. **Revit Installation**: Autodesk Revit must be installed with the [revit-mcp-plugin](https://github.com/revit-mcp/revit-mcp-plugin)
2. **Node.js**: Version 18 or higher
3. **MCP Client**: Claude Desktop or another MCP-compatible client
4. **ESPO Authentication**: Valid API key from the ESPO authentication service

## Installation

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/espocorp/revit-mcp.git
cd revit-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configure Authentication

Create a `.env` file in the project root:

```env
# ESPO Authentication
ESPO_API_KEY=your-api-key-from-vault
ESPO_CLIENT_ID=revit-mcp-client

# Revit Connection
REVIT_HOST=localhost
REVIT_PORT=3000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### 3. Obtain API Key from Vault

```bash
# Access ESPO Vault
export VAULT_ADDR=https://vault.espocorp.com
vault login -method=azure role=espo-users

# Get API key for Revit MCP
vault kv get secret/espo/revit-mcp
```

## Integration with ESPO Services

### Using with Docker

```yaml
version: '3.8'
services:
  revit-mcp:
    build: .
    environment:
      - ESPO_API_KEY=${ESPO_API_KEY}
      - REVIT_HOST=host.docker.internal
    ports:
      - "3000:3000"
    networks:
      - espo-network

networks:
  espo-network:
    external: true
```

### Kubernetes Deployment

Deploy to the ESPO Kubernetes cluster:

```bash
# Build and push to ESPO registry
docker build -t registry.espocorp.com/espo/revit-mcp:latest .
docker push registry.espocorp.com/espo/revit-mcp:latest

# Apply Kubernetes manifest
kubectl apply -f k8s/deployment.yaml -n espo
```

## MCP Client Configuration

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "revit-mcp": {
      "command": "node",
      "args": ["/path/to/revit-mcp/build/index.js"],
      "env": {
        "ESPO_API_KEY": "your-api-key",
        "ESPO_CLIENT_ID": "claude-desktop"
      }
    }
  }
}
```

### ESPO MCP Gateway

For remote access through the ESPO platform:

```json
{
  "servers": {
    "revit-mcp": {
      "url": "wss://mcp-gateway.espocorp.com/revit",
      "apiKey": "${ESPO_API_KEY}"
    }
  }
}
```

## Available Tools

### Building Elements
- `create_point_based_element` - Place doors, windows, furniture
- `create_line_based_element` - Create walls, beams, pipes
- `create_surface_based_element` - Add floors, ceilings, roofs

### Analysis and Queries
- `get_current_view_info` - Get active view details
- `get_current_view_elements` - List elements in view
- `ai_element_filter` - Intelligent element search

### Automation
- `elevator_automation` - Complete elevator system setup
- `duplicate_floor_elements` - Copy entire floor layouts
- `color_splash` - Visualize data through colors

## Use Cases for ESPO

### 1. Automated Permit Documentation

Generate drawings and schedules for permitting:

```typescript
// Extract wall information for permits
const walls = await tools.get_current_view_elements({
  elementType: "Wall"
});

// Generate wall schedule
const schedule = await tools.create_schedule({
  type: "Wall",
  fields: ["Mark", "Type", "Length", "Height"]
});
```

### 2. Design Standards Compliance

Check ESPO design standards:

```typescript
// Check door widths meet accessibility requirements
const doors = await tools.ai_element_filter({
  query: "Find all doors with width less than 36 inches"
});
```

### 3. Multi-Story Building Automation

Replicate floor layouts:

```typescript
// Duplicate floor 1 to floors 2-5
await tools.duplicate_floor_elements({
  sourceFloor: "Level 1",
  targetFloors: ["Level 2", "Level 3", "Level 4", "Level 5"],
  elementTypes: ["Wall", "Door", "Window", "Room"]
});
```

## Monitoring and Logging

### Prometheus Metrics

The server exposes metrics at `/metrics`:

- `revit_mcp_requests_total` - Total API requests
- `revit_mcp_request_duration_seconds` - Request latency
- `revit_mcp_active_connections` - WebSocket connections
- `revit_mcp_errors_total` - Error count by type

### Grafana Dashboard

Import the dashboard from `monitoring/revit-mcp-dashboard.json` to Grafana:

```bash
# Access Grafana
open https://grafana.espocorp.com

# Import dashboard
Dashboard ID: revit-mcp-001
```

## Security Considerations

1. **API Key Rotation**: Rotate API keys quarterly through Vault
2. **Network Isolation**: Deploy in DMZ for external Revit access
3. **Audit Logging**: All commands are logged with client ID
4. **Rate Limiting**: Prevents abuse and ensures fair usage

## Troubleshooting

### Connection Issues

```bash
# Check Revit plugin status
curl http://localhost:3000/health

# Verify MCP server
npm run dev
```

### Authentication Errors

```bash
# Validate API key
curl -H "X-API-Key: $ESPO_API_KEY" http://localhost:3000/auth/validate

# Check Vault access
vault kv get secret/espo/revit-mcp
```

## Support

- **Internal Slack**: #espo-revit-automation
- **Documentation**: `/ESPO/docs/mcp-servers/revit-mcp/`
- **Issues**: https://github.com/espocorp/revit-mcp/issues

## Integration with Rome Platform

The Revit MCP server can integrate with Rome for project management:

```typescript
// Example: Create Revit elements from Rome project data
const project = await romeClient.getProject(projectId);
const elements = project.designElements;

for (const element of elements) {
  await tools.create_point_based_element({
    familyType: element.revitFamily,
    location: element.coordinates,
    level: element.level
  });
}
```