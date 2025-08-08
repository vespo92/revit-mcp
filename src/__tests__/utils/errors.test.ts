import {
  BaseError,
  ConnectionError,
  TimeoutError,
  ReconnectionError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  MissingParameterError,
  InvalidParameterError,
  RevitError,
  ElementNotFoundError,
  TransactionError,
  ConfigurationError,
  InternalError,
  ErrorHandler,
  ErrorCode,
  isBaseError,
  hasErrorCode,
} from "../../utils/errors";

describe("Error Classes", () => {
  describe("ConnectionError", () => {
    it("should create connection error with correct code", () => {
      const error = new ConnectionError("Connection failed");
      expect(error).toBeInstanceOf(BaseError);
      expect(error.code).toBe(ErrorCode.CONNECTION_FAILED);
      expect(error.message).toBe("Connection failed");
    });

    it("should include context data", () => {
      const context = { host: "localhost", port: 8080 };
      const error = new ConnectionError("Connection failed", context);
      expect(error.context).toEqual(context);
    });
  });

  describe("TimeoutError", () => {
    it("should create timeout error with correct code", () => {
      const error = new TimeoutError("Request timed out");
      expect(error.code).toBe(ErrorCode.CONNECTION_TIMEOUT);
    });
  });

  describe("ReconnectionError", () => {
    it("should include attempt count", () => {
      const error = new ReconnectionError("Reconnection failed", 3);
      expect(error.attempts).toBe(3);
      expect(error.context?.attempts).toBe(3);
    });
  });

  describe("AuthenticationError", () => {
    it("should create auth error with custom code", () => {
      const error = new AuthenticationError(
        "Invalid API key",
        ErrorCode.INVALID_API_KEY
      );
      expect(error.code).toBe(ErrorCode.INVALID_API_KEY);
    });
  });

  describe("RateLimitError", () => {
    it("should include rate limit details", () => {
      const error = new RateLimitError(100, 60000, 0);
      expect(error.limit).toBe(100);
      expect(error.windowMs).toBe(60000);
      expect(error.remaining).toBe(0);
      expect(error.message).toContain("100 requests per 60000ms");
    });
  });

  describe("ValidationError", () => {
    it("should include field and value information", () => {
      const error = new ValidationError("Invalid value", "elementId", 123);
      expect(error.field).toBe("elementId");
      expect(error.value).toBe(123);
    });
  });

  describe("MissingParameterError", () => {
    it("should format message correctly", () => {
      const error = new MissingParameterError("elementId");
      expect(error.message).toBe("Missing required parameter: elementId");
      expect(error.field).toBe("elementId");
    });
  });

  describe("InvalidParameterError", () => {
    it("should format message with type information", () => {
      const error = new InvalidParameterError("elementId", "abc", "number");
      expect(error.message).toContain("expected number, got string");
      expect(error.field).toBe("elementId");
      expect(error.value).toBe("abc");
    });
  });

  describe("RevitError", () => {
    it("should handle Revit-specific error codes", () => {
      const error = new RevitError("Command failed", 4001);
      expect(error.code).toBe(ErrorCode.REVIT_COMMAND_FAILED);
    });

    it("should handle custom error codes", () => {
      const error = new RevitError("Command failed", ErrorCode.REVIT_ELEMENT_NOT_FOUND);
      expect(error.code).toBe(ErrorCode.REVIT_ELEMENT_NOT_FOUND);
    });

    it("should include data property", () => {
      const data = { elementId: 123 };
      const error = new RevitError("Command failed", ErrorCode.REVIT_COMMAND_FAILED, data);
      expect(error.data).toEqual(data);
    });
  });

  describe("ElementNotFoundError", () => {
    it("should format message with element ID", () => {
      const error = new ElementNotFoundError(12345);
      expect(error.message).toBe("Element with ID 12345 not found");
      expect(error.elementId).toBe(12345);
    });
  });

  describe("TransactionError", () => {
    it("should include transaction name", () => {
      const error = new TransactionError("Transaction failed", "CreateWalls");
      expect(error.transactionName).toBe("CreateWalls");
      expect(error.context?.transactionName).toBe("CreateWalls");
    });
  });

  describe("ConfigurationError", () => {
    it("should include config key", () => {
      const error = new ConfigurationError("Invalid config", "API_KEY");
      expect(error.configKey).toBe("API_KEY");
      expect(error.context?.configKey).toBe("API_KEY");
    });
  });

  describe("InternalError", () => {
    it("should wrap original error", () => {
      const originalError = new Error("Original error");
      const error = new InternalError("Internal server error", originalError);
      expect(error.originalError).toBe(originalError);
      expect(error.context?.originalMessage).toBe("Original error");
    });
  });
});

