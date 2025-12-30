# ✅ Notifikace Opraveny a Nasazeny

Vaše pochybnost byla správná - chybělo propojení mezi prohlížečem a serverem pro získání "adresy" pro notifikace (tzv. FCM Token). 

## 🛠 Provedené opravy:
1. **Chat Komponenta (`Chat.tsx`)**:
   - Přidána automatická žádost o povolení notifikací při přihlášení.
   - Po povolení se vygeneruje unikátní **Token** zařízení.
   - Tento token se uloží do databáze k uživateli.

2. **Firebase Service**:
   - Odstraněn nefunkční testovací klíč, nyní se používá automatická konfigurace projektu.

3. **Nasazení**:
   - Aplikace byla znovu sestavena (`build`).
   - Hosting byl aktualizován na novou verzi.

## 🚀 Jak to nyní otestovat:
1. **Obnovte aplikaci** (Refresh / F5) na všech zařízeních.
2. Pokud se prohlížeč zeptá "Povolit oznámení?", klikněte na **Povolit**.
3. Přihlaste se jako dva různí uživatelé na dvou zařízeních (nebo v anonymním okně).
4. Pošlete zprávu.
   - **Pokud je aplikace otevřená**: Zobrazí se "toast" zpráva a přehraje zvuk.
   - **Pokud je aplikace na pozadí (mobil)** nebo zavřená (pokud to OS dovolí): Měla by přijít systémová notifikace.

*Poznámka: Na iPhonech (iOS) fungují webové push notifikace jen pokud je aplikace přidána na plochu (Add to Home Screen).*
