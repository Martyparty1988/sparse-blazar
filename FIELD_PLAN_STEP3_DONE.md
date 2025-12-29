# ✅ Krok 3 HOTOVO - Komponenta plánového pole

## 📦 Vytvořené komponenty

### 1. **FieldPlan.tsx** - Hlavní vizualizace
**Funkce:**
- ✅ Zobrazení všech stolů v jedné velké kartě
- ✅ Grid/mřížka s auto-wrap (responzivní)
- ✅ Barevné kódování:
  - 🟡 Žlutá = čeká
  - 🎨 Barva pracovníka = hotovo
- ✅ Iniciály pracovníka na hotových stolech
- ✅ Glow efekt pro hotové stoly
- ✅ Tečky pro přiřazené pracovníky (max 2)
- ✅ Statistiky (celkem/čeká/hotovo)
- ✅ Filtrování (vše/čeká/hotovo)
- ✅ Legenda pracovníků s počtem stolů

**Props:**
```typescript
interface FieldPlanProps {
  projectId: number;
  onTableClick?: (table: FieldTable) => void;
}
```

**Použití:**
```tsx
<FieldPlan 
  projectId={projectId} 
  onTableClick={(table) => console.log(table)}
/>
```

---

### 2. **TableModal.tsx** - Detail stolu
**Funkce:**
- ✅ Zobrazení detailu stolu
- ✅ Číslo stolu s barevným pozadím
- ✅ Typ stolu (IT28/IT42/IT56)
- ✅ Status (čeká/hotovo)
- ✅ Info o dokončení (kdo, kdy)
- ✅ Přiřazení pracovníků (max 2)
- ✅ Tlačítko "Označit jako hotový"
- ✅ Tlačítko "Vrátit do čekání"
- ✅ Mobilní optimalizace (slide-up)

**Props:**
```typescript
interface TableModalProps {
  table: FieldTable;
  onClose: () => void;
  onUpdate?: () => void;
}
```

**Použití:**
```tsx
<TableModal
  table={selectedTable}
  onClose={() => setSelectedTable(null)}
  onUpdate={() => refreshData()}
/>
```

---

### 3. **FieldPlanView.tsx** - Wrapper
**Funkce:**
- ✅ Spojuje FieldPlan a TableModal
- ✅ Správa stavu (vybraný stůl)
- ✅ Refresh po aktualizaci

**Props:**
```typescript
interface FieldPlanViewProps {
  projectId: number;
}
```

**Použití:**
```tsx
<FieldPlanView projectId={projectId} />
```

---

## 🎨 Vizuální funkce

### Grid stolů
- **Responzivní:**
  - Mobile: 3 sloupce
  - Tablet: 6 sloupců
  - Desktop: 10 sloupců
- **Aspect ratio:** 1:1 (čtverce)
- **Gap:** 12px mezi stoly
- **Hover:** Scale 1.1 + glow efekt

### Barevné kódování
```typescript
// Čekající stůl
backgroundColor: '#f59e0b' // Žlutá
boxShadow: '0 4px 12px rgba(0,0,0,0.2)'

// Hotový stůl (např. Martin - modrá)
backgroundColor: '#3b82f6' // Barva pracovníka
boxShadow: '0 0 20px #3b82f640' // Glow efekt
```

### Iniciály pracovníka
```tsx
<span className="text-white/80 font-bold text-[10px]">
  {getInitials(worker.name)} // "MN"
</span>
```

### Tečky přiřazených pracovníků
```tsx
<div className="flex gap-1">
  {assignedWorkers.slice(0, 2).map(worker => (
    <div 
      className="w-3 h-3 rounded-full border border-white/50"
      style={{ backgroundColor: worker.color }}
    />
  ))}
</div>
```

---

## 📊 Statistiky

### Header
```tsx
<div className="stats-badges">
  <div className="pending-badge">
    <div className="count">{stats.pending}</div>
    <div className="label">Čeká</div>
  </div>
  <div className="completed-badge">
    <div className="count">{stats.completed}</div>
    <div className="label">Hotovo</div>
  </div>
</div>
```

### Legenda pracovníků
```tsx
{workers.map(worker => {
  const completedCount = tables.filter(
    t => t.completedBy === worker.id
  ).length;
  
  return (
    <div className="worker-legend-item">
      <div className="color-dot" style={{ backgroundColor: worker.color }} />
      <span>{worker.name}</span>
      <span>{completedCount} stolů</span>
    </div>
  );
})}
```

