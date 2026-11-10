/*
 * xImJxstinnCord – eigenes Menü (Seiten)
 * Eigene Oberfläche für Übersicht, Plugins, Themes, Updates und Backup.
 * Benutzt intern die Plugin-, Theme- und Update-Funktionen von Vencord.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    isPluginEnabled, isSettingHidden, pluginRequiresRestart, plugins,
    startDependenciesRecursive, startPlugin, stopPlugin
} from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { downloadSettingsBackup, uploadSettingsBackup } from "@api/SettingsSync/offline";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { relaunch } from "@utils/native";
import * as Updater from "@utils/updater";
import { React } from "@webpack/common";
import gitHash from "~git-hash";

import {
    autoReloadEnabled, canToggleLive, channelPath, CUSTOM_TYPES, CustomHotkey, deleteCustomHotkey, ensurePluginHotkey,
    formatCombo, getActions, getBinds, getPluginBind, getPluginHotkeys, newCustomId, pluginHotkeyId, recording,
    removePluginHotkey, saveCustomHotkey, scheduleReload, setBind
} from "../xjHotkeys/actions";
import { CSS } from "./style";

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------
type Kid = Node | string | null | undefined | false | Kid[];
function h(tag: string, props: Record<string, any> = {}, ...kids: Kid[]): HTMLElement {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k in el) (el as any)[k] = v;
        else el.setAttribute(k, String(v));
    }
    const add = (c: Kid) => {
        if (c == null || c === false) return;
        if (Array.isArray(c)) c.forEach(add);
        else el.append(c as any);
    };
    kids.forEach(add);
    return el;
}

const ICON: Record<string, string> = {
    home: "M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z",
    plug: "M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5Z",
    brush: "M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3Zm13.71-9.37-1.34-1.34a1 1 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a1 1 0 0 0 0-1.41Z",
    update: "M21 10.12h-6.78l2.74-2.82a7.03 7.03 0 0 0-9.88-.1 6.88 6.88 0 0 0 0 9.8 7.03 7.03 0 0 0 9.88 0A6.5 6.5 0 0 0 19 12.1h2a8.67 8.67 0 0 1-2.64 6.2 9.06 9.06 0 0 1-12.72 0 8.84 8.84 0 0 1 0-12.58 9 9 0 0 1 12.66 0L21 3v7.12ZM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5Z",
    backup: "M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.99 5.99 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96ZM14 13v4h-4v-4H7l5-5 5 5h-3Z",
    gear: "M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.88 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.08.63-.08.94s.02.63.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z",
    search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14Z",
    folder: "M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z",
    restart: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z",
    code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4Zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4Z",
    star: "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z",
    trash: "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z",
    close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z",
    download: "M5 20h14v-2H5v2Zm14-9h-4V3H9v8H5l7 7 7-7Z",
    upload: "M5 20h14v-2H5v2Zm4-4h6v-6h4l-7-7-7 7h4v6Z",
    keyboard: "M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm-9 3h2v2h-2V8Zm0 3h2v2h-2v-2ZM8 8h2v2H8V8Zm0 3h2v2H8v-2Zm-1 2H5v-2h2v2Zm0-3H5V8h2v2Zm9 7H8v-2h8v2Zm0-4h-2v-2h2v2Zm0-3h-2V8h2v2Zm3 3h-2v-2h2v2Zm0-3h-2V8h2v2Z",
    plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z"
};
function icon(name: string, size = 20) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(ns, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", ICON[name] ?? ICON.gear);
    svg.append(p);
    return svg;
}

function toast(text: string) {
    const t = h("div", { class: "xjm-toast" }, text);
    document.body.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3000);
}

const toggle = (on: boolean, change: (v: boolean) => void, disabled = false) =>
    h("label", { class: "xjm-switch" + (disabled ? " off" : "") },
        h("input", { type: "checkbox", checked: on, disabled, onchange: (e: any) => change(e.target.checked) }),
        h("span"));

const hueOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

function ensureStyle() {
    let s = document.getElementById("xjm-style");
    if (!s) {
        s = h("style", { id: "xjm-style" });
        document.head.append(s);
    }
    if (s.textContent !== CSS) s.textContent = CSS;
}

// Seiten, die gerade offen sind, werden bei Änderungen neu gezeichnet
const views = new Set<() => void>();
const redrawAll = () => views.forEach(v => v());

// Plugins, die einen Neustart brauchen
const restartNeeded = new Set<string>();

function restartBar() {
    if (!restartNeeded.size) return null;
    return h("div", { class: "xjm-restart" },
        icon("restart", 18),
        h("div", {}, h("b", {}, "Neustart nötig"), h("span", {}, [...restartNeeded].join(", "))),
        h("button", { class: "xjm-btn", onclick: () => relaunch() }, "Jetzt neu starten"));
}

function pageHead(title: string, sub: string, ic: string, ...actions: Kid[]) {
    return h("div", { class: "xjm-head" },
        h("div", { class: "xjm-head-icon" }, icon(ic, 26)),
        h("div", { class: "xjm-head-text" }, h("h1", {}, title), h("p", {}, sub)),
        h("div", { class: "xjm-head-actions" }, actions));
}

// ---------------------------------------------------------------------------
// Plugins an/aus
// ---------------------------------------------------------------------------
function setEnabled(p: any, on: boolean) {
    const st = Settings.plugins[p.name];
    const was = isPluginEnabled(p.name);
    if (on === was) return;

    if (on) {
        const { restartNeeded: depsNeedRestart, failures } = startDependenciesRecursive(p);
        if (failures.length) { toast("Abhängigkeiten konnten nicht gestartet werden: " + failures.join(", ")); return; }
        if (depsNeedRestart) { st.enabled = true; needsReload(p.name, on); return; }
    }
    if (pluginRequiresRestart(p)) {
        st.enabled = on;
        needsReload(p.name, on);
        return;
    }
    if (was && !p.started) { st.enabled = false; return; }

    const ok = was ? stopPlugin(p) : startPlugin(p);
    if (!ok) {
        st.enabled = false;
        toast(`Fehler beim ${was ? "Stoppen" : "Starten"} von ${p.name}`);
        return;
    }
    st.enabled = on;
}

/** Plugin braucht Neustart: automatisch neu laden oder Hinweis anzeigen */
function needsReload(name: string, on: boolean) {
    if (autoReloadEnabled()) scheduleReload(`${name} ${on ? "an" : "aus"}`);
    else restartNeeded.add(name);
}

