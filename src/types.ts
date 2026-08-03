/** A job is either receiving a car (incoming) or returning it (outgoing). */
export type JobType = "incoming" | "outgoing";

/** Lifecycle of a valet job. Flight state lives separately in FlightInfo. */
export type JobStatus = "pending" | "arrived" | "completed";

/**
 * Where the car physically is relative to the Aena car park.
 *  - awaiting:   not yet parked (incoming client hasn't handed it over, or
 *                outgoing car not yet confirmed inside).
 *  - in_parking: confirmed inside the Aena car park.
 *  - returned:   handed back to the owner / left the car park.
 * Set manually, or fed by a self-hosted parking connector (see
 * services/parkingConnector.ts and parking-connector/).
 */
export type ParkingStatus = "awaiting" | "in_parking" | "returned";

export type FlightPhase =
  | "unknown"
  | "scheduled"
  | "delayed"
  | "boarding"
  | "enroute"
  | "landed"
  | "departed"
  | "cancelled"
  | "diverted";

/** Whether we track this flight's arrival at ALC or its departure from ALC. */
export type FlightRole = "arrival" | "departure";

export interface FlightInfo {
  flightNumber: string;
  role: FlightRole;
  phase: FlightPhase;
  /** ISO datetimes, local to the device. */
  scheduled?: string;
  estimated?: string;
  actual?: string;
  delayMinutes?: number;
  gate?: string;
  terminal?: string;
  /** The "other" airport (origin for arrivals, destination for departures). */
  counterpartAirport?: string;
  lastChecked?: string;
  providerId?: string;
}

export interface Client {
  id: string;
  type: JobType;
  name: string;
  plate: string;
  phone?: string;
  airline?: string;
  flightNumber?: string;
  /** YYYY-MM-DD — the arrival (incoming) or departure/return (outgoing) date. */
  date: string;
  /** HH:mm — scheduled hand-over time with the client. */
  time: string;
  parking?: string;
  notes?: string;
  status: JobStatus;
  parkingStatus: ParkingStatus;
  /** ISO time the car was confirmed inside the car park (manual or connector). */
  parkedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  archived: boolean;
  flight?: FlightInfo;
  createdAt: string;
  updatedAt: string;
}

export type FlightProviderId =
  | "none"
  | "demo"
  | "aena"
  | "aerodatabox"
  | "aviationstack";

export interface Settings {
  flightProvider: FlightProviderId;
  aeroDataBoxKey: string;
  aviationStackKey: string;
  /** Base URL of a personal Aena relay (see aena-proxy/worker.js). */
  aenaProxyUrl: string;
  /** Base URL of a self-hosted parking connector (see parking-connector/). */
  parkingConnectorUrl: string;
  /** Optional shared token the connector requires. */
  parkingConnectorToken: string;
  /** Minutes between flight status refreshes per client. */
  pollIntervalMin: number;
  notificationsEnabled: boolean;
  /** Notify this many minutes before an outgoing hand-over. */
  deliveryLeadMin: number;
  /** Minutes after touchdown before we assume the client reached the kerb. */
  walkOutMin: number;
  /** Two jobs closer together than this (minutes) count as a conflict. */
  conflictWindowMin: number;
  /** Optional Supabase sync (REST-based, see services/sync.ts). */
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncEnabled: boolean;
  /** Optional admin passcode; empty = no lock (easy access by default). */
  passcode: string;
}

export const DEFAULT_SETTINGS: Settings = {
  flightProvider: "none",
  aeroDataBoxKey: "",
  aviationStackKey: "",
  aenaProxyUrl: "",
  parkingConnectorUrl: "",
  parkingConnectorToken: "",
  pollIntervalMin: 3,
  notificationsEnabled: false,
  deliveryLeadMin: 45,
  walkOutMin: 20,
  conflictWindowMin: 15,
  supabaseUrl: "",
  supabaseAnonKey: "",
  syncEnabled: false,
  passcode: "",
};

export interface AppState {
  clients: Client[];
  settings: Settings;
  /** Notification dedupe keys -> epoch ms when sent. */
  notified: Record<string, number>;
}

/** Alicante–Elche Miguel Hernández Airport. */
export const HOME_AIRPORT_IATA = "ALC";
export const HOME_AIRPORT_ICAO = "LEAL";
