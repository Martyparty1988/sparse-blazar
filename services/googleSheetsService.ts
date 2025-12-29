/**
 * Simple Google Sheets Sync Service
 * Uses Google Sheets API v4 for basic read/write operations
 */

export interface SyncConfig {
  apiKey?: string;
  spreadsheetId?: string;
}

export interface SyncData {
  workers?: any[];
  projects?: any[];
  fieldTables?: any[];
  timeRecords?: any[];
  dailyLogs?: any[];
}

class GoogleSheetsSyncService {
  private apiKey: string | null = null;
  private isInitialized = false;
  public isLoggedIn = false;
  private accessToken: string | null = null;

  /**
   * Initialize the service with API key
   */
  async init(apiKey?: string): Promise<void> {
    if (apiKey) {
      this.apiKey = apiKey;
      localStorage.setItem('google_sheets_api_key', apiKey);
    } else {
      this.apiKey = localStorage.getItem('google_sheets_api_key');
    }

    if (this.apiKey) {
      this.isInitialized = true;
      this.isLoggedIn = true;
    }
  }

  /**
   * Sign in with Google OAuth (simplified - just stores API key)
   */
  async signIn(): Promise<void> {
    const apiKey = prompt('Enter your Google Sheets API Key:');
    if (apiKey) {
      await this.init(apiKey);
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    this.apiKey = null;
    this.isLoggedIn = false;
    this.isInitialized = false;
    localStorage.removeItem('google_sheets_api_key');
  }

  /**
   * Create a new spreadsheet
   */
  async createSpreadsheet(title: string): Promise<string> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const response = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          properties: { title },
          sheets: [
            { properties: { title: 'Workers' } },
            { properties: { title: 'Projects' } },
            { properties: { title: 'FieldTables' } },
            { properties: { title: 'TimeRecords' } },
            { properties: { title: 'DailyLogs' } },
          ],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create spreadsheet: ${response.statusText}`);
    }

    const data = await response.json();
    return data.spreadsheetId;
  }

  /**
   * Write data to a specific sheet
   */
  async writeToSheet(
    spreadsheetId: string,
    sheetName: string,
    data: any[]
  ): Promise<void> {
    if (!this.apiKey) throw new Error('Not authenticated');

    // Convert data to 2D array
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const rows = [
      headers,
      ...data.map((row) => headers.map((h) => {
        const value = row[h];
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'object') return JSON.stringify(value);
        return value ?? '';
      })),
    ];

    const range = `${sheetName}!A1`;
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW&key=${this.apiKey}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range,
          values: rows,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to write to sheet: ${response.statusText}`);
    }
  }

  /**
   * Read data from a specific sheet
   */
  async readFromSheet(
    spreadsheetId: string,
    sheetName: string
  ): Promise<any[]> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const range = `${sheetName}!A1:Z1000`;
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error(`Failed to read from sheet: ${response.statusText}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    if (rows.length === 0) return [];

    const headers = rows[0];
    return rows.slice(1).map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  }

  /**
   * Sync project data to Google Sheets
   */
  async syncProjectData(
    spreadsheetId: string,
    data: {
      project: any;
      tables: any[];
      tasks: any[];
      records: any[];
      workers: any[];
    }
  ): Promise<void> {
    if (!this.apiKey) throw new Error('Not authenticated');

    // Write each data type to its respective sheet
    if (data.workers.length > 0) {
      await this.writeToSheet(spreadsheetId, 'Workers', data.workers);
    }

    if (data.tables.length > 0) {
      await this.writeToSheet(spreadsheetId, 'FieldTables', data.tables);
    }

    if (data.tasks.length > 0) {
      await this.writeToSheet(spreadsheetId, 'Projects', [data.project]);
    }

    if (data.records.length > 0) {
      await this.writeToSheet(spreadsheetId, 'TimeRecords', data.records);
    }
  }

  /**
   * Pull all data from Google Sheets
   */
  async pullAllData(spreadsheetId: string): Promise<SyncData> {
    if (!this.apiKey) throw new Error('Not authenticated');

    const [workers, projects, fieldTables, timeRecords, dailyLogs] =
      await Promise.all([
        this.readFromSheet(spreadsheetId, 'Workers').catch(() => []),
        this.readFromSheet(spreadsheetId, 'Projects').catch(() => []),
        this.readFromSheet(spreadsheetId, 'FieldTables').catch(() => []),
        this.readFromSheet(spreadsheetId, 'TimeRecords').catch(() => []),
        this.readFromSheet(spreadsheetId, 'DailyLogs').catch(() => []),
      ]);

    return {
      workers,
      projects,
      fieldTables,
      timeRecords,
      dailyLogs,
    };
  }
}

export const googleSheetsService = new GoogleSheetsSyncService();