// ---------------------------------------------------------------------------
// Einstellungs-Dialog für ein Plugin (eigenes Design)
// ---------------------------------------------------------------------------
const OT = { STRING: 0, NUMBER: 1, BIGINT: 2, BOOLEAN: 3, SELECT: 4, SLIDER: 5, COMPONENT: 6, CUSTOM: 7 };

function openSettings(p: any) {
    const defs: Record<string, any> = p.settings?.def ?? p.options ?? {};
    const store = Settings.plugins[p.name];
    const ov = h("div", { class: "xjm-overlay" });
    const close = () => { ov.remove(); document.removeEventListener("keydown", esc, true); redrawAll(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });

    const body = h("div", { class: "xjm-dialog-body" });
    const set = (key: string, def: any, v: any) => {
        store[key] = v;
        try { def.onChange?.(v); } catch (e) { console.error(e); }
        if (def.restartNeeded) needsReload(p.name, true);
        draw();
    };

    const draw = () => {
        const rows: HTMLElement[] = [];
        let advanced = false;
        for (const [key, def] of Object.entries(defs)) {
            if (key === "enabled") continue;
            try { if (p.settings && isSettingHidden(p.settings, def)) continue; } catch { }
            if (def.hidden === true) continue;
            const value = store[key] ?? def.default;
            const label = h("div", { class: "xjm-opt-text" },
                h("b", {}, key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase())),
                def.description ? h("span", {}, def.description) : null);
            let ctl: HTMLElement;
            switch (def.type) {
                case OT.BOOLEAN:
                    ctl = toggle(!!value, v => set(key, def, v));
                    break;
                case OT.SELECT:
                    ctl = h("select", { class: "xjm-input", onchange: (e: any) => set(key, def, def.options[e.target.selectedIndex].value) },
                        (def.options ?? []).map((o: any) => h("option", { selected: o.value === value }, o.label)));
                    break;
                case OT.SLIDER: {
                    const m = def.markers ?? [0, 100];
                    const val = h("span", { class: "xjm-val" }, String(value));
                    ctl = h("div", { class: "xjm-slider" },
                        h("input", { type: "range", min: m[0], max: m[m.length - 1], step: def.stickToMarkers ? "any" : 1, value,
                            oninput: (e: any) => { val.textContent = e.target.value; },
                            onchange: (e: any) => {
                                let v = Number(e.target.value);
                                if (def.stickToMarkers) v = m.reduce((a: number, b: number) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
                                set(key, def, v);
                            } }), val);
                    break;
                }
                case OT.NUMBER:
                case OT.BIGINT:
                    ctl = h("input", { class: "xjm-input small", type: "number", value: String(value ?? ""),
                        onchange: (e: any) => set(key, def, def.type === OT.BIGINT ? BigInt(e.target.value || 0) : Number(e.target.value)) });
                    break;
                case OT.STRING:
                    ctl = h(def.multiline ? "textarea" : "input", { class: "xjm-input", value: String(value ?? ""), placeholder: def.placeholder ?? "",
                        onkeydown: (e: any) => e.stopPropagation(), onchange: (e: any) => set(key, def, e.target.value) });
                    break;
                default:
                    advanced = true;
                    continue;
            }
            rows.push(h("div", { class: "xjm-opt" + (def.type === OT.STRING && def.multiline ? " col" : "") }, label, ctl));
        }
        const parts: Kid[] = [
            h("div", { class: "xjm-dialog-head" },
                h("div", { class: "xjm-avatar", style: `--h:${hueOf(p.name)}` }, p.name[0]),
                h("div", { class: "xjm-dialog-title" }, h("h2", {}, p.name), h("p", {}, p.description ?? "")),
                h("button", { class: "xjm-iconbtn", title: "Schließen", onclick: close }, icon("close", 18))),
            h("div", { class: "xjm-opt main" },
                h("div", { class: "xjm-opt-text" }, h("b", {}, "Plugin aktiv"),
                    p.required ? h("span", {}, "Wird für xImJxstinnCord benötigt") : null),
                toggle(isPluginEnabled(p.name), v => { setEnabled(p, v); draw(); }, !!p.required)),
            p.required ? null : h("div", { class: "xjm-opt main" },
                h("div", { class: "xjm-opt-text" }, h("b", {}, "Tastenkürzel"),
                    h("span", {}, "Schaltet das Plugin per Taste an/aus" + (canToggleLive(p.name) ? "" : " – Discord lädt dabei kurz neu"))),
                h("div", { class: "xjm-hk-side" },
                    h("button", { class: "xjm-key" + (getPluginBind(p.name) ? "" : " empty"), "data-rec": pluginHotkeyId(p.name),
                        onclick: () => { ensurePluginHotkey(p.name); startRecording(pluginHotkeyId(p.name), draw); } },
                        getPluginBind(p.name) ? formatCombo(getPluginBind(p.name)) : "Taste festlegen"),
                    getPluginBind(p.name) ? h("button", { class: "xjm-iconbtn", title: "Kürzel entfernen", onclick: () => { removePluginHotkey(p.name); draw(); } }, icon("close", 15)) : null)),
            rows.length ? rows : h("div", { class: "xjm-empty small" }, "Dieses Plugin hat keine weiteren Einstellungen."),
            advanced ? h("button", { class: "xjm-btn ghost", onclick: () => { close(); openPluginModal(p, n => needsReload(n, true)); } },
                icon("gear", 16), "Erweiterte Einstellungen") : null,
            p.authors?.length ? h("div", { class: "xjm-authors" }, "von " + p.authors.map((a: any) => a.name).join(", ")) : null
        ];
        body.replaceChildren(h("div", { class: "xjm-dialog-inner" }, parts));
    };
    draw();
    ov.append(h("div", { class: "xjm-dialog" }, body));
    document.body.append(ov);
}

