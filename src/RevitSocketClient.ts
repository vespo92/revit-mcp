import * as net from "net";

export class RevitSocketClient {
  host: string;
  port: number;
  socket: net.Socket;
  isConnected: boolean = false;
  responseCallbacks: Map<string, (response: string) => void> = new Map();
  buffer: string = "";

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
    this.socket = new net.Socket();
    this.setupSocketListeners();
  }

  // ... 其余代码保持不变，只需将类名从 RevitClientConnection 改为 RevitSocketClient
  // ... existing code ...
}
