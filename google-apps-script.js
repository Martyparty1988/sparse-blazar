/**
 * MST Data API - Google Apps Script Backend
 * 
 * Tento skript poskytuje REST API pro synchronizaci dat s Google Sheets.
 * 
 * INSTALACE:
 * 1. Vytvořte Google Sheets s listy: Workers, Projects, FieldTables, TimeRecords, DailyLogs, Tools, ProjectTasks
 * 2. Extensions → Apps Script
 * 3. Zkopírujte CELÝ tento kód (přepište původní)
 * 4. Deploy → New deployment → Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Zkopírujte Deployment URL do aplikace
 */

// ===== KONFIGURACE =====

const SHEETS = {
  WORKERS: 'Workers',
  PROJECTS: 'Projects',
  FIELD_TABLES: 'FieldTables',
  TIME_RECORDS: 'TimeRecords',
  DAILY_LOGS: 'DailyLogs',
  TOOLS: 'Tools',
  PROJECT_TASKS: 'ProjectTasks'
};

// ===== HTTP HANDLERS (DO NOT DELETE) =====

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  const lock = LockService.getScriptLock();
  // Čekej max 30s na zámek, aby se data nepomíchala při více requestech
  try {
    lock.waitLock(30000);
  } catch (e) {
    return createResponse({ success: false, error: 'Server is busy, try again later.' });
  }

  try {
    let result = { success: false, error: 'Unknown request' };

    // 1. GET Request - Pull All Data or Test Connection
    // e.parameter is empty for simple test, or we look for specific params if needed
    if (method === 'GET') {
      const data = getAllData();
      result = { success: true, timestamp: new Date().toISOString(), data: data };
    }
    // 2. POST Request - Push/Sync/Upsert/Delete
    else if (method === 'POST') {
      if (!e.postData || !e.postData.contents) {
        throw new Error('No POST data received');
      }

      const payload = JSON.parse(e.postData.contents);
      const action = payload.action;

      if (action === 'sync') {
        const syncRes = syncData(payload.data);
        result = { success: true, timestamp: new Date().toISOString(), result: syncRes };
      } else if (action === 'upsert') {
        const upsertRes = upsertData(payload.sheet, payload.data);
        result = { success: true, timestamp: new Date().toISOString(), result: upsertRes };
      } else if (action === 'delete') {
        const deleteRes = deleteData(payload.sheet, payload.ids);
        result = { success: true, timestamp: new Date().toISOString(), result: deleteRes };
      } else {
        result = { success: false, error: 'Invalid action: ' + action };
      }
    }

    return createResponse(result);

  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    return createResponse({
      success: false,
      error: error.toString(),
      stack: error.stack
    });
  } finally {
    lock.releaseLock();
  }
}

function createResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== SHEET HELPERS =====

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  let sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) {
    // Auto-create sheet if missing
    sheet = getSpreadsheet().insertSheet(name);
    // Add default basic headers
    sheet.appendRow(['id', 'createdAt', 'updatedAt', 'data']);
  }
  return sheet;
}

// ===== DATA OPERATIONS =====

/**
 * Získá všechna data ze všech listů
 */
function getAllData() {
  return {
    workers: getSheetData(SHEETS.WORKERS),
    projects: getSheetData(SHEETS.PROJECTS),
    fieldTables: getSheetData(SHEETS.FIELD_TABLES),
    timeRecords: getSheetData(SHEETS.TIME_RECORDS),
    dailyLogs: getSheetData(SHEETS.DAILY_LOGS),
    tools: getSheetData(SHEETS.TOOLS),
    projectTasks: getSheetData(SHEETS.PROJECT_TASKS)
  };
}

/**
 * Získá data z konkrétního listu
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return []; // Only header or empty

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      // Basic type conversion
      obj[header] = row[index] === "" ? null : row[index];
    });
    return obj;
  });
}

/**
 * Upsert (Insert nebo Update) data do listu
 */