// ---------------------------------------------------------------------------
// Seite: Übersicht
// ---------------------------------------------------------------------------
function pageMain() {
    const all = Object.values(plugins).filter((p: any) => !p.hidden);
    const active = all.filter((p: any) => isPluginEnabled(p.name)).length;
    const themes = (Settings.enabledThemes?.length ?? 0) + (Settings.themeLinks?.length ?? 0);
    const action = (ic: string, label: string, fn: () => void) =>
        h("button", { class: "xjm-action", onclick: fn }, h("span", { class: "xjm-action-icon" }, icon(ic, 20)), label);

    return [
        h("div", { class: "xjm-hero" },
            h("div", { class: "xjm-hero-glow a" }), h("div", { class: "xjm-hero-glow b" }),
            h("div", { class: "xjm-logo" }, "X"),
            h("div", { class: "xjm-hero-text" },
                h("h1", {}, "xImJxstinnCord"),
                h("p", {}, "Dein eigener Discord-Mod"),
                h("div", { class: "xjm-chips" },
                    h("span", { class: "xjm-chip" }, "Version " + gitHash),
                    h("span", { class: "xjm-chip " + (Updater.isOutdated ? "warn" : "ok") }, Updater.isOutdated ? "Update verfügbar" : "Aktuell")))),
        h("div", { class: "xjm-stats" },
            h("div", { class: "xjm-stat" }, h("b", {}, String(active)), h("span", {}, "Plugins aktiv")),
            h("div", { class: "xjm-stat" }, h("b", {}, String(all.length)), h("span", {}, "Plugins verfügbar")),
            h("div", { class: "xjm-stat" }, h("b", {}, String(themes)), h("span", {}, "Themes aktiv"))),
        restartBar(),
        h("h3", { class: "xjm-section" }, "Schnellzugriff"),
        h("div", { class: "xjm-actions" },
            action("restart", "Discord neu starten", () => relaunch()),
            action("folder", "Einstellungs-Ordner", () => VencordNative.settings.openFolder()),
            action("brush", "Themes-Ordner", () => VencordNative.themes.openFolder()),
            action("code", "QuickCSS bearbeiten", () => VencordNative.quickCss.openEditor()),
            action("update", "Nach Updates suchen", async () => {
                const outdated = await Updater.checkForUpdates().catch(() => false);
                toast(outdated ? "⬆️ Ein Update ist verfügbar!" : "✓ Du bist auf dem neuesten Stand");
                redrawAll();
            })),
        h("h3", { class: "xjm-section" }, "Allgemein"),
        h("div", { class: "xjm-list" },
            optRow("Eigenes CSS (QuickCSS) verwenden", "Dein CSS aus dem QuickCSS-Editor anwenden", Settings.useQuickCss, v => { Settings.useQuickCss = v; }),
            optRow("Mindestgröße des Fensters aufheben", "Discord-Fenster beliebig klein machen", Settings.disableMinSize, v => { Settings.disableMinSize = v; restartNeeded.add("Fenstergröße"); }),
            optRow("Windows-Titelleiste anzeigen", "Statt Discords eigener Titelleiste (Neustart nötig)", Settings.nativeTitleBar, v => { Settings.nativeTitleBar = v; restartNeeded.add("Titelleiste"); }),
            optRow("React-Entwicklertools", "Nur für Plugin-Entwickler (Neustart nötig)", Settings.enableReactDevtools, v => { Settings.enableReactDevtools = v; restartNeeded.add("React-Entwicklertools"); }))
    ];
}

function optRow(title: string, sub: string, on: boolean, change: (v: boolean) => void) {
    return h("div", { class: "xjm-opt" },
        h("div", { class: "xjm-opt-text" }, h("b", {}, title), h("span", {}, sub)),
        toggle(!!on, v => { change(v); redrawAll(); }));
}

// ---------------------------------------------------------------------------
// Seite: Plugins
// ---------------------------------------------------------------------------
const pluginState = { q: "", filter: "all" };

function pageCustomList() {
    const q = pluginState.q.trim().toLowerCase();
    const own = (p: any) => p.name.startsWith("XJ");
    let list = Object.values(plugins).filter((p: any) => !p.hidden) as any[];
    list = list.filter(p => {
        const on = isPluginEnabled(p.name);
        switch (pluginState.filter) {
            case "on": if (!on) return false; break;
            case "off": if (on) return false; break;
            case "own": if (!own(p)) return false; break;
            case "fav": if (!Settings.plugins[p.name]?.isFavorite) return false; break;
        }
        if (!q) return true;
        return (p.name + " " + (p.description ?? "") + " " + (p.tags ?? []).join(" ")).toLowerCase().includes(q);
    });
    list.sort((a, b) => Number(own(b)) - Number(own(a)) || a.name.localeCompare(b.name));
    return list;
}

