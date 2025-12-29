# 👥 Multi-User Guide - Google Sheets Backend

**Jak používat aplikaci s více uživateli najednou**

---

## ✅ ANO, funguje to s více uživateli!

Každý uživatel může:
- ✅ Přidávat své odpracováno
- ✅ Vidět odpracováno ostatních
- ✅ Editovat svoje záznamy
- ✅ Synchronizovat kdykoliv

---

## 🔄 Jak to funguje

### Základní princip:
```
Telefon A → Push → Google Sheets (cloud) ← Pull ← Telefon B
```

1. **Uživatel A** přidá data → **Push to Sheets**
2. Data jsou v **Google Sheets** (sdílený cloud)
3. **Uživatel B** → **Pull from Sheets** → vidí data od A
4. **Uživatel B** přidá své data → **Push**
5. **Uživatel A** → **Pull** → vidí data od B

**Výsledek:** Všichni vidí všechna data! ✅

---

## 📱 Setup pro každého uživatele

### Krok 1: Instalace aplikace
```bash
# V telefonu každého uživatele:
1. Nainstalovat MST aplikaci
2. Vytvořit účet / přihlásit se
```

### Krok 2: Nastavit Google Sheets
```
Settings → Google Sheets Backend
```

**DŮLEŽITÉ:** Všichni musí použít **STEJNOU** Deployment URL!

```
https://script.google.com/macros/s/AKfycbz3jO8_9Glxvc1dXV36OJIQqGwP0CVamqn0TvKwI-PvTLtS6NyC0b-C80TcJZRWF2iy/exec
```

### Krok 3: Test Connection
```
Click "Test Connection" → ✅
```

### Krok 4: První synchronizace
**První uživatel:**
```
Push to Sheets (nahraje existující data)
```

**Ostatní uživatelé:**
```
Pull from Sheets (stáhne data od prvního uživatele)
```

### Krok 5: Zapnout Auto-sync (doporučeno)
```
Settings → Enable Auto-sync
Interval: 30-60 sekund
```

---

## 🎯 Tři režimy synchronizace

### **Režim 1: Auto-sync (Real-time)**
```
✅ Zapnuto: Auto-sync každých 30s
```

**Výhody:**
- ✅ Téměř real-time aktualizace
- ✅ Automatické Push i Pull
- ✅ Nikdy nic nezapomenete

**Nevýhody:**
- ⚠️ Vyšší spotřeba baterie
- ⚠️ Vyžaduje internet

**Pro:**
- Vedoucí v kanceláři
- Pokud potřebujete vidět změny okamžitě

---

### **Režim 2: Manuální (On-demand)**
```
❌ Auto-sync vypnutý
Ruční: Pull / Push tlačítka
```

**Výhody:**
- ✅ Úspora baterie
- ✅ Kontrola nad synchronizací
- ✅ Funguje offline

**Nevýhody:**
- ⚠️ Musíte pamatovat na Pull/Push
- ⚠️ Můžete vidět zastaralá data

**Pro:**
- Montéři v terénu bez internetu
- Telefony se slabou baterií

**Workflow:**
```
Ráno: Pull from Sheets (stáhnout aktuální stav)
Během dne: Pracovat offline
Večer: Push to Sheets (nahrát odpracováno)
```

---

### **Režim 3: Hybrid (DOPORUČENO pro mobil)**
```
✅ Auto-sync: ON
⏱️ Interval: 60-120 sekund
```

**Výhody:**
- ✅ Rozumná spotřeba baterie
- ✅ Stále docela aktuální data
- ✅ Automatické, ale ne agresivní

**Pro:**
- Většina uživatelů
- Ideální kompromis

---

## 📋 Případové studie

### **Příklad 1: Tým 3 montérů + vedoucí**

#### Setup:
- **Montér 1, 2, 3:** Auto-sync každých 60s (nebo manuální Push večer)
- **Vedoucí:** Auto-sync každých 30s (chce vidět aktuální stav)

#### Workflow:
```
8:00 - Montér 1 přijde na stavbu, přidá checkin
      → Auto-sync pošle do cloudu

8:05 - Vedoucí otevře aplikaci
      → Auto-sync stáhne → vidí že Montér 1 je na místě ✅

12:00 - Montér 1, 2, 3 přidají odpracováno
       → Auto-sync / Push to Sheets

17:00 - Vedoucí kontroluje
       → Vidí odpracováno od všech 3 montérů
       → Nebo otevře Google Sheets v PC
```

---

### **Příklad 2: Offline terén**

