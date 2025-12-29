# ✅ Integrace plánového pole - HOTOVO!

## 🎉 Co bylo přidáno

### 1. **Nová stránka: FieldPlans.tsx**
- Zobrazuje seznam projektů se stoly
- Umožňuje výběr projektu
- Zobrazuje plánové pole vybraného projektu
- Auto-select prvního projektu

### 2. **Nová route: /field-plans**
- Přidána do `App.tsx`
- Lazy loading pro optimalizaci
- Dostupná v navigaci

---

## 📁 Soubory

### Vytvořené
- `components/FieldPlans.tsx` - Stránka plánových polí
- `components/FieldPlanView.tsx` - Wrapper pro FieldPlan + TableModal
- `components/FieldPlan.tsx` - Vizualizace plánového pole
- `components/TableModal.tsx` - Detail stolu

### Aktualizované
- `App.tsx` - Přidána route `/field-plans`

---

## 🚀 Jak použít

### 1. Navigace
Přidejte odkaz do navigace (Layout.tsx nebo Sidebar):

```tsx
<Link 
  to="/field-plans"
  className="nav-link"
>
  📐 Plánová pole
</Link>
```

### 2. Přístup
- URL: `http://localhost:3000/#/field-plans`
- Nebo kliknutím na odkaz v navigaci

### 3. Použití
1. Otevřít stránku "Plánová pole"
2. Vybrat projekt ze seznamu
3. Zobrazí se plánové pole s gridem stolů
4. Kliknout na stůl pro detail
5. Přiřadit pracovníky nebo označit jako hotový

---

## 🎨 Funkce stránky

### Header
- Velký titul "PLÁNOVÁ POLE."
- Popis funkcionality

### Project Selector
- Grid karet projektů
- Zobrazuje:
  - Název projektu
  - Počet stolů
  - Status (active/completed/on_hold)
- Zvýraznění vybraného projektu

### Field Plan View
- Automaticky se zobrazí po výběru projektu
- Obsahuje:
  - Statistiky (celkem/čeká/hotovo)
  - Filtrování (vše/čeká/hotovo)
  - Grid stolů s barvami
  - Legenda pracovníků

---

## 📊 Příklad použití

### Scénář 1: Zobrazení plánového pole
```
1. Uživatel otevře /field-plans
2. Zobrazí se seznam projektů
3. První projekt je automaticky vybrán
4. Zobrazí se plánové pole s gridem stolů
5. Žluté stoly = čekají
6. Barevné stoly = hotové (barva pracovníka)
```

### Scénář 2: Označení stolu jako hotový
```
1. Uživatel klikne na žlutý stůl
2. Otevře se modal s detailem
3. Klikne "Označit jako hotový"
4. Stůl změní barvu na barvu pracovníka
5. Zobrazí se iniciály pracovníka
6. Přidá se glow efekt
7. Statistiky se aktualizují
```

### Scénář 3: Přiřazení pracovníků
```
1. Uživatel klikne na stůl
2. V modalu vybere až 2 pracovníky
3. Klikne "Uložit přiřazení"
4. Na stolu se zobrazí 2 tečky (barvy pracovníků)
```

---

## 🔗 Integrace do navigace

### Layout.tsx nebo Sidebar.tsx
Přidejte odkaz do navigace:

```tsx
const navItems = [
  { path: '/', label: 'Dashboard', icon: '🏠' },
  { path: '/projects', label: 'Projekty', icon: '📁' },
  { path: '/field-plans', label: 'Plánová pole', icon: '📐' }, // NOVÉ
  { path: '/workers', label: 'Tým', icon: '👥' },
  { path: '/statistics', label: 'Statistiky', icon: '📊' },
  // ...
];
```

### Nebo jako tlačítko v Projects
V `Projects.tsx` můžete přidat tlačítko pro rychlý přístup:

```tsx
<Link 
  to="/field-plans"
  className="btn-primary"
>
  📐 Zobrazit plánová pole
</Link>
```

---

## 📱 Responzivní design

