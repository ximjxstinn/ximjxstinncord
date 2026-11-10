/*
 * xImJxstinnCord – Tastenkürzel: Aktionen, Speicher und Ausführung
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    isPluginEnabled, pluginRequiresRestart, plugins,
    startDependenciesRecursive, startPlugin, stopPlugin
} from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { insertTextIntoChatInputBox } from "@utils/discord";
import {
    ChannelStore, GuildChannelStore, NavigationRouter, PermissionsBits, PermissionStore,
    SelectedChannelStore, SelectedGuildStore
} from "@webpack/common";

import { setStyle } from "../_xjShared";

export interface HotkeyAction {
    id: string;
    label: string;
    description: string;
    /** Plugin, das aktiv sein muss (optional) */
    plugin?: string;
    /** Standard-Kürzel beim ersten Start */
    defaultCombo?: string;
    /** Aktion schaltet das Plugin selbst an/aus (dann muss es nicht aktiv sein) */
    togglesPlugin?: boolean;
    /** Eigenes Kürzel (bearbeitbar/löschbar) */
    custom?: CustomHotkey;
    run(): string | void; // Rückgabe = Meldung
}

export type CustomType = "plugin" | "setting" | "text" | "link" | "channel" | "css";

export interface CustomHotkey {
    id: string;
    type: CustomType;
    label: string;
    plugin?: string;
    setting?: string;
    text?: string;
    url?: string;
    css?: string;
    on?: boolean;
}

export const CUSTOM_TYPES: { type: CustomType; label: string; hint: string; }[] = [
    { type: "plugin", label: "Plugin an/aus", hint: "Schaltet ein beliebiges Plugin ein oder aus" },
    { type: "setting", label: "Plugin-Einstellung umschalten", hint: "Schaltet eine Ja/Nein-Einstellung eines Plugins um" },
    { type: "text", label: "Text in den Chat einfügen", hint: "Fügt deinen Text ins Eingabefeld ein, z. B. deinen Twitch-Link" },
    { type: "link", label: "Link öffnen", hint: "Öffnet eine Webseite im Browser" },
    { type: "channel", label: "Kanal öffnen", hint: "Springt direkt zu einem Discord-Kanal (Rechtsklick auf Kanal → Link kopieren)" },
    { type: "css", label: "CSS-Schnipsel an/aus", hint: "Schaltet eigenes CSS per Taste ein oder aus" }
];

// ---------------------------------------------------------------------------
// Meldung unten in Discord
// ---------------------------------------------------------------------------
export function hotkeyToast(text: string) {
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, {
        position: "fixed", left: "50%", bottom: "30px", zIndex: "10001", transform: "translate(-50%, 16px)", opacity: "0",
        padding: "11px 18px", borderRadius: "14px", font: "600 14px var(--font-primary, sans-serif)", color: "#fff",
        background: "#15151d", border: "1px solid var(--xj-accent, #9146ff)", boxShadow: "0 12px 30px rgba(0,0,0,.5)",
        transition: ".25s", pointerEvents: "none"
    });
    document.body.append(t);
    requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translate(-50%, 0)"; });
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 1800);
}

const store = () => Settings.plugins.XJHotkeys as any;

// ---------------------------------------------------------------------------
// Automatisch neu laden (für Plugins, die einen Neustart brauchen)
// ---------------------------------------------------------------------------
export const autoReloadEnabled = () => store()?.autoReload === true;

let reloadTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleReload(reason?: string) {
    hotkeyToast((reason ? reason + " – " : "") + "Discord lädt neu …");
    clearTimeout(reloadTimer);
    // kurz warten, damit die Einstellung sicher gespeichert ist und mehrere Klicks zusammengefasst werden
    reloadTimer = setTimeout(() => location.reload(), 1200);
}

// ---------------------------------------------------------------------------
// Sofort-Schalter für Plugins, die eigentlich einen Neustart bräuchten
// (das Plugin bleibt geladen, wird aber pausiert – ohne Neu-Laden)
// ---------------------------------------------------------------------------
interface LiveSwitch { pause(): void; resume(): void; }

function readPaused(): Record<string, boolean> {
    try { return JSON.parse(store()?.paused || "{}") ?? {}; } catch { return {}; }
}
function writePaused(map: Record<string, boolean>) {
    store().paused = JSON.stringify(map);
}
export const isPaused = (name: string) => !!readPaused()[name];
export const hasLiveSwitch = (name: string) => name in LIVE;
/** Ist das Plugin aus Sicht des Nutzers an? (aktiviert und nicht pausiert) */
export const isEffectivelyOn = (name: string) => isPluginEnabled(name) && !isPaused(name);

function refreshChannelStores() {
    for (const st of [GuildChannelStore, ChannelStore, PermissionStore] as any[]) {
        try { st?.emitChange?.(); } catch { }
    }
}

