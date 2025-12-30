/**
 * MST Data API - Google Apps Script Backend (V2 - Clean)
 * 
 * Tento skript funguje jako databáze pro aplikaci MST.
 * Automaticky vytvoří potřebné listy a poskytuje API pro zápis/čtení.
 */

// Seznam listů, které potřebujeme
const SHEETS = {
    WORKERS: 'Workers',
    PROJECTS: 'Projects',
    FIELD_TABLES: 'FieldTables',
    TIME_RECORDS: 'TimeRecords',
    DAILY_LOGS: 'DailyLogs',
    TOOLS: 'Tools',
    PROJECT_TASKS: 'ProjectTasks'
};

// ==========================================
// 1. HTTP HANDLERS (To, co komunikuje s Appkou)
// ==========================================

function doGet(e) {
    return handleRequest(e, 'GET');
}

function doPost(e) {
    return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
    const lock = LockService.getScriptLock();
    // Zámek proti souběžným zápisům (max 30s)
    try {
        lock.waitLock(30000);
    } catch (e) {
        return createResponse({ success: false, error: 'Server busy' });
    }

    try {
        // 1. GET = Stáhnout všechna data
        if (method === 'GET') {
            const data = getAllData();
            return createResponse({ success: true, data: data });
        }

        // 2. POST = Zapsat/Smazat data
        if (method === 'POST') {
            if (!e.postData || !e.postData.contents) {
                return createResponse({ success: false, error: 'No data received' });
            }

            const payload = JSON.parse(e.postData.contents);
            const action = payload.action;

            let resultData;

            if (action === 'sync') {
                resultData = syncData(payload.data);
            } else if (action === 'upsert') {
                resultData = upsertData(payload.sheet, payload.data);
            } else if (action === 'delete') {
                resultData = deleteData(payload.sheet, payload.ids);
            } else {
                return createResponse({ success: false, error: 'Unknown action: ' + action });
            }

            return createResponse({ success: true, result: resultData });
        }

    } catch (error) {
        return createResponse({ success: false, error: error.toString() });
    } finally {
        lock.releaseLock();
    }
}

function createResponse(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 2. DATA FUNKCE (Práce s tabulkou)
// ==========================================

function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
    let sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) {
        sheet = getSpreadsheet().insertSheet(name);
        // Vytvoříme základní hlavičku, pokud je list nový
        sheet.appendRow(['id', 'createdAt', 'updatedAt', 'data']);
    }
    return sheet;
}

function getAllData() {
    const result = {};
    // Projdeme všechny definované listy a stáhneme data
    Object.keys(SHEETS).forEach(key => {
        const sheetName = SHEETS[key];
        result[key.toLowerCase()] = getSheetData(sheetName); // např. workers: [...]
    });
    // Převedeme klíče na camelCase (FIELD_TABLES -> fieldTables), abychom seděli s frontendem
    // Pro jednoduchost ale výše používám 'key.toLowerCase()', což může udělat 'field_tables'.
    // Uděláme to ručně pro jistotu:
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

function getSheetData(sheetName) {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1 || lastCol === 0) return []; // Jen hlavička nebo prázdno

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            let val = row[index];
            // Ošetření prázdných buněk
            if (val === "") val = null;
            obj[header] = val;
        });
        return obj;
    });
}

function upsertData(sheetName, records) {
    if (!records || !records.length) return { updated: 0, inserted: 0 };

    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();

    // Načteme existující data pro kontrolu ID
    let existingIds = [];
    let headers = [];

    if (lastRow > 0) {
        const data = sheet.getDataRange().getValues();
        headers = data[0];
        // Zjistíme kde je sloupec 'id'
        const idIdx = headers.indexOf('id');
        if (idIdx === -1) {
            // Pokud chybí ID sloupec, přidáme ho (jen pro jistotu)
            headers.unshift('id');
            sheet.insertColumnBefore(1);
            sheet.getRange(1, 1).setValue('id');
        }

        // Načteme mapu ID -> číslo řádku
        // Optimalizace: nečíst celou tabulku, pokud je obří, ale pro < 10000 řádků je to OK.
    } else {
        // Prázdný list -> vytvoříme hlavičky z prvního záznamu
        headers = Object.keys(records[0]);
        if (!headers.includes('id')) headers.unshift('id');
        sheet.appendRow(headers);
    }

    // Znovu načíst hlavičky a data pro jistotu
    const freshData = sheet.getDataRange().getValues();
    const freshHeaders = freshData.length ? freshData[0] : headers;
    const idColIdx = freshHeaders.indexOf('id');

    // Mapa existujících ID -> Row Index (1-based, ale v poli 0-based offset od headeru)
    const idMap = new Map();
    if (freshData.length > 1) {
        for (let i = 1; i < freshData.length; i++) {
            const rowId = String(freshData[i][idColIdx]);
            idMap.set(rowId, i + 1); // Row number v Excelu
        }
    }

    let updated = 0;
    let inserted = 0;

    records.forEach(record => {
        const id = String(record.id);

        // Připravit řádek hodnot seřazený podle hlaviček
        const rowValues = freshHeaders.map(header => {
            let val = record[header];
            if (val === undefined) return "";
            if (val === null) return "";
            if (typeof val === 'object') return JSON.stringify(val); // Pro pole a objekty
            if (val instanceof Date) return val.toISOString();
            return val;
        });

        if (idMap.has(id)) {
            // UPDATE
            const rowIndex = idMap.get(id);
            sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
            updated++;
        } else {
            // INSERT
            sheet.appendRow(rowValues);
            // Přidáme do mapy pro případ duplicit v rámci jednoho batch requestu
            inserted++;
            idMap.set(id, sheet.getLastRow());
        }
    });

    return { updated, inserted };
}

function deleteData(sheetName, ids) {
    if (!ids || !ids.length) return { deleted: 0 };

    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { deleted: 0 }; // Empty

    const headers = data[0];
    const idIdx = headers.indexOf('id');
    if (idIdx === -1) return { error: "No ID column" };

    const idsToDelete = new Set(ids.map(String));
    let deleted = 0;

    // Mažeme odzadu, aby se nerozhodily indexy
    for (let i = data.length - 1; i > 0; i--) {
        const rowId = String(data[i][idIdx]);
        if (idsToDelete.has(rowId)) {
            sheet.deleteRow(i + 1);
            deleted++;
        }
    }

    return { deleted };
}

// ==========================================
// 3. SETUP (Spusťte ručně jednou)
// ==========================================

function initializeSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.values(SHEETS).forEach(sheetName => {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            sheet.appendRow(['id', 'createdAt', 'updatedAt']); // Základní pole
            Logger.log('Vytvořen list: ' + sheetName);
        }
    });
    Logger.log('HOTOVO! Všechny listy připraveny.');
}