#### Setup:
- **Montéři:** Auto-sync OFF (nemají internet na staveništi)
- **Vedoucí:** Auto-sync ON

#### Workflow:
```
Ráno (s WiFi):
  Montér → Pull from Sheets (stáhne aktuální projekty/úkoly)
  
Během dne (bez internetu):
  Montér → Přidává odpracováno offline
  Data: Uložena lokálně v telefonu
  
Večer (s WiFi):
  Montér → Push to Sheets (nahraje celé odpracováno)
  Vedoucí → Vidí odpracováno od všech
```

---

### **Příklad 3: Vedoucí + externí účetní**

#### Setup:
```
1. Sdílet Google Sheets "MST Database"
   → File → Share → přidat email účetní
   
2. Účetní má přístup k Sheets (nemusí mít aplikaci!)
```

#### Workflow:
```
Montéři → Používají aplikaci → Push data
Google Sheets → Automaticky aktualizováno
Účetní → Otevře Google Sheets v PC
       → Vidí všechna data
       → Export → Excel → Fakturace
```

---

## ⚠️ Konflikty a jak je řešit

### **Problém: Dva lidé upraví stejný záznam**

#### Scénář:
```
10:00 - Jan (offline) upraví záznam #123 → "4 hodiny"
10:05 - Petr (online) upraví záznam #123 → "5 hodin"
10:10 - Petr Push → Google Sheets má "5 hodin"
10:15 - Jan se připojí → Push → Google Sheets má "4 hodiny" ⚠️
```

**Co se stane:** Janova verze přepíše Petrovu (last write wins)

#### Řešení 1: Auto-sync (prevence)
```
✅ Auto-sync ON → Jan by stáhl Petrovu změnu před editací
```

#### Řešení 2: Workflow pravidla
```
Pravidlo: Každý montér upravuje POUZE svoje záznamy
- Jan přidává svoje hodiny → ID začíná "jan-..."
- Petr přidává svoje hodiny → ID začíná "petr-..."
- Nikdy neupravují navzájem své záznamy
```

#### Řešení 3: Pull před Push
```
Workflow:
1. Pull from Sheets (stáhnout nejnovější stav)
2. Upravit data
3. Push to Sheets (nahrát změny)
```

---

### **Problém: Duplicitní záznamy**

#### Scénář:
```
Jan přidá záznam offline
Petr přidá STEJNÝ záznam (např. oba přidali projekt ručně)
```

#### Řešení:
```
✅ ID generování je automatické a unikátní:
   id: `${Date.now()}-${Math.random()}`
   
✅ Každý záznam má jiné ID, takže jsou to 2 různé záznamy
   (můžete pak smazat duplicitu v Google Sheets ručně)
```

---

### **Problém: Smazané záznamy se vrací**

#### Scénář:
```
Jan (offline) smaže záznam #123
Petr (online) → Pull → nemá #123
Jan → Push → #123 se NEVRÁTÍ ✅ (lokálně smazaný)
```

**Řešení:** Aplikace správně handluje mazání ✅

---

## 🔒 Bezpečnost pro více uživatelů

### **Aktuální nastavení (TESTOVACÍ):**
```
Who has access: Anyone (Kdokoli)
⚠️ Kdokoliv s URL může číst/zapisovat data!
```

### **Doporučeno pro produkci:**

#### **Možnost 1: Pouze vy**
```
Apps Script → Deploy → Manage deployments → Edit
Who has access: Only myself

✅ Bezpečné
⚠️ Jen vy můžete přistupovat (ne týmové použití)
```

#### **Možnost 2: Pouze Google účty**
```
Who has access: Anyone with Google account

✅ Musí být přihlášeni Google účtem
⚠️ Vyžaduje OAuth (složitější setup)
```

#### **Možnost 3: API Key** (DOPORUČENO pro týmy)

V `google-apps-script.js`:
```javascript
const API_KEY = "vase-tajne-heslo-123"; // Změňte!

function doPost(e) {
  // Ověř API klíč
  const providedKey = e.parameter.apiKey || JSON.parse(e.postData.contents).apiKey;
  
  if (providedKey !== API_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: "Invalid API key"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Zbytek kódu...
}

function doGet(e) {
  // Stejná kontrola pro GET
  if (e.parameter.apiKey !== API_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: "Invalid API key"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Zbytek kódu...
}
```

V aplikaci (Settings):
```typescript
// V settings přidat další pole:
const API_KEY = "vase-tajne-heslo-123";

// Upravit googleSheetsService.ts:
async init(config: { deploymentUrl: string; apiKey: string }) {
  this.config = {
    ...config,
    deploymentUrl: `${config.deploymentUrl}?apiKey=${config.apiKey}`
  };
}
```