// --- ShowHiddenChannels ---------------------------------------------------
const SHC_HIDE_CLASS = "xj-shc-paused-hide";
let shcObserver: MutationObserver | null = null;
let shcPending = false;

function shcCanView(id: string) {
    try {
        const ch = ChannelStore.getChannel(id);
        if (!ch || !ch.guild_id) return true;
        return PermissionStore.can(PermissionsBits.VIEW_CHANNEL, ch);
    } catch { return true; }
}

function shcMarkRows() {
    for (const el of document.querySelectorAll<HTMLElement>('[data-list-item-id^="channels___"]')) {
        const row = (el.closest("li") ?? el) as HTMLElement;
        row.classList.toggle(SHC_HIDE_CLASS, !shcCanView(el.getAttribute("data-list-item-id")!.slice(11)));
    }
}

const shcLive: LiveSwitch = {
    pause() {
        const p = plugins.ShowHiddenChannels as any;
        if (!p) return;
        if (!p.__xjOriginal) p.__xjOriginal = p.isHiddenChannel;
        // Alle Stellen, an denen ShowHiddenChannels eingreift, fragen diese Funktion – „nein“ = Discord verhält sich normal
        p.isHiddenChannel = () => false;
        setStyle("xj-shc-paused", `.${SHC_HIDE_CLASS} { display: none !important; }`);
        shcMarkRows();
        if (!shcObserver) {
            shcObserver = new MutationObserver(() => {
                if (shcPending) return;
                shcPending = true;
                setTimeout(() => { shcPending = false; shcMarkRows(); }, 40);
            });
            shcObserver.observe(document.body, { childList: true, subtree: true });
        }
        refreshChannelStores();
        // Falls gerade ein gesperrter Kanal offen ist: zurück zum Server
        try {
            const cid = SelectedChannelStore.getChannelId();
            const gid = SelectedGuildStore.getGuildId();
            if (cid && gid && !shcCanView(cid)) NavigationRouter.transitionTo(`/channels/${gid}`);
        } catch { }
    },
    resume() {
        const p = plugins.ShowHiddenChannels as any;
        if (p?.__xjOriginal) p.isHiddenChannel = p.__xjOriginal;
        shcObserver?.disconnect();
        shcObserver = null;
        document.querySelectorAll("." + SHC_HIDE_CLASS).forEach(e => e.classList.remove(SHC_HIDE_CLASS));
        setStyle("xj-shc-paused", null);
        refreshChannelStores();
    }
};

const LIVE: Record<string, LiveSwitch> = {
    ShowHiddenChannels: shcLive
};

/** Beim Start: pausierte Plugins wieder pausieren */
export function applyPausedPlugins() {
    for (const [name, paused] of Object.entries(readPaused())) {
        if (paused && LIVE[name] && isPluginEnabled(name)) LIVE[name].pause();
    }
}
export function releasePausedPlugins() {
    for (const [name, paused] of Object.entries(readPaused())) if (paused && LIVE[name]) LIVE[name].resume();
}

/**
 * Plugin an/aus ohne Neu-Laden, wenn irgendwie möglich.
 * Gibt eine Meldung zurück, oder null, wenn der normale Weg genommen werden soll.
 */
export function setLiveState(name: string, on: boolean): string | null {
    if (!LIVE[name] || !isPluginEnabled(name)) return null;
    const map = readPaused();
    if (on) { delete map[name]; writePaused(map); LIVE[name].resume(); }
    else { map[name] = true; writePaused(map); LIVE[name].pause(); }
    return `${name} ${on ? "an" : "aus"}`;
}

// ---------------------------------------------------------------------------
// Plugin an/aus
// ---------------------------------------------------------------------------
export function canToggleLive(name: string) {
    const p = plugins[name];
    if (!p || p.required) return false;
    if (LIVE[name] && isPluginEnabled(name)) return true;
    return !pluginRequiresRestart(p);
}

/** Schaltet ein Plugin um – live, oder mit automatischem Neu-Laden, wenn es nicht anders geht. */
export function togglePlugin(name: string): string {
    const p = plugins[name];
    if (!p) return `${name} gibt es nicht`;
    if (p.required) return `${name} kann nicht ausgeschaltet werden`;
    const st = Settings.plugins[name];

    // Sofort-Schalter (z. B. ShowHiddenChannels): pausieren statt neu laden
    const live = setLiveState(name, !isEffectivelyOn(name));
    if (live) return live;

    const on = isPluginEnabled(name);
    if (!canToggleLive(name)) {
        st.enabled = !on;
        if (autoReloadEnabled()) { scheduleReload(`${name} ${on ? "aus" : "an"}`); return ""; }
        return `${name} ${on ? "aus" : "an"} – wirkt beim nächsten Discord-Start`;
    }
    if (!on) {
        const { restartNeeded, failures } = startDependenciesRecursive(p);
        if (failures.length) return `${name}: Abhängigkeiten konnten nicht starten`;
        if (restartNeeded) {
            st.enabled = true;
            if (autoReloadEnabled()) { scheduleReload(`${name} an`); return ""; }
            return `${name} an – wirkt nach dem Neu-Laden`;
        }
    }
    const ok = on ? stopPlugin(p) : startPlugin(p);
    if (!ok) return `Fehler bei ${name}`;
    st.enabled = !on;
    return `${name} ${on ? "aus" : "an"}`;
}

