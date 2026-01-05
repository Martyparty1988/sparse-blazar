# Testování - MST Marty Solar Tracker

## 📊 Aktuální Stav

**Testovací pokrytí:** 55 testů (50 ✅ úspěšných, 5 ❌ selhání)

### Nastavená Infrastruktura

✅ **Vitest** - Rychlý test runner pro Vite projekty
✅ **React Testing Library** - Testování React komponent
✅ **jsdom** - DOM simulace pro testy
✅ **Setup soubory** - Globální konfigurace testů

## 🚀 Spuštění Testů

```bash
# Spustit všechny testy
npm test

# Spustit testy ve watch módu (automaticky se znovu spustí při změně)
npm run test:watch

# Spustit testy s vizuálním UI
npm run test:ui

# Generovat coverage report
npm run test:coverage
```

## 📁 Struktura Testů

```
__tests__/
├── unit/
│   ├── services/
│   │   └── recordProcessor.test.ts     # Testy pro parsování tabulek
│   └── utils/
│       └── workerColors.test.ts        # Testy pro barvy a utility
└── integration/
    ├── components/                     # (připraveno pro budoucí testy)
    └── contexts/                       # (připraveno pro budoucí testy)
```

## 🐛 Odhalené Problémy

### 1. Bug v `parseTableCompletionPatterns` (services/recordProcessor.ts)

**Problém:** Regex vzory zachycují interpunkci (čárky, tečky, dvojtečky) jako součást kódů tabulek.

**Příklady:**
- `"hotový stůl 28.1, dokončil 149"` → zachytí `["28.1,", "149,"]` místo `["28.1", "149"]`
- `"Dokončil jsem: stůl 100"` → zachytí `["jsem:", "100"]`
- `"hotový stůl 29."` → zachytí `["29."]` místo `["29"]`

**Dopad:** Databázové dotazy hledají tabulky s kódy obsahujícími interpunkci, což nikdy nenajde shodu.

**Doporučené řešení:**
```typescript
// Upravit regex vzory, aby nezachycovaly interpunkci
// Místo \S+ použít specifičtější pattern:
const pattern1 = /hotov[ýá]\s+st[ůu]l\s+([\w.-]+)/gi;
const pattern2 = /st[ůu]l\s+([\w.-]+)\s+hotov[ýá]/gi;
// atd...

// NEBO přidat post-processing:
tableCodes.forEach(code => {
  const cleaned = code.replace(/[,:;!?]+$/, ''); // odstraň interpunkci na konci
  cleanedCodes.add(cleaned);
});
```

**Priorita:** 🔴 VYSOKÁ - Může způsobit ztrátu dat při sledování dokončených tabulek

### 2. Očekávané chování `getInitials` (utils/workerColors.ts)

**Poznámka:** Toto NENÍ bug, pouze upřesnění chování.

Funkce vrací první písmeno z každého slova:
- `"Jan Novák"` → `"JN"` ✅
- `"Martin"` → `"M"` ✅ (ne "MA")

## 📈 Pokrytí Testů

### ✅ Otestováno (100% pokrytí)

- **utils/workerColors.ts**
  - `WORKER_COLORS` - pole barev
  - `getWorkerColor()` - přiřazování barev pracovníkům
  - `getRandomWorkerColor()` - náhodné barvy
  - `getLighterColor()` - opacity manipulace
  - `getInitials()` - extrakce iniciál

- **services/recordProcessor.ts**
  - `parseTableCompletionPatterns()` - parsování českých vzorů
  - Všechny 5 pattern typů:
    - ✅ "hotový stůl X"
    - ✅ "stůl X hotový"
    - ✅ "dokončil/dokončen/dokončeno X"
    - ✅ "X dokončen/dokončeno"
    - ✅ "TR X" (legacy)

### ⏳ Čeká na testy (0% pokrytí)

**Kritické služby:**
- `services/firebaseService.ts` - Synchronizace (535 řádků)
- `services/db.ts` - Databázové migrace (27 verzí)
- `services/backupService.ts` - Záloha/obnovení

**Context providery:**
- `contexts/AuthContext.tsx` - Autentizace
- `contexts/BackupContext.tsx` - Správa záloh
- `contexts/ToastContext.tsx` - Notifikace

**Komponenty:**
- Všech 40+ React komponent

**Hooky:**
- `hooks/useDarkMode.ts`
- `hooks/useSwipe.ts`
- `hooks/usePullToRefresh.ts`
- `hooks/useTouchGestures.ts`

## 🎯 Další Kroky

### Fáze 1: Oprava Nalezených Bugů
1. ⚠️ **URGENTNÍ:** Opravit `parseTableCompletionPatterns` (interpunkce)
2. Přidat test pro ověření opravy

### Fáze 2: Rozšíření Pokrytí
1. Testy pro `backupService.ts` (komprese/dekomprese)
2. Testy pro databázové migrace
3. Testy pro `firebaseService.ts` sync logiku
4. Testy pro `AuthContext.tsx`

### Fáze 3: Integrační Testy
1. Formuláře (WorkerForm, ProjectForm, TimeRecordForm)
2. Dashboard komponenty
3. Chat funkcionalita

### Fáze 4: E2E Testy
1. Kritické user flow (Login → Create Project → Add Time Record)

## 💡 Doporučené Praktiky

### Při psaní nových testů:

```typescript
describe('Název modulu/funkce', () => {
  describe('konkrétní funkce', () => {
    it('mělo by dělat X když Y', () => {
      // Arrange (příprava)
      const input = 'test';

      // Act (akce)
      const result = myFunction(input);

      // Assert (ověření)
      expect(result).toBe('expected');
    });
  });
});
```

### Mock Firebase:
```typescript
import { vi } from 'vitest';

// Mock Firebase služby
vi.mock('../services/firebaseService', () => ({
  firebaseService: {
    synchronize: vi.fn().mockResolvedValue({ success: true }),
    // ... další mocky
  }
}));
```

### Mock Dexie:
```typescript
import Dexie from 'dexie';
import 'fake-indexeddb/auto';

// fake-indexeddb automaticky mockuje IndexedDB
```

## 📚 Užitečné Odkazy

- [Vitest Dokumentace](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## 🔧 Konfigurace

- **Test runner:** Vitest 4.0.16
- **Environment:** jsdom
- **Setup:** `setupTests.ts`
- **Config:** `vitest.config.ts`
- **Timeout:** 10s pro async testy
- **Coverage provider:** v8

---

**Poslední aktualizace:** 2026-01-05
**Autor:** Claude (AI asistent)