---

## 🎯 Interakce

### Kliknutí na stůl
1. Otevře se TableModal
2. Zobrazí detail stolu
3. Umožní:
   - Přiřadit pracovníky (max 2)
   - Označit jako hotový
   - Vrátit do čekání

### Označení jako hotový
```typescript
await db.fieldTables.update(table.id!, {
  status: 'completed',
  completedAt: new Date(),
  completedBy: currentUser.workerId,
});
```

### Přiřazení pracovníků
```typescript
await db.fieldTables.update(table.id!, {
  assignedWorkers: [workerId1, workerId2], // Max 2
});
```

---

## 📱 Responzivní design

### Desktop
- 10 sloupců
- Velké stoly (60x60px)
- Hover efekty
- Glow animace

### Tablet
- 6 sloupců
- Střední stoly (50x50px)
- Touch-friendly

### Mobile
- 3 sloupce
- Malé stoly (40x40px)
- Slide-up modal
- Velké tlačítka (min 44px)

---

## 🔄 Aktualizace dat

### Live queries
Komponenty používají `useLiveQuery` z Dexie:
```typescript
const tables = useLiveQuery(
  () => db.fieldTables.where('projectId').equals(projectId).toArray(),
  [projectId]
);
```

**Výhoda:** Automatická aktualizace při změně dat v DB.

### Manual refresh
```typescript
const [refreshKey, setRefreshKey] = useState(0);

const handleUpdate = () => {
  setRefreshKey(prev => prev + 1);
};

<FieldPlan key={refreshKey} ... />
```

---

## 🎨 CSS Třídy

### Hlavní kontejner
```css
.field-plan-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 12px;
}
```

### Stůl - čekající
```css
.table-pending {
  background: #f59e0b;
  border: 2px solid #f59e0b;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
```

### Stůl - hotový
```css
.table-completed {
  /* backgroundColor se nastaví dynamicky */
  border: 2px solid currentColor;
  box-shadow: 0 0 20px currentColor;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px currentColor; }
  50% { box-shadow: 0 0 30px currentColor; }
}
```

---

## 🚀 Integrace do aplikace

### V Projects view
```tsx
import FieldPlanView from './components/FieldPlanView';

// V detailu projektu
{selectedProject && (
  <FieldPlanView projectId={selectedProject.id!} />
)}
```

### V Plan view
```tsx
// Nahradit starý systém s SolarTable
<FieldPlanView projectId={projectId} />
```

---

## 📝 Další vylepšení (volitelné)

### 1. Drag & Drop
Přesouvání stolů mezi pracovníky:
```typescript
const handleDrop = (tableId: string, workerId: number) => {
  await db.fieldTables.update(tableId, {
    assignedWorkers: [workerId]
  });
};
```

### 2. Hromadné operace
Označit více stolů najednou:
```typescript
const handleBulkComplete = async (tableIds: number[]) => {
  await db.fieldTables.bulkUpdate(
    tableIds.map(id => ({
      key: id,
      changes: { status: 'completed', completedBy: workerId }
    }))
  );
};
```

### 3. Export do PDF
Vygenerovat PDF s barevnou mapou:
```typescript
import jsPDF from 'jspdf';

const exportToPDF = () => {
  const doc = new jsPDF();
  // Vykreslit barevnou mapu stolů
  doc.save('field-plan.pdf');
};
```

---

## ✅ Checklist

### Hotovo
- [x] FieldPlan.tsx - vizualizace
- [x] TableModal.tsx - detail
- [x] FieldPlanView.tsx - wrapper
- [x] Barevné kódování
- [x] Iniciály pracovníků
- [x] Glow efekty
- [x] Statistiky
- [x] Filtrování
- [x] Legenda
- [x] Responzivní design
- [x] Touch-friendly
- [x] Live updates

### Zbývá
- [ ] Integrace do App.tsx
- [ ] Aktualizace Plan view
- [ ] Testování na mobilu
- [ ] AI parsing "hotový stůl X"

---

**Status**: ✅ Krok 3 dokončen  
**Další**: Integrace do aplikace  
**Čas**: ~20 minut na integraci