// ---------------------------------------------------------------------------
// CSS-Schnipsel der eigenen Kürzel
// ---------------------------------------------------------------------------
export function applyVisibilityStyles() {
    const css: string[] = [];
    for (const c of getCustomHotkeys()) if (c.type === "css" && c.on && c.css) css.push(c.css);
    setStyle("xj-hotkey-visibility", css.join("\n") || null);
}

const settingFlip = (plugin: string, key: string) => {
    const st = Settings.plugins[plugin] as any;
    st[key] = !st[key];
    return !!st[key];
};

// ---------------------------------------------------------------------------
// Standard: diese Plugins bekommen beim ersten Start ein Kürzel zum An-/Ausschalten
// ---------------------------------------------------------------------------
export const DEFAULT_PLUGIN_BINDS: Record<string, string> = {
    ShowHiddenChannels: "ctrl+shift+h",
    MessageLogger: "ctrl+shift+l",
    XJStreamerBlur: "ctrl+shift+b"
};
/** Alte Aktions-IDs aus früheren Versionen → Plugin */
const OLD_IDS: Record<string, string> = { shc: "ShowHiddenChannels", "shc-plugin": "ShowHiddenChannels", ml: "MessageLogger", blur: "XJStreamerBlur", design: "XJDesign", twitch: "XJTwitchLive", clock: "XJStreamClock" };

// ---------------------------------------------------------------------------
// Eigene Kürzel
// ---------------------------------------------------------------------------
function readJson<T>(key: string, fallback: T): T {
    try { return JSON.parse(store()?.[key] || "") ?? fallback; } catch { return fallback; }
}

export function getCustomHotkeys(): CustomHotkey[] {
    const s = store();
    // Übernahme der alten „Plugin an/aus“-Liste
    if (s?.customPlugins) {
        const old = readJson<string[]>("customPlugins", []);
        const list = readJson<CustomHotkey[]>("customHotkeys", []);
        for (const name of old) {
            const id = "toggle:" + name;
            if (!list.some(c => c.id === id)) list.push({ id, type: "plugin", label: `${name} an/aus`, plugin: name });
        }
        s.customHotkeys = JSON.stringify(list);
        s.customPlugins = "";
    }
    return readJson<CustomHotkey[]>("customHotkeys", []);
}

