/*
 * xImJxstinnCord – Tastenkürzel: Aktionen, Speicher und Ausführung
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    isPluginEnabled, pluginRequiresRestart, plugins,
    startDependenciesRecursive, startPlugin, stopPlugin
} from "@api/PluginManager";
import { Settings } from "@api/Settings";

import { setStyle } from "../_xjShared";
import { toggleStreamerBlur } from "../xjStreamerBlur";

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
    run(): string | void; // Rückgabe = Meldung
}

// ---------------------------------------------------------------------------
// Meldung unten in Discord
// ---------------------------------------------------------------------------
export function hotkeyToast(text: string) {
    const t = document.createElement("div");
    t.className = "xjm-toast";
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

// ---------------------------------------------------------------------------
// Plugin an/aus (ohne Neustart, falls möglich)
// ---------------------------------------------------------------------------
export function canToggleLive(name: string) {
    const p = plugins[name];
    return !!p && !p.required && !pluginRequiresRestart(p);
}

export function togglePluginLive(name: string): string {
    const p = plugins[name];
    if (!p) return `${name} gibt es nicht`;
    const st = Settings.plugins[name];
    const on = isPluginEnabled(name);
    if (!canToggleLive(name)) return `${name} braucht zum Umschalten einen Neustart`;
    if (!on) {
        const { restartNeeded, failures } = startDependenciesRecursive(p);
        if (failures.length || restartNeeded) return `${name}: Abhängigkeiten brauchen einen Neustart`;
    }
    const ok = on ? stopPlugin(p) : startPlugin(p);
    if (!ok) return `Fehler bei ${name}`;
    st.enabled = !on;
    return `${name} ${on ? "aus" : "an"}`;
}

// ---------------------------------------------------------------------------
// Zustände der Ein-/Ausblenden-Aktionen (bleiben über Neustarts erhalten)
// ---------------------------------------------------------------------------
const store = () => Settings.plugins.XJHotkeys as any;

export function applyVisibilityStyles() {
    const s = store();
    const css: string[] = [];
    if (s?.hideHiddenChannels)
        css.push(`li:has(.vc-shc-hidden-channel-icon), [class*="containerDefault"]:has(.vc-shc-hidden-channel-icon) { display: none !important; }`);
    if (s?.hideLoggedMessages)
        css.push(`.messagelogger-deleted, .messagelogger-edited, .messagelogger-edit-marker { display: none !important; }`);
    setStyle("xj-hotkey-visibility", css.join("\n") || null);
}

function flip(key: string) {
    const s = store();
    s[key] = !s[key];
    applyVisibilityStyles();
    return !s[key];
}

const settingFlip = (plugin: string, key: string) => {
    const st = Settings.plugins[plugin] as any;
    st[key] = !st[key];
    return !!st[key];
};

// ---------------------------------------------------------------------------
// Alle Aktionen
// ---------------------------------------------------------------------------
export const BUILTIN_ACTIONS: HotkeyAction[] = [
    {
        id: "shc", plugin: "ShowHiddenChannels", defaultCombo: "ctrl+shift+h",
        label: "Versteckte Kanäle ein-/ausblenden",
        description: "Blendet die Kanäle mit Schloss in der Kanalliste aus oder wieder ein",
        run: () => flip("hideHiddenChannels") ? "🔒 Versteckte Kanäle sichtbar" : "🙈 Versteckte Kanäle ausgeblendet"
    },
    {
        id: "ml", plugin: "MessageLogger", defaultCombo: "ctrl+shift+l",
        label: "Gelöschte Nachrichten ein-/ausblenden",
        description: "Zeigt oder versteckt gelöschte und bearbeitete Nachrichten vom MessageLogger",
        run: () => flip("hideLoggedMessages") ? "🗑 Gelöschte Nachrichten sichtbar" : "🙈 Gelöschte Nachrichten ausgeblendet"
    },
    {
        id: "blur", plugin: "XJStreamerBlur", defaultCombo: "ctrl+shift+b",
        label: "Streamer-Blur umschalten",
        description: "Verwischt Chats und DMs – oder hebt es wieder auf",
        run: () => toggleStreamerBlur() ? "🙈 Streamer-Blur an" : "👀 Streamer-Blur aus"
    },
    {
        id: "silent", plugin: "SilentTyping",
        label: "Unsichtbar tippen umschalten",
        description: "Andere sehen nicht, dass du tippst (SilentTyping)",
        run: () => settingFlip("SilentTyping", "isEnabled") ? "🤫 Unsichtbar tippen an" : "⌨️ Unsichtbar tippen aus"
    },
    {
        id: "translate", plugin: "Translate",
        label: "Automatisch übersetzen umschalten",
        description: "Deine Nachrichten werden vor dem Senden übersetzt (Translate)",
        run: () => settingFlip("Translate", "autoTranslate") ? "🌍 Auto-Übersetzen an" : "🌍 Auto-Übersetzen aus"
    },
    {
        id: "design", plugin: "XJDesign",
        label: "Designer an/aus",
        description: "Schaltet dein xImJxstinn-Farbschema ein oder aus",
        togglesPlugin: true,
        run: () => togglePluginLive("XJDesign")
    },
    {
        id: "twitch", plugin: "XJTwitchLive",
        label: "Twitch-Anzeige an/aus",
        description: "Blendet das LIVE-Abzeichen ein oder aus",
        togglesPlugin: true,
        run: () => togglePluginLive("XJTwitchLive")
    },
    {
        id: "clock", plugin: "XJStreamClock",
        label: "Stream-Uhr an/aus",
        description: "Blendet die Uhr ein oder aus",
        togglesPlugin: true,
        run: () => togglePluginLive("XJStreamClock")
    },
    {
        id: "quickcss",
        label: "Eigenes CSS an/aus",
        description: "Schaltet dein QuickCSS ein oder aus",
        run: () => { Settings.useQuickCss = !Settings.useQuickCss; return Settings.useQuickCss ? "🎨 Eigenes CSS an" : "🎨 Eigenes CSS aus"; }
    },
    {
        id: "reload",
        label: "Discord neu laden",
        description: "Lädt Discord neu (wie Strg + R)",
        run: () => { location.reload(); }
    }
];

/** Alle Aktionen inkl. eigener „Plugin an/aus“-Kürzel */
export function getActions(): HotkeyAction[] {
    const custom = getCustomPlugins().map(name => ({
        id: "toggle:" + name,
        plugin: name,
        label: `${name} an/aus`,
        description: "Schaltet das Plugin ohne Neustart ein oder aus",
        togglesPlugin: true,
        run: () => togglePluginLive(name)
    }));
    return [...BUILTIN_ACTIONS, ...custom];
}

