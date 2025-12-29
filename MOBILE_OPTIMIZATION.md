# 📱 Mobile-First Optimization Plan

**Cíl:** Optimalizovat MST aplikaci pro mobilní zařízení (primární use case)

---

## 🎯 Prioritní úpravy pro mobil

### 1. **Touch-Friendly Velikosti** ✅
- Min. 44x44px pro všechna tlačítka
- Větší padding pro formuláře
- Větší fonty pro čitelnost

### 2. **Responsivní Grid Layouts**
- Dashboard: 1 sloupec na mobilu
- Projects: Full-width karty
- Formuláře: Stack vertikálně

### 3. **Bottom Navigation Optimalizace**
- Větší ikony (7 → 8)
- Více prostoru mezi položkami
- Lepší visual feedback

### 4. **Input Fields**
- Font-size min 16px (prevent zoom on iOS)
- Lepší spacing
- Clear buttons

### 5. **Modal Dialogy**
- Full-screen na mobilech
- Swipe to dismiss
- Bottom sheets style

### 6. **Karty projektů**
- Swipe actions (edit/delete)
- Bigger tap targets
- Lepší visual hierarchy

### 7. **Performance**
- Lazy loading images
- Virtual scrolling pro dlouhé seznamy
- Optimized re-renders

---

## 📋 Component-by-Component Changes

### ✅ Layout.tsx
- [x] Bottom nav má dobré velikosti
- [ ] **TODO:** Větší ikony (w-6 h-6 → w-7 h-7)
- [ ] **TODO:** Více padding v nav items (p-5 → p-6)

### Dashboard.tsx
- [ ] **TODO:** Grid 1 column na mobilu
- [ ] **TODO:** ActionTile větší min-height (160px → 180px)
- [ ] **TODO:** Větší fonty pro hlavní čísla

### Projects.tsx
- [ ] **TODO:** ProjectCard full-width na mobilu
- [ ] **TODO:** Swipe actions pro edit/delete
- [ ] **TODO:** Lepší spacing mezi kartami

### TimeRecordForm.tsx
- [ ] **TODO:** Full-screen modal na mobilu
- [ ] **TODO:** Větší input fieldsfields
- [ ] **TODO:** Sticky footer s tlačítky

### Settings.tsx
- [ ] **TODO:** Sections skládací (accordion)
- [ ] **TODO:** Větší toggle switches
- [ ] **TODO:** Full-width buttons

---

## 🎨 Design System Updates

### Typography Scale (Mobile)
```css
--text-xs: 12px
--text-sm: 14px
--text-base: 16px  /* Minimum for inputs! */
--text-lg: 18px
--text-xl: 20px
--text-2xl: 24px
--text-3xl: 30px
--text-4xl: 36px
--text-5xl: 48px
```

### Spacing Scale
```css
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
--space-10: 40px
--space-12: 48px
```

### Touch Targets
```css
--min-touch-target: 44px  /* iOS Human Interface Guidelines */
--min-touch-target-android: 48px  /* Material Design */
--comfortable-touch: 56px  /* Ideal size */
```

---

## 🚀 Implementation Steps

### Phase 1: Foundation (NOW)
1. ✅ Update CSS variables for mobile
2. ✅ Fix input font-sizes
3. ✅ Improve bottom navigation
4. ✅ Add mobile-specific utilities

### Phase 2: Components (NEXT)
5. ⏳ Dashboard mobile layout
6. ⏳ Projects cards optimization
7. ⏳ Forms full-screen on mobile
8. ⏳ Modals bottom-sheet style

### Phase 3: Polish
9. ⏳ Swipe gestures
10. ⏳ Pull-to-refresh
11. ⏳ Haptic feedback
12. ⏳ Performance optimizations

---

## 📱 Mobile Breakpoints

```css
/* Mobile First Approach */
@media (min-width: 640px)  { /* sm - small tablets */ }
@media (min-width: 768px)  { /* md - tablets */ }
@media (min-width: 1024px) { /* lg - desktop */ }
@media (min-width: 1280px) { /* xl - large desktop */ }
```

**Primary target:** < 640px (mobile phones)

---

## ✅ Checklist

### General
- [ ] All buttons min 44px
- [ ] All inputs font-size 16px+
- [ ] No horizontal scrolling
- [ ] Touch gestures work smoothly
- [ ] Fast load time (<2s)

### Navigation
- [ ] Bottom nav easy to reach with thumb
- [ ] Active states clear
- [ ] No accidental taps

### Forms
- [ ] Easy to fill on mobile
- [ ] Keyboard doesn't obscure inputs
- [ ] Clear error messages
- [ ] Easy to submit

### Lists & Cards
- [ ] Easy to scan
- [ ] Clear actions
- [ ] Swipe gestures (optional)
- [ ] Good performance with many items

---

## 🎯 Success Metrics

**Before:**
- Load time: ?
- First interaction: ?
-ayout shifts: ?

**After (Target):**
- Load time: <2s
- First interaction: <1s
- No layout shifts
- 60fps animations

---

## 📝 Notes

- Using Tailwind for rapid iteration
- CSS variables for theming
- Mobile-first approach (start with mobile, add desktop styles)
- Test on real devices (iPhone, Android)

**Let's make MST the best mobile experience! 📱✨**
