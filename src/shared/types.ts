export type PassengerStatus =
  | 'waiting'
  | 'onboard_sharing'
  | 'onboard_not_sharing'
  | 'reached_destination'
  | 'disconnected';

export type SessionStatus = 'active' | 'expired' | 'completed';

export type ConfidenceLabel =
  | 'multi_signal'
  | 'single_signal'
  | 'low_confidence'
  | 'no_signal';

export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  order: number;
}

export interface BusSession {
  id: string;
  sessionCode: string;
  sessionName: string;
  routeName: string;
  stops: RouteStop[];
  createdAt: number;
  expiresAt: number;
  status: SessionStatus;
  waitingCount?: number;
  onboardCount?: number;
  sharingCount?: number;
}

export interface Passenger {
  id: string;
  userId: string;
  sessionId: string;
  displayName: string;
  shareName: boolean;
  passengerStatus: PassengerStatus;
  joinedAt: number;
  updatedAt: number;
  location?: PassengerLocation | null;
}

export interface PassengerLocation {
  id: string;
  passengerId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
  isSharing: boolean;
}

export interface AggregatedBusLocation {
  id: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  activeContributors: number;
  outliersFiltered: number;
  confidenceLabel: ConfidenceLabel;
  isEstimated: boolean;
  timestamp: number;
}

export interface SessionSnapshot {
  session: BusSession;
  passengers: Passenger[];
  aggregatedBus: AggregatedBusLocation | null;
  serverTime: number;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  shareName: boolean;
  updateIntervalMs: 3000 | 5000;
  trafficLayerDefault: boolean;
  arrivalAlertsEnabled: boolean;
  arrivalAlertDistanceMeters: number;
}

export type AppScreen =
  | 'splash'
  | 'welcome'
  | 'enter-name'
  | 'location-permission'
  | 'join-bus'
  | 'tracking'
  | 'passengers'
  | 'settings';

export type TrackingSubView = 'map' | 'waiting' | 'onboard';

// WebSocket protocol messages
export type ClientWsMessage =
  | {
      type: 'session:join';
      sessionId: string;
      passengerId: string;
    }
  | {
      type: 'location:update';
      sessionId: string;
      passengerId: string;
      latitude: number;
      longitude: number;
      accuracy: number;
      heading: number | null;
      speed: number | null;
      isSharing: boolean;
      timestamp: number;
    }
  | {
      type: 'status:update';
      sessionId: string;
      passengerId: string;
      passengerStatus: PassengerStatus;
      shareName?: boolean;
    }
  | {
      type: 'ping';
    };

export type ServerWsMessage =
  | {
      type: 'session:state';
      payload: SessionSnapshot;
    }
  | {
      type: 'session:event';
      event:
        | 'passenger_boarded'
        | 'passenger_waiting'
        | 'passenger_reached'
        | 'sharing_paused'
        | 'passenger_disconnected';
      passengerId: string;
      displayName: string;
      timestamp: number;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
      serverTime: number;
    };
