// xImJxstinnCord – Hauptprozess (läuft im Electron-Main-Prozess von Discord)
// Wird von resources/app.asar geladen; die originale Discord-App liegt in resources/_app.asar.
"use strict";

const electron = require("electron");
const path = require("path");
const ofs = require("original-fs"); // fs ohne asar-Sonderbehandlung
const { app, ipcMain, shell } = electron;

const DATA_DIR = process.env.XJCORD_DATA_DIR || path.join(app.getPath("appData"), "xImJxstinnCord");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// ---------------------------------------------------------------------------
// Pfade: unsere app.asar und die originale Discord-App
// ---------------------------------------------------------------------------
const ourAsarDir = path.dirname(require.main.filename);          // ...\resources\app.asar
const resourcesDir = path.dirname(ourAsarDir);                    // ...\resources
const discordAsar = path.join(resourcesDir, "_app.asar");
const discordPkg = require(path.join(discordAsar, "package.json"));

// ---------------------------------------------------------------------------
// BrowserWindow abfangen, um unser Preload-Skript einzuschleusen
// ---------------------------------------------------------------------------
const windows = new Set();

class BrowserWindow extends electron.BrowserWindow {
    constructor(options) {
        if (options && options.webPreferences && options.webPreferences.preload && options.title) {
            process.env.XJCORD_DISCORD_PRELOAD = options.webPreferences.preload;
            options.webPreferences.preload = path.join(__dirname, "preload.js");
            options.webPreferences.sandbox = false;
            super(options);
            setupWindow(this);
        } else {
            super(options);
        }
    }
}
Object.assign(BrowserWindow, electron.BrowserWindow);
Object.defineProperty(BrowserWindow, "name", { value: "BrowserWindow", configurable: true });

const electronPath = require.resolve("electron");
delete require.cache[electronPath].exports;
require.cache[electronPath].exports = { ...electron, BrowserWindow };

function setupWindow(win) {
    windows.add(win);
    win.on("closed", () => windows.delete(win));
    win.webContents.once("did-finish-load", () => applyWindowSettings(win));
}

function readSettings() {
    try { return JSON.parse(ofs.readFileSync(SETTINGS_FILE, "utf8")); } catch { return {}; }
}

// Fenster nur verändern, wenn das Plugin "Fenster-Tools" wirklich etwas eingestellt hat.
// (setOpacity macht unter Windows ein "Layered Window" daraus – das soll nie nebenbei passieren.)
function applyWindowSettings(win) {
    const wt = (readSettings().plugins || {}).WindowTools;
    if (!wt || !wt.enabled) return;
    try {
        if (wt.alwaysOnTop) win.setAlwaysOnTop(true);
        const o = Number(wt.opacity);
        if (o >= 30 && o < 100) win.setOpacity(o / 100);
    } catch { }
}

// ---------------------------------------------------------------------------
// IPC für den Renderer
// ---------------------------------------------------------------------------
ipcMain.handle("xj:window", (e, s) => {
    const win = electron.BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (typeof s.alwaysOnTop === "boolean" && win.isAlwaysOnTop() !== s.alwaysOnTop) win.setAlwaysOnTop(s.alwaysOnTop);
    if (typeof s.opacity === "number") {
        const target = Math.min(1, Math.max(0.3, s.opacity / 100));
        // nur ändern, wenn nötig – 100 % wird nur gesetzt, um eine vorher gesetzte Transparenz aufzuheben
        if (Math.abs(win.getOpacity() - target) > 0.001) win.setOpacity(target);
    }
});

ipcMain.handle("xj:devtools", e => {
    e.sender.isDevToolsOpened() ? e.sender.closeDevTools() : e.sender.openDevTools({ mode: "detach" });
});

ipcMain.handle("xj:openExternal", (_, url) => {
    if (typeof url === "string" && /^https:\/\/(www\.)?twitch\.tv\/[A-Za-z0-9_]{1,30}$/.test(url)) shell.openExternal(url);
});

ipcMain.handle("xj:openFolder", (_, which) => {
    const sub = { themes: "themes", plugins: "plugins" }[which] || "";
    const dir = path.join(DATA_DIR, sub);
    ofs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
});

// Twitch-Status über decapi.me (kein Login/API-Key nötig)
ipcMain.handle("xj:twitch", async (_, channel) => {
    if (!/^[A-Za-z0-9_]{1,30}$/.test(channel || "")) return { error: "Ungültiger Kanalname" };
    const get = async url => {
        const f = electron.net && electron.net.fetch ? electron.net.fetch : fetch;
        const r = await f(url, { headers: { "User-Agent": "xImJxstinnCord" } });
        return (await r.text()).trim();
    };
    try {
        const [uptime, viewers] = await Promise.all([
            get("https://decapi.me/twitch/uptime/" + channel),
            get("https://decapi.me/twitch/viewercount/" + channel)
        ]);
        const offline = /offline/i.test(uptime);
        return { live: !offline, uptime: offline ? "" : uptime, viewers: /^\d+$/.test(viewers) ? Number(viewers) : null };
    } catch (err) {
        return { error: String(err && err.message || err) };
    }
});