describe("Error Utilities", () => {
  describe("BaseError.toJSON", () => {
    it("should serialize error to JSON", () => {
      const error = new ConnectionError("Test error", { host: "localhost" });
      const json = error.toJSON();
      
      expect(json).toHaveProperty("name", "ConnectionError");
      expect(json).toHaveProperty("message", "Test error");
      expect(json).toHaveProperty("code", ErrorCode.CONNECTION_FAILED);
      expect(json).toHaveProperty("timestamp");
      expect(json).toHaveProperty("context", { host: "localhost" });
      expect(json).toHaveProperty("stack");
    });
  });

  describe("ErrorHandler.formatForResponse", () => {
    it("should format BaseError for response", () => {
      const error = new ValidationError("Invalid input", "field1");
      const response = ErrorHandler.formatForResponse(error);
      
      expect(response).toHaveProperty("error");
      expect(response.error.code).toBe(ErrorCode.INVALID_INPUT);
      expect(response.error.message).toBe("Invalid input");
      expect(response.error.data).toEqual({ field: "field1", value: undefined });
    });

    it("should format standard Error", () => {
      const error = new Error("Standard error");
      const response = ErrorHandler.formatForResponse(error);
      
      expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response.error.message).toBe("Standard error");
    });

    it("should handle unknown errors", () => {
      const response = ErrorHandler.formatForResponse("String error");
      
      expect(response.error.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(response.error.message).toBe("An unknown error occurred");
      expect(response.error.data).toEqual({ error: "String error" });
    });
  });

  describe("ErrorHandler.wrapAsync", () => {
    it("should wrap async function with error handling", async () => {
      const asyncFn = async (value: number) => {
        if (value < 0) throw new Error("Negative value");
        return value * 2;
      };

      const wrapped = ErrorHandler.wrapAsync(asyncFn);
      
      // Should work normally with valid input
      await expect(wrapped(5)).resolves.toBe(10);
      
      // Should throw InternalError for errors
      await expect(wrapped(-1)).rejects.toThrow(InternalError);
    });

    it("should use custom error transformer", async () => {
      const asyncFn = async () => {
        throw new Error("Test error");
      };

      const wrapped = ErrorHandler.wrapAsync(asyncFn, (error) => 
        new ValidationError("Transformed error")
      );
      
      await expect(wrapped()).rejects.toThrow(ValidationError);
    });
  });

  describe("ErrorHandler.createCircuitBreaker", () => {
    it("should open circuit after threshold failures", async () => {
      let callCount = 0;
      const failingFn = async () => {
        callCount++;
        throw new Error("Always fails");
      };

      const breaker = ErrorHandler.createCircuitBreaker(failingFn, {
        threshold: 3,
        timeout: 100,
        resetTimeout: 1000,
      });

      // First 3 calls should fail normally
      for (let i = 0; i < 3; i++) {
        await expect(breaker()).rejects.toThrow("Always fails");
      }
      expect(callCount).toBe(3);

      // Circuit should be open now
      await expect(breaker()).rejects.toThrow("Circuit breaker is open");
      expect(callCount).toBe(3); // No additional calls
    });

    it("should timeout long-running operations", async () => {
      const slowFn = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return "success";
      };

      const breaker = ErrorHandler.createCircuitBreaker(slowFn, {
        threshold: 3,
        timeout: 100,
        resetTimeout: 1000,
      });

      await expect(breaker()).rejects.toThrow(TimeoutError);
    });

    it("should reset circuit after timeout", async () => {
      let shouldFail = true;
      const conditionalFn = async () => {
        if (shouldFail) throw new Error("Failure");
        return "success";
      };

      const breaker = ErrorHandler.createCircuitBreaker(conditionalFn, {
        threshold: 2,
        timeout: 100,
        resetTimeout: 100, // Short reset for testing
      });

      // Open the circuit
      await expect(breaker()).rejects.toThrow("Failure");
      await expect(breaker()).rejects.toThrow("Failure");
      await expect(breaker()).rejects.toThrow("Circuit breaker is open");

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Circuit should work again
      shouldFail = false;
      await expect(breaker()).resolves.toBe("success");
    });
  });

  describe("Type Guards", () => {
    it("should identify BaseError instances", () => {
      const baseError = new ConnectionError("Test");
      const standardError = new Error("Test");
      
      expect(isBaseError(baseError)).toBe(true);
      expect(isBaseError(standardError)).toBe(false);
      expect(isBaseError("string")).toBe(false);
      expect(isBaseError(null)).toBe(false);
    });

    it("should check error codes", () => {
      const connectionError = new ConnectionError("Test");
      const timeoutError = new TimeoutError("Test");
      
      expect(hasErrorCode(connectionError, ErrorCode.CONNECTION_FAILED)).toBe(true);
      expect(hasErrorCode(connectionError, ErrorCode.CONNECTION_TIMEOUT)).toBe(false);
      expect(hasErrorCode(timeoutError, ErrorCode.CONNECTION_TIMEOUT)).toBe(true);
      expect(hasErrorCode(new Error("Test"), ErrorCode.CONNECTION_FAILED)).toBe(false);
    });
  });
});