
export interface Worker {
  id?: number;
  name: string;
  hourlyRate: number;
  username?: string; // New: Login username
  password?: string; // New: Simple password/pin
  color?: string; // NEW: Barva zaměstnance (hex, např. "#3b82f6")
  createdAt: Date;
}

export interface Project {
  id?: number;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'on_hold';
  tables?: string[]; // NEW: Seznam ID stolů (např. ["28", "28.1", "149.1"])
  planFile?: File;
  googleSpreadsheetId?: string; // ID of the connected Google Sheet
  lastSync?: Date; // Timestamp of last sync
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TimeRecord {
  id?: number;
  workerId: number;
  projectId: number;
  startTime: Date;
  endTime: Date;
  description: string;
}

export interface User {
  username: string;
  role: 'user' | 'admin';
  workerId?: number; // New: Links the logged-in user to a specific worker record
}

// NEW: Stůl v plánovém poli (zjednodušený model)
export interface FieldTable {
  id?: number;
  projectId: number;
  tableId: string; // ID stolu (např. "28", "28.1", "149.1")
  tableType: 'small' | 'medium' | 'large';
  status: 'pending' | 'completed';
  assignedWorkers?: number[]; // ID přiřazených pracovníků (max 2)
  completedAt?: Date;
  completedBy?: number; // ID pracovníka, který dokončil
}

// DEPRECATED: Starý model (ponecháno pro zpětnou kompatibilitu)
export interface SolarTable {
  id?: number;
  projectId: number;
  x: number;
  y: number;
  tableCode: string;
  tableType: 'small' | 'medium' | 'large';
  status: 'pending' | 'completed';
}

export interface TableAssignment {
  id?: number;
  tableId: number;
  workerId: number;
}


export interface PlanMarker {
  id?: number;
  projectId: number;
  workerId: number;
  x: number; // percentage
  y: number; // percentage
  page: number;
}

export interface AttendanceSession {
  id?: number;
  workerId: number;
  startTime: Date;
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'holiday';

export interface DailyLog {
  id?: number;
  date: string; // YYYY-MM-DD
  workerId: number;
  status: AttendanceStatus;
  notes: string;
}

export interface ProjectTask {
  id?: number;
  projectId: number;
  taskType: 'panels' | 'construction' | 'cables';
  description: string;

  // Fields for panels
  panelCount?: number;
  pricePerPanel?: number;

  // Fields for cables
  tableSize?: 'small' | 'medium' | 'large';

  // General fields
  price: number; // This will be the total price for the task
  assignedWorkerId?: number;
  completionDate?: Date;
  startTime?: Date; // For efficiency tracking
  endTime?: Date;   // For efficiency tracking
}


export interface ProjectComponent {
  id?: number;
  projectId: number;
  name: string;
  description: string;
}

export interface AnnotationPath {
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
  tool: 'pencil' | 'eraser';
}

export interface PlanAnnotation {
  id?: number;
  projectId: number;
  page: number;
  paths: AnnotationPath[];
}

export interface TableStatusHistory {
  id?: number;
  tableId: number;
  workerId: number;
  status: 'pending' | 'completed';
  timestamp: Date;
}

export interface BackupMetadata {
  appVersion: string;
  itemsCount: {
    workers: number;
    projects: number;
    records: number;
  };
  dataSize: number;
}

export interface Backup {
  id?: number;
  version: string;
  timestamp: Date;
  type: 'auto' | 'manual';
  name?: string;
  data: string; // LZ-compressed JSON string
  metadata: BackupMetadata;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  text: string;
  icon: string;
}

export interface CloudBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
}

export type ToolStatus = 'available' | 'borrowed' | 'broken' | 'service' | 'lost';

export interface Tool {
  id?: number;
  name: string;
  type: string; // e.g., "Drill", "Ladder", "Car"
  brand?: string;
  serialNumber?: string;
  status: ToolStatus;
  assignedWorkerId?: number; // Who has it currently
  purchaseDate?: Date;
  notes?: string;
  lastInspection?: Date;
}

export interface DailyReport {
  id?: number;
  date: string; // YYYY-MM-DD
  projectId: number;
  stringsCompleted: number; // Počet hotových stringů
  notes: string; // Obecné poznámky (CZ)
  issues: string; // Problémy (CZ)
  managerEmail?: string; // Email site managera
  sentAt?: Date; // Kdy byl report odeslán
}