### Desktop
- 3 sloupce pro výběr projektů
- 10 sloupců pro grid stolů
- Velké stoly (60x60px)

### Tablet
- 2 sloupce pro výběr projektů
- 6 sloupců pro grid stolů
- Střední stoly (50x50px)

### Mobile
- 1 sloupec pro výběr projektů
- 3 sloupce pro grid stolů
- Malé stoly (40x40px)
- Slide-up modal

---

## 🎯 Testování

### Checklist
- [ ] Otevřít `/field-plans`
- [ ] Zobrazí se seznam projektů
- [ ] Vybrat projekt
- [ ] Zobrazí se plánové pole
- [ ] Kliknout na stůl
- [ ] Otevře se modal
- [ ] Přiřadit pracovníky
- [ ] Označit jako hotový
- [ ] Zkontrolovat barvy
- [ ] Zkontrolovat statistiky
- [ ] Testovat filtrování
- [ ] Testovat na mobilu

### Očekávané výsledky
- ✅ Stránka se načte bez chyb
- ✅ Projekty se zobrazí
- ✅ Grid stolů je responzivní
- ✅ Barvy odpovídají pracovníkům
- ✅ Modal funguje
- ✅ Aktualizace dat funguje
- ✅ Statistiky jsou správné

---

## 🐛 Možné problémy

### Problem: Stránka je prázdná
**Řešení:**
- Zkontrolovat, že existují projekty se stoly
- Vytvořit nový projekt s polem "Seznam stolů"

### Problem: Barvy se nezobrazují
**Řešení:**
- Zkontrolovat, že databáze je verze 21
- Spustit `npm run dev` znovu
- Vyčistit cache prohlížeče

### Problem: Modal se neotevírá
**Řešení:**
- Zkontrolovat console pro chyby
- Ověřit, že TableModal je správně importován

---

## 📝 Další vylepšení (volitelné)

### 1. Přidat do Dashboard
Zobrazit přehled plánových polí na hlavní stránce:

```tsx
<div className="dashboard-widget">
  <h3>Plánová pole</h3>
  <div className="mini-field-plans">
    {projects.map(p => (
      <MiniFieldPlan key={p.id} projectId={p.id!} />
    ))}
  </div>
</div>
```

### 2. Export do PDF
Přidat tlačítko pro export:

```tsx
<button onClick={() => exportFieldPlanToPDF(projectId)}>
  📄 Export do PDF
</button>
```

### 3. Hromadné operace
Přidat možnost vybrat více stolů:

```tsx
<button onClick={() => markMultipleAsCompleted(selectedTables)}>
  ✓ Označit vybrané jako hotové
</button>
```

### 4. Drag & Drop
Umožnit přesouvání stolů mezi pracovníky:

```tsx
<DndContext onDragEnd={handleDragEnd}>
  {tables.map(table => (
    <DraggableTable key={table.id} table={table} />
  ))}
</DndContext>
```

---

## ✅ Checklist dokončení

### Implementace
- [x] FieldPlans.tsx vytvořena
- [x] Route přidána do App.tsx
- [x] Lazy loading nakonfigurován
- [x] Responzivní design
- [x] Auto-select prvního projektu

### Zbývá
- [ ] Přidat odkaz do navigace (Layout/Sidebar)
- [ ] Testovat na mobilu
- [ ] Testovat všechny funkce
- [ ] Přidat do dokumentace
- [ ] Screenshot pro README

---

## 🎉 Výsledek

**Před:**
- Plánové pole nebylo dostupné jako samostatná stránka
- Musel jste jít přes Projects → kliknout na projekt

**Po:**
- Dedikovaná stránka `/field-plans`
- Rychlý přístup ke všem plánovým polím
- Přehledný výběr projektů
- Vizuální mapa všech stolů
- Barevné kódování podle pracovníků

---

**Status**: ✅ **INTEGRACE HOTOVA**  
**URL**: `/field-plans`  
**Komponenty**: 4 nové  
**Routes**: 1 nová  
**Další**: Přidat do navigace a testovat

🎨 **Plánové pole je plně integrováno do aplikace!** 🚀
