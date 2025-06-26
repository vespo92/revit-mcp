# Revit MCP Server - Enhanced Edition

## 🚀 Overview

This enhanced version of the Revit MCP server provides powerful automation capabilities for Revit, with a focus on elevator design and floor duplication workflows. It integrates with PyRevit, supports intelligent element search via vector embeddings, and includes comprehensive security features.

## 🔒 Security Enhancements

### Critical Security Fixes
- **Removed RCE vulnerability** in `send_code_to_revit` tool
- **Added authentication** via API keys
- **Implemented rate limiting** to prevent abuse
- **Code validation** for custom scripts
- **Audit logging** for all operations

### Security Features
- API key authentication (minimum 32 characters)
- Client whitelisting
- Rate limiting (configurable)
- Input validation and sanitization
- Secure code execution with whitelisted patterns
- Audit trail for compliance

## 🏗️ New Tools

### 1. `duplicate_floor_elements`
Duplicate all elements from one floor to multiple floors with intelligent filtering.

```javascript
{
  "tool": "duplicate_floor_elements",
  "data": {
    "sourceLevelId": 12345,
    "targetLevelIds": [23456, 34567, 45678],
    "elementFilter": {
      "categories": ["OST_Walls", "OST_Doors", "OST_Furniture"],
      "boundingBox": {
        "min": { "x": 0, "y": 0 },
        "max": { "x": 10000, "y": 10000 }
      }
    },
    "options": {
      "updateHostedElements": true,
      "groupBeforeCopy": true
    }
  }
}
```

### 2. `elevator_automation`
Comprehensive elevator design automation with multiple actions:

- **create_shaft**: Create elevator shaft with walls and pit
- **place_doors**: Place elevator doors at specified levels
- **duplicate_to_floors**: Duplicate elevator elements to other floors
- **create_machine_room**: Create machine room above shaft
- **analyze_existing**: Analyze existing elevators in model
- **create_opening**: Create floor openings for shaft

```javascript
{
  "tool": "elevator_automation",
  "data": {
    "action": "create_shaft",
    "shaftParameters": {
      "location": { "x": 5000, "y": 5000 },
      "dimensions": { "width": 2000, "depth": 2500 },
      "baseLevelId": 1234,
      "topLevelId": 5678,
      "wallThickness": 200,
      "createPit": true,
      "pitDepth": 1500
    }
  }
}
```

### 3. `send_code_to_revit_secure`
Secure version of code execution with validation and templates:

```javascript
{
  "tool": "send_code_to_revit_secure",
  "data": {
    "template": "duplicate_elements",
    "parameters": [elementIds, translationVector],
    "apiKey": "your-api-key"
  }
}
```

## 🐳 Docker Services

### Start All Services
```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

### Services Included

1. **ChromaDB** (Port 8000)
   - Vector database for intelligent element search
   - Stores element embeddings for semantic search

2. **Redis** (Port 6379)
   - Caching layer for performance
   - Rate limiting storage
   - Session management

3. **PyRevit Bridge** (Port 5000)
   - HTTP API for Revit integration
   - Element embedding and search
   - Floor pattern analysis
   - Elevator optimization algorithms

4. **Ollama** (Port 11434) - Optional
   - Local LLM for intelligent analysis
   - Code generation assistance

5. **Monitoring Stack** - Optional
   - Prometheus (Port 9090)
   - Grafana (Port 3000)

## 🔧 Installation

### 1. Clone and Install
```bash
git clone <repository>
cd revit-mcp
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Generate API Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Build MCP Server
```bash
npm run build
```

### 5. Start Docker Services
```bash
docker-compose up -d
```

