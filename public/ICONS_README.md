# 🎨 Generování PWA ikon

## Rychlý start

### Metoda 1: HTML Generator (Doporučeno pro rychlý test)

1. Otevřete soubor v prohlížeči:
   ```
   public/generate-placeholder-icons.html
   ```

2. Ikony se automaticky vygenerují

3. Klikněte na "Stáhnout všechny"

4. Přesuňte stažené ikony do složky `public/`

### Metoda 2: Online nástroje (Doporučeno pro produkci)

#### PWA Asset Generator (nejlepší)
```bash
# Instalace
npm install -g pwa-asset-generator

# Generování z SVG
pwa-asset-generator icon.svg ./public --icon-only --favicon

# Nebo z PNG
pwa-asset-generator source-icon.png ./public --icon-only --favicon
```

#### RealFaviconGenerator
1. Jděte na https://realfavicongenerator.net/
2. Nahrajte `icon.svg` nebo vytvořte vlastní design
3. Stáhněte všechny velikosti
4. Zkopírujte do `public/`

#### PWA Builder
1. Jděte na https://www.pwabuilder.com/imageGenerator
2. Nahrajte source ikonu
3. Stáhněte package
4. Zkopírujte do `public/`

### Metoda 3: Manuálně (Photoshop/GIMP/Figma)

1. Vytvořte source ikonu 1024x1024px
2. Exportujte následující velikosti:
   - icon-72.png (72x72)
   - icon-96.png (96x96)
   - icon-128.png (128x128)
   - icon-144.png (144x144)
   - icon-152.png (152x152)
   - icon-192.png (192x192)
   - icon-384.png (384x384)
   - icon-512.png (512x512)

3. Pro maskable ikony (Android):
   - icon-maskable-192.png (192x192 s 20% paddingem)
   - icon-maskable-512.png (512x512 s 20% paddingem)

## Požadavky na ikony

### Standardní ikony
- **Formát**: PNG
- **Pozadí**: Opaque (ne transparent)
- **Obsah**: Vycentrovaný
- **Barvy**: Gradient blue → purple → cyan
- **Styl**: Minimalistický, glassmorphism

### Maskable ikony (Android Adaptive Icons)
- **Safe zone**: 80% (ikona musí být v kruhu 80% velikosti)
- **Padding**: 10% ze všech stran
- **Pozadí**: Musí pokrývat celou plochu
- **Test**: https://maskable.app/

## Design guidelines

### Barvy
```
Primary:   #3b82f6 (Electric Blue)
Secondary: #a855f7 (Purple)
Accent:    #06b6d4 (Cyan)
Background: #020617 → #4c1d95 (Gradient)
```

### Kompozice
- **Hlavní prvek**: Solární panel (3x2 grid)
- **Doplňkové**: Slunce uprostřed
- **Dekorace**: Sluneční paprsky (8 bodů)
- **Efekt**: Glassmorphism overlay (5% white)

### Rozměry
- **Source**: 1024x1024px (pro budoucí škálování)
- **Export**: 72, 96, 128, 144, 152, 192, 384, 512px
- **Maskable**: 192, 512px (s paddingem)

## Testování ikon

### Online nástroje
- **Maskable test**: https://maskable.app/
- **Favicon checker**: https://realfavicongenerator.net/favicon_checker
- **PWA test**: https://www.pwabuilder.com/

### V prohlížeči
1. Otevřete DevTools (F12)
2. Application → Manifest
3. Zkontrolujte, že všechny ikony jsou načtené
4. Zkuste "Add to home screen"

### Na zařízení
- **iOS**: Přidat na plochu → zkontrolovat ikonu
- **Android**: Nainstalovat PWA → zkontrolovat ikonu
- **Desktop**: Nainstalovat → zkontrolovat v taskbaru

## Troubleshooting

### Ikony se nezobrazují
1. Zkontrolujte cesty v `manifest.json`
2. Ověřte, že soubory existují v `public/`
3. Hard refresh (Ctrl+Shift+R)
4. Vyčistěte cache

### Špatná kvalita
1. Použijte vyšší source rozlišení (1024x1024)
2. Exportujte jako PNG-24 (ne PNG-8)
3. Nepoužívejte JPEG (artefakty)

### Maskable ikony vypadají špatně
1. Zkontrolujte safe zone (80%)
2. Otestujte na https://maskable.app/
3. Přidejte více paddingu (25% místo 20%)

## Struktura souborů

```
public/
├── icon-72.png
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
├── icon-512.png
├── icon-maskable-192.png
├── icon-maskable-512.png
└── generate-placeholder-icons.html
```

## Další kroky

Po vygenerování ikon:

1. ✅ Zkopírujte do `public/`
2. ✅ Aktualizujte cesty v `manifest.json` (už hotovo)
3. ✅ Otestujte v prohlížeči
4. ✅ Otestujte na mobilních zařízeních
5. ✅ Lighthouse audit

---

**Tip**: Pro rychlé testování použijte HTML generator. Pro produkci použijte PWA Asset Generator nebo profesionální nástroje.
