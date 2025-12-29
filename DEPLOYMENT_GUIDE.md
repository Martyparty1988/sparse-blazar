# 🚀 MST PWA - Deployment Guide

## 📋 Pre-deployment Checklist

### ✅ Hotovo
- [x] Service Worker v5 implementován
- [x] PWA manifest nakonfigurován
- [x] Touch gestures implementovány
- [x] Responzivní design
- [x] Offline režim
- [x] Install prompt (iOS + Android)
- [x] Dokumentace vytvořena

### 🔴 Zbývá před nasazením

#### 1. Ikony (KRITICKÉ)
```bash
# Metoda A: HTML Generator (rychlé)
# Otevřete: public/generate-placeholder-icons.html
# Stáhněte všechny ikony
# Zkopírujte do public/

# Metoda B: PWA Asset Generator (doporučeno)
npm install -g pwa-asset-generator
pwa-asset-generator icon.svg ./public --icon-only --favicon

# Metoda C: Online
# https://realfavicongenerator.net/
# https://www.pwabuilder.com/imageGenerator
```

#### 2. HTTPS Setup (KRITICKÉ)
PWA vyžaduje HTTPS (kromě localhost)

**Možnosti:**
- **Cloudflare** (nejjednodušší, zdarma)
- **Let's Encrypt** (certbot)
- **Vercel/Netlify** (automatické HTTPS)

#### 3. Testování
```bash
# Build
npm run build

# Preview
npm run preview

# Lighthouse audit
# DevTools → Lighthouse → Generate report
# Cíl: PWA score 100
```

---

## 🌐 Deployment Options

### Option 1: Vercel (Doporučeno)

**Výhody:**
- ✅ Automatické HTTPS
- ✅ Global CDN
- ✅ Automatické builds z Git
- ✅ Zdarma pro personal projekty

**Postup:**
```bash
# 1. Instalace Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Production deploy
vercel --prod
```

**Konfigurace** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/manifest+json"
        }
      ]
    }
  ]
}
```

---

### Option 2: Netlify

**Výhody:**
- ✅ Automatické HTTPS
- ✅ Continuous deployment
- ✅ Drag & drop deploy
- ✅ Zdarma

**Postup:**
```bash
# 1. Instalace Netlify CLI
npm install -g netlify-cli

# 2. Login
netlify login

# 3. Deploy
netlify deploy

# 4. Production deploy
netlify deploy --prod
```

**Konfigurace** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/service-worker.js"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"

[[headers]]
  for = "/manifest.json"
  [headers.values]
    Content-Type = "application/manifest+json"
```

---

### Option 3: GitHub Pages

**Výhody:**
- ✅ Zdarma
- ✅ Automatické HTTPS
- ✅ Integrace s GitHub

**Postup:**
```bash
# 1. Instalace gh-pages
npm install -D gh-pages

# 2. Přidat do package.json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  }
}

# 3. Deploy
npm run deploy
```

**Konfigurace** (`vite.config.ts`):
```typescript
export default defineConfig({
  base: '/mst-solar-tracker/', // název repo
  // ... rest of config
});
```

---

### Option 4: Vlastní server (VPS)

**Výhody:**
- ✅ Plná kontrola
- ✅ Vlastní doména

**Postup:**
```bash
# 1. Build
npm run build

# 2. Upload dist/ na server
scp -r dist/* user@server:/var/www/mst

# 3. Nginx konfigurace
```

**Nginx config:**
```nginx
server {
    listen 443 ssl http2;
    server_name mst.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    root /var/www/mst;
    index index.html;

    # Service Worker
    location /service-worker.js {
        add_header Cache-Control "public, max-age=0, must-revalidate";
        add_header Service-Worker-Allowed "/";
    }

    # Manifest
    location /manifest.json {
        add_header Content-Type "application/manifest+json";
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 🧪 Post-deployment Testing

### 1. PWA Installability
```bash
# Chrome DevTools
# Application → Manifest
# Zkontrolovat všechny ikony
# "Add to home screen" test
```

### 2. Lighthouse Audit
```bash
# DevTools → Lighthouse
# Vybrat: Progressive Web App
# Generate report

