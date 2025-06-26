"""
PyRevit Bridge Service - HTTP API for Revit automation
This runs as a Flask service and communicates with PyRevit extension
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
import chromadb
from chromadb.config import Settings
import os
import json
import logging
from datetime import datetime
import hashlib
from functools import wraps
import numpy as np

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/app/logs/pyrevit-bridge.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize Redis connection
redis_client = redis.Redis.from_url(
    os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
    decode_responses=True
)

# Initialize ChromaDB client
chroma_client = chromadb.HttpClient(
    host=os.environ.get('CHROMA_URL', 'http://localhost:8000').replace('http://', '').replace(':8000', ''),
    port=8000,
    settings=Settings(anonymized_telemetry=False),
    headers={"Authorization": f"Bearer {os.environ.get('CHROMA_TOKEN', 'test-token')}"}
)

# Get or create collections
element_collection = chroma_client.get_or_create_collection(
    name="revit_elements",
    metadata={"description": "Revit element embeddings for intelligent search"}
)

# API key validation
API_KEY = os.environ.get('API_KEY', 'development-key')

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != API_KEY:
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check Redis
        redis_client.ping()
        redis_status = 'healthy'
    except:
        redis_status = 'unhealthy'
    
    try:
        # Check ChromaDB
        chroma_client.heartbeat()
        chroma_status = 'healthy'
    except:
        chroma_status = 'unhealthy'
    
    return jsonify({
        'status': 'healthy' if redis_status == 'healthy' and chroma_status == 'healthy' else 'degraded',
        'services': {
            'redis': redis_status,
            'chromadb': chroma_status
        },
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/elements/embed', methods=['POST'])
@require_api_key
def embed_elements():
    """Store element data with embeddings for intelligent search"""
    try:
        data = request.json
        elements = data.get('elements', [])
        
        if not elements:
            return jsonify({'error': 'No elements provided'}), 400
        
        # Prepare data for ChromaDB
        ids = []
        documents = []
        metadatas = []
        
        for element in elements:
            element_id = str(element['id'])
            ids.append(element_id)
            
            # Create searchable document
            doc = f"{element.get('category', '')} {element.get('type', '')} {element.get('family', '')} "
            doc += f"{element.get('name', '')} "
            
            # Add parameter values
            params = element.get('parameters', {})
            for key, value in params.items():
                doc += f"{key}: {value} "
            
            documents.append(doc)
            
            # Store metadata
            metadata = {
                'element_id': element_id,
                'category': element.get('category', ''),
                'type': element.get('type', ''),
                'family': element.get('family', ''),
                'level_id': str(element.get('level_id', '')),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            # Add numeric parameters for filtering
            if 'bbox' in element:
                metadata['bbox_min_x'] = element['bbox']['min']['x']
                metadata['bbox_min_y'] = element['bbox']['min']['y']
                metadata['bbox_min_z'] = element['bbox']['min']['z']
                metadata['bbox_max_x'] = element['bbox']['max']['x']
                metadata['bbox_max_y'] = element['bbox']['max']['y']
                metadata['bbox_max_z'] = element['bbox']['max']['z']
            
            metadatas.append(metadata)
        
        # Add to ChromaDB
        element_collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )
        
        # Cache in Redis for quick access
        for element in elements:
            redis_key = f"element:{element['id']}"
            redis_client.setex(
                redis_key,
                3600,  # 1 hour TTL
                json.dumps(element)
            )
        
        return jsonify({
            'success': True,
            'embedded_count': len(elements),
            'message': f'Successfully embedded {len(elements)} elements'
        })
        
    except Exception as e:
        logger.error(f"Error embedding elements: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/elements/search', methods=['POST'])
@require_api_key
def search_elements():
    """Intelligent element search using vector embeddings"""
    try:
        data = request.json
        query = data.get('query', '')
        filters = data.get('filters', {})
        limit = min(data.get('limit', 10), 100)
        
        # Build where clause for ChromaDB
        where = {}
        if 'category' in filters:
            where['category'] = filters['category']
        if 'type' in filters:
            where['type'] = filters['type']
        if 'level_id' in filters:
            where['level_id'] = str(filters['level_id'])
        
        # Bounding box filter
        if 'bbox' in filters:
            bbox = filters['bbox']
            where['$and'] = [
                {'bbox_min_x': {'$gte': bbox['min']['x']}},
                {'bbox_min_y': {'$gte': bbox['min']['y']}},
                {'bbox_max_x': {'$lte': bbox['max']['x']}},
                {'bbox_max_y': {'$lte': bbox['max']['y']}}
            ]
        
        # Search in ChromaDB
        results = element_collection.query(
            query_texts=[query],
            n_results=limit,
            where=where if where else None
        )
        
        # Get full element data from Redis cache
        elements = []
        for i, element_id in enumerate(results['ids'][0]):
            # Try cache first
            cached = redis_client.get(f"element:{element_id}")
            if cached:
                element_data = json.loads(cached)
            else:
                # Fallback to metadata
                element_data = {
                    'id': element_id,
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i] if 'distances' in results else None
                }
            
            elements.append(element_data)
        
        return jsonify({
            'success': True,
            'query': query,
            'count': len(elements),
            'elements': elements
        })
        
    except Exception as e:
        logger.error(f"Error searching elements: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/floors/analyze', methods=['POST'])
@require_api_key
def analyze_floors():
    """Analyze floor patterns for duplication opportunities"""
    try:
        data = request.json
        project_id = data.get('project_id')
        
        # Get all elements grouped by level from ChromaDB
        all_elements = element_collection.get()
        
        # Group by level
        levels = {}
        for i, metadata in enumerate(all_elements['metadatas']):
            level_id = metadata.get('level_id')
            if level_id:
                if level_id not in levels:
                    levels[level_id] = []
                levels[level_id].append({
                    'id': all_elements['ids'][i],
                    'category': metadata.get('category'),
                    'type': metadata.get('type')
                })
        
        # Find similar floors
        floor_signatures = {}
        for level_id, elements in levels.items():
            # Create a signature based on element types and counts
            signature = {}
            for element in elements:
                key = f"{element['category']}:{element['type']}"
                signature[key] = signature.get(key, 0) + 1
            
            # Convert to string for comparison
            sig_str = json.dumps(signature, sort_keys=True)
            sig_hash = hashlib.md5(sig_str.encode()).hexdigest()
            
            if sig_hash not in floor_signatures:
                floor_signatures[sig_hash] = []
            floor_signatures[sig_hash].append({
                'level_id': level_id,
                'element_count': len(elements),
                'signature': signature
            })
        
        # Find duplicate patterns
        patterns = []
        for sig_hash, floors in floor_signatures.items():
            if len(floors) > 1:
                patterns.append({
                    'pattern_id': sig_hash,
                    'floor_count': len(floors),
                    'floors': floors,
                    'similarity': 1.0  # Exact match
                })
        
        # Cache analysis results
        redis_client.setex(
            f"floor_analysis:{project_id}",
            3600,
            json.dumps(patterns)
        )
        
        return jsonify({
            'success': True,
            'total_floors': len(levels),
            'patterns_found': len(patterns),
            'patterns': patterns
        })
        
    except Exception as e:
        logger.error(f"Error analyzing floors: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/elevators/optimize', methods=['POST'])
@require_api_key
def optimize_elevators():
    """Optimize elevator placement and configuration"""
    try:
        data = request.json
        building_params = data.get('building_parameters', {})
        
        # Basic elevator optimization logic
        floor_count = building_params.get('floor_count', 1)
        floor_area = building_params.get('floor_area', 1000)  # m²
        occupancy_per_floor = building_params.get('occupancy_per_floor', 50)
        
        # Calculate required elevators (simplified)
        total_occupancy = floor_count * occupancy_per_floor
        elevators_needed = max(1, int(total_occupancy / 300))  # 1 elevator per 300 people
        
        # Determine elevator specifications
        if floor_count <= 5:
            speed = 1.0  # m/s
            capacity = 8
        elif floor_count <= 15:
            speed = 1.5
            capacity = 13
        else:
            speed = 2.5
            capacity = 21
        
        # Optimal placement suggestions
        suggestions = []
        if elevators_needed == 1:
            suggestions.append({
                'location': 'central',
                'coordinates': {'x': floor_area / 2, 'y': floor_area / 2}
            })
        else:
            # Distribute elevators
            for i in range(elevators_needed):
                suggestions.append({
                    'location': f'bank_{i+1}',
                    'coordinates': {
                        'x': (i + 1) * floor_area / (elevators_needed + 1),
                        'y': floor_area / 2
                    }
                })
        
        result = {
            'elevators_required': elevators_needed,
            'specifications': {
                'speed': speed,
                'capacity': capacity,
                'stops': floor_count
            },
            'placement_suggestions': suggestions,
            'estimated_wait_time': 30 / elevators_needed,  # seconds
            'handling_capacity': elevators_needed * capacity * 12  # trips per hour
        }
        
        # Cache results
        cache_key = f"elevator_optimization:{hashlib.md5(json.dumps(building_params, sort_keys=True).encode()).hexdigest()}"
        redis_client.setex(cache_key, 3600, json.dumps(result))
        
        return jsonify({
            'success': True,
            'optimization': result
        })
        
    except Exception as e:
        logger.error(f"Error optimizing elevators: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cache/clear', methods=['POST'])
@require_api_key
def clear_cache():
    """Clear Redis cache"""
    try:
        pattern = request.json.get('pattern', '*')
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
        
        return jsonify({
            'success': True,
            'cleared_keys': len(keys),
            'message': f'Cleared {len(keys)} keys matching pattern: {pattern}'
        })
        
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)