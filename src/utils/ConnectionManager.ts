import { RevitClientConnection } from "./SocketClient.js";

export class ConnectionManager {
  private static instance: ConnectionManager;
  private connection: RevitClientConnection | null = null;
  private host: string = 'localhost';
  private port: number = 60100;

  private constructor() {}

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public async getConnection(): Promise<RevitClientConnection> {
    if (!this.connection || !this.connection.isConnected) {
      this.connection = new RevitClientConnection(this.host, this.port);
      await this.connection.connect();
    }
    return this.connection;
  }

  public async closeConnection(): Promise<void> {
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
  }
}

// Helper function for tools
export async function withRevitConnection<T>(
  callback: (connection: RevitClientConnection) => Promise<T>
): Promise<T> {
  const manager = ConnectionManager.getInstance();
  const connection = await manager.getConnection();
  return callback(connection);
}