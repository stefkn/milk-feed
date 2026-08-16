import { browser } from "$app/environment";
import type { DataConnection, Peer as PeerType } from "peerjs";
import type { SyncMessage } from "./sync";
import { generateSessionCode } from "./sessionCode";

export type SessionStatus = "disconnected" | "connecting" | "connected";

export interface SessionCallbacks {
  onStatus: (status: SessionStatus) => void;
  onMessage: (message: SyncMessage) => void;
  onError: (message: string) => void;
}

export interface SessionHandle {
  readonly code: string;
  readonly isHost: boolean;
  send: (message: SyncMessage) => void;
  close: () => void;
}

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;

/**
 * Wraps a PeerJS data connection to a single remote peer.
 *
 * The host registers a stable id (the session code) and waits for the guest to
 * dial in; the guest dials the host and re-dials with exponential backoff if
 * the connection drops. This keeps reconnection simple: the guest always knows
 * where to reconnect, so a dropped link converges again without a server.
 */
class PeerSession implements SessionHandle {
  readonly code: string;
  readonly isHost: boolean;

  private callbacks: SessionCallbacks;
  private peer: PeerType | undefined;
  private conn: DataConnection | undefined;
  private status: SessionStatus = "disconnected";
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: number | undefined;
  private closed = false;

  constructor(code: string, isHost: boolean, callbacks: SessionCallbacks) {
    this.code = code;
    this.isHost = isHost;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    if (!browser) {
      return;
    }
    await this.ensurePeer();
  }

  send(message: SyncMessage): void {
    if (this.conn && this.conn.open) {
      this.conn.send(JSON.stringify(message));
    }
  }

  close(): void {
    this.closed = true;
    this.clearReconnectTimer();
    if (this.conn) {
      this.conn.close();
      this.conn = undefined;
    }
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }
    this.peer = undefined;
    this.setStatus("disconnected");
  }

  private isCurrentPeer(peer: PeerType): boolean {
    return this.peer === peer;
  }

  private async ensurePeer(): Promise<void> {
    if (this.closed) {
      return;
    }
    if (this.peer && !this.peer.destroyed && this.peer.open) {
      return;
    }

    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }

    const { Peer } = await import("peerjs");
    this.setStatus("connecting");

    const peer = this.isHost ? new Peer(this.code) : new Peer();
    this.peer = peer;

    peer.on("open", () => {
      if (!this.isCurrentPeer(peer)) {
        return;
      }
      // The guest always initiates the data channel once registered.
      if (!this.isHost) {
        this.dial();
      }
    });

    peer.on("connection", (conn) => {
      if (!this.isCurrentPeer(peer) || !this.isHost) {
        return;
      }
      this.attach(conn);
    });

    peer.on("disconnected", () => {
      if (!this.isCurrentPeer(peer) || this.closed) {
        return;
      }
      // Lost the signalling link; try to re-register with the same id.
      peer.reconnect();
    });

    peer.on("error", (err) => {
      if (!this.isCurrentPeer(peer) || this.closed) {
        return;
      }
      if (err.type === "unavailable-id") {
        this.setStatus("disconnected");
        this.callbacks.onError(
          "That session code is already in use. Please start a new session.",
        );
        return;
      }
      if (err.type === "peer-unavailable") {
        // Remote peer is not reachable yet; the reconnect loop keeps trying.
        return;
      }
      console.error("PeerJS error:", err.type, err);
      this.callbacks.onError(`Connection error (${err.type}).`);
    });

    peer.on("close", () => {
      if (!this.isCurrentPeer(peer)) {
        return;
      }
      this.conn = undefined;
      if (!this.closed) {
        this.onConnectionLost();
      }
    });
  }

  private dial(): void {
    if (this.closed || !this.peer) {
      return;
    }
    if (this.conn && this.conn.open) {
      return;
    }
    const conn = this.peer.connect(this.code, { reliable: true });
    this.attach(conn);
  }

  private attach(conn: DataConnection): void {
    if (this.conn && this.conn.open) {
      conn.close();
      return;
    }
    this.conn = conn;

    conn.on("open", () => {
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.setStatus("connected");
    });

    conn.on("data", (data) => {
      this.handleData(data);
    });

    conn.on("close", () => {
      if (this.conn === conn) {
        this.conn = undefined;
      }
      this.onConnectionLost();
    });

    conn.on("error", () => {
      if (this.conn === conn) {
        this.conn = undefined;
      }
      this.onConnectionLost();
    });
  }

  private handleData(data: unknown): void {
    let message: SyncMessage;
    try {
      message = JSON.parse(String(data)) as SyncMessage;
    } catch (err) {
      console.error("Failed to parse peer message", err);
      return;
    }
    if (message.type === "feeds" && Array.isArray(message.feeds)) {
      this.callbacks.onMessage(message);
    }
  }

  private onConnectionLost(): void {
    if (this.closed) {
      return;
    }
    this.setStatus("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== undefined) {
      return;
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.reconnectDelayMs = Math.min(
        this.reconnectDelayMs * 2,
        MAX_RECONNECT_DELAY_MS,
      );
      void this.reconnect();
    }, this.reconnectDelayMs);
  }

  private async reconnect(): Promise<void> {
    if (this.closed) {
      return;
    }
    if (this.isHost) {
      // The host never dials; it just re-registers its id and waits for the
      // guest to reconnect.
      await this.ensurePeer();
      return;
    }
    if (!this.peer || this.peer.destroyed || this.peer.disconnected) {
      // Recreating the guest peer dials automatically once it opens.
      await this.ensurePeer();
      return;
    }
    this.dial();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private setStatus(status: SessionStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.callbacks.onStatus(status);
  }
}

export async function createSession(
  callbacks: SessionCallbacks,
  code: string = generateSessionCode(),
): Promise<SessionHandle> {
  const session = new PeerSession(code, true, callbacks);
  await session.start();
  return session;
}

export async function joinSession(
  code: string,
  callbacks: SessionCallbacks,
): Promise<SessionHandle> {
  const session = new PeerSession(code, false, callbacks);
  await session.start();
  return session;
}