function pluginCard(p: any) {
    const on = isPluginEnabled(p.name);
    const st = Settings.plugins[p.name];
    const defs = p.settings?.def ?? p.options ?? {};
    const hasSettings = Object.entries(defs).some(([k, d]: [string, any]) => k !== "enabled" && !d.hidden);
    return h("div", { class: "xjm-card" + (on ? " on" : "") + (p.required ? " req" : "") },
        h("div", { class: "xjm-avatar", style: `--h:${hueOf(p.name)}` }, p.name[0]),
        h("div", { class: "xjm-card-main" },
            h("div", { class: "xjm-card-title" },
                h("b", {}, p.name),
                p.name.startsWith("XJ") ? h("span", { class: "xjm-tag own" }, "Eigenes") : null,
                restartNeeded.has(p.name) ? h("span", { class: "xjm-tag warn" }, "Neustart") : null,
                hotkeyFor(p.name) ? h("span", { class: "xjm-tag key", title: "Tastenkürzel" }, "⌨ " + formatCombo(hotkeyFor(p.name))) : null),
            h("p", {}, p.description ?? "")),
        h("div", { class: "xjm-card-side" },
            toggle(on, v => { setEnabled(p, v); redrawAll(); }, !!p.required),
            h("div", { class: "xjm-card-buttons" },
                h("button", { class: "xjm-iconbtn" + (st?.isFavorite ? " fav" : ""), title: "Favorit", onclick: () => { st.isFavorite = !st.isFavorite; redrawAll(); } }, icon("star", 16)),
                hasSettings ? h("button", { class: "xjm-iconbtn", title: "Einstellungen", onclick: () => openSettings(p) }, icon("gear", 16)) : null)));
}

function pagePlugins(redraw: () => void) {
    const list = pageCustomList();
    const chips: [string, string][] = [["all", "Alle"], ["on", "Aktiv"], ["off", "Inaktiv"], ["own", "Eigene"], ["fav", "Favoriten"]];
    const search = h("input", {
        class: "xjm-search-input", placeholder: "Plugin suchen …", value: pluginState.q,
        onkeydown: (e: any) => e.stopPropagation(),
        oninput: (e: any) => {
            pluginState.q = e.target.value;
            const pos = e.target.selectionStart;
            redraw();
            const s = document.querySelector<HTMLInputElement>(".xjm-search-input");
            s?.focus(); s?.setSelectionRange(pos, pos);
        }
    });
    return [
        pageHead("Plugins", `${Object.values(plugins).filter((p: any) => !p.hidden && isPluginEnabled(p.name)).length} von ${Object.values(plugins).filter((p: any) => !p.hidden).length} aktiv`, "plug"),
        restartBar(),
        h("div", { class: "xjm-search" }, icon("search", 18), search),
        h("div", { class: "xjm-chiprow" }, chips.map(([id, label]) =>
            h("button", { class: "xjm-filter" + (pluginState.filter === id ? " sel" : ""), onclick: () => { pluginState.filter = id; redraw(); } }, label))),
        list.length ? h("div", { class: "xjm-grid" }, list.map(pluginCard)) : h("div", { class: "xjm-empty" }, "Keine Plugins gefunden.")
    ];
}

// ---------------------------------------------------------------------------
// Seite: Themes
// ---------------------------------------------------------------------------
const themeState = { tab: "local", list: null as any[] | null, loading: false };

function pageThemes(redraw: () => void) {
    if (!themeState.list && !themeState.loading) {
        themeState.loading = true;
        VencordNative.themes.getThemesList().then(l => { themeState.list = l; themeState.loading = false; redraw(); })
            .catch(() => { themeState.list = []; themeState.loading = false; redraw(); });
    }
    const tabs: [string, string][] = [["local", "Lokale Themes"], ["online", "Online-Themes"], ["css", "Eigenes CSS"], ["design", "Designer"]];
    let content: Kid;
    if (themeState.tab === "local") {
        const enabled = new Set(Settings.enabledThemes);
        content = [
            h("div", { class: "xjm-row-actions" },
                h("button", { class: "xjm-btn", onclick: () => VencordNative.themes.openFolder() }, icon("folder", 16), "Themes-Ordner öffnen"),
                h("button", { class: "xjm-btn ghost", onclick: () => { themeState.list = null; redraw(); } }, icon("restart", 16), "Neu laden")),
            !themeState.list ? h("div", { class: "xjm-empty" }, "Lade Themes …")
                : !themeState.list.length ? h("div", { class: "xjm-empty" }, "Noch keine Themes. Leg .css-Dateien in den Themes-Ordner und klick auf „Neu laden“.")
                    : h("div", { class: "xjm-grid" }, themeState.list.map(t => {
                        const on = enabled.has(t.fileName);
                        return h("div", { class: "xjm-card" + (on ? " on" : "") },
                            h("div", { class: "xjm-avatar", style: `--h:${hueOf(t.name || t.fileName)}` }, (t.name || t.fileName)[0]),
                            h("div", { class: "xjm-card-main" },
                                h("div", { class: "xjm-card-title" }, h("b", {}, t.name || t.fileName), t.version ? h("span", { class: "xjm-tag" }, "v" + t.version) : null),
                                h("p", {}, t.description || "Keine Beschreibung"),
                                t.author ? h("small", {}, "von " + t.author) : null),
                            h("div", { class: "xjm-card-side" },
                                toggle(on, v => {
                                    Settings.enabledThemes = v ? [...Settings.enabledThemes, t.fileName] : Settings.enabledThemes.filter(f => f !== t.fileName);
                                    redraw();
                                })));
                    }))
        ];
    } else if (themeState.tab === "online") {
        const ta = h("textarea", { class: "xjm-input code", rows: 7, value: (Settings.themeLinks ?? []).join("\n"),
            placeholder: "https://raw.githubusercontent.com/…/theme.css\nEin Link pro Zeile", onkeydown: (e: any) => e.stopPropagation() }) as HTMLTextAreaElement;
        content = [
            h("p", { class: "xjm-hint" }, "Lade Themes direkt aus dem Internet – ein Link pro Zeile, am besten direkte Links (raw oder github.io)."),
            ta,
            h("div", { class: "xjm-row-actions" }, h("button", { class: "xjm-btn", onclick: () => {
                Settings.themeLinks = [...new Set(ta.value.split("\n").map(s => s.trim()).filter(Boolean))];
                toast("✓ Online-Themes gespeichert");
            } }, "Speichern"))
        ];
    } else if (themeState.tab === "css") {
        content = [
            h("div", { class: "xjm-list" },
                optRow("Eigenes CSS aktiv", "Dein CSS wird nach allen Themes geladen", Settings.useQuickCss, v => { Settings.useQuickCss = v; })),
            h("div", { class: "xjm-row-actions" },
                h("button", { class: "xjm-btn", onclick: () => VencordNative.quickCss.openEditor() }, icon("code", 16), "CSS-Editor öffnen"))
        ];
    } else {
        const design = plugins.XJDesign;
        content = design ? [
            h("p", { class: "xjm-hint" }, "Dein xImJxstinn-Designer: Presets, Akzentfarbe, Hintergrundbild, Schrift und Rundungen."),
            h("div", { class: "xjm-list" }, h("div", { class: "xjm-opt" },
                h("div", { class: "xjm-opt-text" }, h("b", {}, "Designer aktiv"), h("span", {}, "Eigenes Farbschema über Discord legen")),
                toggle(isPluginEnabled("XJDesign"), v => { setEnabled(design, v); redraw(); }))),
            h("div", { class: "xjm-row-actions" }, h("button", { class: "xjm-btn", onclick: () => openSettings(design) }, icon("brush", 16), "Designer einstellen"))
        ] : h("div", { class: "xjm-empty" }, "Designer nicht gefunden.");
    }
    return [
        pageHead("Themes", "Lokale Themes, Online-Themes, eigenes CSS und dein Designer", "brush"),
        h("div", { class: "xjm-tabs" }, tabs.map(([id, label]) =>
            h("button", { class: "xjm-tab" + (themeState.tab === id ? " sel" : ""), onclick: () => { themeState.tab = id; redraw(); } }, label))),
        h("div", { class: "xjm-tabbody" }, content)
    ];
}