// ---------------------------------------------------------------------------
// Content-Security-Policy erweitern (Hintergrundbilder, Google Fonts)
// ---------------------------------------------------------------------------
function patchCsp(headers) {
    const key = Object.keys(headers).find(k => k.toLowerCase() === "content-security-policy");
    if (!key) return;
    const add = {
        "img-src": ["https:", "data:", "blob:"],
        "style-src": ["https:", "'unsafe-inline'"],
        "font-src": ["https:", "data:"]
    };
    headers[key] = [].concat(headers[key]).map(policy => {
        const parts = policy.split(";").map(p => p.trim()).filter(Boolean);
        const seen = new Set();
        const out = parts.map(p => {
            const [name, ...vals] = p.split(/\s+/);
            seen.add(name);
            return add[name] ? [name, ...vals, ...add[name]].join(" ") : p;
        });
        for (const n of Object.keys(add)) if (!seen.has(n) && seen.has("default-src")) out.push([n, "'self'", ...add[n]].join(" "));
        return out.join("; ");
    });
}

app.whenReady().then(() => {
    const wr = electron.session.defaultSession.webRequest;
    wr.onHeadersReceived(({ responseHeaders, resourceType }, cb) => {
        if (responseHeaders && (resourceType === "mainFrame" || resourceType === "subFrame")) patchCsp(responseHeaders);
        cb({ cancel: false, responseHeaders });
    });
    wr.onHeadersReceived = () => { }; // Discord darf unseren Handler nicht ersetzen
});

// ---------------------------------------------------------------------------
// Nach Discord-Updates erhalten bleiben: neue app-* Ordner automatisch patchen
// ---------------------------------------------------------------------------
function patchNewerVersions() {
    try {
        const installRoot = path.dirname(path.dirname(resourcesDir)); // ...\Discord
        for (const d of ofs.readdirSync(installRoot)) {
            if (!d.startsWith("app-")) continue;
            const res = path.join(installRoot, d, "resources");
            if (res === resourcesDir) continue;
            const appAsar = path.join(res, "app.asar");
            const backup = path.join(res, "_app.asar");
            if (ofs.existsSync(appAsar) && !ofs.existsSync(backup)) {
                ofs.renameSync(appAsar, backup);
                try {
                    writeLoaderAsar(appAsar);
                } catch (err) {
                    try { ofs.rmSync(appAsar, { force: true }); } catch { }
                    ofs.renameSync(backup, appAsar); // rückgängig, Discord bleibt startfähig
                    throw err;
                }
                console.log("[xImJxstinnCord] Neue Discord-Version gepatcht:", d);
            }
        }
    } catch (err) {
        console.error("[xImJxstinnCord] Update-Patch fehlgeschlagen", err);
    }
}
// Schreibt eine kleine app.asar, die diesen Loader lädt (gleiches Format wie der Installer)
function writeLoaderAsar(file) {
    const indexJs = Buffer.from("require(" + JSON.stringify(__filename) + ")");
    const pkg = Buffer.from('{"name":"discord","main":"index.js"}');
    let header = JSON.stringify({ files: {
        "index.js": { size: indexJs.length, offset: "0" },
        "package.json": { size: pkg.length, offset: String(indexJs.length) }
    } });
    const hLen = Buffer.byteLength(header);
    const aligned = (hLen + 3) & ~3;
    header += "0".repeat(aligned - hLen);
    const nums = Buffer.alloc(16);
    [4, aligned + 8, aligned + 4, hLen].forEach((n, i) => nums.writeUInt32LE(n, i * 4));
    ofs.writeFileSync(file, Buffer.concat([nums, Buffer.from(header), indexJs, pkg]));
}

