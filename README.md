# xImJxstinnCord

Dein eigener Discord-Mod mit Plugins, Themes und einem Menü in den Discord-Einstellungen, ganz ohne Vencord.

## Installieren
1. Starte `xImJxstinnCord-Installer.exe`. Der Installer öffnet sich als eigenes App-Fenster.
2. Wähle dein Discord aus und klicke auf **„xImJxstinnCord installieren“**.
3. In Discord findest du alles unter **Benutzereinstellungen → xImJxstinnCord**.

Falls Windows „Der Computer wurde durch Windows geschützt“ anzeigt, klicke auf **Weitere Informationen → Trotzdem ausführen**. Die Warnung kommt nur, weil die .exe nicht signiert ist.

## Das Menü in Discord
In den Benutzereinstellungen steht ganz oben ein eigener Bereich **xImJxstinnCord**, aufgebaut wie bei Vencord: eine Überschrift mit Linien und Einträge mit Icons. Er hat fünf Seiten:
| Seite | Inhalt |
|---|---|
| **xImJxstinnCord** | Übersicht, Ordner öffnen, Discord neu laden/starten, Tastenkürzel, alles zurücksetzen |
| **Plugins** | Alle Plugins mit Suche, Filter, An/Aus-Schalter und ⚙ für die Einstellungen |
| **Themes** | Lokale Themes, Designer, Online-Themes (Links), eigenes CSS |
| **Updater** | Version, Änderungen, Auto-Update |
| **Backup & Restore** | Einstellungen als Datei sichern und wiederherstellen |

Falls Discord seine Einstellungen einmal umbaut und der Bereich fehlt, öffnet **Strg + Shift + X** das gleiche Menü als Notlösung. Das Kürzel kannst du abschalten.

## Eingebaute Plugins
**Versteckte Kanäle anzeigen (ShowHiddenChannels)** · **Rollenfarben überall (RoleColorEverywhere)** · Twitch-Live-Anzeige · Streamer-Blur · Stream-Uhr · Werbung weg · Chat-Buttons ausblenden · „schreibt gerade“ ausblenden · Aktiv-Spalte ausblenden · Kompakte Serverleiste · Fenster-Tools · DevTools-Kürzel

## Eigene Plugins
Lege `.js`-Dateien in `%APPDATA%\xImJxstinnCord\plugins` und klicke in Discord unter **Plugins** auf **„Neu laden“**. Die Datei `beispiel-plugin.js` dort zeigt dir alle Möglichkeiten. Ein Plugin mit Fehlern wird rot markiert, die anderen laufen trotzdem weiter.

In eigenen Plugins hast du außerdem `ctx.webpack.findStore("Name")`, um an Discords interne Daten zu kommen (zum Beispiel `GuildMemberStore`).

```js
XJ.definePlugin({
    id: "MeinPlugin",
    name: "Mein Plugin",
    description: "Was es macht",
    settings: { farbe: { type: "color", label: "Farbe", default: "#9146ff" } },
    css: s => `[class*="username_"] { color: ${s.farbe} !important; }`,
    start(ctx) { ctx.toast("Läuft!"); },
    stop(ctx) { }
});
```

## Themes
- **Lokal:** `.css`-Dateien in `%APPDATA%\xImJxstinnCord\themes`. Änderungen an den Dateien werden sofort übernommen. Vencord- und BetterDiscord-Themes funktionieren meistens auch.
- **Online:** Links zu `.css`-Dateien, zum Beispiel von GitHub.
- **Designer:** Presets, Akzentfarbe, Hintergrundbild, Schrift, Rundung.
- **Eigenes CSS:** Editor mit Live-Vorschau.

## Auto-Update
Der Mod prüft beim Start und danach alle 6 Stunden das neueste Release von `ximjxstinn/ximjxstinncord` auf GitHub. Das Repo muss **öffentlich** sein.

Eine neue Version veröffentlichst du so:
```
git tag v1.2.0
git push origin v1.2.0
```
GitHub Actions baut daraufhin den Installer und erstellt das Release. Alle installierten Mods holen sich die neue Version dann selbst.

## Projektaufbau
- `mod/patcher.js`: Loader im Hauptprozess (Fenster, CSP, Discord-Updates, Auto-Update, Twitch)
- `mod/preload.js`: Brücke zu Windows (Einstellungen, Themes, Plugins laden)
- `mod/renderer.js`: Plugin-System, Theme-System, Menü und eingebaute Plugins
- `mod/examples/`: Beispiel-Plugin und Beispiel-Theme, die bei der Installation angelegt werden
- `*.go`, `ui/`: der Installer (App-Fenster über WebView2; falls das fehlt, Browser als Ersatz)
- `vendor/`: mitgelieferte Go-Bibliotheken, damit der Build ohne Internet funktioniert
- `winres/`, `rsrc_windows_amd64.syso`: Icon und Windows-Manifest

Installer bauen: `set GOOS=windows` und dann `go build -ldflags "-s -w -H windowsgui" -o xImJxstinnCord-Installer.exe .`