// ---------------------------------------------------------------------------
// Seite: Updates
// ---------------------------------------------------------------------------
const updState = { checking: false, updating: false, checked: false, error: "" };

function pageUpdater(redraw: () => void) {
    const check = async () => {
        updState.checking = true; updState.error = ""; redraw();
        try { await Updater.checkForUpdates(); updState.checked = true; } catch (e) { updState.error = String(e); }
        updState.checking = false; redraw();
    };
    const doUpdate = async () => {
        updState.updating = true; redraw();
        try {
            if (await Updater.update()) {
                if (confirm("Update installiert! Discord jetzt neu starten?")) relaunch();
            }
        } catch (e) { updState.error = String(e); }
        updState.updating = false; redraw();
    };
    const changes = (Updater.changes ?? []) as any[];
    const status = updState.error ? "Fehler: " + updState.error
        : Updater.isOutdated ? `${changes.length || "Ein"} Update${changes.length === 1 ? "" : "s"} verfügbar`
            : updState.checked ? "Du bist auf dem neuesten Stand" : "Noch nicht geprüft";

    return [
        pageHead("Updates", "Neue Versionen kommen automatisch von GitHub", "update"),
        h("div", { class: "xjm-update-card" + (Updater.isOutdated ? " warn" : "") },
            h("div", { class: "xjm-update-ring" }, icon(Updater.isOutdated ? "download" : "update", 30)),
            h("div", { class: "xjm-update-text" }, h("b", {}, "Version " + gitHash), h("span", {}, status)),
            Updater.isOutdated
                ? h("button", { class: "xjm-btn", disabled: updState.updating, onclick: doUpdate }, updState.updating ? "Installiere …" : "Jetzt updaten")
                : h("button", { class: "xjm-btn", disabled: updState.checking, onclick: check }, updState.checking ? "Prüfe …" : "Nach Updates suchen")),
        changes.length ? h("div", { class: "xjm-changes" }, h("h3", { class: "xjm-section" }, "Neu"),
            changes.map(c => h("div", { class: "xjm-change" }, h("code", {}, c.hash), h("span", {}, c.message)))) : null,
        h("h3", { class: "xjm-section" }, "Einstellungen"),
        h("div", { class: "xjm-list" },
            optRow("Automatisch updaten", "Updates ohne Nachfrage installieren", Settings.autoUpdate, v => { Settings.autoUpdate = v; }),
            optRow("Nach Update benachrichtigen", "Kurzer Hinweis, wenn ein Update installiert wurde", Settings.autoUpdateNotification, v => { Settings.autoUpdateNotification = v; }))
    ];
}

// ---------------------------------------------------------------------------
// Seite: Backup
// ---------------------------------------------------------------------------
function pageBackup() {
    const card = (ic: string, title: string, text: string, btn: string, fn: () => void) =>
        h("div", { class: "xjm-bigcard" },
            h("div", { class: "xjm-bigcard-icon" }, icon(ic, 28)),
            h("b", {}, title), h("span", {}, text),
            h("button", { class: "xjm-btn", onclick: fn }, btn));
    return [
        pageHead("Backup", "Einstellungen sichern und wiederherstellen", "backup"),
        h("div", { class: "xjm-twocol" },
            card("download", "Backup speichern", "Speichert Plugins, deren Einstellungen, Themes und dein CSS in einer Datei.", "Backup speichern", () => downloadSettingsBackup()),
            card("upload", "Backup laden", "Lädt eine Backup-Datei. Deine aktuellen Einstellungen werden dabei ersetzt.", "Datei auswählen …", () => uploadSettingsBackup())),
        h("p", { class: "xjm-hint" }, "Tipp: Mach ein Backup, bevor du viel ausprobierst – dann kannst du jederzeit zurück.")
    ];
}