function upsertData(sheetName, records) {
  if (!records || records.length === 0) {
    return { updated: 0, inserted: 0 };
  }

  const sheet = getSheet(sheetName);
  const existingData = sheet.getDataRange().getValues();

  // Initialize headers if sheet is empty
  let headers = [];
  if (existingData.length > 0) {
    headers = existingData[0];
  } else {
    // Create headers from first record keys
    headers = Object.keys(records[0]);
    // Ensure 'id' is present
    if (!headers.includes('id')) headers.unshift('id');
    sheet.appendRow(headers);
  }

  let rows = existingData.slice(1);
  let updated = 0;
  let inserted = 0;

  // Calculate new rows or updates
  // PRO TIP: Batch operations would be faster, but for now row-by-row logic is safer for consistency
  // To optimize, we will rebuild the whole data array in memory and write it once.

  // Map existing rows by ID
  const idIndex = headers.indexOf('id');
  if (idIndex === -1) throw new Error(`Sheet ${sheetName} missing 'id' column`);

  const rowsMap = new Map();
  rows.forEach((row, idx) => {
    const id = String(row[idIndex]);
    rowsMap.set(id, { rowIndex: idx, data: row });
  });

  const modifiedRowsMap = new Map(); // To store updates

  records.forEach(record => {
    const recordId = String(record.id);

    // Prepare row array
    const recordRowArray = headers.map(header => {
      let value = record[header];

      // Handle missing new fields in old records gracefully (undefined becomes empty string)
      if (value === undefined) return '';

      // Conversions
      if (value === null) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'object') return JSON.stringify(value);
      return value;
    });

    // Check if new fields appeared in this record that are not in headers
    // (Simplification: we ignore new fields for existing sheets to avoid complex header migration in this simple script version)

    if (rowsMap.has(recordId)) {
      updated++;
      // Update map
      rowsMap.set(recordId, { rowIndex: rowsMap.get(recordId).rowIndex, data: recordRowArray });
    } else {
      inserted++;
      // Add new
      rowsMap.set(recordId, { rowIndex: rowsMap.size, data: recordRowArray });
    }
  });

  // Reconstruct all rows
  const finalRows = Array.from(rowsMap.values()).map(v => v.data);

  if (finalRows.length > 0) {
    // Write back everything (safest for small datasets)
    // Clear content from row 2
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
    }

    // Write new data
    sheet.getRange(2, 1, finalRows.length, headers.length).setValues(finalRows);
  }

  return { updated, inserted };
}

/**
 * Smaže záznamy podle ID
 */
function deleteData(sheetName, ids) {
  if (!ids || ids.length === 0) {
    return { deleted: 0 };
  }

  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return { deleted: 0 };

  const headers = data[0];
  const idIndex = headers.indexOf('id');

  if (idIndex < 0) {
    throw new Error('Sheet does not have an "id" column');
  }

  let deleted = 0;
  const idsToDelete = new Set(ids.map(String));

  // Loop backwards
  for (let i = data.length - 1; i > 0; i--) {
    const rowId = String(data[i][idIndex]);
    if (idsToDelete.has(rowId)) {
      sheet.deleteRow(i + 1);
      deleted++;
    }
  }

  return { deleted };
}

/**
 * Synchronizuje všechna data najednou (full sync)
 */
function syncData(data) {
  const results = {};

  if (data.workers) results.workers = upsertData(SHEETS.WORKERS, data.workers);
  if (data.projects) results.projects = upsertData(SHEETS.PROJECTS, data.projects);
  if (data.fieldTables) results.fieldTables = upsertData(SHEETS.FIELD_TABLES, data.fieldTables);
  if (data.timeRecords) results.timeRecords = upsertData(SHEETS.TIME_RECORDS, data.timeRecords);
  if (data.dailyLogs) results.dailyLogs = upsertData(SHEETS.DAILY_LOGS, data.dailyLogs);
  if (data.tools) results.tools = upsertData(SHEETS.TOOLS, data.tools);
  if (data.projectTasks) results.projectTasks = upsertData(SHEETS.PROJECT_TASKS, data.projectTasks);

  return results;
}

// ===== SETUP =====

/**
 * Inicializace - vytvoří všechny potřebné listy
 * Spusťte tuto funkci ručně v editoru jednou po instalaci!
 */
function initializeSheets() {
  const ss = getSpreadsheet();
  Object.values(SHEETS).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['id', 'createdAt', 'updatedAt']); // Default base headers
      Logger.log(`Created sheet: ${sheetName}`);
    }
  });
  Logger.log('All sheets initialized!');
}