app.on("before-quit", patchNewerVersions);
setInterval(patchNewerVersions, 10 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Auto-Update über GitHub-Releases
// ---------------------------------------------------------------------------
const UPDATE_REPO = "ximjxstinn/ximjxstinncord";
const UPDATE_FILES = ["patcher.js", "preload.js", "renderer.js"];
const DIST_DIR = __dirname;

function localVersion() {
    try { return ofs.readFileSync(path.join(DIST_DIR, "version.txt"), "utf8").trim() || "0.0.0"; } catch { return "0.0.0"; }
}

function cmpVersion(a, b) {
    const pa = String(a).replace(/^v/, "").split(/[.-]/).map(n => parseInt(n, 10) || 0);
    const pb = String(b).replace(/^v/, "").split(/[.-]/).map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
}

const updateState = { status: "idle", current: localVersion(), latest: null, notes: "", error: null, needs: null };

function broadcast() {
    for (const w of windows) {
        try { if (!w.isDestroyed()) w.webContents.send("xj:update", updateState); } catch { }
    }
}

async function httpGet(url, binary) {
    const f = electron.net && electron.net.fetch ? electron.net.fetch : fetch;
    const r = await f(url, { headers: { "User-Agent": "xImJxstinnCord-Updater", "Accept": "application/vnd.github+json" } });
    if (r.status === 404 && !binary) { const e = new Error("Noch kein Release auf GitHub"); e.code = 404; throw e; }
    if (!r.ok) throw new Error("GitHub antwortete mit " + r.status);
    return binary ? Buffer.from(await r.arrayBuffer()) : r.json();
}

let updating = false;
async function checkForUpdate(install) {
    if (updating) return updateState;
    updating = true;
    Object.assign(updateState, { status: "checking", error: null, current: localVersion() });
    broadcast();
    try {
        const rel = await httpGet(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`);
        const latest = String(rel.tag_name || "").replace(/^v/, "");
        updateState.latest = latest;
        updateState.notes = String(rel.body || "").slice(0, 2000);

        if (!latest || cmpVersion(latest, updateState.current) <= 0) {
            updateState.status = "uptodate";
            return updateState;
        }
        if (!install) {
            updateState.status = "available";
            return updateState;
        }

        updateState.status = "downloading";
        broadcast();

        // 1. Alles herunterladen und prüfen, bevor irgendetwas ersetzt wird
        const downloaded = {};
        for (const name of UPDATE_FILES) {
            const asset = (rel.assets || []).find(a => a.name === name);
            if (!asset) throw new Error(name + " fehlt im Release " + latest);
            const buf = await httpGet(asset.browser_download_url, true);
            const text = buf.toString("utf8");
            if (buf.length < 500 || !text.includes("xImJxstinnCord")) throw new Error(name + " sieht beschädigt aus");
            downloaded[name] = buf;
        }

        // 2. Was ändert sich? (Renderer = Neu laden reicht, Loader/Preload = Neustart nötig)
        let needs = "reload";
        for (const name of UPDATE_FILES) {
            let old = null;
            try { old = ofs.readFileSync(path.join(DIST_DIR, name)); } catch { }
            if (name !== "renderer.js" && (!old || !old.equals(downloaded[name]))) needs = "restart";
        }

        // 3. Erst .new-Dateien schreiben, dann alle auf einmal tauschen
        for (const name of UPDATE_FILES) ofs.writeFileSync(path.join(DIST_DIR, name + ".new"), downloaded[name]);
        for (const name of UPDATE_FILES) ofs.renameSync(path.join(DIST_DIR, name + ".new"), path.join(DIST_DIR, name));
        ofs.writeFileSync(path.join(DIST_DIR, "version.txt"), latest);

        console.log("[xImJxstinnCord] Update installiert:", updateState.current, "→", latest);
        Object.assign(updateState, { status: "installed", needs, current: latest });
        return updateState;
    } catch (err) {
        for (const name of UPDATE_FILES) { try { ofs.rmSync(path.join(DIST_DIR, name + ".new"), { force: true }); } catch { } }
        updateState.status = err.code === 404 ? "norelease" : "error";
        updateState.error = String(err && err.message || err);
        console.warn("[xImJxstinnCord] Update-Prüfung:", updateState.error);
        return updateState;
    } finally {
        updating = false;
        broadcast();
    }
}

ipcMain.handle("xj:update-state", () => updateState);
ipcMain.handle("xj:update-check", () => checkForUpdate(true));
ipcMain.handle("xj:restart", () => { app.relaunch(); app.exit(0); });

function autoUpdateEnabled() {
    const s = readSettings();
    return s.autoUpdate !== false;
}

app.whenReady().then(() => {
    setTimeout(() => checkForUpdate(autoUpdateEnabled()), 20 * 1000);
    setInterval(() => checkForUpdate(autoUpdateEnabled()), 6 * 60 * 60 * 1000).unref();
});

// ---------------------------------------------------------------------------
// Originales Discord starten
// ---------------------------------------------------------------------------
console.log("[xImJxstinnCord] Lade Discord …");
require.main.filename = path.join(discordAsar, discordPkg.main);
app.setAppPath(discordAsar);
require(require.main.filename);
