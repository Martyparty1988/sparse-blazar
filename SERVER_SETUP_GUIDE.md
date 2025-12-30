# 🚀 Průvodce: Vlastní Server a Automatické Notifikace

Tento průvodce vám pomůže zprovoznit "mozek" aplikace na cloudu od Googlu (Firebase Functions). Díky tomu bude aplikace posílat notifikace automaticky, i když nikdo není online.

## 1. Příprava Firebase účtu
Firebase Functions vyžadují tarif **Blaze** (Pay-as-you-go). 
1. Jděte do [Firebase Console](://console.firebase.google.com/).
2. Vyberte svůj projekt (pravděpodobně `mst-ap`).https
3. Vlevo dole klikněte na **Upgrade** a vyberte **Blaze**.
   * *Poznámka: Je tam velký bezplatný limit. Pro malou firmu to pravděpodobně bude stále stát 0 Kč měsíčně.*

## 2. Instalace nástrojů na vašem PC
Pokud ještě nemáte, nainstalujte si Firebase terminál:
1. Otevřete PowerShell nebo Terminál a napište:
   ```bash
   npm install -g firebase-tools
   ```
2. Přihlaste se ke svému Google účtu:
   ```bash
   firebase login
   ```

## 3. Nasazení serverového kódu (Deploy)
Já jsem vám už připravil kód v souboru `functions/index.js`. Teď ho jen "vystřelíme" nahoru:

1. Otevřete terminál v hlavní složce projektu.
2. Inicializujte projekt (pokud už není):
   ```bash
   firebase init functions
   ```
   * *Vyberte "Use an existing project" a zvolte svůj projekt.*
   * *Jazyk zvolte JavaScript.*
3. Nahrajte kód na server:
   ```bash
   firebase deploy --only functions
   ```

## Co teď server umí automaticky?
* **Chat**: Kdykoliv někdo napíše zprávu, server ji zachytí, najde všechny ostatní pracovníky a pošle jim echo na mobil/PC (pokud mají povolena oznámení).
* **Závady**: Pokud někdo v plánu nahlásí u stolu status "Závada", admini dostanou okamžitě varování.

## Podpora a údržba
Pokud se něco v budoucnu pokazí, můžete logy serveru sledovat v sekci **Functions** ve Firebase konzoli. Kód je navržen tak, aby byl maximálně úsporný a bezpečný.

---
*Váš AI asistent Antigravity*