export function saveCustomHotkey(c: CustomHotkey) {
    const list = getCustomHotkeys();
    const i = list.findIndex(x => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    store().customHotkeys = JSON.stringify(list);
    applyVisibilityStyles();
}

export function deleteCustomHotkey(id: string) {
    store().customHotkeys = JSON.stringify(getCustomHotkeys().filter(c => c.id !== id));
    setBind(id, null);
    applyVisibilityStyles();
}

export const newCustomId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function channelPath(url?: string) {
    const m = /channels\/(@me|\d+)(?:\/(\d+))?(?:\/(\d+))?/.exec(url || "");
    return m ? "/channels/" + [m[1], m[2], m[3]].filter(Boolean).join("/") : null;
}

function customToAction(c: CustomHotkey): HotkeyAction {
    const fallback = c.type === "plugin" && c.plugin ? `${c.plugin} an/aus`
        : c.type === "setting" && c.plugin ? `${c.plugin}: ${c.setting} umschalten`
            : CUSTOM_TYPES.find(t => t.type === c.type)?.label || "Eigenes Kürzel";
    const base = { id: c.id, label: c.label?.trim() || fallback, custom: c };
    switch (c.type) {
        case "plugin":
            return { ...base, plugin: c.plugin, togglesPlugin: true, description: `Schaltet ${c.plugin} ein oder aus`, run: () => togglePlugin(c.plugin!) };
        case "setting":
            return {
                ...base, plugin: c.plugin, description: `Schaltet „${c.setting}“ von ${c.plugin} um`,
                run: () => `${c.plugin}: ${c.setting} ${settingFlip(c.plugin!, c.setting!) ? "an" : "aus"}`
            };
        case "text":
            return {
                ...base, description: "Fügt ein: " + (c.text ?? "").slice(0, 60),
                run: () => { insertTextIntoChatInputBox(c.text ?? ""); return "✏️ Text eingefügt"; }
            };
        case "link":
            return {
                ...base, description: "Öffnet " + (c.url ?? ""),
                run: () => {
                    if (!/^https?:\/\//i.test(c.url ?? "")) return "Ungültiger Link";
                    VencordNative.native.openExternal(c.url!);
                    return "🔗 Link geöffnet";
                }
            };
        case "channel":
            return {
                ...base, description: "Springt zu " + (channelPath(c.url) ?? "?"),
                run: () => {
                    const path = channelPath(c.url);
                    if (!path) return "Ungültiger Kanal-Link";
                    NavigationRouter.transitionTo(path);
                    return "";
                }
            };
        case "css":
        default:
            return {
                ...base, description: "Eigenes CSS-Schnipsel" + (c.on ? " (gerade an)" : ""),
                run: () => { c.on = !c.on; saveCustomHotkey(c); return c.on ? "🎨 CSS-Schnipsel an" : "🎨 CSS-Schnipsel aus"; }
            };
    }
}

/** Alle Aktionen inkl. eigener Kürzel */
export function getActions(): HotkeyAction[] {
    return getCustomHotkeys().map(customToAction);
}

// ---------------------------------------------------------------------------
// Plugin-Kürzel (Plugin an/aus)
// ---------------------------------------------------------------------------
export const pluginHotkeyId = (name: string) => "toggle:" + name;

export function getPluginHotkeys(): CustomHotkey[] {
    return getCustomHotkeys().filter(c => c.type === "plugin" && c.plugin);
}

export function ensurePluginHotkey(name: string) {
    const id = pluginHotkeyId(name);
    if (!getCustomHotkeys().some(c => c.id === id)) saveCustomHotkey({ id, type: "plugin", label: "", plugin: name });
    return id;
}

export function getPluginBind(name: string) {
    return getBinds()[pluginHotkeyId(name)] ?? null;
}

export function setPluginBind(name: string, combo: string | null) {
    setBind(ensurePluginHotkey(name), combo);
}

export function removePluginHotkey(name: string) {
    deleteCustomHotkey(pluginHotkeyId(name));
}

// ---------------------------------------------------------------------------
// Speicher der Kürzel
// ---------------------------------------------------------------------------
export function getBinds(): Record<string, string> {
    const s = store();
    if (!s) return {};
    if (!s.initialized) {
        s.initialized = true;
        s.binds = JSON.stringify({});
        for (const [name, combo] of Object.entries(DEFAULT_PLUGIN_BINDS)) if (plugins[name]) setPluginBind(name, combo);
    }
    // Übernahme aus früheren Versionen (Ausblenden-Aktionen → Plugin an/aus)
    if (!s.migratedV3) {
        s.migratedV3 = true;
        s.hideHiddenChannels = false;
        s.hideLoggedMessages = false;
        const binds = readJson<Record<string, string>>("binds", {});
        for (const [oldId, plugin] of Object.entries(OLD_IDS)) {
            const combo = binds[oldId];
            if (!combo) continue;
            delete binds[oldId];
            s.binds = JSON.stringify(binds);
            if (!getPluginBind(plugin)) setPluginBind(plugin, combo);
        }
    }
    return readJson<Record<string, string>>("binds", {});
}

export function setBind(id: string, combo: string | null) {
    const binds = getBinds();
    if (combo) {
        // dasselbe Kürzel darf nur einmal vergeben sein
        for (const [k, v] of Object.entries(binds)) if (v === combo) delete binds[k];
        binds[id] = combo;
    } else delete binds[id];
    store().binds = JSON.stringify(binds);
}

// ---------------------------------------------------------------------------
// Tastenkombinationen
// ---------------------------------------------------------------------------
export function comboFromEvent(e: KeyboardEvent): string | null {
    if (typeof e.key !== "string") return null;
    if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return null;
    let key = e.code?.startsWith("Key") ? e.code.slice(3).toLowerCase()
        : e.code?.startsWith("Digit") ? e.code.slice(5)
            : e.key.toLowerCase();
    if (key === " ") key = "space";
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(key);
    return parts.join("+");
}

export function formatCombo(combo?: string | null) {
    if (!combo) return "—";
    const names: Record<string, string> = { ctrl: "Strg", alt: "Alt", shift: "Shift", space: "Leertaste", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", escape: "Esc" };
    return combo.split("+").map(p => names[p] ?? (p.length === 1 ? p.toUpperCase() : p.replace(/^f(\d+)$/, "F$1").replace(/^./, c => c.toUpperCase()))).join(" + ");
}

/** Während ein Kürzel aufgenommen wird, sollen keine Aktionen auslösen */
export const recording = { active: false };
