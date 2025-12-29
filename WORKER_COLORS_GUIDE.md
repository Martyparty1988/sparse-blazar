# 🎨 Barvy zaměstnanců - Implementace

## ✅ Co bylo implementováno

### 1. **Worker.color** - Nové pole v databázi
```typescript
export interface Worker {
  id?: number;
  name: string;
  hourlyRate: number;
  username?: string;
  password?: string;
  color?: string; // NEW: Hex barva (např. "#3b82f6")
  createdAt: Date;
}
```

### 2. **Paleta barev** - 16 vibrantních barev
```typescript
const WORKER_COLORS = [
  '#3b82f6', // Electric Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#84cc16', // Lime
  '#f43f5e', // Rose
  '#0ea5e9', // Sky Blue
  '#eab308', // Yellow
  '#6366f1', // Indigo
  '#22c55e', // Emerald
];
```

### 3. **Helper funkce** - `utils/workerColors.ts`

#### `getWorkerColor()`
Získá barvu pro zaměstnance:
```typescript
const color = getWorkerColor(workerId, worker.color, allWorkers);
```

#### `getRandomWorkerColor()`
Vygeneruje náhodnou barvu z palety:
```typescript
const color = getRandomWorkerColor();
```

#### `getLighterColor()`
Vytvoří světlejší variantu pro pozadí:
```typescript
const bgColor = getLighterColor('#3b82f6', 0.2); // "#3b82f633"
```

#### `getInitials()`
Získá iniciály ze jména:
```typescript
const initials = getInitials('Martin Novák'); // "MN"
```

### 4. **Databáze** - Verze 21
- Přidán index `color` do workers tabulky
- Automatická migrace: přiřazení barev existujícím zaměstnancům
- Každý zaměstnanec dostane unikátní barvu z palety

---

## 🎨 Jak to použít

### Vizualizace hotových stolů

```typescript
import { getWorkerColor, getInitials } from '../utils/workerColors';

// V komponentě FieldPlan nebo TableCard
const table = {
  tableId: "28.1",
  status: "completed",
  completedBy: 5 // ID zaměstnance
};

const worker = await db.workers.get(table.completedBy);
const color = getWorkerColor(worker.id!, worker.color);
const initials = getInitials(worker.name);

// Renderování
<div 
  className="table-card"
  style={{ 
    backgroundColor: color,
    borderColor: color 
  }}
>
  <span className="table-number">{table.tableId}</span>
  <div className="worker-badge" style={{ backgroundColor: color }}>
    {initials}
  </div>
</div>
```

### Vizualizace s více pracovníky

```typescript
const table = {
  tableId: "28.1",
  status: "completed",
  assignedWorkers: [3, 7] // Max 2 pracovníci
};

const workers = await db.workers.bulkGet(table.assignedWorkers);

// Renderování
<div className="table-card">
  <span className="table-number">{table.tableId}</span>
  <div className="worker-badges">
    {workers.map(worker => {
      const color = getWorkerColor(worker.id!, worker.color);
      const initials = getInitials(worker.name);
      
      return (
        <div 
          key={worker.id}
          className="worker-dot"
          style={{ backgroundColor: color }}
          title={worker.name}
        >
          {initials}
        </div>
      );
    })}
  </div>
</div>
```

### CSS pro stoly

```css
/* Čekající stůl - žlutá */
.table-pending {
  background: #f59e0b;
  border: 2px solid #f59e0b;
}

/* Hotový stůl - barva pracovníka */
.table-completed {
  /* background se nastaví dynamicky podle worker.color */
  border: 2px solid currentColor;
  box-shadow: 0 0 20px currentColor;
}

/* Pracovnické tečky */
.worker-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  font-size: 10px;
  font-weight: bold;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 🎯 Příklady použití

### 1. Plánové pole - Grid stolů

```tsx
<div className="field-plan-grid">
  {tables.map(table => {
    const isCompleted = table.status === 'completed';
    const worker = isCompleted && table.completedBy 
      ? await db.workers.get(table.completedBy)
      : null;
    
    const color = worker 
      ? getWorkerColor(worker.id!, worker.color)
      : '#f59e0b'; // Žlutá pro čekající
    
    return (
      <div
        key={table.id}
        className={`table-block ${isCompleted ? 'completed' : 'pending'}`}
        style={{
          backgroundColor: color,
          borderColor: color,
          boxShadow: isCompleted ? `0 0 15px ${color}40` : 'none'
        }}
      >
        <span className="table-id">{table.tableId}</span>
        {worker && (
          <span className="worker-initials">
            {getInitials(worker.name)}
          </span>
        )}
      </div>
    );
  })}
</div>
```

### 2. Legenda - Kdo dělal co

```tsx
<div className="workers-legend">
  <h3>Pracovníci</h3>
  {workers.map(worker => {
    const color = getWorkerColor(worker.id!, worker.color);
    const completedCount = tables.filter(
      t => t.completedBy === worker.id
    ).length;
    
    return (
      <div key={worker.id} className="worker-legend-item">
        <div 
          className="color-dot"
          style={{ backgroundColor: color }}
        />
        <span className="worker-name">{worker.name}</span>
        <span className="completed-count">{completedCount} stolů</span>
      </div>
    );
  })}
</div>
```

### 3. Statistiky - Barevný graf

```tsx
import { PieChart, Pie, Cell } from 'recharts';

const data = workers.map(worker => ({
  name: worker.name,
  value: tables.filter(t => t.completedBy === worker.id).length,
  color: getWorkerColor(worker.id!, worker.color)
}));

<PieChart width={400} height={400}>
  <Pie data={data} dataKey="value">
    {data.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={entry.color} />
    ))}
  </Pie>
</PieChart>
```

---

## 🔄 Migrace existujících dat

### Automatická migrace
Při upgradu na verzi 21 databáze:
1. Všichni existující zaměstnanci dostanou barvu
2. Barvy se přiřadí podle indexu (0-15)
3. Pokud je více než 16 zaměstnanců, barvy se opakují

### Manuální změna barvy
```typescript
// V Team managementu nebo Worker formu
await db.workers.update(workerId, {
  color: '#3b82f6' // Nová barva
});
```

---

## 🎨 Design guidelines

### Kontrast
- Všechny barvy mají dobrý kontrast s bílým textem
- Vhodné pro světlé i tmavé pozadí

### Rozlišitelnost
- 16 barev je dostatečně odlišných
- Funguje i pro barvoslepé (většina kombinací)

### Konzistence
- Stejná barva = stejný pracovník
- Barva se nemění (pokud ji uživatel nezmění)

---

## 📝 Další vylepšení (volitelné)

### Color picker v Team managementu
```tsx
<input
  type="color"
  value={worker.color || '#3b82f6'}
  onChange={(e) => updateWorkerColor(worker.id!, e.target.value)}
  className="color-picker"
/>
```

### Gradient pro více pracovníků
Pokud stůl dělali 2 pracovníci:
```css
.table-multi-worker {
  background: linear-gradient(
    135deg,
    ${worker1.color} 0%,
    ${worker1.color} 50%,
    ${worker2.color} 50%,
    ${worker2.color} 100%
  );
}
```

---

**Status**: ✅ Implementováno  
**Verze DB**: 21  
**Soubory**: types.ts, db.ts, utils/workerColors.ts  
**Další**: Použít v FieldPlan.tsx a TableCard.tsx
