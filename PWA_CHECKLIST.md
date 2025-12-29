# ✅ PWA Optimalizace - Checklist

## 🎯 Co bylo implementováno

### ✅ 1. Service Worker (Offline režim)
- [x] Cache strategie v5
- [x] Offline fallback stránka
- [x] Background Sync API
- [x] Push Notifications (připraveno)
- [x] Automatické čištění cache

### ✅ 2. PWA Manifest (Instalace)
- [x] Kompletní manifest.json
- [x] Ikony (72px - 512px)
- [x] Maskable ikony
- [x] Shortcuts (4 hlavní sekce)
- [x] Screenshots placeholder
- [x] Theme colors

### ✅ 3. Install Prompt
- [x] iOS podpora (instrukce)
- [x] Android podpora (native prompt)
- [x] Desktop podpora
- [x] Inteligentní zobrazení (delay 3s)
- [x] Limit dismissů (max 3x)
- [x] Moderní UI (glassmorphism)

### ✅ 4. Touch Gestures
- [x] Pinch-to-zoom (0.5x - 3x)
- [x] Pan (posouvání)
- [x] Double-tap (reset)
- [x] Custom hook `useTouchGestures`
- [x] Integrace do Plan komponenty
- [x] Vizuální hinty

### ✅ 5. Responzivní design
- [x] Touch-friendly prvky (44x44px)
- [x] Prevence zoom na iOS
- [x] Viewport optimalizace
- [x] Apple meta tagy
- [x] CSS animace (fade-in, slide-up)
- [x] Prevence pull-to-refresh

### ✅ 6. Ikony a dokumentace
- [x] SVG ikona (scalable)
- [x] Generator script
- [x] PWA_MOBILE_GUIDE.md
- [x] IMPLEMENTATION_SUMMARY.md
- [x] Tento checklist

---

## 📋 Co je potřeba udělat před nasazením

### 🔴 Kritické (MUSÍ být hotové)

- [ ] **Vygenerovat všechny velikosti ikon**
  ```bash
  npm install -g pwa-asset-generator
  pwa-asset-generator icon.svg ./public --icon-only
  ```
  
- [ ] **Nastavit HTTPS** (PWA vyžaduje)
  - Let's Encrypt
  - Cloudflare
  - Nebo jiný SSL certifikát

- [ ] **Otestovat na reálných zařízeních**
  - [ ] iPhone (Safari)
  - [ ] Android (Chrome)
  - [ ] Desktop (Chrome/Edge)

### 🟡 Důležité (mělo by být hotové)

- [ ] **Vytvořit screenshots**
  - [ ] Wide: 1280x720px (desktop)
  - [ ] Narrow: 750x1334px (mobile)
  
- [ ] **Lighthouse audit** (cíl: PWA score 100)
  ```bash
  npm run build
  npm run preview
  # DevTools → Lighthouse → Generate report
  ```

- [ ] **Optimalizovat build**
  - [ ] Zkontrolovat velikost bundle
  - [ ] Optimalizovat images (WebP)
  - [ ] Minifikace

### 🟢 Nice to have (volitelné)

- [ ] **Push Notifications** (implementovat logiku)
- [ ] **Background Sync** (implementovat sync)
- [ ] **Share API** (sdílení obsahu)
- [ ] **Offline analytics** (tracking)

---

## 🧪 Testovací postup

### 1. Lokální test
```bash
# Nainstalovat dependencies
npm install

# Spustit dev server
npm run dev

# Otevřít v prohlížeči
# http://localhost:5173
```

### 2. Service Worker test
1. Otevřít DevTools (F12)
2. Application → Service Workers
3. Zkontrolovat, že SW je aktivní
4. Network → Offline
5. Obnovit stránku (měla by fungovat)

### 3. Install prompt test

**Desktop:**
1. DevTools → Application → Manifest
2. Kliknout "Add to home screen"
3. Nebo počkat 3s na automatický prompt

**Mobile:**
1. Otevřít na mobilu
2. Počkat 3s
3. Měl by se objevit install prompt
4. Nebo Menu → "Přidat na plochu"

### 4. Touch gestures test
1. Otevřít na mobilu/tabletu
2. Jít do Plan view
3. Vybrat projekt s PDF
4. Zkusit:
   - Pinch (zoom)
   - Pan (posouvání)
   - Double-tap (reset)

### 5. Offline test
1. Nainstalovat jako PWA
2. Zapnout Airplane mode
3. Otevřít aplikaci
4. Měla by fungovat (cached data)

---

## 📊 Očekávané výsledky

### Lighthouse scores (cíl)
- Performance: **90+**
- Accessibility: **95+**
- Best Practices: **95+**
- SEO: **90+**
- PWA: **100** ✨

### PWA checklist (Chrome DevTools)
- [x] Registruje Service Worker
- [x] Odpovídá s 200 když offline
- [x] Má web app manifest
- [x] Má ikony
- [x] Má theme color
- [x] Viewport je nastaven
- [x] Content je sized correctly

---

## 🐛 Známé problémy a řešení

### Problem: Service Worker se neaktualizuje
**Řešení:**
```javascript
// V DevTools Console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload();
```

### Problem: Ikony se nezobrazují
**Řešení:**
1. Zkontrolovat cesty v `manifest.json`
2. Ověřit, že ikony existují v `/public`
3. Hard refresh (Ctrl+Shift+R)
4. Vyčistit cache

### Problem: Install prompt se nezobrazuje
**Řešení:**
1. Zkontrolovat HTTPS (required)
2. Ověřit manifest.json (valid JSON)
3. Service Worker musí být aktivní
4. Počkejte 3 sekundy
5. Zkontrolovat localStorage (dismiss count)

### Problem: Touch gestures nefungují
**Řešení:**
1. Zkontrolovat, že jste na touch zařízení
2. Ověřit, že není aktivní drawing mode
3. Zkusit double-tap pro reset
4. Zkontrolovat console pro errors

---

## 📞 Podpora

### Dokumentace
- `PWA_MOBILE_GUIDE.md` - Kompletní guide
- `IMPLEMENTATION_SUMMARY.md` - Technické detaily
- `README.md` - Obecné info o projektu

### Užitečné odkazy
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://web.dev/add-manifest/)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

---

## ✨ Shrnutí

**Implementováno:**
- ✅ Offline režim (Service Worker v5)
- ✅ PWA instalace (všechny platformy)
- ✅ Touch gestures (pinch, pan, double-tap)
- ✅ Responzivní design (mobily + desktop)
- ✅ Moderní ikony (SVG + placeholder)
- ✅ Kompletní dokumentace

**Zbývá:**
- 🔴 Vygenerovat finální ikony (všechny velikosti)
- 🔴 Nastavit HTTPS
- 🔴 Otestovat na reálných zařízeních
- 🟡 Vytvořit screenshots
- 🟡 Lighthouse audit

**Odhadovaný čas do produkce:** 2-4 hodiny

---

**Vytvořeno:** 2025-12-29  
**Status:** ✅ Ready for testing  
**Next step:** Vygenerovat ikony a testovat na zařízeních