// ---------------------------------------------------------------------------
// Seite: Tastenkürzel
// ---------------------------------------------------------------------------
function hotkeyFor(plugin: string) {
    return getPluginBind(plugin);
}

function startRecording(id: string, redraw: () => void) {
    recording.active = true;
    const btn = [...document.querySelectorAll<HTMLElement>("[data-rec]")].find(b => b.dataset.rec === id);
    if (btn) { btn.classList.add("rec"); btn.textContent = "Taste drücken …"; }
    const onKey = (e: KeyboardEvent) => {
        if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return;
        e.preventDefault(); e.stopPropagation();
        window.removeEventListener("keydown", onKey, true);
        recording.active = false;
        if (e.key === "Escape") { redraw(); return; }
        if (e.key === "Backspace" || e.key === "Delete") { setBind(id, null); redraw(); return; }
        const parts: string[] = [];
        if (e.ctrlKey) parts.push("ctrl");
        if (e.altKey) parts.push("alt");
        if (e.shiftKey) parts.push("shift");
        const key = e.code?.startsWith("Key") ? e.code.slice(3).toLowerCase()
            : e.code?.startsWith("Digit") ? e.code.slice(5) : e.key.toLowerCase();
        parts.push(key === " " ? "space" : key);
        if (parts.length === 1 && !/^f\d+$/.test(key)) {
            toast("Bitte mit Strg, Alt oder Shift kombinieren (oder eine F-Taste nehmen)");
            redraw();
            return;
        }
        setBind(id, parts.join("+"));
        toast("⌨ Kürzel gespeichert: " + formatCombo(parts.join("+")));
        redraw();
    };
    window.addEventListener("keydown", onKey, true);
}

function openCustomEditor(existing: CustomHotkey | null, redraw: () => void) {
    const c: CustomHotkey = existing ? { ...existing } : { id: newCustomId(), type: "text", label: "" };
    if (c.type === "plugin") c.type = "setting";
    const ov = h("div", { class: "xjm-overlay" });
    const close = () => { ov.remove(); document.removeEventListener("keydown", esc, true); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !recording.active) { e.stopPropagation(); close(); } };
    document.addEventListener("keydown", esc, true);
    ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
    const body = h("div", { class: "xjm-dialog-body" });
    const stop = (e: any) => e.stopPropagation();

    const allPlugins = Object.values(plugins).filter((p: any) => !p.hidden && !p.required).map((p: any) => p.name).sort();
    const boolSettings = (name?: string) => Object.entries((name && (plugins[name]?.settings?.def ?? plugins[name]?.options)) || {})
        .filter(([k, d]: [string, any]) => k !== "enabled" && d.type === 3 && !d.hidden).map(([k, d]: [string, any]) => ({ key: k, desc: d.description ?? "" }));

    const field = (label: string, ctl: HTMLElement, hint?: string) =>
        h("div", { class: "xjm-field" }, h("b", {}, label), ctl, hint ? h("span", {}, hint) : null);

    const draw = () => {
        const type = CUSTOM_TYPES.find(t => t.type === c.type)!;
        const fields: Kid[] = [];
        if (c.type === "plugin" || c.type === "setting") {
            fields.push(field("Plugin", h("select", { class: "xjm-input", onchange: (e: any) => { c.plugin = e.target.value; c.setting = undefined; draw(); } },
                h("option", { value: "" }, "Plugin auswählen …"),
                allPlugins.map(n => h("option", { value: n, selected: c.plugin === n }, n)))));
        }
        if (c.type === "setting" && c.plugin) {
            const opts = boolSettings(c.plugin);
            fields.push(opts.length
                ? field("Einstellung", h("select", { class: "xjm-input", onchange: (e: any) => { c.setting = e.target.value; } },
                    h("option", { value: "" }, "Einstellung auswählen …"),
                    opts.map(o => h("option", { value: o.key, selected: c.setting === o.key }, o.key + (o.desc ? " – " + o.desc.slice(0, 60) : "")))))
                : h("div", { class: "xjm-empty small" }, "Dieses Plugin hat keine Ja/Nein-Einstellungen."));
        }
        if (c.type === "text") fields.push(field("Text", h("textarea", { class: "xjm-input", rows: 3, value: c.text ?? "", placeholder: "z. B. Ich bin jetzt live: https://twitch.tv/…", onkeydown: stop, oninput: (e: any) => { c.text = e.target.value; } })));
        if (c.type === "link") fields.push(field("Link", h("input", { class: "xjm-input", value: c.url ?? "", placeholder: "https://…", onkeydown: stop, oninput: (e: any) => { c.url = e.target.value; } })));
        if (c.type === "channel") fields.push(field("Kanal-Link", h("input", { class: "xjm-input", value: c.url ?? "", placeholder: "https://discord.com/channels/…", onkeydown: stop, oninput: (e: any) => { c.url = e.target.value; } }), "In Discord: Rechtsklick auf den Kanal → „Link kopieren“"));
        if (c.type === "css") fields.push(field("CSS", h("textarea", { class: "xjm-input code", rows: 6, value: c.css ?? "", placeholder: "/* z. B. */\n[class*=\"membersWrap\"] { display: none !important; }", onkeydown: stop, oninput: (e: any) => { c.css = e.target.value; } })));

        const save = () => {
            if ((c.type === "plugin" || c.type === "setting") && !c.plugin) return toast("Bitte ein Plugin auswählen");
            if (c.type === "setting" && !c.setting) return toast("Bitte eine Einstellung auswählen");
            if (c.type === "text" && !c.text?.trim()) return toast("Bitte einen Text eingeben");
            if (c.type === "link" && !/^https?:\/\//i.test(c.url ?? "")) return toast("Der Link muss mit https:// beginnen");
            if (c.type === "channel" && !channelPath(c.url)) return toast("Das ist kein Discord-Kanal-Link");
            if (c.type === "css" && !c.css?.trim()) return toast("Bitte CSS eingeben");
            if (!c.label.trim()) {
                c.label = c.type === "plugin" ? `${c.plugin} an/aus`
                    : c.type === "setting" ? `${c.plugin}: ${c.setting} umschalten`
                        : type.label;
            }
            saveCustomHotkey(c);
            close();
            redraw();
            toast(existing ? "✓ Kürzel gespeichert" : "✓ Kürzel erstellt – jetzt Taste festlegen");
        };

        body.replaceChildren(h("div", { class: "xjm-dialog-inner" }, [
            h("div", { class: "xjm-dialog-head" },
                h("div", { class: "xjm-hk-icon big" }, icon("keyboard", 22)),
                h("div", { class: "xjm-dialog-title" }, h("h2", {}, existing ? "Kürzel bearbeiten" : "Neues Tastenkürzel"), h("p", {}, type.hint)),
                h("button", { class: "xjm-iconbtn", title: "Schließen", onclick: close }, icon("close", 18))),
            h("div", { class: "xjm-typegrid" }, CUSTOM_TYPES.filter(t => t.type !== "plugin").map(t =>
                h("button", { class: "xjm-typebtn" + (c.type === t.type ? " sel" : ""), onclick: () => { c.type = t.type; draw(); } }, t.label))),
            field("Name (optional)", h("input", { class: "xjm-input", value: c.label, placeholder: "z. B. Twitch-Link posten", onkeydown: stop, oninput: (e: any) => { c.label = e.target.value; } })),
            fields,
            h("div", { class: "xjm-row-actions end" },
                h("button", { class: "xjm-btn ghost", onclick: close }, "Abbrechen"),
                h("button", { class: "xjm-btn", onclick: save }, existing ? "Speichern" : "Erstellen"))
        ]));
    };
    draw();
    ov.append(h("div", { class: "xjm-dialog" }, body));
    document.body.append(ov);
}