// ---------------------------------------------------------------------------
// Speicher der Kürzel
// ---------------------------------------------------------------------------
function readJson<T>(key: string, fallback: T): T {
    try { return JSON.parse(store()?.[key] || "") ?? fallback; } catch { return fallback; }
}

export function getBinds(): Record<string, string> {
    const s = store();
    if (s && !s.initialized) {
        const defaults: Record<string, string> = {};
        for (const a of BUILTIN_ACTIONS) if (a.defaultCombo) defaults[a.id] = a.defaultCombo;
        s.binds = JSON.stringify(defaults);
        s.initialized = true;
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

export function getCustomPlugins(): string[] {
    return readJson<string[]>("customPlugins", []);
}

export function addCustomPlugin(name: string) {
    const list = getCustomPlugins();
    if (!list.includes(name)) list.push(name);
    store().customPlugins = JSON.stringify(list);
}

export function removeCustomPlugin(name: string) {
    store().customPlugins = JSON.stringify(getCustomPlugins().filter(n => n !== name));
    setBind("toggle:" + name, null);
}

// ---------------------------------------------------------------------------
// Tastenkombinationen
// ---------------------------------------------------------------------------
export function comboFromEvent(e: KeyboardEvent): string | null {
    if (typeof e.key !== "string") return null;
    if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return null;
    let key = e.code?.startsWith("Key") ? e.code.slice(3).toLowerCase()
        : e.code?.startsWith("Digit") ? e.code.slice(5)
            : e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase();
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
