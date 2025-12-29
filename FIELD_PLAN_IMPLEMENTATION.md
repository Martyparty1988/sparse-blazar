# 📋 Implementace systému plánového pole - Krok 1 HOTOVO

## ✅ Dokončeno

### 1. Datový model (types.ts)
- ✅ **Project** - přidáno pole `tables?: string[]` pro seznam ID stolů
- ✅ **FieldTable** - nový interface pro stoly v plánovém poli
  - `tableId: string` - ID stolu (např. "28", "28.1")
  - `status: 'pending' | 'completed'`
  - `assignedWorkers?: number[]` - max 2 pracovníci
  - `completedAt?: Date`
  - `completedBy?: number`

### 2. Databáze (services/db.ts)
- ✅ Přidána tabulka `fieldTables`
- ✅ Verze 20 databáze
- ✅ Index: `&[projectId+tableId]` pro rychlé vyhledávání

---

## 🚧 Další kroky

### Krok 2: Formulář pro vytvoření projektu
**Soubor**: `components/ProjectForm.tsx`

**Úpravy**:
1. Přidat pole "Seznam stolů" (textarea)
2. Validace: projekt nelze uložit bez stolů
3. Parsing: rozdělit text na pole stringů
4. Uložit do `project.tables[]`
5. Vytvořit záznamy v `fieldTables` pro každý stůl

### Krok 3: Komponenta "Plánové pole"
**Nový soubor**: `components/FieldPlan.tsx`

**Funkce**:
- Zobrazit JEDNU velkou kartu "Plán pole - stoly"
- Grid/mřížka stolů (auto-wrap)
- Každý stůl = malý obdélník s číslem
- Barvy podle stavu (žlutá/zelená)
- Indikace pracovníků (max 2 tečky/iniciály)
- Kliknutí → spodní sheet/modal

### Krok 4: Modal pro stůl
**Nový soubor**: `components/TableModal.tsx`

**Obsah**:
- Číslo stolu
- Typ (small/medium/large)
- Stav (čeká/hotovo)
- Přiřazení pracovníků (max 2)
- Tlačítko "Označit jako hotový"

### Krok 5: Záznam práce
**Soubor**: `components/TimeRecordForm.tsx`

**Úpravy**:
1. Úkolovka → výběr ze stolů v plánovém poli
2. Kabely → POUZE pokud projekt má stoly
3. AI parsing: "hotový stůl 28.1"
   - Najít stůl v DB
   - Označit jako hotový
   - Přiřadit pracovníka

---

## 📝 Poznámky k implementaci

### Parsing seznamu stolů
```typescript
function parseTableList(input: string): string[] {
  return input
    .split(/[,\n]/) // Rozdělit podle čárky nebo nového řádku
    .map(s => s.trim()) // Odstranit mezery
    .filter(s => s.length > 0); // Odstranit prázdné
}
```

### Vytvoření FieldTable záznamů
```typescript
async function createFieldTables(projectId: number, tableIds: string[]) {
  const tables: FieldTable[] = tableIds.map(tableId => ({
    projectId,
    tableId,
    tableType: detectTableType(tableId), // IT28 = small, IT42 = medium, IT56 = large
    status: 'pending',
    assignedWorkers: []
  }));
  
  await db.fieldTables.bulkAdd(tables);
}
```

### Detekce typu stolu
```typescript
function detectTableType(tableId: string): 'small' | 'medium' | 'large' {
  const id = tableId.toLowerCase();
  if (id.startsWith('it28') || id.startsWith('28')) return 'small';
  if (id.startsWith('it42') || id.startsWith('42')) return 'medium';
  if (id.startsWith('it56') || id.startsWith('56')) return 'large';
  return 'medium'; // default
}
```

---

## 🎯 Priorita dalších kroků

1. **VYSOKÁ**: ProjectForm.tsx - formulář s polem pro stoly
2. **VYSOKÁ**: FieldPlan.tsx - vizualizace plánového pole
3. **STŘEDNÍ**: TableModal.tsx - detail stolu
4. **STŘEDNÍ**: TimeRecordForm.tsx - úprava pro úkolovku
5. **NÍZKÁ**: AI parsing "hotový stůl X"

---

## 🔄 Migrace existujících dat

Pro existující projekty:
- Starý systém (SolarTable) zůstává funkční
- Nové projekty používají FieldTable
- Postupná migrace dle potřeby

---

**Status**: ✅ Krok 1 dokončen  
**Další**: Implementace ProjectForm.tsx  
**Čas**: ~30 minut na formulář
