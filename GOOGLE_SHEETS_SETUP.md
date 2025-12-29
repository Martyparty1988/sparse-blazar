# 📊 Google Sheets jako Backend - Kompletní Průvodce

## 🎯 Přehled

Toto řešení používá **Google Apps Script** jako bezplatný backend API pro synchronizaci dat s Google Sheets. Není potřeba OAuth na klientu - vše běží přes jednoduchý HTTPS endpoint!

---

## 📋 Krok 1: Vytvoření Google Sheets

1. Jděte na [Google Sheets](https://sheets.google.com)
2. Vytvořte novou tabulku s názvem **"MST Database"**
3. Vytvořte následující listy (sheets):
   - `Workers`
   - `Projects`
   - `FieldTables`
   - `TimeRecords`
   - `DailyLogs`

---

## 📝 Krok 2: Google Apps Script Setup

### 2.1 Otevřete Script Editor

1. V Google Sheets klikněte na **Extensions** → **Apps Script**
2. Smažte výchozí kód
3. Zkopírujte celý kód níže (nachází se v souboru `google-apps-script.js`)

### 2.2 Nasaďte jako Web App

1. V Apps Script klikněte na **Deploy** → **New deployment**
2. Vyberte typ: **Web app**
3. Nastavte:
   - **Description**: "MST Data API"
   - **Execute as**: **Me**
   - **Who has access**: **Anyone** (pro testování) nebo **Anyone with Google account**
4. Klikněte na **Deploy**
5. **Zkopírujte URL** - toto je váš API endpoint!

---

## 🔧 Krok 3: Konfigurace v MST Aplikaci

1. Spusťte MST aplikaci
2. Jděte do **Nastavení** (Settings)
3. V sekci **Google Sheets Sync** vložte:
   - **Deployment URL**: (URL z kroku 2.2)
4. Klikněte na **Test Connection**
5. Pokud je vše OK, klikněte na **Enable Sync**

---

## 🚀 Jak to funguje

### Automatická synchronizace

Aplikace automaticky synchronizuje data každých **30 sekund** (nastavitelné).

### Manuální sync

- **Push to Sheets**: Nahraje lokální data do Google Sheets
- **Pull from Sheets**: Stáhne data z Google Sheets
- **Full Sync**: Obousměrná synchronizace s intelligent merge

---

## 📊 Struktura dat v Google Sheets

### Workers Sheet
```
id | name | email | role | hourlyRate | color | createdAt | phone | address | active
```

### Projects Sheet
```
id | name | location | tableIds | startDate | endDate | status | description | createdAt
```

### FieldTables Sheet
```
id | projectId | tableId | status | completedAt | completedBy | construction | paneling | cabling | notes | createdAt
```

### TimeRecords Sheet
```
id | workerId | projectId | date | hours | workType | description | createdAt
```

### DailyLogs Sheet
```
id | projectId | date | weather | notes | workersPresent | tablesCompleted | createdAt
```

---

## ⚡ Funkce API

### GET /exec
Získá všechna data ze všech listů

### POST /exec
Vloží/aktualizuje data v Google Sheets

**Body format:**
```json
{
  "action": "upsert",
  "sheet": "Workers",
  "data": [...]
}
```

### DELETE /exec
Smaže záznamy podle ID

**Body format:**
```json
{
  "action": "delete",
  "sheet": "Workers",
  "ids": ["id1", "id2"]
}
```

---

## 🔒 Bezpečnost

### Doporučení pro produkci:

1. **Změňte "Who has access"** na **"Only myself"** nebo **"Anyone with Google account"**
2. **Přidejte API Key** do Apps Script pro autentizaci requestů
3. **Použijte CORS** pro omezení domén
4. **Šifrujte citlivá data** před odesláním

### Příklad s API Key:

V Apps Script přidejte:

```javascript
const API_KEY = "your-secret-key-here";

function doPost(e) {
  const apiKey = e.parameter.apiKey || "";
  if (apiKey !== API_KEY) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Invalid API key"
    })).setMimeType(ContentService.MimeType.JSON);
  }
  // ... rest of code
}
```

V klientu přidejte `?apiKey=your-secret-key-here` k URL.

---

## 🐛 Troubleshooting

### "Script not found" error
- Znovu nasaďte Apps Script (Deploy → Manage deployments → Edit → New version)

### "Authorization required" error
- Zkontrolujte nastavení "Who has access" v deployment

### Data se nesynchronizují
- Zkontrolujte názvy listů (musí přesně odpovídat)
- Zkontrolujte Console v prohlížeči (F12) pro chyby
- Test Connection by měl být zelený

### Pomalá synchronizace
- Zvyšte interval synchronizace v nastavení (default: 30s)
- Pro velké datasety použijte manuální sync

---

## 📈 Performance Tips

1. **Batch Operations**: Apps Script automaticky dělá batch upserts
2. **Caching**: Lokální data jsou cached v IndexedDB
3. **Selective Sync**: Synchronizujte pouze změněná data
4. **Offline Support**: Aplikace funguje offline, sync proběhne po připojení

---

## 🎉 Hotovo!

Nyní máte plně funkční Google Sheets jako backend databázi zdarma! 🚀

Veškerá data jsou zálohována v cloudu, dostupná odkudkoliv, a můžete je editovat i přímo v Google Sheets.

