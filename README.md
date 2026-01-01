# ☀️ MST - Martyho Solar Tracker

**MST** je progresivní webová aplikace (PWA) navržená pro efektivní správu výstavby solárních parků. Funguje **offline-first**, využívá cloudovou synchronizaci přes **Firebase** a moderní UI optimalizované pro mobilní zařízení.

![App Screenshot](https://image.pollinations.ai/prompt/dashboard%20ui%20design%20solar%20panel%20management%20system%20dark%20mode%20neon%20glassmorphism?width=1280&height=720&nologo=true)

---

## 🌟 Klíčové Funkce

### 🏗️ Projekty & Plány
- **Interaktivní mapy**: Vizualizace projektů s barevným odlišením stavů stolů (Pending/Completed/Defect).
- **Projekty**: Správa projektů s detaily (lokace, data zahájení/ukončení).
- **Marker System**: Označování stolů v terénu, podpora pro nahlášení závad ("Defect") s poznámkami.

### 💼 Práce & Mzdy
- **Dva režimy vykazování**: 
  1. **Hodinová sazba**: Klasické sledování času (Start/Stop).
  2. **Úkolová mzda (Stringy)**: Automatický výpočet stringů podle typu stolu (S/M/L = 1/1.5/2 stringy).
- **Pokročilé mzdy**: Přehledný mzdový list oddělující hodinovou mzdu od úkolové (Kč za string) + bonusy.
- **Unified Log**: Sloučený pohled na odvedenou práci a formulář pro rychlý zápis.

### 📱 Mobile-First & PWA
- **Responzivní design**: Optimalizováno pro iPhone a Android (ošetření "safe areas", notch).
- **Touch-friendly**: Větší ovládací prvky, gesta pro kontextové menu, žádný zoom na inputech.
- **Offline režim**: Plná funkčnost bez internetu díky indexované DB, synchronizace na pozadí.

### 👥 Správa Týmu
- **Profily pracovníků**: Barevné kódování, přiřazení rolí (Admin/User).
- **Docházka**: Sledování příchodů a odchodů.
- **Statistiky**: Grafy výkonnosti jednotlivců i celého projektu.

### 💾 Data & Cloud
- **Hybridní úložiště**: Lokální data v `IndexedDB` (Dexie.js) pro rychlost + `Firebase Realtime Database` pro týmovou synchronizaci.
- **Zálohování**: Bezpečné cloudové zálohy.

---

## 🛠️ Technický Stack

| Kategorie | Technologie | Účel |
|-----------|-------------|------|
| **Frontend** | React 18, TypeScript | UI logika a moderní komponenty |
| **Build** | Vite | Rychlý bundler a vývojové prostředí |
| **Local Data** | Dexie.js (IndexedDB) | Lokální offline-first databáze |
| **Sync/Auth** | Firebase (Auth + Database) | Přihlašování a real-time synchronizace |
| **Styling** | Tailwind CSS | Utility-first CSS, Custom Glassmorphism |
| **Vizualizace** | Recharts | Grafy mezd a výkonu |

### 📂 Struktura Projektu

```bash
src/
├── components/       # UI Komponenty (ProjectCard, TimeRecords, FieldPlan...)
├── contexts/         # React Context (Auth, I18n, Toast...)
├── services/         # Služby
│   ├── db.ts           # Lokální DB schéma (Dexie)
│   ├── firebaseService.ts # Komunikace s Firebase
├── types/            # TypeScript definice (Project, TimeRecord...)
└── App.tsx           # Hlavní routování
```

---

## 🚀 Instalace a Spuštění

1.  **Naklonovat repozitář:**
    ```bash
    git clone https://github.com/martyparty1988/sparse-blazar.git
    cd sparse-blazar/current-app
    ```

2.  **Instalace závislostí:**
    ```bash
    npm install
    ```

3.  **Nastavení Firebase:**
    *   Vytvořte `firebaseConfig.json` nebo upravte `services/firebaseService.ts` s vašimi údaji.

4.  **Spuštění (Dev):**
    ```bash
    npm run dev
    ```

5.  **Build (Prod):**
    ```bash
    npm run build
    ```

---

## 💡 Návody k použití

### Jak nahlásit závadu?
1. Otevřete sekci **Projekty** (mapa).
2. Dlouze stiskněte (nebo klikněte pravým tlačítkem) na konkrétní stůl.
3. Zvolte **"Nahlásit závadu"**.
4. Vyplňte poznámku v okně a potvrďte. Stůl zčervená.

### Jak zapsat úkolovou práci?
1. Jděte do sekce **Práce**.
2. Klikněte na **"Přidat záznam"**.
3. Přepněte typ práce na **"Úkol"** (ikona seznamu).
4. Vyberte projekt a vložte ID stolů nebo vyberte typ stolu (Malý/Střední/Velký).
5. Aplikace automaticky spočítá počet stringů.

---

## 📜 Licence

Proprietary software tailored for Martyho Solar Tracker usages.
Created by Martin.
