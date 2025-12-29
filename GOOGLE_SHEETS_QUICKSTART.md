# 🚀 Google Sheets jako Backend - RYCHLÝ START

> **Vše je připraveno!** Stačí 5 minut k nastavení plně funkčního Google Sheets backendu.

---

## ⚡ 3 Kroky k funkčnímu backend

### 📋 Krok 1: Setup Google Sheets (2 min)

1. **Vytvořte nový Google Sheets**
   - Jděte na [sheets.google.com](https://sheets.google.com)
   - Vytvořte novou tabulku (název libovolný, např. "MST Database")

2. **Vytvořte 5 listů:**
   - `Workers`
   - `Projects`
   - `FieldTables`
   - `TimeRecords`
   - `DailyLogs`

   _(Klikněte na + dole pro nový list, přejmenujte kliknutím na název)_

---

### 🔧 Krok 2: Nasaďte Apps Script (2 min)

1. **Otevřete Script Editor**
   - V Google Sheets: **Extensions** → **Apps Script**

2. **Zkopírujte kód**
   - Otevřete soubor **`google-apps-script.js`** (v tomto projektu)
   - Zkopírujte **CELÝ** obsah (Ctrl+A, Ctrl+C)
   - Vložte do Apps Script editoru (smažte původní kód)
   - Klikněte **Ctrl+S** (uložit)

3. **Nasaďte jako Web App**
   - Klikněte **Deploy** (vpravo nahoře)
   - **New deployment**
   - Vyberte typ: **Web app**
   - Nastavte:
     - Execute as: **Me**
     - Who has access: **Anyone** _(pro test - později změňte!)_
   - Klikněte **Deploy**
   - **ZKOPÍRUJTE URL** (vypadá jako `https://script.google.com/macros/s/...`)

---

### ✅ Krok 3: Připojte MST Aplikaci (1 min)

**Varianta A: Testovací Demo**

1. Otevřete `google-sheets-demo.html` v prohlížeči
2. Vložte Deployment URL
3. Klikněte "Test Connection" → mělo by být ✅
4. Zkuste "Push to Sheets" a "Pull from Sheets"

**Varianta B: MST Aplikace**

1. Spusťte aplikaci: `npm run dev`
2. Přihlaste se jako admin
3. Jděte do **Settings** (Nastavení)
4. Najděte sekci "📊 Google Sheets Backend"
5. Vložte Deployment URL
6. Klikněte "Connect Google Sheets"
7. Po připojení:
   - **⬆️ Push to Sheets** - nahraje lokální data
   - **⬇️ Pull from Sheets** - stáhne data

---

## 🎉 HOTOVO!

Data se nyní synchronizují mezi aplikací a Google Sheets!

### Co můžete dělat:

- ✅ **Editovat data přímo v Google Sheets** - změny se projeví po Pull
- ✅ **Sdílet tabulku s týmem** - všichni vidí stejná data
- ✅ **Exportovat do Excel/CSV** - File → Download
- ✅ **Historie změn** - Google Sheets trackuje vše
- ✅ **Záloha v cloudu** - data jsou automaticky zálohována
- ✅ **Grafy a analýzy** - použijte Google Sheets funkce

---

## 🔒 Bezpečnost (DŮLEŽITÉ pro produkci!)

⚠️ **Po testování změňte "Who has access":**

1. V Apps Script: **Deploy** → **Manage deployments**
2. Klikněte ⚙️ (Edit)
3. Změňte "Who has access" na:
   - **Only myself** (nejbezpečnější)
   - **Anyone with Google account** (doporučeno)
4. **New version** → **Deploy**

### Přidejte API Key (volitelné):

Viz `GOOGLE_SHEETS_SETUP.md` → sekce Bezpečnost

---

## 📚 Další Dokumentace

- **`GOOGLE_SHEETS_SETUP.md`** - Kompletní průvodce
- **`GOOGLE_SHEETS_READY.md`** - Detailní dokumentace API
- **`google-apps-script.js`** - Backend kód s komentáři
- **`services/googleSheetsService.ts`** - Frontend služba

---

## 🐛 Něco nefunguje?

### Test Connection neprošel
- Zkontrolujte, že jste zkopírovali CELOU Deployment URL
- URL musí začínat `https://script.google.com/macros/s/`
- Zkuste znovu nasadit (Deploy → Manage → Edit → New version)

### "Authorization required"
- První spuštění vyžaduje autorizaci
- Klikněte "Review Permissions" → Select account → Allow

### Data se nesynchronizují
- Zkontrolujte názvy listů (musí být přesně: Workers, Projects, ...)
- Otevřete Console (F12) pro detaily chyb
- Apps Script logs: Apps Script → View → Executions

### CORS Error
- Apps Script by měl automaticky povolit CORS
- Ujistěte se, že deployment je typu "Web app"

---

## 💡 Tipy

**Pro testování:**
- Použijte `google-sheets-demo.html` - nezávislé na main aplikaci

**První push:**
- Nejdřív udělejte Push to Sheets
- Pak zkontrolujte data v Google Sheets
- Pokuste se něco změnit v Sheets
- Pull from Sheets by měl načíst změny

**Auto-sync:**
- V Settings můžete povolit automatickou synchronizaci
- Default interval: 30s
- Doporučeno: 60s+ pro produkci

---

## ✨ Příště...

Když budete chtít přidat novou tabulku/kolekci:

1. Přidejte nový list v Google Sheets
2. Aktualizujte `google-apps-script.js` (přidejte do SHEETS konstant)
3. Aktualizujte `SyncData` interface v `googleSheetsService.ts`
4. Ready! 🎉

---

**Užijte si váš nový backend! 🚀**

Otázky? Problém? Podívejte se do `GOOGLE_SHEETS_SETUP.md` pro detailní návod.
