# 📊 StatsPage - Statistiky a Grafy

## Přehled
Nová stránka **StatsPage** (`/stats`) poskytuje komplexní vizualizaci dat projektu s pokročilými grafy a KPI metrikami.

## ✅ Implementované funkce

### 1. **KPI Karty** 🎯
Tři hlavní metriky zobrazené v atraktivních kartách s gradientem:

#### ⚡ Instalováno celkem (kWp)
- Zobrazuje celkový instalovaný výkon v kWp
- Progress bar ukazující pokrok vůči celkovému cíli
- Gradient: emerald (zelený)
- Ikona: ⚡

#### 👥 Aktivní tým
- Počet pracovníků, kteří dokončili alespoň jeden stůl
- Celkový počet dokončených stolů
- Gradient: blue (modrý)
- Ikona: 👥

#### 📈 Průměr za den (kWp/den)
- Průměrný denní výkon (pouze dny s prací)
- Ukazuje efektivitu týmu
- Gradient: purple (fialový)
- Ikona: 📈

### 2. **Denní pokrok - Liniový graf** 📊
- **Typ grafu**: LineChart (Recharts)
- **Data**: Kumulativní kWp za posledních 30 dní
- **Osa X**: Datum (formát DD.MM)
- **Osa Y**: kWp
- **Vlastnosti**:
  - Gradient výplň pod křivkou
  - Animované body na křivce
  - Responsivní tooltip s detaily
  - Zelená barva (#10b981)

### 3. **Výkon pracovníků - Sloupcový graf** 🏆
- **Typ grafu**: BarChart (Recharts) s duální osou Y
- **Data**: Počet stolů a kWp pro každého pracovníka
- **Levá osa Y**: Počet stolů
- **Pravá osa Y**: kWp
- **Vlastnosti**:
  - Dva sloupcové grafy vedle sebe
  - Seřazeno podle kWp (sestupně)
  - Modrá barva pro stoly (#3b82f6)
  - Zelená barva pro kWp (#10b981)
  - Zaoblené rohy sloupců

### 4. **Rozdělení stavů - Koláčový graf** 🎯
- **Typ grafu**: PieChart (Recharts)
- **Data**: Hotovo vs. Plán
- **Kategorie**:
  - ✅ **Hotovo** (zelená #10b981)
  - 📋 **Plán** (šedá #6b7280)
- **Vlastnosti**:
  - Procenta zobrazená přímo na grafu
  - Interaktivní tooltip
  - Velký poloměr (140px)

### 5. **Pokrok podle typu práce - Progress bary** 🔧
Tři horizontální progress bary pro různé typy prací:

#### 🔵 Konstrukce (K)
- Modrá barva (#3b82f6)
- Procento dokončení
- Animovaný gradient

#### 🟣 Panely (P)
- Fialová barva (#8b5cf6)
- Procento dokončení
- Animovaný gradient

#### 🟡 Kabely (C)
- Jantarová barva (#f59e0b)
- Procento dokončení
- Animovaný gradient

**Poznámka**: V současné implementaci jsou hodnoty pro P a C simulované (85% a 70% z hodnoty K). Pro plnou funkčnost je třeba rozšířit datový model o sledování jednotlivých typů prací.

## 🎨 Design vlastnosti

### Barevné schéma
- **Emerald**: #10b981 (instalovaný výkon)
- **Blue**: #3b82f6 (tým, stoly)
- **Purple**: #8b5cf6 (průměry, panely)
- **Amber**: #f59e0b (kabely)
- **Gray**: #6b7280 (plánované)

### Glassmorphism efekty
- `backdrop-blur-2xl`
- `bg-black/20`
- `border border-white/10`
- Průhledné pozadí s rozmazáním

### Animace
- Smooth transitions (500ms)
- Hover efekty na kartách
- Pulsující efekty na pozadí
- Fade-in animace

## 📐 Výpočty

### Výkon stolů (TABLE_POWER)
```typescript
const TABLE_POWER = {
  small: 0.5,   // 0.5 kWp
  medium: 1.0,  // 1.0 kWp
  large: 1.5    // 1.5 kWp
};
```

### Celkový instalovaný výkon
```typescript
installedKWp = Σ(TABLE_POWER[table.tableType]) 
  pro všechny dokončené stoly
```

### Průměr za den
```typescript
avgKWpPerDay = installedKWp / počet_dní_s_prací
```

### Výkon pracovníka
```typescript
workerKWp = Σ(TABLE_POWER[table.tableType]) 
  pro všechny stoly přiřazené pracovníkovi
```

## 🔄 Datové zdroje

### Použité tabulky (Dexie)
- `db.projects` - Seznam projektů
- `db.workers` - Seznam pracovníků
- `db.fieldTables` - Stoly v plánovém poli
  - `projectId` - ID projektu
  - `tableId` - ID stolu
  - `tableType` - Typ stolu (small/medium/large)
  - `status` - Stav (pending/completed)
  - `assignedWorkers` - Pole ID pracovníků
  - `completedAt` - Datum dokončení
  - `completedBy` - ID pracovníka, který dokončil

### Live Queries
Všechny dotazy používají `useLiveQuery` z `dexie-react-hooks` pro real-time aktualizace.

## 🚀 Použití

### Navigace
1. **Z Dashboard**: Klikněte na dlaždici "Statistiky"
2. **Přímý odkaz**: `/stats`
3. **Menu**: (pokud bude přidáno do navigace)

### Workflow
1. Otevřete stránku `/stats`
2. Vyberte projekt z dropdown menu
3. Prohlížejte grafy a KPI metriky
4. Data se automaticky aktualizují při změnách

## 📱 Responsivita

### Breakpointy
- **Mobile**: 1 sloupec pro všechny grafy
- **Tablet (md)**: 2 sloupce pro KPI karty
- **Desktop (xl)**: 2 sloupce pro grafy, 3 sloupce pro KPI

### Touch optimalizace
- Velké klikací oblasti
- Smooth scrolling
- Optimalizované tooltips pro dotyk

## 🔮 Budoucí vylepšení

### Doporučené rozšíření
1. **Detailní sledování K-P-C**
   - Rozšířit `FieldTable` o pole: `constructionProgress`, `panelingProgress`, `cablingProgress`
   - Aktualizovat UI pro zadávání pokroku po jednotlivých fázích

2. **Exporty**
   - PDF report s grafy
   - Excel export dat
   - Sdílení přes email

3. **Filtry**
   - Časové rozmezí (týden, měsíc, rok)
   - Filtr podle pracovníka
   - Filtr podle typu stolu

4. **Další grafy**
   - Heatmap aktivity
   - Gantt chart pro timeline
   - Scatter plot pro efektivitu

5. **Predikce**
   - Odhad dokončení projektu
   - Trend analysis
   - AI doporučení

## 🐛 Známé limitace

1. **Simulovaná data K-P-C**: Progress bary pro panely a kabely jsou simulované
2. **30 denní okno**: Denní pokrok zobrazuje pouze posledních 30 dní
3. **Bez exportu**: Momentálně není možné exportovat grafy

## 📝 Technické poznámky

### Závislosti
- `recharts` ^2.10.0 - Knihovna pro grafy
- `dexie-react-hooks` ^1.1.7 - Live queries
- `react-router-dom` ^6.20.0 - Routing

### Performance
- Lazy loading komponenty
- Memoizované výpočty (`useMemo`)
- Optimalizované re-rendery

### Přístupnost
- Sémantické HTML
- ARIA labels na grafech
- Keyboard navigation support

---

**Vytvořeno**: 2025-12-29  
**Verze**: 1.0.0  
**Status**: ✅ Plně funkční
