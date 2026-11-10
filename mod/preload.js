// xImJxstinnCord – Preload (läuft vor Discord im Fenster)
"use strict";

const { contextBridge, ipcRenderer, webFrame } = require("electron");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const DATA_DIR = process.env.XJCORD_DATA_DIR ||
    path.join(process.env.APPDATA || path.join(require("os").homedir(), ".config"), "xImJxstinnCord");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const THEMES_DIR = path.join(DATA_DIR, "themes");
const PLUGINS_DIR = path.join(DATA_DIR, "plugins");

const safeName = f => typeof f === "string" && /^[^\\/:*?"<>|]+$/.test(f) && !f.startsWith(".");

function listDir(dir, ext) {
    try {
        fs.mkdirSync(dir, { recursive: true });
        return fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(ext) && safeName(f)).sort((a, b) => a.localeCompare(b));
    } catch { return []; }
}

// Eigene Plugins vorab prüfen (Syntaxfehler sollen nicht alles kaputt machen)
const pluginErrors = [];
function loadUserPlugins() {
    const out = [];
    for (const file of listDir(PLUGINS_DIR, ".js")) {
        try {
            const code = fs.readFileSync(path.join(PLUGINS_DIR, file), "utf8");
            new vm.Script(code, { filename: file }); // wirft bei Syntaxfehler
            out.push({ file, code });
        } catch (err) {
            pluginErrors.push({ file, error: String(err && err.message || err) });
        }
    }
    return out;
}

if (location.protocol !== "data:") {
    contextBridge.exposeInMainWorld("XJNative", {
        version: (() => { try { return fs.readFileSync(path.join(__dirname, "version.txt"), "utf8").trim(); } catch { return "dev"; } })(),

        // Einstellungen
        getSettings() {
            try { return fs.readFileSync(SETTINGS_FILE, "utf8"); } catch { return "{}"; }
        },
        setSettings(json) {
            if (typeof json !== "string" || json.length > 5_000_000) return;
            fs.mkdirSync(DATA_DIR, { recursive: true });
            const tmp = SETTINGS_FILE + ".tmp";
            fs.writeFileSync(tmp, json);
            fs.renameSync(tmp, SETTINGS_FILE);
        },

        // Themes
        getThemes() {
            return listDir(THEMES_DIR, ".css").map(file => {
                try { return { file, content: fs.readFileSync(path.join(THEMES_DIR, file), "utf8") }; }
                catch { return { file, content: "" }; }
            });
        },
        onThemesChanged(cb) {
            if (typeof cb !== "function") return;
            let t;
            try {
                fs.mkdirSync(THEMES_DIR, { recursive: true });
                fs.watch(THEMES_DIR, () => { clearTimeout(t); t = setTimeout(() => { try { cb(); } catch { } }, 300); });
            } catch { }
        },
        deleteTheme(file) {
            if (!safeName(file)) return false;
            try { fs.rmSync(path.join(THEMES_DIR, file)); return true; } catch { return false; }
        },

        // Plugins
        getPluginErrors: () => pluginErrors.slice(),

        // Updates
        updateState: () => ipcRenderer.invoke("xj:update-state"),
        checkUpdate: () => ipcRenderer.invoke("xj:update-check"),
        restart: () => ipcRenderer.invoke("xj:restart"),
        onUpdate(cb) {
            if (typeof cb !== "function") return;
            ipcRenderer.on("xj:update", (_, state) => { try { cb(state); } catch (e) { console.error(e); } });
        },

        // Fenster & System
        setWindow: s => ipcRenderer.invoke("xj:window", s),
        toggleDevTools: () => ipcRenderer.invoke("xj:devtools"),
        twitch: channel => ipcRenderer.invoke("xj:twitch", channel),
        openExternal: url => ipcRenderer.invoke("xj:openExternal", url),
        openFolder: which => ipcRenderer.invoke("xj:openFolder", which)
    });

    (async () => {
        try {
            await webFrame.executeJavaScript(fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8"));
        } catch (err) {
            console.error("[xImJxstinnCord] Renderer konnte nicht geladen werden", err);
            return;
        }
        // Eigene Plugins einzeln laden – ein kaputtes Plugin stoppt die anderen nicht
        for (const { file, code } of loadUserPlugins()) {
            const wrapped = `(() => { const XJ = window.XJ; XJ.__loadingFile = ${JSON.stringify(file)};
try {
${code}
} catch (e) { XJ.__pluginLoadError(${JSON.stringify(file)}, e); } finally { XJ.__loadingFile = null; } })();
//# sourceURL=xjcord-plugin://${encodeURIComponent(file)}`;
            try { await webFrame.executeJavaScript(wrapped); }
            catch (err) { pluginErrors.push({ file, error: String(err && err.message || err) }); }
        }
    })();
}

// Discords eigenes Preload laden
const original = process.env.XJCORD_DISCORD_PRELOAD;
if (original) require(original);