**Pak:**
- ✅ Sdílíte URL + API klíč jen s týmem
- ✅ Ostatní nemůžou přistupovat
- ✅ Můžete změnit klíč kdykoliv (re-deploy)

---

## 📊 Monitoring více uživatelů

### **Možnost 1: Google Sheets přímo**
```
1. Otevřete "MST Database" v Google Sheets
2. Vidíte data od všech uživatelů
3. Můžete filtrovat, třídit, exportovat
```

### **Možnost 2: Apps Script Logs**
```
1. Apps Script → View → Executions
2. Vidíte každý API call
3. Timestamp, user (pokud OAuth), errors
```

### **Možnost 3: Custom logging**

Přidejte do `google-apps-script.js`:
```javascript
function logActivity(action, data) {
  const logSheet = getSheet('ActivityLog');
  logSheet.appendRow([
    new Date().toISOString(),
    action,
    JSON.stringify(data),
    Session.getTemporaryActiveUserKey() // Anonymní user ID
  ]);
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  logActivity('POST', { action: params.action, dataCount: params.data?.length || 0 });
  // ... rest of code
}
```

Pak máte log:
```
Timestamp              | Action | Data                    | User
2025-12-29 10:00:00   | POST   | {"action":"upsert"...}  | user123
2025-12-29 10:05:00   | GET    | {}                      | user456
```

---

## 🎯 Doporučený Workflow pro tým

### **Setup (jednou):**
1. ✅ Vytvořit Google Sheets backend (hotovo!)
2. ✅ Nasadit Web App (hotovo!)
3. ✅ (Volitelně) Přidat API Key pro bezpečnost
4. ✅ Otestovat s 1-2 uživateli

### **Každý uživatel (při instalaci):**
1. Nainstalovat aplikaci
2. Settings → Google Sheets → Vložit URL (+ API key)
3. Test Connection ✅
4. **První uživatel:** Push to Sheets
5. **Ostatní:** Pull from Sheets

### **Denní použití:**

#### **Monntéři (terén):**
```
Ráno:
  - Pull from Sheets (stáhnout úkoly/projekty)
  
Během dne:
  - Pracovat (může být offline)
  - Přidávat časové záznamy
  
Večer:
  - Push to Sheets (nahrát odpracováno)
```

#### **Vedoucí (kancelář):**
```
Celý den:
  - Auto-sync ON (každých 30s)
  - Vidí real-time stav všech
  
Kdykoliv:
  - Otevřít Google Sheets v PC
  - Export do Excel pro účetnictví
  - Sdílet s účetní/klientem
```

---

## ✅ Checklist pro multi-user setup

### Před nasazením:
- [ ] Deployment URL funguje (otestováno)
- [ ] (Doporučeno) API Key přidán do kódu
- [ ] Google Sheets sdíleny s týmem / nebo veřejné s API key
- [ ] Otestováno s 2-3 zařízeními současně

### Každý uživatel:
- [ ] Aplikace nainstalována
- [ ] Deployment URL nakonfigurována v Settings
- [ ] (Pokud používáte) API Key nastaven
- [ ] Test Connection ✅
- [ ] První Pull/Push proveden

### Workflow:
- [ ] Všichni vědí kdy dát Pull/Push
- [ ] Nebo: Auto-sync zapnutý u všech
- [ ] Pravidla kdo upravuje jaká data
- [ ] Vedoucí má přístup k Google Sheets

---

## 🎉 Shrnutí

### **Ano, funguje to s více uživateli! ✅**

**Klíčové body:**
1. ✅ Všichni sdílí STEJNOU Deployment URL
2. ✅ Data jsou v Google Sheets (jeden společný cloud)
3. ✅ Pull stáhne data od ostatních
4. ✅ Push nahraje vaše data ostatním
5. ✅ Auto-sync = automatická synchronizace
6. ✅ Můžete mít neomezený počet uživatelů

**Pro nejlepší výsledky:**
- Zapněte **Auto-sync** (každých 30-60s)
- Nebo: **Ráno Pull, večer Push**
- Přidejte **API Key** pro bezpečnost
- Otevřete **Google Sheets** v PC pro monitoring

**A můžete začít! 🚀**

---

## 📞 Support

**Otázky?** Checkněte:
- `GOOGLE_SHEETS_QUICKSTART.md` - základní setup
- `GOOGLE_SHEETS_SETUP.md` - pokročilé nastavení
- `DEPLOYMENT_SUCCESS.md` - deployment info

**Happy teamwork!** 👥🎉
