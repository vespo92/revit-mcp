/**
 * TypeScript type definitions for Revit API responses and entities
 */

// Basic Revit types
export interface RevitElementId {
  id: number;
  uniqueId?: string;
}

export interface RevitPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface RevitBoundingBox {
  min: RevitPoint3D;
  max: RevitPoint3D;
}

export interface RevitTransform {
  origin: RevitPoint3D;
  basisX: RevitPoint3D;
  basisY: RevitPoint3D;
  basisZ: RevitPoint3D;
}

// Element types
export interface RevitElement {
  id: number;
  uniqueId: string;
  category: string;
  categoryId: number;
  name: string;
  type?: string;
  typeName?: string;
  levelId?: number;
  parameters?: Record<string, any>;
}

export interface RevitWall extends RevitElement {
  type: "Wall";
  length: number;
  height: number;
  thickness: number;
  isStructural: boolean;
  locationCurve?: {
    start: RevitPoint3D;
    end: RevitPoint3D;
  };
}

export interface RevitFloor extends RevitElement {
  type: "Floor";
  area: number;
  thickness: number;
  levelId: number;
  boundary?: RevitPoint3D[];
}

export interface RevitDoor extends RevitElement {
  type: "Door";
  width: number;
  height: number;
  hostId: number;
  fromRoom?: number;
  toRoom?: number;
}

export interface RevitWindow extends RevitElement {
  type: "Window";
  width: number;
  height: number;
  sillHeight: number;
  hostId: number;
}

export interface RevitLevel {
  id: number;
  name: string;
  elevation: number;
  projectElevation: number;
  viewId?: number;
}

export interface RevitView {
  id: number;
  name: string;
  viewType: string;
  levelId?: number;
  scale?: number;
  detailLevel?: "Coarse" | "Medium" | "Fine";
  isTemplate: boolean;
  cropBox?: RevitBoundingBox;
}

export interface RevitFamily {
  id: number;
  name: string;
  category: string;
  familyTypes: RevitFamilyType[];
}

export interface RevitFamilyType {
  id: number;
  name: string;
  familyName: string;
  parameters: Record<string, any>;
}

// Operation responses
export interface CreateElementResponse {
  success: boolean;
  elementId?: number;
  uniqueId?: string;
  error?: string;
  details?: any;
}

export interface ModifyElementResponse {
  success: boolean;
  modifiedCount: number;
  elementIds: number[];
  errors?: string[];
}

export interface DeleteElementResponse {
  success: boolean;
  deletedCount: number;
  elementIds: number[];
  errors?: string[];
}

export interface GetElementsResponse {
  success: boolean;
  elements: RevitElement[];
  count: number;
  hasMore?: boolean;
  nextOffset?: number;
}

export interface BatchOperationResponse {
  success: boolean;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  results: Array<{
    operation: string;
    success: boolean;
    elementId?: number;
    error?: string;
  }>;
}

// Elevator-specific types
export interface ElevatorShaftParameters {
  location: { x: number; y: number };
  dimensions: { width: number; depth: number };
  baseLevelId: number;
  topLevelId: number;
  wallThickness?: number;
  createPit?: boolean;
  pitDepth?: number;
}

export interface ElevatorShaftResponse {
  success: boolean;
  shaftWallIds: number[];
  pitId?: number;
  openingIds?: number[];
  error?: string;
}

export interface ElevatorDoorPlacementResponse {
  success: boolean;
  placedDoorIds: number[];
  failedLevels: number[];
  errors?: string[];
}

export interface ElevatorAnalysis {
  elevatorCount: number;
  elevators: Array<{
    id: number;
    type: string;
    levels: number[];
    dimensions: { width: number; depth: number };
    capacity?: number;
    speed?: number;
  }>;
}

// Floor duplication types
export interface FloorDuplicationParameters {
  sourceElementIds: number[];
  fromLevelId: number;
  toLevelIds: number[];
  includeOpenings?: boolean;
  adjustHosted?: boolean;
  maintainRelationships?: boolean;
}

export interface FloorDuplicationResponse {
  success: boolean;
  duplicatedCount: number;
  byLevel: Record<number, number[]>;
  errors?: string[];
}

// AI element filter types
export interface AIFilterParameters {
  prompt: string;
  viewId?: number;
  categories?: string[];
  maxResults?: number;
  includeMetadata?: boolean;
}

export interface AIFilterResponse {
  success: boolean;
  matchedElements: Array<{
    element: RevitElement;
    confidence: number;
    reason: string;
  }>;
  totalMatches: number;
  processingTime: number;
}

// Transaction types
export interface RevitTransaction {
  id: string;
  name: string;
  status: "pending" | "committed" | "rolled_back";
  operations: Array<{
    type: string;
    elementId?: number;
    timestamp: number;
  }>;
}

// Error response type
export interface RevitErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
}

// Selection and filtering
export interface SelectionFilter {
  categories?: string[];
  levels?: number[];
  families?: string[];
  parameters?: Record<string, any>;
  boundingBox?: RevitBoundingBox;
  customFilter?: string; // For advanced filtering expressions
}

export interface SelectionResponse {
  success: boolean;
  selectedIds: number[];
  count: number;
}

// Parameter operations
export interface ParameterValue {
  name: string;
  value: any;
  type: "String" | "Integer" | "Double" | "Boolean" | "ElementId";
  isReadOnly: boolean;
  group?: string;
}

export interface GetParametersResponse {
  success: boolean;
  elementId: number;
  parameters: ParameterValue[];
}

export interface SetParametersResponse {
  success: boolean;
  elementId: number;
  modifiedParameters: string[];
  errors?: Array<{
    parameter: string;
    error: string;
  }>;
}

// View operations
export interface ViewCreationParameters {
  name: string;
  viewType: "FloorPlan" | "CeilingPlan" | "Elevation" | "Section" | "3D";
  levelId?: number;
  viewTemplateId?: number;
  cropBox?: RevitBoundingBox;
}

export interface ViewCreationResponse {
  success: boolean;
  viewId?: number;
  viewName?: string;
  error?: string;
}

// Export/Import operations
export interface ExportParameters {
  format: "IFC" | "DWG" | "PDF" | "FBX" | "NWC";
  viewIds?: number[];
  outputPath: string;
  options?: Record<string, any>;
}

export interface ExportResponse {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  duration?: number;
  error?: string;
}

// Type guards
export function isRevitElement(obj: any): obj is RevitElement {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.id === "number" &&
    typeof obj.uniqueId === "string" &&
    typeof obj.category === "string"
  );
}

export function isRevitWall(element: RevitElement): element is RevitWall {
  return element.type === "Wall";
}

export function isRevitFloor(element: RevitElement): element is RevitFloor {
  return element.type === "Floor";
}

export function isRevitDoor(element: RevitElement): element is RevitDoor {
  return element.type === "Door";
}

export function isRevitWindow(element: RevitElement): element is RevitWindow {
  return element.type === "Window";
}

export function isErrorResponse(response: any): response is RevitErrorResponse {
  return response.success === false && response.error !== undefined;
}

// Utility types for tool implementations
export type RevitCommandResult<T> = T | RevitErrorResponse;

export type RevitToolResponse = {
  content: Array<{
    type: "text";
    text: string;
  }>;
};

/**
 * Helper to format Revit responses for MCP tools
 */
export function formatRevitResponse(
  success: boolean,
  message: string,
  details?: any
): RevitToolResponse {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
      ...(details
        ? [
            {
              type: "text" as const,
              text: `\nDetails:\n${JSON.stringify(details, null, 2)}`,
            },
          ]
        : []),
    ],
  };
}