# Cílové skóre:
# PWA: 100/100 ✨
# Performance: 90+
# Accessibility: 95+
```

### 3. Service Worker
```bash
# DevTools → Application → Service Workers
# Zkontrolovat: Activated and running
# Network → Offline
# Refresh → mělo by fungovat
```

### 4. Cross-device Testing

**Desktop:**
- [ ] Chrome (Windows/Mac/Linux)
- [ ] Edge
- [ ] Firefox
- [ ] Safari (Mac)

**Mobile:**
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] iPad (Safari)

**Tests:**
- [ ] Install prompt funguje
- [ ] Offline režim funguje
- [ ] Touch gestures fungují (mobil)
- [ ] Ikony se zobrazují správně
- [ ] Shortcuts fungují (Android)

---

## 📊 Performance Optimization

### Build Optimization
```bash
# Analyze bundle
npm run build -- --mode analyze

# Check bundle size
ls -lh dist/assets/

# Gzip test
gzip -9 dist/assets/*.js
ls -lh dist/assets/*.js.gz
```

### Recommended optimizations:
- ✅ Code splitting (už implementováno)
- ✅ Lazy loading (už implementováno)
- ✅ Service Worker caching (už implementováno)
- 🔄 Image optimization (WebP)
- 🔄 Font subsetting
- 🔄 Critical CSS

---

## 🔒 Security Checklist

- [ ] HTTPS enabled
- [ ] CSP headers configured
- [ ] API keys v environment variables (ne v kódu)
- [ ] CORS properly configured
- [ ] Service Worker scope limited
- [ ] No sensitive data in localStorage
- [ ] XSS protection enabled

---

## 📈 Monitoring & Analytics

### Doporučené nástroje:
- **Google Analytics 4** (user tracking)
- **Sentry** (error tracking)
- **Lighthouse CI** (performance monitoring)
- **Web Vitals** (Core Web Vitals)

### Setup Google Analytics:
```html
<!-- V index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 🐛 Common Issues & Solutions

### Issue: Service Worker not updating
**Solution:**
```javascript
// V service-worker.js
// Změňte CACHE_VERSION na v6, v7, etc.
const CACHE_VERSION = 'v6';
```

### Issue: Icons not showing
**Solution:**
1. Zkontrolujte cesty v manifest.json
2. Ověřte CORS headers
3. Hard refresh (Ctrl+Shift+R)

### Issue: Install prompt not showing
**Solution:**
1. Zkontrolujte HTTPS
2. Ověřte manifest.json (valid JSON)
3. Service Worker musí být aktivní
4. Počkejte 3 sekundy

### Issue: Offline mode not working
**Solution:**
1. Zkontrolujte Service Worker status
2. Ověřte cache strategie
3. Zkontrolujte console pro errors

---

## 📝 Deployment Checklist

### Pre-deployment
- [ ] Vygenerovat všechny ikony
- [ ] Vytvořit screenshots
- [ ] Lighthouse audit (PWA: 100)
- [ ] Cross-browser testing
- [ ] Mobile testing (iOS + Android)
- [ ] Offline mode test
- [ ] Performance test

### Deployment
- [ ] Build production bundle
- [ ] Upload to hosting
- [ ] Configure HTTPS
- [ ] Setup custom domain (optional)
- [ ] Configure headers (Service Worker, Manifest)
- [ ] Test live site

### Post-deployment
- [ ] Verify PWA installability
- [ ] Test on real devices
- [ ] Monitor errors (Sentry)
- [ ] Check analytics
- [ ] Update documentation

---

## 🎯 Success Metrics

### Technical
- ✅ Lighthouse PWA score: 100/100
- ✅ Performance score: 90+
- ✅ Accessibility score: 95+
- ✅ Service Worker: Active
- ✅ Offline: Functional

### User Experience
- ✅ Install prompt shown
- ✅ App installable on all platforms
- ✅ Touch gestures smooth
- ✅ Offline mode works
- ✅ Fast load time (<3s)

---

## 📞 Support & Resources

### Documentation
- `PWA_MOBILE_GUIDE.md` - Kompletní guide
- `IMPLEMENTATION_SUMMARY.md` - Technické detaily
- `PWA_CHECKLIST.md` - Checklist
- `public/ICONS_README.md` - Ikony guide

### External Resources
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [PWA Builder](https://www.pwabuilder.com/)

---

**Status:** ✅ Ready for deployment  
**Next step:** Vygenerovat ikony → Deploy → Test

**Estimated deployment time:** 1-2 hodiny