const hkState = { q: "" };

function pageHotkeys(redraw: () => void) {
    const binds = getBinds();
    const hk = Settings.plugins.XJHotkeys as any;
    const hkOn = isPluginEnabled("XJHotkeys");
    const pluginKeys = getPluginHotkeys().filter(c => plugins[c.plugin!]);
    const assigned = new Set(pluginKeys.map(c => c.plugin));
    const others = getActions().filter(a => a.custom && a.custom.type !== "plugin");

    const pluginRow = (c: CustomHotkey) => {
        const name = c.plugin!;
        const p: any = plugins[name];
        const on = isPluginEnabled(name);
        const combo = binds[c.id];
        return h("div", { class: "xjm-hk" + (combo ? " set" : "") },
            h("div", { class: "xjm-avatar", style: `--h:${hueOf(name)}` }, name[0]),
            h("div", { class: "xjm-opt-text" },
                h("b", {}, name),
                h("span", {}, p?.description ?? ""),
                h("div", { class: "xjm-hk-meta" },
                    h("span", { class: "xjm-tag" + (on ? " ok" : "") }, on ? "an" : "aus"),
                    canToggleLive(name) ? null : h("span", { class: "xjm-tag warn" }, "lädt neu"))),
            h("div", { class: "xjm-hk-side" },
                toggle(on, v => { setEnabled(p, v); redraw(); }),
                h("button", { class: "xjm-key" + (combo ? "" : " empty"), "data-rec": c.id, title: "Klicken und neue Taste drücken (Entf = löschen, Esc = abbrechen)",
                    onclick: () => startRecording(c.id, redraw) }, combo ? formatCombo(combo) : "Taste festlegen"),
                h("button", { class: "xjm-iconbtn", title: "Entfernen", onclick: () => { removePluginHotkey(name); redraw(); } }, icon("trash", 15))));
    };

    const otherRow = (a: any) => {
        const combo = binds[a.id];
        const ic = ({ setting: "gear", text: "code", link: "star", channel: "home", css: "brush" } as any)[a.custom.type] ?? "keyboard";
        return h("div", { class: "xjm-hk custom" + (combo ? " set" : "") },
            h("div", { class: "xjm-hk-icon" }, icon(ic, 18)),
            h("div", { class: "xjm-opt-text" }, h("b", {}, a.label), h("span", {}, a.description)),
            h("div", { class: "xjm-hk-side" },
                h("button", { class: "xjm-key" + (combo ? "" : " empty"), "data-rec": a.id, onclick: () => startRecording(a.id, redraw) }, combo ? formatCombo(combo) : "Taste festlegen"),
                h("button", { class: "xjm-iconbtn", title: "Bearbeiten", onclick: () => openCustomEditor(a.custom, redraw) }, icon("gear", 15)),
                h("button", { class: "xjm-iconbtn", title: "Löschen", onclick: () => { if (confirm(`„${a.label}“ löschen?`)) { deleteCustomHotkey(a.id); redraw(); } } }, icon("trash", 15))));
    };

    // Plugin hinzufügen: Suche über alle Plugins
    const q = hkState.q.trim().toLowerCase();
    const candidates = (Object.values(plugins) as any[])
        .filter(p => !p.hidden && !p.required && !assigned.has(p.name) && p.name !== "XJHotkeys")
        .filter(p => !q || (p.name + " " + (p.description ?? "")).toLowerCase().includes(q))
        .sort((x, y) => x.name.localeCompare(y.name))
        .slice(0, q ? 12 : 0);
    const search = h("input", {
        class: "xjm-search-input", placeholder: "Plugin suchen und Kürzel hinzufügen …", value: hkState.q,
        onkeydown: (e: any) => e.stopPropagation(),
        oninput: (e: any) => {
            hkState.q = e.target.value;
            const pos = e.target.selectionStart;
            redraw();
            const s = document.querySelector<HTMLInputElement>(".xjm-hkadd .xjm-search-input");
            s?.focus(); s?.setSelectionRange(pos, pos);
        }
    });

    return [
        pageHead("Tastenkürzel", "Plugins per Taste an- und ausschalten", "keyboard"),
        !hkOn ? h("div", { class: "xjm-restart" }, icon("keyboard", 18),
            h("div", {}, h("b", {}, "Tastenkürzel sind aus"), h("span", {}, "Das Plugin XJHotkeys ist deaktiviert.")),
            h("button", { class: "xjm-btn", onclick: () => { const p = plugins.XJHotkeys; if (p) { startPlugin(p); Settings.plugins.XJHotkeys.enabled = true; } redraw(); } }, "Einschalten")) : null,

        h("div", { class: "xjm-hkadd" },
            h("div", { class: "xjm-search" }, icon("search", 18), search),
            candidates.length ? h("div", { class: "xjm-suggest" }, candidates.map(p =>
                h("button", { class: "xjm-suggest-item", onclick: () => {
                    const id = ensurePluginHotkey(p.name);
                    hkState.q = "";
                    redraw();
                    setTimeout(() => startRecording(id, redraw), 30);
                } },
                    h("div", { class: "xjm-avatar small", style: `--h:${hueOf(p.name)}` }, p.name[0]),
                    h("b", {}, p.name),
                    canToggleLive(p.name) ? null : h("span", { class: "xjm-tag warn" }, "lädt neu"),
                    h("span", { class: "xjm-suggest-plus" }, icon("plus", 16))))) : null),

        h("p", { class: "xjm-hint" }, "Kürzel drücken = Plugin an/aus. Plugins mit „lädt neu“ brauchen einen Neustart – Discord lädt dann automatisch kurz neu. Tipp: Das Kürzel kannst du auch direkt im ⚙-Dialog jedes Plugins festlegen."),
        pluginKeys.length ? h("div", { class: "xjm-hklist" }, pluginKeys.map(pluginRow))
            : h("div", { class: "xjm-empty" }, "Noch keine Plugin-Kürzel. Such oben ein Plugin und füg es hinzu."),

        h("h3", { class: "xjm-section" }, "Weitere Kürzel"),
        others.length ? h("div", { class: "xjm-hklist" }, others.map(otherRow)) : null,
        h("button", { class: "xjm-btn ghost", onclick: () => openCustomEditor(null, redraw) }, icon("plus", 16), "Text, Link, Kanal oder CSS per Taste"),

        h("h3", { class: "xjm-section" }, "Einstellungen"),
        h("div", { class: "xjm-list" },
            optRow("Automatisch neu laden", "Wenn ein Plugin einen Neustart braucht, lädt Discord sich selbst neu", hk?.autoReload !== false, v => { hk.autoReload = v; }),
            optRow("Meldung beim Benutzen anzeigen", "Kurzer Hinweis unten, z. B. „ShowHiddenChannels aus“", hk?.showToasts !== false, v => { hk.showToasts = v; }))
    ];
}

