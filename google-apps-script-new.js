
const API_KEY = 'YOUR_SECRET_API_KEY'; // DŮLEŽITÉ: Změňte na váš tajný klíč!

const SHEETS = {
    WORKERS: 'Workers',
    PROJECTS: 'Projects',
    FIELD_TABLES: 'FieldTables',
    TIME_RECORDS: 'TimeRecords',
    DAILY_LOGS: 'DailyLogs',
    TOOLS: 'Tools',
    PROJECT_TASKS: 'ProjectTasks'
};

function doGet(e) {
    if (!isAuthorized(e)) {
        return createUnauthorizedResponse();
    }
    return handleRequest(e, 'GET');
}

function doPost(e) {
    if (!isAuthorized(e)) {
        return createUnauthorizedResponse();
    }
    return handleRequest(e, 'POST');
}

function isAuthorized(e) {
    const providedKey = e.parameter.apiKey || (e.postData && e.postData.contents && JSON.parse(e.postData.contents).apiKey);
    return providedKey === API_KEY;
}

function createUnauthorizedResponse() {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Invalid API key' }))
        .setMimeType(ContentService.MimeType.JSON);
}

function handleRequest(e, method) {
    const lock = LockService.getScriptLock();
    try {
        lock.waitLock(30000);
    } catch (e) {
        return createResponse({ success: false, error: 'Server busy' });
    }

    try {
        if (method === 'GET') {
            const data = getAllData();
            return createResponse({ success: true, data: data });
        }

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

function getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
    let sheet = getSpreadsheet().getSheetByName(name);
    if (!sheet) {
        sheet = getSpreadsheet().insertSheet(name);
        sheet.appendRow(['id', 'createdAt', 'updatedAt', 'data']);
    }
    return sheet;
}

function getAllData() {
    const result = {};
    Object.keys(SHEETS).forEach(key => {
        const sheetName = SHEETS[key];
        const camelCaseKey = key.charAt(0).toLowerCase() + key.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase());
        result[camelCaseKey] = getSheetData(sheetName);
    });
    return result;
}

function getSheetData(sheetName) {
    const sheet = getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1 || lastCol === 0) return [];

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0];
    const rows = data.slice(1);

    return rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
            let val = row[index];
            if (val === "") val = null;
            try {
                // Pokusí se převést JSON stringy zpět na objekty/pole
                if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                    val = JSON.parse(val);
                }
            } catch (e) {
                // Není to validní JSON, necháme jako string
            }
            obj[header] = val;
        });
        return obj;
    });
}

function upsertData(sheetName, records) {
    if (!records || !records.length) return { updated: 0, inserted: 0 };

    const sheet = getSheet(sheetName);
    let headers = [];
    if (sheet.getLastRow() > 0) {
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    } else {
        headers = Array.from(new Set(records.flatMap(Object.keys)));
        if (!headers.includes('id')) headers.unshift('id');
        sheet.appendRow(headers);
    }

    const idColIdx = headers.indexOf('id');
    const data = sheet.getDataRange().getValues();
    const idMap = new Map(data.slice(1).map((row, i) => [String(row[idColIdx]), i + 2]));

    const rowsToUpdate = [];
    const rowsToInsert = [];

    records.forEach(record => {
        const rowValues = headers.map(header => {
            let val = record[header];
            if (val === undefined || val === null) return "";
            if (typeof val === 'object') return JSON.stringify(val);
            if (val instanceof Date) return val.toISOString();
            return val;
        });

        const rowIndex = idMap.get(String(record.id));
        if (rowIndex) {
            rowsToUpdate.push({ index: rowIndex, values: rowValues });
        } else {
            rowsToInsert.push(rowValues);
        }
    });

    rowsToUpdate.forEach(item => {
        sheet.getRange(item.index, 1, 1, item.values.length).setValues([item.values]);
    });

    if (rowsToInsert.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, rowsToInsert[0].length).setValues(rowsToInsert);
    }

    return { updated: rowsToUpdate.length, inserted: rowsToInsert.length };
}

function deleteData(sheetName, ids) {
    if (!ids || !ids.length) return { deleted: 0 };

    const sheet = getSheet(sheetName);
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { deleted: 0 };

    const headers = data[0];
    const idIdx = headers.indexOf('id');
    if (idIdx === -1) return { error: "No ID column" };

    const idsToDelete = new Set(ids.map(String));
    let deleted = 0;

    for (let i = data.length - 1; i > 0; i--) {
        const rowId = String(data[i][idIdx]);
        if (idsToDelete.has(rowId)) {
            sheet.deleteRow(i + 1);
            deleted++;
        }
    }

    return { deleted };
}

function syncData(data) {
    // Implement sync logic - for now, just upsert all data
    Object.keys(data).forEach(sheetNameKey => {
        const sheetName = SHEETS[sheetNameKey.toUpperCase().replace(/([A-Z])/g, '_$1')]; // a bit of a hack to convert camelCase back to SNAKE_CASE
        if (sheetName) {
            upsertData(sheetName, data[sheetNameKey]);
        }
    });
    return { status: "Sync completed" };
}

function initializeSheets() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Object.values(SHEETS).forEach(sheetName => {
        let sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            sheet = ss.insertSheet(sheetName);
            // Dynamically determine headers from a sample object if possible, or use a default
            const defaultHeaders = ['id', 'createdAt', 'updatedAt', 'name', 'description', 'status']; 
            sheet.appendRow(defaultHeaders);
            Logger.log('Vytvořen list: ' + sheetName);
        }
    });
    Logger.log('HOTOVO! Všechny listy připraveny.');
}
