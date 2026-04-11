// src/modules/notifications/gateway/notifications.gateway.ts
//
// FIX 15: Socket.io gateway — was completely missing.
// Handles:
//   - User authentication via JWT on connection
//   - Per-user rooms (userId) for targeted notifications
//   - Per-org rooms (orgId) for broadcast dashboard updates
//   - Presence tracking (online users)

import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Algorithm } from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
  userId: string;
  orgId: string | null;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*', // tightened in production via config
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  // Track online users: userId → Set<socketId>
  private readonly onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.logger.log('NotificationsGateway initialized at /notifications');
  }

  // ── Connection ────────────────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'Authentication token required' });
        client.disconnect();
        return;
      }

      const algorithm = this.configService.get<string>('auth.jwtAlgorithm', 'RS256') as Algorithm;
      const publicKey = this.configService.get<string>('auth.jwtPublicKey');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: publicKey,
        algorithms: [algorithm],
      });

      const authedClient = client as AuthenticatedSocket;
      authedClient.userId = payload.sub as string;
      authedClient.orgId = (payload.orgId as string) ?? null;

      // Join personal room — for targeted notifications
      await client.join(`user:${authedClient.userId}`);

      // Join org room — for broadcast dashboard events
      if (authedClient.orgId) {
        await client.join(`org:${authedClient.orgId}`);
      }

      // Track presence
      if (!this.onlineUsers.has(authedClient.userId)) {
        this.onlineUsers.set(authedClient.userId, new Set());
      }
      this.onlineUsers.get(authedClient.userId)!.add(client.id);

      this.logger.debug(
        `Client connected: userId=${authedClient.userId}, orgId=${authedClient.orgId ?? 'none'}`,
      );

      client.emit('connected', { userId: authedClient.userId, orgId: authedClient.orgId });
    } catch {
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const authedClient = client as AuthenticatedSocket;
    if (authedClient.userId) {
      const sockets = this.onlineUsers.get(authedClient.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) this.onlineUsers.delete(authedClient.userId);
      }
    }
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  // ── Org room management ───────────────────────────────────────────────────

  @SubscribeMessage('join-org')
  async handleJoinOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orgId: string },
  ): Promise<void> {
    const authedClient = client as AuthenticatedSocket;
    // Leave previous org room if any
    if (authedClient.orgId) {
      await client.leave(`org:${authedClient.orgId}`);
    }
    authedClient.orgId = data.orgId;
    await client.join(`org:${data.orgId}`);
    client.emit('org-joined', { orgId: data.orgId });
  }

  // ── Emit helpers (called by NotificationsService) ─────────────────────────

  /** Emit an event to a specific user (all their connected sockets) */
  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  /** Broadcast to all sockets in an org room */
  emitToOrg(orgId: string, event: string, data: unknown): void {
    this.server.to(`org:${orgId}`).emit(event, data);
  }

  /** Check if a user has any active connections */
  isOnline(userId: string): boolean {
    const sockets = this.onlineUsers.get(userId);
    return (sockets?.size ?? 0) > 0;
  }

  /** Count of distinct online users across all orgs */
  getOnlineCount(): number {
    return this.onlineUsers.size;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private extractToken(client: Socket): string | null {
    // Try Authorization header first (Bearer <token>)
    const authHeader = client.handshake.headers.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    // Fall back to query param (?token=...)
    return (client.handshake.query['token'] as string) ?? null;
  }
}