// ---------------------------------------------------------------------------
// Einbindung in die Discord-Einstellungen
// ---------------------------------------------------------------------------
const RENDER: Record<string, (redraw: () => void) => Kid> = {
    main: () => pageMain(),
    plugins: redraw => pagePlugins(redraw),
    themes: redraw => pageThemes(redraw),
    updater: redraw => pageUpdater(redraw),
    backup: () => pageBackup(),
    hotkeys: redraw => pageHotkeys(redraw)
};

function mount(el: HTMLElement, page: string) {
    ensureStyle();
    let first = true;
    const draw = () => {
        const scroll = el.closest("[class*='scroller']")?.scrollTop;
        let content: Kid;
        try { content = RENDER[page](draw); } catch (e) {
            console.error("[xImJxstinnCord] Fehler im Menü", e);
            content = h("div", { class: "xjm-empty" }, "Hier ist etwas schiefgelaufen: " + String(e));
        }
        // Einblende-Animation nur beim ersten Öffnen, nicht bei jedem Klick
        el.replaceChildren(h("div", { class: first ? "xjm intro" : "xjm" }, content));
        first = false;
        const sc = el.closest("[class*='scroller']");
        if (sc && scroll != null) sc.scrollTop = scroll;
    };
    draw();
    views.add(draw);
    return () => { views.delete(draw); };
}

function makePage(page: string) {
    return function XJPage() {
        const ref = React.useRef<HTMLDivElement>(null);
        React.useEffect(() => (ref.current ? mount(ref.current, page) : undefined), []);
        return React.createElement("div", { ref, className: "xjm-mount" });
    };
}

export const XJPages = {
    main: makePage("main"),
    plugins: makePage("plugins"),
    themes: makePage("themes"),
    updater: makePage("updater"),
    backup: makePage("backup"),
    hotkeys: makePage("hotkeys"),
    /** Icon für den Eintrag in der Seitenleiste */
    hotkeysIcon: (props: any) => React.createElement("svg", { viewBox: "0 0 24 24", width: 20, height: 20, ...props },
        React.createElement("path", { fill: "currentColor", d: ICON.keyboard }))
};