### 6. Configure Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "revit-mcp-enhanced": {
      "command": "node",
      "args": ["<path-to-project>/build/index.js"],
      "env": {
        "REVIT_MCP_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 🏢 Elevator Design Workflow

### 1. Analyze Existing Building
```javascript
// Find existing elevators
await mcp.call("elevator_automation", {
  action: "analyze_existing",
  analysisParameters: {
    searchRadius: 10000
  }
});
```

### 2. Create Elevator Shaft
```javascript
// Create shaft through all floors
await mcp.call("elevator_automation", {
  action: "create_shaft",
  shaftParameters: {
    location: { x: 5000, y: 5000 },
    dimensions: { width: 2000, depth: 2500 },
    baseLevelId: baseLevelId,
    topLevelId: topLevelId
  }
});
```

### 3. Place Doors at Each Floor
```javascript
// Add doors
await mcp.call("elevator_automation", {
  action: "place_doors",
  doorParameters: {
    doorTypeId: doorTypeId,
    levelIds: allLevelIds,
    openingSide: "front"
  }
});
```

### 4. Duplicate Floor Layouts
```javascript
// Copy typical floor to all floors
await mcp.call("duplicate_floor_elements", {
  sourceLevelId: typicalFloorId,
  targetLevelIds: otherFloorIds,
  elementFilter: {
    excludeCategories: ["OST_Stairs", "OST_StairsRailing"]
  }
});
```

## 🔍 Intelligent Element Search

### Embed Elements for Search
```bash
curl -X POST http://localhost:5000/api/elements/embed \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "elements": [
      {
        "id": "12345",
        "category": "OST_Doors",
        "type": "Single Door",
        "family": "M_Single-Flush",
        "parameters": {
          "Height": 2100,
          "Width": 900
        }
      }
    ]
  }'
```

### Search Elements
```bash
curl -X POST http://localhost:5000/api/elements/search \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "elevator doors on level 3",
    "filters": {
      "category": "OST_Doors"
    },
    "limit": 20
  }'
```

## 🛡️ Security Best Practices

1. **API Keys**
   - Use strong, unique API keys (minimum 32 characters)
   - Rotate keys regularly
   - Never commit keys to version control

2. **Network Security**
   - Run services behind a firewall
   - Use TLS/SSL for production
   - Implement IP whitelisting if possible

3. **Code Execution**
   - Only use pre-approved templates when possible
   - Review all custom code before execution
   - Monitor audit logs regularly

4. **Rate Limiting**
   - Configure appropriate rate limits
   - Monitor for abuse patterns
   - Implement progressive delays for repeated violations

## 📊 Monitoring

Access Grafana dashboards at `http://localhost:3000` (default: admin/admin)

Available metrics:
- API request rates
- Element duplication performance
- Cache hit rates
- Error rates
- Resource utilization

## 🐛 Troubleshooting

### Check Service Health
```bash
# All services
docker-compose ps

# Individual service logs
docker-compose logs -f chromadb
docker-compose logs -f pyrevit-bridge

# API health check
curl http://localhost:5000/health
```

### Common Issues

1. **Authentication Errors**
   - Verify API key in .env matches client configuration
   - Check allowed clients list

2. **Connection Errors**
   - Ensure Revit plugin is running
   - Check firewall settings
   - Verify port configurations

3. **Performance Issues**
   - Monitor Redis cache hit rates
   - Check ChromaDB index size
   - Review rate limiting settings

## 🤝 Integration with PyRevit

Create a PyRevit extension that connects to this MCP server:

```python
# PyRevit script example
from pyrevit import routes
import requests

MCP_BRIDGE_URL = "http://localhost:5000"
API_KEY = "your-api-key"

@routes.post('/mcp/notify')
def notify_mcp(element_data):
    """Send element updates to MCP server"""
    response = requests.post(
        f"{MCP_BRIDGE_URL}/api/elements/embed",
        headers={"X-API-Key": API_KEY},
        json={"elements": element_data}
    )
    return response.json()
```

## 📚 Additional Resources

- [PyRevit Documentation](https://pyrevitlabs.github.io/)
- [Revit API Documentation](https://www.revitapidocs.com/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [ChromaDB Documentation](https://docs.trychroma.com/)

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

---

**Note**: This enhanced version prioritizes security and should be used in production environments only after thorough testing and security review.