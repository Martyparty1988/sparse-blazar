# ✅ Krok 2 HOTOVO - Formulář pro vytvoření projektu

## 📋 Co bylo implementováno

### 1. **Aktualizace ProjectForm.tsx**

#### ✅ Import
- Změněn import z `SolarTable` na `FieldTable`

#### ✅ Validace
- **Projekt nelze uložit bez stolů!**
- Alert: "Seznam stolů je povinný! Projekt nelze uložit bez stolů."

#### ✅ Ukládání dat
```typescript
const projectData = {
  name,
  description,
  status,
  tables: tableIds, // NEW: Seznam ID stolů jako string[]
  planFile,
  createdAt,
  updatedAt
};
```

#### ✅ Vytváření FieldTable záznamů
```typescript
const fieldTables = tableIds.map(tableId => ({
  projectId,
  tableId,
  tableType: detectTableType(tableId), // small/medium/large
  status: 'pending',
  assignedWorkers: []
}));
await db.fieldTables.bulkAdd(fieldTables);
```

#### ✅ Detekce typu stolu
```typescript
function detectTableType(tableId: string): 'small' | 'medium' | 'large' {
  const id = tableId.toLowerCase();
  if (id.includes('28') || id.startsWith('it28')) return 'small';
  if (id.includes('42') || id.startsWith('it42')) return 'medium';
  if (id.includes('56') || id.startsWith('it56')) return 'large';
  return 'medium'; // default
}
```

#### ✅ Načítání existujících stolů
- Priorita: `project.tables[]` (nový systém)
- Fallback: `fieldTables` (databáze)
- Zpětná kompatibilita zachována

---

## 🎯 Testování

### Vytvoření nového projektu
1. Otevřít formulář "Nový projekt"
2. Vyplnit název
3. Vybrat stav (Aktivní/Dokončený/Pozastavený)
4. **Zadat seznam stolů:**
   ```
   28
   28.1
   149.1
   IT42-5
   IT56-10
   ```
5. Pokusit se uložit BEZ stolů → ❌ Chyba
6. Zadat stoly → ✅ Uložení úspěšné

### Kontrola v databázi
```typescript
// V DevTools Console:
const project = await db.projects.get(1);
console.log(project.tables); // ["28", "28.1", "149.1", ...]

const tables = await db.fieldTables.where('projectId').equals(1).toArray();
console.log(tables); // [{tableId: "28", tableType: "small", ...}, ...]
```

---

## 🚀 Další kroky

### Krok 3: Komponenta "Plánové pole"
**Soubor**: `components/FieldPlan.tsx` (NOVÝ)

**Funkce:**
- Zobrazit JEDNU velkou kartu "📐 Plán pole - stoly"
- Grid/mřížka stolů (auto-wrap)
- Každý stůl = malý obdélník s číslem
- Barvy podle stavu:
  - Čeká → `bg-yellow-500`
  - Hotovo → `bg-green-500`
- Indikace pracovníků (max 2 tečky)
- Kliknutí → otevře TableModal

### Krok 4: Modal pro stůl
**Soubor**: `components/TableModal.tsx` (NOVÝ)

**Obsah:**
- Číslo stolu
- Typ (small/medium/large)
- Stav (čeká/hotovo)
- Přiřazení pracovníků (max 2)
- Tlačítko "Označit jako hotový"

### Krok 5: Úprava záznamu práce
**Soubor**: `components/TimeRecordForm.tsx`

**Úpravy:**
- Úkolovka → výběr ze stolů v plánovém poli
- Kabely → POUZE pokud projekt má stoly
- AI parsing: "hotový stůl 28.1"

---

## 📝 Poznámky

### Parsing seznamu stolů
- Podporuje čárky: `28, 28.1, 149.1`
- Podporuje nové řádky:
  ```
  28
  28.1
  149.1
  ```
- Automaticky trim() a filter()

### Detekce typu
- `IT28` nebo `28` → small
- `IT42` nebo `42` → medium
- `IT56` nebo `56` → large
- Jiné → medium (default)

### Zpětná kompatibilita
- Starý systém (`SolarTable`) stále funguje
- Nové projekty používají `FieldTable`
- Postupná migrace možná

---

**Status**: ✅ Krok 2 dokončen  
**Další**: Implementace FieldPlan.tsx  
**Čas**: ~45 minut na vizualizaci plánového pole
