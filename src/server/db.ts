import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AggregatedBusLocation,
  BusSession,
  Passenger,
  PassengerLocation,
  PassengerStatus,
  RouteStop,
  SessionSnapshot,
} from '../shared/types.ts';
import { aggregateBusLocation } from '../shared/locationAggregation.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'busbridge.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize the 5 core relational tables matching the specified schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bus_sessions (
    id TEXT PRIMARY KEY,
    session_code TEXT NOT NULL UNIQUE,
    session_name TEXT NOT NULL,
    route_name TEXT NOT NULL,
    stops_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS passengers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES bus_sessions(id) ON DELETE CASCADE,
    passenger_status TEXT NOT NULL,
    share_name INTEGER NOT NULL DEFAULT 1,
    joined_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passenger_locations (
    id TEXT PRIMARY KEY,
    passenger_id TEXT NOT NULL UNIQUE REFERENCES passengers(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL REFERENCES bus_sessions(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL NOT NULL,
    heading REAL,
    speed REAL,
    timestamp INTEGER NOT NULL,
    is_sharing INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS aggregated_bus_locations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE REFERENCES bus_sessions(id) ON DELETE CASCADE,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL NOT NULL,
    heading REAL,
    speed REAL,
    active_contributors INTEGER NOT NULL,
    outliers_filtered INTEGER NOT NULL DEFAULT 0,
    confidence_label TEXT NOT NULL,
    is_estimated INTEGER NOT NULL DEFAULT 1,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_passengers_session ON passengers(session_id);
  CREATE INDEX IF NOT EXISTS idx_locations_session ON passenger_locations(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_code ON bus_sessions(session_code);
`);

const SEEDED_ROUTES: Array<{
  id: string;
  sessionCode: string;
  sessionName: string;
  routeName: string;
  stops: RouteStop[];
}> = [
  {
    id: 'session_38r_geary',
    sessionCode: '38R-SF',
    sessionName: '38R Geary Rapid — Westbound',
    routeName: 'Salesforce Transit Center → Ocean Beach',
    stops: [
      { id: 's1', name: 'Salesforce Transit Center', latitude: 37.7897, longitude: -122.3965, order: 1 },
      { id: 's2', name: 'Market & Kearny', latitude: 37.7885, longitude: -122.4034, order: 2 },
      { id: 's3', name: 'Geary & Powell', latitude: 37.7873, longitude: -122.4083, order: 3 },
      { id: 's4', name: 'Geary & Van Ness', latitude: 37.7855, longitude: -122.4214, order: 4 },
      { id: 's5', name: 'Geary & Fillmore', latitude: 37.7840, longitude: -122.4332, order: 5 },
      { id: 's6', name: 'Geary & Arguello', latitude: 37.7811, longitude: -122.4586, order: 6 },
      { id: 's7', name: 'Park Presidio & Geary', latitude: 37.7803, longitude: -122.4728, order: 7 },
      { id: 's8', name: '48th Ave & Point Lobos', latitude: 37.7795, longitude: -122.5096, order: 8 },
    ],
  },
  {
    id: 'session_14r_mission',
    sessionCode: '14R-SF',
    sessionName: '14R Mission Rapid — Southbound',
    routeName: 'Ferry Building → Daly City BART',
    stops: [
      { id: 'm1', name: 'Steuart & Mission', latitude: 37.7933, longitude: -122.3924, order: 1 },
      { id: 'm2', name: 'Mission & 4th St', latitude: 37.7851, longitude: -122.4044, order: 2 },
      { id: 'm3', name: 'Mission & 16th St BART', latitude: 37.7650, longitude: -122.4197, order: 3 },
      { id: 'm4', name: 'Mission & 24th St BART', latitude: 37.7524, longitude: -122.4184, order: 4 },
      { id: 'm5', name: 'Mission & Cortland', latitude: 37.7393, longitude: -122.4227, order: 5 },
      { id: 'm6', name: 'Mission & Geneva', latitude: 37.7166, longitude: -122.4408, order: 6 },
    ],
  },
  {
    id: 'session_campus_loop',
    sessionCode: 'CAMPUS',
    sessionName: 'Campus Express Loop',
    routeName: 'North Dorms → Science Quad → Medical Plaza',
    stops: [
      { id: 'c1', name: 'North Residential Hub', latitude: 37.8758, longitude: -122.2588, order: 1 },
      { id: 'c2', name: 'Hearst Mining Circle', latitude: 37.8742, longitude: -122.2570, order: 2 },
      { id: 'c3', name: 'Memorial Glade', latitude: 37.8724, longitude: -122.2595, order: 3 },
      { id: 'c4', name: 'Downtown BART Plaza', latitude: 37.8698, longitude: -122.2680, order: 4 },
      { id: 'c5', name: 'South Science Complex', latitude: 37.8674, longitude: -122.2625, order: 5 },
    ],
  },
  {
    id: 'session_bay_express',
    sessionCode: 'BAY-EX',
    sessionName: 'Bayshore Commuter Coach 101',
    routeName: 'Caltrain 4th & King → SFO Terminal 2',
    stops: [
      { id: 'b1', name: '4th & King Caltrain', latitude: 37.7764, longitude: -122.3943, order: 1 },
      { id: 'b2', name: 'Potrero & Cesar Chavez', latitude: 37.7483, longitude: -122.4055, order: 2 },
      { id: 'b3', name: 'Bayshore & Geneva', latitude: 37.7091, longitude: -122.4017, order: 3 },
      { id: 'b4', name: 'San Bruno BART', latitude: 37.6377, longitude: -122.4162, order: 4 },
      { id: 'b5', name: 'SFO Terminal 2 Departures', latitude: 37.6177, longitude: -122.3853, order: 5 },
    ],
  },
];

function ensureSeededSessions() {
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO bus_sessions (
      id, session_code, session_name, route_name, stops_json, created_at, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const renewStmt = db.prepare(`
    UPDATE bus_sessions SET expires_at = ?, status = 'active' WHERE id = ? AND expires_at < ?
  `);

  const tx = db.transaction(() => {
    for (const s of SEEDED_ROUTES) {
      insertStmt.run(
        s.id,
        s.sessionCode,
        s.sessionName,
        s.routeName,
        JSON.stringify(s.stops),
        now,
        now + twelveHours
      );
      renewStmt.run(now + twelveHours, s.id, now + 60 * 60 * 1000);
    }
  });
  tx();
}

ensureSeededSessions();

export function createOrUpdateUser(name: string, existingUserId?: string): { id: string; name: string; createdAt: number } {
  const cleanName = name.trim().slice(0, 48) || 'Commuter';
  const now = Date.now();

  if (existingUserId) {
    const existing = db.prepare('SELECT id, name, created_at FROM users WHERE id = ?').get(existingUserId) as
      | { id: string; name: string; created_at: number }
      | undefined;
    if (existing) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(cleanName, existingUserId);
      return { id: existing.id, name: cleanName, createdAt: existing.created_at };
    }
  }

  const id = `usr_${crypto.randomUUID().slice(0, 12)}`;
  db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)').run(id, cleanName, now);
  return { id, name: cleanName, createdAt: now };
}

export function listActiveSessions(): BusSession[] {
  const now = Date.now();
  // Automatically expire stale sessions
  db.prepare(`UPDATE bus_sessions SET status = 'expired' WHERE status = 'active' AND expires_at < ?`).run(now);

  const rows = db
    .prepare(`SELECT * FROM bus_sessions WHERE status = 'active' ORDER BY created_at ASC`)
    .all() as Array<{
      id: string;
      session_code: string;
      session_name: string;
      route_name: string;
      stops_json: string;
      created_at: number;
      expires_at: number;
      status: string;
    }>;

  const countsStmt = db.prepare(`
    SELECT passenger_status, COUNT(*) as cnt
    FROM passengers
    WHERE session_id = ?
    GROUP BY passenger_status
  `);

  return rows.map((row) => {
    const counts = countsStmt.all(row.id) as Array<{ passenger_status: PassengerStatus; cnt: number }>;
    let waitingCount = 0;
    let onboardCount = 0;
    let sharingCount = 0;

    for (const c of counts) {
      if (c.passenger_status === 'waiting') waitingCount += c.cnt;
      if (c.passenger_status === 'onboard_sharing') {
        onboardCount += c.cnt;
        sharingCount += c.cnt;
      }
      if (c.passenger_status === 'onboard_not_sharing') {
        onboardCount += c.cnt;
      }
    }

    return {
      id: row.id,
      sessionCode: row.session_code,
      sessionName: row.session_name,
      routeName: row.route_name,
      stops: JSON.parse(row.stops_json) as RouteStop[],
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: row.status as BusSession['status'],
      waitingCount,
      onboardCount,
      sharingCount,
    };
  });
}

export function getSessionByCodeOrId(codeOrId: string): BusSession | null {
  const normalized = codeOrId.trim().toUpperCase();
  const row = db
    .prepare(`SELECT * FROM bus_sessions WHERE (id = ? OR UPPER(session_code) = ?) AND status = 'active'`)
    .get(codeOrId.trim(), normalized) as
    | {
        id: string;
        session_code: string;
        session_name: string;
        route_name: string;
        stops_json: string;
        created_at: number;
        expires_at: number;
        status: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    sessionCode: row.session_code,
    sessionName: row.session_name,
    routeName: row.route_name,
    stops: JSON.parse(row.stops_json) as RouteStop[],
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status as BusSession['status'],
  };
}

export function createBusSession(params: {
  sessionName: string;
  routeName: string;
  originLat?: number;
  originLng?: number;
}): BusSession {
  const now = Date.now();
  const eightHours = 8 * 60 * 60 * 1000;
  const id = `ses_${crypto.randomUUID().slice(0, 10)}`;
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();

  const stops: RouteStop[] =
    params.originLat !== undefined && params.originLng !== undefined
      ? [
          {
            id: 'stop_origin',
            name: 'Boarding Origin',
            latitude: params.originLat,
            longitude: params.originLng,
            order: 1,
          },
        ]
      : [];

  db.prepare(`
    INSERT INTO bus_sessions (
      id, session_code, session_name, route_name, stops_json, created_at, expires_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    id,
    code,
    params.sessionName.trim().slice(0, 80) || 'Community Bus Session',
    params.routeName.trim().slice(0, 100) || 'Custom Corridor',
    JSON.stringify(stops),
    now,
    now + eightHours
  );

  return {
    id,
    sessionCode: code,
    sessionName: params.sessionName.trim().slice(0, 80) || 'Community Bus Session',
    routeName: params.routeName.trim().slice(0, 100) || 'Custom Corridor',
    stops,
    createdAt: now,
    expiresAt: now + eightHours,
    status: 'active',
    waitingCount: 0,
    onboardCount: 0,
    sharingCount: 0,
  };
}

export function joinSession(params: {
  userId: string;
  sessionId: string;
  shareName: boolean;
  initialStatus?: PassengerStatus;
}): Passenger {
  const now = Date.now();
  const existing = db
    .prepare(`
      SELECT p.*, u.name as user_name
      FROM passengers p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = ? AND p.session_id = ?
    `)
    .get(params.userId, params.sessionId) as
    | {
        id: string;
        user_id: string;
        session_id: string;
        passenger_status: PassengerStatus;
        share_name: number;
        joined_at: number;
        updated_at: number;
        user_name: string;
      }
    | undefined;

  if (existing) {
    const nextStatus =
      existing.passenger_status === 'disconnected' || existing.passenger_status === 'reached_destination'
        ? (params.initialStatus ?? 'waiting')
        : existing.passenger_status;

    db.prepare(`
      UPDATE passengers
      SET passenger_status = ?, share_name = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, params.shareName ? 1 : 0, now, existing.id);

    // Extend session expiry on activity
    db.prepare(`UPDATE bus_sessions SET expires_at = ? WHERE id = ?`).run(
      now + 8 * 60 * 60 * 1000,
      params.sessionId
    );

    return {
      id: existing.id,
      userId: existing.user_id,
      sessionId: existing.session_id,
      displayName: params.shareName ? existing.user_name : `Commuter ${existing.id.slice(-4).toUpperCase()}`,
      shareName: params.shareName,
      passengerStatus: nextStatus,
      joinedAt: existing.joined_at,
      updatedAt: now,
      location: getPassengerLocation(existing.id),
    };
  }

  const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(params.userId) as
    | { id: string; name: string }
    | undefined;
  const userName = user?.name ?? 'Commuter';
  const passengerId = `pax_${crypto.randomUUID().slice(0, 12)}`;
  const status = params.initialStatus ?? 'waiting';

  db.prepare(`
    INSERT INTO passengers (id, user_id, session_id, passenger_status, share_name, joined_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(passengerId, params.userId, params.sessionId, status, params.shareName ? 1 : 0, now, now);

  return {
    id: passengerId,
    userId: params.userId,
    sessionId: params.sessionId,
    displayName: params.shareName ? userName : `Commuter ${passengerId.slice(-4).toUpperCase()}`,
    shareName: params.shareName,
    passengerStatus: status,
    joinedAt: now,
    updatedAt: now,
    location: null,
  };
}

export function getPassengerLocation(passengerId: string): PassengerLocation | null {
  const row = db
    .prepare(`SELECT * FROM passenger_locations WHERE passenger_id = ?`)
    .get(passengerId) as
    | {
        id: string;
        passenger_id: string;
        session_id: string;
        latitude: number;
        longitude: number;
        accuracy: number;
        heading: number | null;
        speed: number | null;
        timestamp: number;
        is_sharing: number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    passengerId: row.passenger_id,
    sessionId: row.session_id,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    heading: row.heading,
    speed: row.speed,
    timestamp: row.timestamp,
    isSharing: row.is_sharing === 1,
  };
}

export function updatePassengerStatus(params: {
  sessionId: string;
  passengerId: string;
  passengerStatus: PassengerStatus;
  shareName?: boolean;
}): Passenger | null {
  const now = Date.now();
  const row = db
    .prepare(`
      SELECT p.*, u.name as user_name
      FROM passengers p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ? AND p.session_id = ?
    `)
    .get(params.passengerId, params.sessionId) as
    | {
        id: string;
        user_id: string;
        session_id: string;
        passenger_status: PassengerStatus;
        share_name: number;
        joined_at: number;
        updated_at: number;
        user_name: string;
      }
    | undefined;

  if (!row) return null;

  const shareNameBit =
    params.shareName !== undefined ? (params.shareName ? 1 : 0) : row.share_name;

  db.prepare(`
    UPDATE passengers
    SET passenger_status = ?, share_name = ?, updated_at = ?
    WHERE id = ?
  `).run(params.passengerStatus, shareNameBit, now, params.passengerId);

  if (
    params.passengerStatus === 'onboard_not_sharing' ||
    params.passengerStatus === 'reached_destination' ||
    params.passengerStatus === 'disconnected'
  ) {
    db.prepare(`UPDATE passenger_locations SET is_sharing = 0 WHERE passenger_id = ?`).run(
      params.passengerId
    );
  } else if (params.passengerStatus === 'onboard_sharing' || params.passengerStatus === 'waiting') {
    db.prepare(`UPDATE passenger_locations SET is_sharing = 1 WHERE passenger_id = ?`).run(
      params.passengerId
    );
  }

  recomputeAndSaveAggregatedBus(params.sessionId);

  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    displayName: shareNameBit === 1 ? row.user_name : `Commuter ${row.id.slice(-4).toUpperCase()}`,
    shareName: shareNameBit === 1,
    passengerStatus: params.passengerStatus,
    joinedAt: row.joined_at,
    updatedAt: now,
    location: getPassengerLocation(row.id),
  };
}

export function upsertPassengerLocation(params: {
  sessionId: string;
  passengerId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  isSharing: boolean;
  timestamp?: number;
}): AggregatedBusLocation | null {
  const now = params.timestamp ?? Date.now();
  // Verify session membership before updating
  const pax = db
    .prepare(`SELECT id, passenger_status FROM passengers WHERE id = ? AND session_id = ?`)
    .get(params.passengerId, params.sessionId) as
    | { id: string; passenger_status: PassengerStatus }
    | undefined;

  if (!pax) return null;

  // Privacy: overwrite single latest location row per passenger (no public history trail)
  const locId = `loc_${params.passengerId}`;
  db.prepare(`
    INSERT INTO passenger_locations (
      id, passenger_id, session_id, latitude, longitude, accuracy, heading, speed, timestamp, is_sharing
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(passenger_id) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      heading = excluded.heading,
      speed = excluded.speed,
      timestamp = excluded.timestamp,
      is_sharing = excluded.is_sharing
  `).run(
    locId,
    params.passengerId,
    params.sessionId,
    params.latitude,
    params.longitude,
    Math.max(1, params.accuracy || 15),
    params.heading,
    params.speed,
    now,
    params.isSharing ? 1 : 0
  );

  db.prepare(`UPDATE passengers SET updated_at = ? WHERE id = ?`).run(now, params.passengerId);

  return recomputeAndSaveAggregatedBus(params.sessionId);
}

export function getSessionPassengers(sessionId: string): Passenger[] {
  const rows = db
    .prepare(`
      SELECT
        p.id, p.user_id, p.session_id, p.passenger_status, p.share_name, p.joined_at, p.updated_at,
        u.name as user_name,
        pl.id as loc_id, pl.latitude, pl.longitude, pl.accuracy, pl.heading, pl.speed, pl.timestamp as loc_ts, pl.is_sharing
      FROM passengers p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN passenger_locations pl ON pl.passenger_id = p.id
      WHERE p.session_id = ?
      ORDER BY p.updated_at DESC
    `)
    .all(sessionId) as Array<{
      id: string;
      user_id: string;
      session_id: string;
      passenger_status: PassengerStatus;
      share_name: number;
      joined_at: number;
      updated_at: number;
      user_name: string;
      loc_id: string | null;
      latitude: number | null;
      longitude: number | null;
      accuracy: number | null;
      heading: number | null;
      speed: number | null;
      loc_ts: number | null;
      is_sharing: number | null;
    }>;

  return rows.map((r) => {
    const shareName = r.share_name === 1;
    // Privacy: do not expose coordinates for passengers who are not sharing or reached destination
    const canExposeLocation =
      r.loc_id !== null &&
      r.latitude !== null &&
      r.longitude !== null &&
      r.is_sharing === 1 &&
      (r.passenger_status === 'waiting' || r.passenger_status === 'onboard_sharing');

    return {
      id: r.id,
      userId: r.user_id,
      sessionId: r.session_id,
      displayName: shareName ? r.user_name : `Commuter ${r.id.slice(-4).toUpperCase()}`,
      shareName,
      passengerStatus: r.passenger_status,
      joinedAt: r.joined_at,
      updatedAt: r.updated_at,
      location: canExposeLocation
        ? {
            id: r.loc_id!,
            passengerId: r.id,
            sessionId: r.session_id,
            latitude: r.latitude!,
            longitude: r.longitude!,
            accuracy: r.accuracy ?? 20,
            heading: r.heading,
            speed: r.speed,
            timestamp: r.loc_ts ?? r.updated_at,
            isSharing: true,
          }
        : null,
    };
  });
}

export function recomputeAndSaveAggregatedBus(sessionId: string): AggregatedBusLocation | null {
  const passengers = getSessionPassengers(sessionId);
  const aggregated = aggregateBusLocation(sessionId, passengers);

  if (!aggregated) {
    db.prepare(`DELETE FROM aggregated_bus_locations WHERE session_id = ?`).run(sessionId);
    return null;
  }

  db.prepare(`
    INSERT INTO aggregated_bus_locations (
      id, session_id, latitude, longitude, accuracy, heading, speed,
      active_contributors, outliers_filtered, confidence_label, is_estimated, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      heading = excluded.heading,
      speed = excluded.speed,
      active_contributors = excluded.active_contributors,
      outliers_filtered = excluded.outliers_filtered,
      confidence_label = excluded.confidence_label,
      is_estimated = excluded.is_estimated,
      timestamp = excluded.timestamp
  `).run(
    aggregated.id,
    aggregated.sessionId,
    aggregated.latitude,
    aggregated.longitude,
    aggregated.accuracy,
    aggregated.heading,
    aggregated.speed,
    aggregated.activeContributors,
    aggregated.outliersFiltered,
    aggregated.confidenceLabel,
    aggregated.isEstimated ? 1 : 0,
    aggregated.timestamp
  );

  return aggregated;
}

export function getSessionSnapshot(sessionId: string): SessionSnapshot | null {
  const session = getSessionByCodeOrId(sessionId);
  if (!session) return null;

  const passengers = getSessionPassengers(session.id);
  const aggregatedBus = recomputeAndSaveAggregatedBus(session.id);

  return {
    session,
    passengers,
    aggregatedBus,
    serverTime: Date.now(),
  };
}

export function markStalePassengersDisconnected(staleThresholdMs = 50_000): string[] {
  const cutoff = Date.now() - staleThresholdMs;
  const staleRows = db
    .prepare(`
      SELECT id, session_id
      FROM passengers
      WHERE passenger_status = 'onboard_sharing' AND updated_at < ?
    `)
    .all(cutoff) as Array<{ id: string; session_id: string }>;

  if (staleRows.length === 0) return [];

  const affectedSessions = new Set<string>();
  const tx = db.transaction(() => {
    for (const row of staleRows) {
      db.prepare(`UPDATE passengers SET passenger_status = 'disconnected' WHERE id = ?`).run(row.id);
      db.prepare(`UPDATE passenger_locations SET is_sharing = 0 WHERE passenger_id = ?`).run(row.id);
      affectedSessions.add(row.session_id);
    }
  });
  tx();

  for (const sid of affectedSessions) {
    recomputeAndSaveAggregatedBus(sid);
  }

  return Array.from(affectedSessions);
}
