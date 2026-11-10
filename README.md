# xImJxstinnCord

Dein eigener Discord-Mod: **alle Vencord-Plugins** plus deine eigenen Plugins, dein Name und dein eigener Installer. Updates kommen automatisch aus diesem Repo.

xImJxstinnCord basiert auf [Vencord](https://github.com/Vendicated/Vencord) (© Vendicated und Mitwirkende) und steht deshalb wie Vencord unter der **GPL-3.0** (siehe `LICENSE`). Der Vencord-Quellcode wird beim Bauen direkt von GitHub geholt. Dieses Repo enthält nur die xImJxstinnCord-eigenen Teile.

## Installieren
1. Lade unter **Releases → devbuild** die Datei `xImJxstinnCord-Installer.exe` herunter und starte sie.
2. Wähle dein Discord aus und klicke auf **„xImJxstinnCord installieren“**. Ein vorhandenes Vencord wird ersetzt, und deine Plugin-Einstellungen bleiben erhalten.
3. In Discord findest du alles unter **Benutzereinstellungen → xImJxstinnCord Settings**.

## Was drin ist
- Alle Vencord-Plugins (über 170), zum Beispiel ShowHiddenChannels, RoleColorEverywhere, MessageLogger und Translate
- Vencords Menü in den Discord-Einstellungen: Plugins, Themes, Updater, Cloud, Backup & Restore
- Deine eigenen Plugins aus `userplugins/`:
  | Plugin | Funktion |
  |---|---|
  | **XJTwitchLive** | LIVE-Abzeichen mit Laufzeit und Zuschauern deines Twitch-Kanals |
  | **XJStreamerBlur** | Verwischt Chats und DMs beim Streamen (Strg + Shift + B) |
  | **XJStreamClock** | Verschiebbare Uhr mit Stoppuhr |
  | **XJDesign** | xImJxstinn-Designer mit Presets, Akzentfarbe, Hintergrund, Schrift und Rundung |

## So funktionieren Updates
GitHub Actions (`.github/workflows/build.yml`) baut xImJxstinnCord:
- bei jedem Push auf `main`,
- per Knopf unter **Actions → Build xImJxstinnCord → Run workflow**,
- jeden Montag automatisch, sobald es eine neue Vencord-Version gibt.

Das Ergebnis landet im Release **devbuild**. Der eingebaute Updater in Discord (Einstellungen → Updater) findet es dort und installiert es.

## Eigene Plugins hinzufügen
Lege einen Ordner in `userplugins/` an, zum Beispiel `userplugins/meinPlugin/index.ts`, und schreibe ein normales [Vencord-Plugin](https://docs.vencord.dev/plugins/) hinein. Nach einem Push baut GitHub automatisch eine neue Version. Dateien und Ordner, die mit `_` beginnen (wie `_xjShared.ts`), sind nur Helfer und werden nicht als Plugin geladen.

## Aufbau
- `userplugins/`: deine eigenen Plugins
- `branding/apply.mjs`: setzt den Namen „xImJxstinnCord“ ins Menü
- `installer/`: der Windows-Installer (Go, App-Fenster über WebView2)
- `vencord.lock`: welche Vencord-Version zuletzt gebaut wurde (setzt der Build automatisch)
