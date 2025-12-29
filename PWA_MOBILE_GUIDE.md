# 📱 PWA & Mobile Optimization Guide

## ✅ Implementované funkce

### 1. **Offline režim** 🔌
- ✅ Service Worker v5 s pokročilými cache strategiemi
- ✅ Offline fallback stránka
- ✅ Cache First pro statické assety
- ✅ Network First pro HTML
- ✅ Background Sync API podpora
- ✅ Push Notifications připraveno

**Cache strategie:**
- **Navigation**: Network First → Cache → Offline page
- **Static Assets**: Cache First s background update
- **CDN Resources**: Cache First
- **API Calls**: Network Only s error handling

### 2. **PWA Instalace** 📲
- ✅ Vylepšený install prompt pro iOS i Android
- ✅ BeforeInstallPrompt event handling
- ✅ Automatická detekce platformy
- ✅ Delay 3s před zobrazením
- ✅ Limit 3 dismissů
- ✅ Moderní UI s glassmorphism
- ✅ Shortcuts v manifestu (Projekty, Tým, Plán, Statistiky)

### 3. **Responzivní design** 📱💻
- ✅ Touch-friendly tlačítka (min 44x44px)
- ✅ Prevence zoom při focus na input (iOS)
- ✅ Viewport optimalizace
- ✅ Glassmorphism efekty
- ✅ Mobilní breakpointy (md:)
- ✅ Prevence pull-to-refresh

### 4. **Touch gestures** 👆
- ✅ Pinch-to-zoom v plánovači (0.5x - 3x)
- ✅ Pan (posouvání) dvěma prsty
- ✅ Double-tap pro reset zoomu
- ✅ Touch-friendly markery (větší na mobilu)
- ✅ Smooth animace
- ✅ Vizuální hint pro uživatele

### 5. **Ikony a manifest** 🎨
- ✅ Kompletní manifest.json s PWA features
- ✅ Apple touch ikony
- ✅ Maskable ikony pro Android
- ✅ Theme color pro dark/light mode
- ✅ Screenshots pro app stores
- ✅ Shortcuts pro rychlý přístup

## 🚀 Jak testovat PWA

### Desktop (Chrome/Edge)
1. Spusťte dev server: `npm run dev`
2. Otevřete DevTools (F12)
3. Jděte na **Application** → **Service Workers**
4. Zkontrolujte, že SW je aktivní
5. Zkuste offline režim (DevTools → Network → Offline)
6. Install prompt: DevTools → Application → Manifest → "Add to home screen"

### Android
1. Otevřete v Chrome: `http://your-ip:5173`
2. Počkejte 3s na install prompt
3. Nebo: Menu → "Přidat na plochu"
4. Otevřete jako samostatnou aplikaci
5. Testujte offline režim (Airplane mode)

### iOS (Safari)
1. Otevřete v Safari
2. Klepněte na tlačítko Sdílet (⬆️)
3. "Přidat na plochu"
4. Otevřete jako aplikaci
5. Testujte touch gestures v plánovači

## 📋 Checklist před nasazením

- [ ] Vygenerovat všechny velikosti ikon (72-512px)
- [ ] Vytvořit maskable ikony (safe zone 80%)
- [ ] Vytvořit screenshots (wide + narrow)
- [ ] Otestovat na reálných zařízeních (iOS + Android)
- [ ] Ověřit offline funkcionalitu
- [ ] Zkontrolovat Lighthouse PWA score (cíl: 100)
- [ ] Nastavit HTTPS (required pro PWA)
- [ ] Registrovat Service Worker v produkci

## 🛠️ Generování ikon

### Automaticky (doporučeno)
```bash
# Nainstalovat PWA Asset Generator
npm install -g pwa-asset-generator

# Vygenerovat všechny ikony
pwa-asset-generator source-icon.png ./public --icon-only --favicon
```

### Online nástroje
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [PWA Builder](https://www.pwabuilder.com/imageGenerator)
- [Favicon.io](https://favicon.io/)

### Manuálně
1. Vytvořte source ikonu 1024x1024px
2. Použijte Photoshop/GIMP/Figma
3. Exportujte velikosti: 72, 96, 128, 144, 152, 192, 384, 512
4. Pro maskable: přidejte 20% padding (safe zone)

## 🎨 Design guidelines

### Ikona
- **Rozměry**: 1024x1024px (source)
- **Safe zone**: 80% pro maskable (820x820px)
- **Formát**: PNG s transparentním pozadím
- **Styl**: Minimalistický, glassmorphism
- **Barvy**: Gradient blue (#3b82f6) → purple (#a855f7)

### Screenshots
- **Wide**: 1280x720px (desktop/tablet landscape)
- **Narrow**: 750x1334px (mobile portrait)
- **Obsah**: Dashboard, Projects, Plan view
- **Kvalita**: High-res, reálná data

## 📱 Touch gestures v plánovači

### Podporované gesta
- **Pinch**: Zoom in/out (2 prsty)
- **Pan**: Posouvání (2 prsty)
- **Double-tap**: Reset zoom na 1.0
- **Single tap**: Přidat/editovat marker

### Limity
- **Min zoom**: 0.5x
- **Max zoom**: 3.0x
- **Pan**: Neomezený (v rámci canvasu)

## 🔧 Troubleshooting

### Service Worker se neaktualizuje
```javascript
// V DevTools Console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
location.reload();
```

### Ikony se nezobrazují
1. Zkontrolujte cesty v `manifest.json`
2. Ověřte, že ikony existují v `/public`
3. Hard refresh (Ctrl+Shift+R)
4. Vyčistěte cache

### Install prompt se nezobrazuje
1. Zkontrolujte HTTPS (required)
2. Ověřte manifest.json (valid JSON)
3. Service Worker musí být aktivní
4. Počkejte 3 sekundy po načtení
5. Zkontrolujte dismiss count v localStorage

### Touch gestures nefungují
1. Zkontrolujte, že jste na touch zařízení
2. Ověřte, že není aktivní drawing mode
3. Zkuste double-tap pro reset
4. Zkontrolujte console pro errors

## 📊 Performance metriky

### Lighthouse targets
- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 95+
- **SEO**: 90+
- **PWA**: 100

### Optimalizace
- ✅ Lazy loading komponent
- ✅ Code splitting (React.lazy)
- ✅ Service Worker caching
- ✅ Image optimization (WebP)
- ✅ Minifikace CSS/JS
- ✅ Gzip/Brotli compression

## 🌐 Browser podpora

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Install Prompt | ✅ | ✅ | ⚠️ Manual | ⚠️ Manual |
| Push Notifications | ✅ | ✅ | ❌ | ✅ |
| Background Sync | ✅ | ✅ | ❌ | ❌ |
| Touch Gestures | ✅ | ✅ | ✅ | ✅ |

## 📚 Další zdroje

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://web.dev/add-manifest/)
- [Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)

---

**Vytvořeno**: 2025-12-29  
**Verze**: 1.0  
**Service Worker**: v5
