import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import {
  createBusSession,
  createOrUpdateUser,
  getSessionByCodeOrId,
  getSessionSnapshot,
  joinSession,
  listActiveSessions,
  markStalePassengersDisconnected,
  updatePassengerStatus,
  upsertPassengerLocation,
} from './src/server/db.ts';
import type {
  ClientWsMessage,
  PassengerStatus,
  ServerWsMessage,
} from './src/shared/types.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  app.use(express.json());

  // Safe public client configuration endpoint
  app.get('/api/config', (_req, res) => {
    res.json({
      mapsApiKey:
        process.env.VITE_GOOGLE_MAPS_API_KEY ||
        process.env.GOOGLE_MAPS_API_KEY ||
        '',
    });
  });

  // Create or update passenger identity (simple name-based MVP onboarding)
  app.post('/api/users', (req, res) => {
    const { name, userId } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Passenger name is required.' });
    }
    const user = createOrUpdateUser(name, typeof userId === 'string' ? userId : undefined);
    res.json(user);
  });

  // List active bus tracking sessions with live participant counts
  app.get('/api/sessions', (_req, res) => {
    const sessions = listActiveSessions();
    res.json({ sessions });
  });

  // Lookup a session by code or ID
  app.get('/api/sessions/:codeOrId', (req, res) => {
    const session = getSessionByCodeOrId(req.params.codeOrId);
    if (!session) {
      return res.status(404).json({ error: 'Bus tracking session not found or expired.' });
    }
    const snapshot = getSessionSnapshot(session.id);
    res.json(snapshot);
  });

  // Create a new community bus tracking session
  app.post('/api/sessions', (req, res) => {
    const { sessionName, routeName, originLat, originLng } = req.body ?? {};
    if (typeof sessionName !== 'string' || !sessionName.trim()) {
      return res.status(400).json({ error: 'Bus / session name is required.' });
    }
    const session = createBusSession({
      sessionName,
      routeName: typeof routeName === 'string' && routeName.trim() ? routeName : 'Community Route',
      originLat: typeof originLat === 'number' ? originLat : undefined,
      originLng: typeof originLng === 'number' ? originLng : undefined,
    });
    res.status(201).json({ session });
  });

  // Join a bus tracking session as a passenger
  app.post('/api/sessions/:sessionId/join', (req, res) => {
    const { userId, shareName, initialStatus } = req.body ?? {};
    if (typeof userId !== 'string' || !userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }
    const session = getSessionByCodeOrId(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or expired.' });
    }
    const passenger = joinSession({
      userId,
      sessionId: session.id,
      shareName: shareName !== false,
      initialStatus: initialStatus as PassengerStatus | undefined,
    });
    const snapshot = getSessionSnapshot(session.id);
    if (snapshot) {
      broadcastSessionState(session.id, snapshot);
    }
    res.json({ passenger, snapshot });
  });

  // REST fallback for status updates
  app.post('/api/sessions/:sessionId/status', (req, res) => {
    const { passengerId, passengerStatus, shareName } = req.body ?? {};
    if (!passengerId || !passengerStatus) {
      return res.status(400).json({ error: 'passengerId and passengerStatus are required.' });
    }
    const updated = updatePassengerStatus({
      sessionId: req.params.sessionId,
      passengerId,
      passengerStatus,
      shareName,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Passenger not in session.' });
    }
    const snapshot = getSessionSnapshot(req.params.sessionId);
    if (snapshot) {
      broadcastSessionState(req.params.sessionId, snapshot);
    }
    res.json({ passenger: updated, snapshot });
  });

  // Create HTTP server so Express and WebSocket share port 3000
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  interface ClientMeta {
    ws: WebSocket;
    sessionId?: string;
    passengerId?: string;
  }

  const roomClients = new Map<string, Set<ClientMeta>>();
  const clientMetaMap = new Map<WebSocket, ClientMeta>();

  function broadcastToRoom(sessionId: string, message: ServerWsMessage) {
    const clients = roomClients.get(sessionId);
    if (!clients) return;
    const raw = JSON.stringify(message);
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  function broadcastSessionState(sessionId: string, snapshot = getSessionSnapshot(sessionId)) {
    if (!snapshot) return;
    broadcastToRoom(sessionId, {
      type: 'session:state',
      payload: snapshot,
    });
  }

  wss.on('connection', (ws) => {
    const meta: ClientMeta = { ws };
    clientMetaMap.set(ws, meta);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ClientWsMessage;

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() } satisfies ServerWsMessage));
          return;
        }

        if (msg.type === 'session:join') {
          if (meta.sessionId && roomClients.has(meta.sessionId)) {
            roomClients.get(meta.sessionId)!.delete(meta);
          }
          meta.sessionId = msg.sessionId;
          meta.passengerId = msg.passengerId;
          if (!roomClients.has(msg.sessionId)) {
            roomClients.set(msg.sessionId, new Set());
          }
          roomClients.get(msg.sessionId)!.add(meta);

          const snapshot = getSessionSnapshot(msg.sessionId);
          if (snapshot) {
            ws.send(JSON.stringify({ type: 'session:state', payload: snapshot } satisfies ServerWsMessage));
          }
          return;
        }

        if (msg.type === 'status:update') {
          const updated = updatePassengerStatus({
            sessionId: msg.sessionId,
            passengerId: msg.passengerId,
            passengerStatus: msg.passengerStatus,
            shareName: msg.shareName,
          });
          if (!updated) {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid session membership.' }));
            return;
          }
          const eventMap: Partial<Record<PassengerStatus, 'passenger_boarded' | 'passenger_waiting' | 'passenger_reached' | 'sharing_paused' | 'passenger_disconnected'>> = {
            onboard_sharing: 'passenger_boarded',
            waiting: 'passenger_waiting',
            reached_destination: 'passenger_reached',
            onboard_not_sharing: 'sharing_paused',
            disconnected: 'passenger_disconnected',
          };
          const evt = eventMap[msg.passengerStatus];
          if (evt) {
            broadcastToRoom(msg.sessionId, {
              type: 'session:event',
              event: evt,
              passengerId: updated.id,
              displayName: updated.displayName,
              timestamp: Date.now(),
            });
          }
          broadcastSessionState(msg.sessionId);
          return;
        }

        if (msg.type === 'location:update') {
          upsertPassengerLocation({
            sessionId: msg.sessionId,
            passengerId: msg.passengerId,
            latitude: msg.latitude,
            longitude: msg.longitude,
            accuracy: msg.accuracy,
            heading: msg.heading,
            speed: msg.speed,
            isSharing: msg.isSharing,
            timestamp: msg.timestamp,
          });
          broadcastSessionState(msg.sessionId);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      clientMetaMap.delete(ws);
      if (meta.sessionId && roomClients.has(meta.sessionId)) {
        roomClients.get(meta.sessionId)!.delete(meta);
      }
    });
  });

  // Periodically check for stale onboard sharers (e.g., lost internet > 50s)
  setInterval(() => {
    const affected = markStalePassengersDisconnected(50_000);
    for (const sid of affected) {
      broadcastSessionState(sid);
    }
  }, 15_000);

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
        ws: {
          server,
          path: '/__vite_hmr',
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BusBridge server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start BusBridge server:', err);
  process.exit(1);
});
