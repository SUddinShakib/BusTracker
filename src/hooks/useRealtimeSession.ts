import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientWsMessage,
  PassengerStatus,
  ServerWsMessage,
  SessionSnapshot,
} from '../shared/types.ts';

export type WsConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface SessionActivityEvent {
  id: string;
  event: string;
  displayName: string;
  timestamp: number;
}

interface UseRealtimeSessionParams {
  sessionId: string | null;
  passengerId: string | null;
}

export function useRealtimeSession({ sessionId, passengerId }: UseRealtimeSessionParams) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [connectionState, setConnectionState] = useState<WsConnectionState>('disconnected');
  const [recentEvents, setRecentEvents] = useState<SessionActivityEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueueRef = useRef<ClientWsMessage[]>([]);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const sendMessage = useCallback((msg: ClientWsMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      // Queue non-ping messages while reconnecting (keep latest location only)
      if (msg.type === 'location:update') {
        pendingQueueRef.current = pendingQueueRef.current.filter(
          (m) => m.type !== 'location:update'
        );
      }
      if (msg.type !== 'ping') {
        pendingQueueRef.current.push(msg);
      }
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !passengerId) {
      setConnectionState('disconnected');
      return;
    }

    let isDisposed = false;

    const connect = () => {
      if (isDisposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      setConnectionState(
        reconnectAttemptRef.current === 0 ? 'connecting' : 'reconnecting'
      );

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isDisposed) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnectionState('connected');

        ws.send(
          JSON.stringify({
            type: 'session:join',
            sessionId,
            passengerId,
          } satisfies ClientWsMessage)
        );

        // Flush any queued messages from disconnect window
        while (pendingQueueRef.current.length > 0) {
          const queued = pendingQueueRef.current.shift()!;
          ws.send(JSON.stringify(queued));
        }
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data) as ServerWsMessage;
          if (msg.type === 'session:state') {
            setSnapshot(msg.payload);
          } else if (msg.type === 'session:event') {
            const eventItem: SessionActivityEvent = {
              id: `${msg.passengerId}_${msg.timestamp}`,
              event: msg.event,
              displayName: msg.displayName,
              timestamp: msg.timestamp,
            };
            setRecentEvents((prev) => [eventItem, ...prev].slice(0, 6));
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (isDisposed) return;
        setConnectionState('reconnecting');
        const delay = Math.min(8000, 1000 * Math.pow(1.6, reconnectAttemptRef.current));
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    // Heartbeat ping every 20s
    const pingInterval = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' } satisfies ClientWsMessage));
      }
    }, 20_000);

    return () => {
      isDisposed = true;
      window.clearInterval(pingInterval);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, passengerId]);

  const sendLocationUpdate = useCallback(
    (params: {
      latitude: number;
      longitude: number;
      accuracy: number;
      heading: number | null;
      speed: number | null;
      isSharing: boolean;
      timestamp?: number;
    }) => {
      if (!sessionId || !passengerId) return;
      sendMessage({
        type: 'location:update',
        sessionId,
        passengerId,
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy,
        heading: params.heading,
        speed: params.speed,
        isSharing: params.isSharing,
        timestamp: params.timestamp ?? Date.now(),
      });
    },
    [sessionId, passengerId, sendMessage]
  );

  const sendStatusUpdate = useCallback(
    (passengerStatus: PassengerStatus, shareName?: boolean) => {
      if (!sessionId || !passengerId) return;
      sendMessage({
        type: 'status:update',
        sessionId,
        passengerId,
        passengerStatus,
        shareName,
      });
    },
    [sessionId, passengerId, sendMessage]
  );

  return {
    snapshot,
    setSnapshot,
    connectionState,
    recentEvents,
    sendLocationUpdate,
    sendStatusUpdate,
  };
}
