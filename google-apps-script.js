/**
 * MST Data API - Google Apps Script Backend
 * 
 * Tento skript poskytuje REST API pro synchronizaci dat s Google Sheets.
 * 
 * INSTALACE:
 * 1. Vytvořte Google Sheets s listy: Workers, Projects, FieldTables, TimeRecords, DailyLogs
 * 2. Extensions → Apps Script
 * 3. Zkopírujte tento kód
 * 4. Deploy → New deployment → Web app
 * 5. Execute as: Me, Who has access: Anyone
 * 6. Zkopírujte Deployment URL
 */

// ===== KONFIGURACE =====

const SHEETS = {
  WORKERS: 'Workers',
  PROJECTS: 'Projects',
  FIELD_TABLES: 'FieldTables',
  TIME_RECORDS: 'TimeRecords',
  DAILY_LOGS: 'DailyLogs'
};

// Získá aktivní spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Získá konkrétní list
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  // Vytvoř list pokud neexistuje
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  
  return sheet;
}

// ===== HTTP HANDLERS =====

/**
 * Zpracuje GET požadavky - vrátí všechna data
 */
function doGet(e) {
  try {
    const data = getAllData();
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Zpracuje POST požadavky - upsert/delete operace
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    let result;
    
    switch (action) {
      case 'upsert':
        result = upsertData(params.sheet, params.data);
        break;
        
      case 'delete':
        result = deleteData(params.sheet, params.ids);
        break;
        
      case 'clear':
        result = clearSheet(params.sheet);
        break;
        
      case 'sync':
        result = syncData(params.data);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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
    dailyLogs: getSheetData(SHEETS.DAILY_LOGS)
  };
}

/**
 * Získá data z konkrétního listu
 */
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  
  if (data.length === 0) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
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
  
  let headers = existingData.length > 0 ? existingData[0] : Object.keys(records[0]);
  let rows = existingData.slice(1);
  
  let updated = 0;
  let inserted = 0;
  
  records.forEach(record => {
    const recordId = record.id;
    
    // Najdi existující řádek podle ID
    const existingRowIndex = rows.findIndex(row => {
      const idIndex = headers.indexOf('id');
      return idIndex >= 0 && row[idIndex] === recordId;
    });
    
    // Převeď record do pole podle headers
    const recordRow = headers.map(header => {
      const value = record[header];
      
      // Speciální handling pro různé typy
      if (value === undefined || value === null) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      if (value instanceof Date) return value.toISOString();
      return value;
    });
    
    if (existingRowIndex >= 0) {
      // Update existujícího řádku
      rows[existingRowIndex] = recordRow;
      updated++;
    } else {
      // Insert nového řádku
      rows.push(recordRow);
      inserted++;
    }
  });
  
  // Zapiš zpět do sheetu
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
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
  
  if (data.length === 0) return { deleted: 0 };
  
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  
  if (idIndex < 0) {
    throw new Error('Sheet does not have an "id" column');
  }
  
  let deleted = 0;
  
  // Projdi řádky pozpátku (aby se indexy neposouvaly při mazání)
  for (let i = data.length - 1; i > 0; i--) {
    const rowId = data[i][idIndex];
    if (ids.includes(rowId)) {
      sheet.deleteRow(i + 1); // +1 protože Sheets jsou 1-indexed
      deleted++;
    }
  }
  
  return { deleted };
}

/**
 * Vyčistí celý list (kromě hlavičky)
 */
function clearSheet(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  return { cleared: true };
}

/**
 * Synchronizuje všechna data najednou (full sync)
 */
function syncData(data) {
  const results = {};
  
  if (data.workers) {
    results.workers = upsertData(SHEETS.WORKERS, data.workers);
  }
  
  if (data.projects) {
    results.projects = upsertData(SHEETS.PROJECTS, data.projects);
  }
  
  if (data.fieldTables) {
    results.fieldTables = upsertData(SHEETS.FIELD_TABLES, data.fieldTables);
  }
  
  if (data.timeRecords) {
    results.timeRecords = upsertData(SHEETS.TIME_RECORDS, data.timeRecords);
  }
  
  if (data.dailyLogs) {
    results.dailyLogs = upsertData(SHEETS.DAILY_LOGS, data.dailyLogs);
  }
  
  return results;
}

// ===== HELPER FUNCTIONS =====

/**
 * Testovací funkce - můžete spustit pro test
 */
function testAPI() {
  const testData = {
    workers: [
      {
        id: 'test-1',
        name: 'Jan Novák',
        email: 'jan@example.com',
        role: 'Montér',
        hourlyRate: 250,
        color: '#FF5733',
        createdAt: new Date().toISOString()
      }
    ]
  };
  
  const result = syncData(testData);
  Logger.log('Test result:', result);
  
  const allData = getAllData();
  Logger.log('All data:', allData);
}

/**
 * Inicializace - vytvoří všechny potřebné listy
 */
function initializeSheets() {
  const ss = getSpreadsheet();
  
  Object.values(SHEETS).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      Logger.log(`Created sheet: ${sheetName}`);
    }
  });
  
  Logger.log('All sheets initialized!');
}
