// xImJxstinnCord – Renderer (läuft direkt in Discord)
// Menü: Discord-Einstellungen → xImJxstinnCord  (oder Strg + Shift + X)
(() => {
    "use strict";
    if (window.__XJCORD__) return;
    window.__XJCORD__ = true;

    const N = window.XJNative;
    if (!N) return console.error("[xImJxstinnCord] Native-Brücke fehlt");
    const LOG = (...a) => console.log("%c[xImJxstinnCord]", "color:#9146ff;font-weight:bold", ...a);

    // =======================================================================
    // Einstellungen
    // =======================================================================
    const DEFAULTS = {
        plugins: {},
        themes: {
            enabled: [],
            links: [],
            quickCss: "",
            quickCssEnabled: true,
            designer: { enabled: true, preset: "twitch", accent: "", gradient: true, bg: "", opacity: 80, blur: 4, font: "standard", round: 12, glow: true }
        },
        autoUpdate: true,
        settingsEntry: true,
        hotkey: true,
        welcomed: false
    };

    function merge(def, val) {
        if (typeof def !== "object" || def === null || Array.isArray(def)) return val === undefined ? def : val;
        const out = {};
        const v = val && typeof val === "object" && !Array.isArray(val) ? val : {};
        for (const k of new Set([...Object.keys(def), ...Object.keys(v)])) out[k] = k in def ? merge(def[k], v[k]) : v[k];
        return out;
    }

    let raw = {};
    try { raw = JSON.parse(N.getSettings() || "{}"); } catch { }

    // Einstellungen aus Version 1.0 übernehmen
    if (raw.theme && !raw.themes) {
        raw.themes = { designer: raw.theme, quickCss: raw.customCss || "" };
        raw.plugins = {
            ...(raw.plugins || {}),
            TwitchLive: { enabled: !!raw.twitch?.enabled, channel: raw.twitch?.channel || "", showViewers: raw.twitch?.showViewers !== false, pos: raw.twitch?.pos || null },
            StreamerBlur: { enabled: !!raw.streamerBlur },
            NoAds: { enabled: raw.hideNitro !== false },
            HideTyping: { enabled: !!raw.hideTyping },
            CompactServers: { enabled: !!raw.compactServers },
            WindowTools: { enabled: !!raw.alwaysOnTop || (raw.windowOpacity ?? 100) < 100, alwaysOnTop: !!raw.alwaysOnTop, opacity: raw.windowOpacity ?? 100 },
            DevTools: { enabled: raw.devtools !== false }
        };
        for (const k of ["theme", "customCss", "twitch", "streamerBlur", "hideNitro", "hideTyping", "compactServers", "alwaysOnTop", "windowOpacity", "devtools"]) delete raw[k];
    }

    let S = merge(DEFAULTS, raw);

    let saveTimer;
    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { try { N.setSettings(JSON.stringify(S, null, 2)); } catch (e) { console.error(e); } }, 250);
    }

    // =======================================================================
    // Helfer
    // =======================================================================
    const h = (tag, props = {}, ...kids) => {
        const el = document.createElement(tag);
        for (const [k, v] of Object.entries(props || {})) {
            if (v == null) continue;
            if (k === "class") el.className = v;
            else if (k === "style") el.style.cssText = v;
            else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
            else if (k in el) el[k] = v;
            else el.setAttribute(k, v);
        }
        for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c);
        return el;
    };

    function styleTag(id, css) {
        let s = document.getElementById(id);
        if (css == null || css === "") { s?.remove(); return; }
        if (!s) { s = h("style", { id }); document.head.append(s); }
        if (s.textContent !== css) s.textContent = css;
    }

    function normHex(x) {
        x = (x || "").trim().replace(/^#/, "");
        if (/^[0-9a-f]{3}$/i.test(x)) x = x.split("").map(c => c + c).join("");
        return /^[0-9a-f]{6}$/i.test(x) ? "#" + x.toLowerCase() : null;
    }
    const rgb = x => [0, 2, 4].map(i => parseInt(x.slice(1 + i, 3 + i), 16));
    const rgba = (x, a) => { const [r, g, b] = rgb(x); return `rgba(${r}, ${g}, ${b}, ${a})`; };
    const shade = (x, amt) => "#" + rgb(x).map(c => {
        const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
        return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
    }).join("");
    const cssUrl = u => String(u).trim().replace(/["\\\n\r]/g, encodeURIComponent);

    function toast(text, ms = 3500) {
        const t = h("div", { class: "xj-toast" }, text);
        document.body.append(t);
        requestAnimationFrame(() => t.classList.add("show"));
        setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms);
    }

    // Ein gemeinsamer, gedrosselter DOM-Beobachter für alles
    const domListeners = new Set();
    let domPending = false;
    function onDom(fn) { domListeners.add(fn); return () => domListeners.delete(fn); }
    function startDomObserver() {
        new MutationObserver(() => {
            if (domPending) return;
            domPending = true;
            setTimeout(() => {
                domPending = false;
                for (const fn of domListeners) { try { fn(); } catch (e) { console.error(e); } }
            }, 250);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // Tastenkürzel-Registry
    const keybinds = new Set();
    window.addEventListener("keydown", e => {
        if (typeof e.key !== "string") return; // z. B. Autofill-Events ohne Taste
        if (e.key === "Escape" && overlays.length && closeTopOverlay()) { e.stopPropagation(); e.preventDefault(); return; }
        if (!e.ctrlKey && !e.altKey) return;
        for (const kb of keybinds) {
            if (kb.ctrl === e.ctrlKey && kb.shift === e.shiftKey && kb.alt === !!e.altKey && e.key.toLowerCase() === kb.key) {
                e.preventDefault(); e.stopPropagation();
                try { kb.fn(e); } catch (err) { console.error(err); }
                return;
            }
        }
    }, true);
    function addKeybind(combo, fn) {
        const parts = combo.toLowerCase().split("+").map(s => s.trim());
        const kb = { ctrl: parts.includes("ctrl") || parts.includes("strg"), shift: parts.includes("shift"), alt: parts.includes("alt"), key: parts[parts.length - 1], fn };
        keybinds.add(kb);
        return () => keybinds.delete(kb);
    }

    // =======================================================================
    // Zugriff auf Discords interne Module (Stores) – für Plugins wie ShowHiddenChannels
    // =======================================================================
    const WP = (() => {
        let req = null;
        const cache = {};
        function getReq() {
            if (req) return req;
            const chunk = window.webpackChunkdiscord_app;
            if (!chunk || typeof chunk.push !== "function") return null;
            try {
                chunk.push([[Symbol("xjcord")], {}, r => { req = r; }]);
                chunk.pop();
            } catch (e) { console.error("[xImJxstinnCord] Webpack-Zugriff fehlgeschlagen", e); }
            return req;
        }
        function* allExports() {
            const r = getReq();
            if (!r || !r.c) return;
            for (const id in r.c) {
                const m = r.c[id] && r.c[id].exports;
                if (!m || m === window || m === document) continue;
                yield m;
                if (typeof m === "object" || typeof m === "function") {
                    for (const k in m) {
                        let v; try { v = m[k]; } catch { continue; }
                        if (v && v !== m && (typeof v === "object" || typeof v === "function")) yield v;
                    }
                }
            }
        }
        function findStore(name) {
            if (cache[name]) return cache[name];
            for (const v of allExports()) {
                try {
                    if (typeof v.getName === "function" && typeof v.addChangeListener === "function" && v.getName() === name) return (cache[name] = v);
                } catch { }
            }
            return null;
        }
        function findByProps(...props) {
            for (const v of allExports()) {
                try { if (props.every(p => p in v)) return v; } catch { }
            }
            return null;
        }
        function waitFor(fn, timeout = 90000) {
            return new Promise((resolve, reject) => {
                const t0 = Date.now();
                const tick = () => {
                    let v = null;
                    try { v = fn(); } catch { }
                    if (v) return resolve(v);
                    if (Date.now() - t0 > timeout) return reject(new Error("Discord-Modul nicht gefunden – Discord hat sich vermutlich verändert"));
                    setTimeout(tick, 750);
                };
                tick();
            });
        }
        return { get req() { return getReq(); }, findStore, findByProps, waitFor, waitForStore: n => waitFor(() => findStore(n)) };
    })();

    // React-Props eines DOM-Elements nach oben durchsuchen
    function reactFind(el, pick, depth = 15) {
        if (!el) return null;
        const key = Object.keys(el).find(k => k.startsWith("__reactFiber$"));
        let f = key ? el[key] : null;
        for (let i = 0; f && i < depth; i++, f = f.return) {
            const p = f.memoizedProps;
            if (p && typeof p === "object") {
                try { const v = pick(p); if (v) return v; } catch { }
            }
        }
        return null;
    }

    const currentGuildId = () => { const g = location.pathname.split("/")[2]; return g && g !== "@me" ? g : null; };
    const currentChannelId = () => location.pathname.split("/")[3] || null;

    // =======================================================================
    // Plugin-System
    // =======================================================================
    const plugins = new Map();
    let started = false;

    function pluginStore(id) {
        if (!S.plugins[id] || typeof S.plugins[id] !== "object") S.plugins[id] = {};
        return S.plugins[id];
    }

    function definePlugin(def) {
        if (!def || typeof def !== "object" || !/^[A-Za-z0-9_-]{2,40}$/.test(def.id || "")) {
            console.error("[xImJxstinnCord] Ungültiges Plugin (id fehlt oder falsch):", def);
            return;
        }
        if (plugins.has(def.id)) {
            console.error("[xImJxstinnCord] Plugin-ID doppelt:", def.id);
            return;
        }
        const builtin = !!def.__builtin;
        const entry = { def, builtin, file: builtin ? null : (XJ.__loadingFile || "?"), running: false, error: null, ctx: null };
        plugins.set(def.id, entry);

        // Standardwerte setzen
        const st = pluginStore(def.id);
        if (typeof st.enabled !== "boolean") st.enabled = !!def.enabledByDefault;
        for (const [k, o] of Object.entries(def.settings || {})) if (!(k in st)) st[k] = o.default;

        if (started && st.enabled) startPlugin(def.id);
        return def;
    }

    function makeCtx(entry) {
        const id = entry.def.id;
        const cleanups = [];
        const styleId = "xj-plugin-" + id;
        const ctx = {
            id,
            active: true,
            webpack: WP,
            react: reactFind,
            get settings() { return pluginStore(id); },
            save,
            css(text) { styleTag(styleId, text || ""); },
            onCleanup(fn) { cleanups.push(fn); },
            interval(fn, ms) { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); return t; },
            timeout(fn, ms) { const t = setTimeout(fn, ms); cleanups.push(() => clearTimeout(t)); return t; },
            listen(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); cleanups.push(() => target.removeEventListener(ev, fn, opts)); },
            onDom(fn) { cleanups.push(onDom(fn)); },
            keybind(combo, fn) { cleanups.push(addKeybind(combo, fn)); },
            element(el) { cleanups.push(() => el.remove()); return el; },
            toast,
            h,
            native: { twitch: N.twitch, setWindow: N.setWindow, toggleDevTools: N.toggleDevTools, openExternal: N.openExternal },
            __cleanup() {
                ctx.active = false;
                while (cleanups.length) { try { cleanups.pop()(); } catch (e) { console.error(e); } }
                styleTag(styleId, "");
            }
        };
        return ctx;
    }

    function applyPluginCss(entry) {
        if (!entry.running || !entry.def.css) return;
        try {
            const css = typeof entry.def.css === "function" ? entry.def.css(pluginStore(entry.def.id)) : entry.def.css;
            entry.ctx.css(css);
        } catch (e) { console.error(e); }
    }

    function startPlugin(id) {
        const entry = plugins.get(id);
        if (!entry || entry.running) return;
        entry.error = null;
        entry.ctx = makeCtx(entry);
        entry.running = true;
        try {
            applyPluginCss(entry);
            const r = entry.def.start?.(entry.ctx);
            if (r && typeof r.then === "function") {
                const ctxAtStart = entry.ctx;
                r.catch(e => {
                    if (entry.ctx !== ctxAtStart) return;
                    entry.error = String(e && e.message || e);
                    console.error("[xImJxstinnCord] Plugin-Fehler:", id, e);
                    rerenderAll();
                });
            }
        } catch (e) {
            entry.error = String(e && e.message || e);
            console.error("[xImJxstinnCord] Plugin-Fehler beim Start:", id, e);
            stopPlugin(id, true);
            entry.error = String(e && e.message || e);
            toast("⚠️ Plugin " + (entry.def.name || id) + " hatte einen Fehler");
        }
    }

    function stopPlugin(id, silent) {
        const entry = plugins.get(id);
        if (!entry || !entry.running) return;
        try { entry.def.stop?.(entry.ctx); } catch (e) { if (!silent) console.error(e); }
        entry.ctx?.__cleanup();
        entry.ctx = null;
        entry.running = false;
    }

    function setPluginEnabled(id, on) {
        pluginStore(id).enabled = on;
        save();
        on ? startPlugin(id) : stopPlugin(id);
    }

    function pluginSettingChanged(id, key) {
        save();
        const entry = plugins.get(id);
        if (!entry || !entry.running) return;
        const o = entry.def.settings?.[key];
        if (entry.def.onSettingChange) {
            try { entry.def.onSettingChange(entry.ctx, key); } catch (e) { console.error(e); }
            applyPluginCss(entry);
        } else if (o && o.restart === false) {
            applyPluginCss(entry);
        } else {
            stopPlugin(id); startPlugin(id);
        }
    }

    const XJ = window.XJ = {
        version: N.version,
        definePlugin,
        h, toast,
        webpack: WP,
        react: reactFind,
        __loadingFile: null,
        __pluginLoadError(file, e) { console.error("[xImJxstinnCord] Plugin-Datei", file, e); userPluginErrors.push({ file, error: String(e && e.message || e) }); }
    };
    const userPluginErrors = [];

    // =======================================================================
    // Eingebaute Plugins
    // =======================================================================
    const builtin = def => definePlugin({ ...def, __builtin: true });

    builtin({
        id: "TwitchLive",
        name: "Twitch-Live-Anzeige",
        description: "Abzeichen mit LIVE-Status, Laufzeit und Zuschauern deines Twitch-Kanals. Klick öffnet den Kanal, ziehen verschiebt es.",
        tags: ["Streamer"],
        settings: {
            channel: { type: "string", label: "Twitch-Kanal", placeholder: "dein-twitch-name", default: "" },
            showViewers: { type: "boolean", label: "Zuschauerzahl anzeigen", default: true },
            interval: { type: "slider", label: "Aktualisieren alle", min: 30, max: 300, step: 30, unit: " s", default: 60 },
            pos: { type: "hidden", default: null }
        },
        start(ctx) {
            const s = ctx.settings;
            const ch = String(s.channel || "").trim().replace(/^.*twitch\.tv\//i, "").replace(/[^A-Za-z0-9_]/g, "");
            if (!ch) return;
            const el = ctx.element(h("div", { class: "xj-twitch", title: "Klicken: Twitch öffnen · Ziehen: verschieben" },
                h("span", { class: "dot" }), h("span", { class: "txt" }, ch + " …")));
            if (s.pos) { el.style.left = s.pos.x + "px"; el.style.top = s.pos.y + "px"; }
            else { el.style.right = "20px"; el.style.bottom = "90px"; }
            document.body.append(el);
            draggable(el, pos => { s.pos = pos; save(); }, () => N.openExternal("https://www.twitch.tv/" + ch.toLowerCase()));

            const short = u => {
                const hh = +(/(\d+)\s*hour/.exec(u)?.[1] || 0), mm = +(/(\d+)\s*minute/.exec(u)?.[1] || 0);
                return hh ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${mm}m`;
            };
            const update = async () => {
                const r = await N.twitch(ch).catch(e => ({ error: String(e) }));
                const txt = el.querySelector(".txt");
                el.classList.toggle("live", !!r.live);
                if (r.error) txt.textContent = ch + " · Fehler";
                else if (r.live) txt.textContent = `LIVE · ${short(r.uptime)}${s.showViewers && r.viewers != null ? " · " + r.viewers + " 👀" : ""}`;
                else txt.textContent = ch + " · offline";
            };
            update();
            ctx.interval(update, Math.max(30, +s.interval || 60) * 1000);
        }
    });

    builtin({
        id: "StreamerBlur",
        name: "Streamer-Blur",
        description: "Verwischt Nachrichten, Bilder und DMs, bis du mit der Maus drüberfährst. Umschalten mit Strg+Shift+B.",
        tags: ["Streamer"],
        settings: {
            active: { type: "boolean", label: "Blur gerade aktiv", default: true, restart: false },
            strength: { type: "slider", label: "Stärke", min: 2, max: 20, unit: " px", default: 7, restart: false },
            dms: { type: "boolean", label: "Auch DM-Liste verwischen", default: true, restart: false }
        },
        css: s => !s.active ? "" : `
[class*="messageContent"], [class*="embedWrapper"], [class*="imageWrapper"], [class*="attachment"]${s.dms ? `,
[class*="privateChannels"] [class*="name_"], [class*="privateChannels"] [class*="avatar"]` : ""} { filter: blur(${s.strength}px); transition: filter .2s; }
[class*="message_"]:hover [class*="messageContent"], [class*="message_"]:hover [class*="embedWrapper"],
[class*="message_"]:hover [class*="imageWrapper"], [class*="message_"]:hover [class*="attachment"],
[class*="privateChannels"] li:hover [class*="name_"], [class*="privateChannels"] li:hover [class*="avatar"] { filter: none; }`,
        start(ctx) {
            ctx.keybind("ctrl+shift+b", () => {
                ctx.settings.active = !ctx.settings.active; save();
                applyPluginCss(plugins.get("StreamerBlur"));
                toast(ctx.settings.active ? "🙈 Streamer-Blur an" : "👀 Streamer-Blur aus", 1800);
                rerenderAll();
            });
        }
    });

    builtin({
        id: "NoAds",
        name: "Werbung weg",
        description: "Blendet Nitro-, Shop- und Quest-Werbung aus.",
        tags: ["Komfort"],
        enabledByDefault: true,
        settings: {
            gift: { type: "boolean", label: "Geschenk-Button im Chat", default: true, restart: false },
            tabs: { type: "boolean", label: "Nitro-, Shop- und Quest-Tabs", default: true, restart: false },
            other: { type: "boolean", label: "Sonstige Nitro-Hinweise", default: true, restart: false }
        },
        css: s => [
            s.gift && `[class*="buttons_"] [aria-label="Send a gift"], [class*="buttons_"] [aria-label="Ein Geschenk senden"], [class*="buttons_"] [aria-label="Geschenk senden"], [class*="giftButton"] { display: none !important; }`,
            s.tabs && `a[href="/store"], a[href="/shop"], a[href="/quest-home"], li:has(> div > a[href="/store"]), li:has(> div > a[href="/shop"]), li:has(> div > a[href="/quest-home"]) { display: none !important; }`,
            s.other && `[class*="premiumTab"], [class*="nitroWheel"], [class*="upsell"] { display: none !important; }`
        ].filter(Boolean).join("\n")
    });

    builtin({
        id: "ChatButtons",
        name: "Chat-Buttons ausblenden",
        description: "Wähle, welche Buttons neben dem Eingabefeld angezeigt werden.",
        tags: ["Komfort"],
        settings: {
            gif: { type: "boolean", label: "GIF-Button ausblenden", default: true, restart: false },
            sticker: { type: "boolean", label: "Sticker-Button ausblenden", default: true, restart: false },
            apps: { type: "boolean", label: "Apps-Button ausblenden", default: false, restart: false }
        },
        css: s => {
            const sel = [];
            if (s.gif) sel.push('[aria-label="Open GIF picker"]', '[aria-label="GIF-Auswahl öffnen"]');
            if (s.sticker) sel.push('[aria-label="Open sticker picker"]', '[aria-label="Sticker-Auswahl öffnen"]');
            if (s.apps) sel.push('[aria-label="Apps"]', '[class*="channelAppLauncher"]');
            return sel.length ? `[class*="buttons_"] :is(${sel.join(",")}) { display: none !important; }` : "";
        }
    });

    builtin({
        id: "HideTyping",
        name: "„schreibt gerade“ ausblenden",
        description: "Versteckt die Anzeige, wer gerade tippt.",
        tags: ["Komfort"],
        css: `[class*="typing_"] { visibility: hidden !important; }`
    });

    builtin({
        id: "CompactServers",
        name: "Kompakte Serverleiste",
        description: "Macht die Server-Icons links etwas kleiner.",
        tags: ["Design"],
        settings: { scale: { type: "slider", label: "Größe", min: 70, max: 100, step: 2, unit: " %", default: 88, restart: false } },
        css: s => `[class*="guilds_"] [class*="listItem_"] { margin-bottom: 4px !important; }
[class*="guilds_"] [class*="wrapper_"] svg, [class*="guilds_"] [class*="blobContainer"] { transform: scale(${s.scale / 100}); }`
    });

    builtin({
        id: "HideActivity",
        name: "Aktiv-Spalte ausblenden",
        description: "Versteckt die „Jetzt aktiv“-Spalte in der Freundesliste.",
        tags: ["Komfort"],
        css: `[class*="nowPlayingColumn"] { display: none !important; }`
    });

    builtin({
        id: "WindowTools",
        name: "Fenster-Tools",
        description: "Discord immer im Vordergrund halten und das Fenster durchsichtig machen.",
        tags: ["Komfort"],
        settings: {
            alwaysOnTop: { type: "boolean", label: "Immer im Vordergrund", default: false },
            opacity: { type: "slider", label: "Deckkraft des Fensters", min: 30, max: 100, step: 5, unit: " %", default: 100 }
        },
        start(ctx) {
            const s = ctx.settings, o = +s.opacity || 100;
            if (s.alwaysOnTop) N.setWindow({ alwaysOnTop: true });
            if (o < 100) N.setWindow({ opacity: o });
            ctx.onCleanup(() => {
                if (s.alwaysOnTop) N.setWindow({ alwaysOnTop: false });
                if (o < 100) N.setWindow({ opacity: 100 });
            });
        }
    });

    builtin({
        id: "DevTools",
        name: "DevTools-Kürzel",
        description: "Strg+Shift+I öffnet die Entwicklertools – praktisch zum Bauen eigener Themes und Plugins.",
        tags: ["Entwickler"],
        enabledByDefault: true,
        start(ctx) { ctx.keybind("ctrl+shift+i", () => N.toggleDevTools()); }
    });

    builtin({
        id: "StreamClock",
        name: "Stream-Uhr",
        description: "Kleine verschiebbare Uhr mit Datum – auch als Stoppuhr für deinen Stream.",
        tags: ["Streamer"],
        settings: {
            seconds: { type: "boolean", label: "Sekunden anzeigen", default: true },
            stopwatch: { type: "boolean", label: "Stoppuhr seit Discord-Start", default: false },
            pos: { type: "hidden", default: null }
        },
        start(ctx) {
            const s = ctx.settings, t0 = Date.now();
            const el = ctx.element(h("div", { class: "xj-twitch xj-clock", title: "Ziehen zum Verschieben" }, h("span", { class: "txt" })));
            if (s.pos) { el.style.left = s.pos.x + "px"; el.style.top = s.pos.y + "px"; } else { el.style.right = "20px"; el.style.bottom = "130px"; }
            document.body.append(el);
            draggable(el, pos => { s.pos = pos; save(); }, () => { });
            const pad = n => String(n).padStart(2, "0");
            const tick = () => {
                const d = new Date();
                let txt = `🕒 ${pad(d.getHours())}:${pad(d.getMinutes())}${s.seconds ? ":" + pad(d.getSeconds()) : ""}`;
                if (s.stopwatch) { const sec = Math.floor((Date.now() - t0) / 1000); txt += ` · ⏱ ${Math.floor(sec / 3600)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`; }
                el.querySelector(".txt").textContent = txt;
            };
            tick();
            ctx.interval(tick, 1000);
        }
    });

    builtin({
        id: "ShowHiddenChannels",
        name: "Versteckte Kanäle anzeigen",
        description: "Zeigt Kanäle, für die du keine Berechtigung hast, mit einem Schloss in der Kanalliste. Lesen kannst du sie trotzdem nicht – du siehst Name, Thema und Kategorie.",
        tags: ["Discord"],
        settings: {
            dim: { type: "boolean", label: "Versteckte Kanäle abdunkeln", default: true, restart: false },
            info: { type: "boolean", label: "Info-Seite beim Öffnen eines versteckten Kanals", default: true, restart: false }
        },
        css: s => `
.xj-hidden-ch { position: relative; ${s.dim ? "opacity: .6;" : ""} }
.xj-hidden-ch:hover { opacity: 1; }
.xj-lock { margin-left: 4px; font-size: 12px; flex: none; filter: grayscale(.2); }
.xj-hidden-info { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; background: var(--background-base-low, var(--background-primary)); }
.xj-hidden-info > div { max-width: 460px; text-align: center; padding: 30px; }
.xj-hidden-info .big { font-size: 56px; }
.xj-hidden-info h2 { margin: 10px 0 6px; color: var(--header-primary, #fff); font-size: 22px; }
.xj-hidden-info p { color: var(--text-muted, #999); margin: 4px 0; font-size: 14.5px; line-height: 1.45; }
.xj-hidden-info .topic { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: var(--background-base-lower, var(--background-secondary)); color: var(--text-default, #ddd); text-align: left; white-space: pre-wrap; }`,
        async start(ctx) {
            const PS = await WP.waitForStore("PermissionStore");
            const CS = await WP.waitForStore("ChannelStore");
            if (!ctx.active) return;
            const VIEW_CHANNEL = 1n << 10n;
            const hidden = new Set();
            const origCan = PS.can;

            PS.can = function (perm, channel, ...rest) {
                const result = origCan.call(this, perm, channel, ...rest);
                if (result) return result;
                try {
                    if (perm == VIEW_CHANNEL && channel && channel.guild_id && channel.id) {
                        hidden.add(channel.id);
                        return true;
                    }
                } catch { }
                return result;
            };
            const refresh = () => {
                for (const n of ["PermissionStore", "GuildChannelStore", "ChannelListStore"]) {
                    try { WP.findStore(n)?.emitChange?.(); } catch { }
                }
            };
            ctx.onCleanup(() => {
                PS.can = origCan;
                document.querySelectorAll(".xj-hidden-ch").forEach(e => e.classList.remove("xj-hidden-ch"));
                document.querySelectorAll(".xj-lock, .xj-hidden-info").forEach(e => e.remove());
                refresh();
            });
            refresh();

            const decorate = () => {
                // Schloss an versteckte Kanäle in der Liste
                for (const id of hidden) {
                    for (const el of document.querySelectorAll(`[data-list-item-id="channels___${id}"]`)) {
                        el.classList.add("xj-hidden-ch");
                        if (!el.querySelector(".xj-lock")) {
                            const nameEl = el.querySelector('[class*="name_"]') || el;
                            nameEl.append(h("span", { class: "xj-lock", title: "Versteckter Kanal" }, "🔒"));
                        }
                    }
                }
                // Info-Seite, wenn ein versteckter Kanal geöffnet ist
                const cid = currentChannelId();
                const old = document.querySelector(".xj-hidden-info");
                if (!ctx.settings.info || !cid || !hidden.has(cid)) { old?.remove(); return; }
                if (old && old.dataset.id === cid) return;
                old?.remove();
                const chat = document.querySelector('main[class*="chatContent"]') || document.querySelector('[class*="chatContent"]') || document.querySelector('[class*="chat_"]');
                if (!chat) return;
                const ch = CS.getChannel(cid) || {};
                const parent = ch.parent_id ? CS.getChannel(ch.parent_id) : null;
                if (getComputedStyle(chat).position === "static") chat.style.position = "relative";
                chat.append(h("div", { class: "xj-hidden-info", "data-id": cid },
                    h("div", {},
                        h("div", { class: "big" }, "🔒"),
                        h("h2", {}, "#" + (ch.name || "versteckter-kanal")),
                        h("p", {}, "Das ist ein versteckter Kanal. Du hast keine Berechtigung, die Nachrichten zu sehen."),
                        parent ? h("p", {}, "Kategorie: " + parent.name) : null,
                        ch.topic ? h("div", { class: "topic" }, ch.topic) : null)));
            };
            ctx.onDom(decorate);
            ctx.listen(window, "popstate", decorate);
            ctx.interval(decorate, 1500);
        }
    });

    builtin({
        id: "RoleColorEverywhere",
        name: "Rollenfarben überall",
        description: "Zeigt die Rollenfarben auch bei @Erwähnungen, in Sprachkanälen und auf Wunsch im Nachrichtentext.",
        tags: ["Discord", "Design"],
        settings: {
            mentions: { type: "boolean", label: "@Erwähnungen einfärben", default: true },
            voice: { type: "boolean", label: "Namen in Sprachkanälen einfärben", default: true },
            messages: { type: "boolean", label: "Nachrichtentext in Rollenfarbe", default: false },
            strength: { type: "slider", label: "Stärke beim Nachrichtentext", min: 20, max: 100, step: 10, unit: " %", default: 60 }
        },
        async start(ctx) {
            const GMS = await WP.waitForStore("GuildMemberStore");
            if (!ctx.active) return;
            const s = ctx.settings;
            const colorOf = uid => {
                const g = currentGuildId();
                if (!g || !uid) return null;
                try { return GMS.getMember(g, uid)?.colorString || null; } catch { return null; }
            };
            const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, var(--text-default, var(--text-normal, #dbdee1)))`;
            const mark = (el, prop, value) => {
                el.dataset.xjRc = "1";
                if (!value) return;
                el.style.setProperty(prop, value, "important");
                el.classList.add("xj-rc");
            };
            const paint = () => {
                if (s.mentions) for (const el of document.querySelectorAll(".mention:not([data-xj-rc])")) {
                    const uid = reactFind(el, p => p.userId || (p.user && p.user.id));
                    const c = colorOf(uid);
                    mark(el, "color", c);
                    if (c) el.style.setProperty("background-color", `color-mix(in srgb, ${c} 18%, transparent)`, "important");
                }
                if (s.voice) for (const el of document.querySelectorAll('[class*="voiceUser"]:not([data-xj-rc])')) {
                    const uid = reactFind(el, p => (p.user && p.user.id) || p.userId);
                    const name = el.querySelector('[class*="username"], [class*="usernameFont"]');
                    if (name) mark(name, "color", colorOf(uid));
                    el.dataset.xjRc = "1";
                }
                if (s.messages) for (const el of document.querySelectorAll('[id^="message-content-"]:not([data-xj-rc])')) {
                    const uid = reactFind(el, p => p.message && p.message.author && p.message.author.id, 25);
                    const c = colorOf(uid);
                    mark(el, "color", c ? mix(c, s.strength) : null);
                }
            };
            ctx.onCleanup(() => {
                for (const el of document.querySelectorAll("[data-xj-rc]")) {
                    if (el.classList.contains("xj-rc")) { el.style.removeProperty("color"); el.style.removeProperty("background-color"); el.classList.remove("xj-rc"); }
                    delete el.dataset.xjRc;
                }
            });
            let lastGuild = currentGuildId();
            ctx.onDom(() => {
                const g = currentGuildId();
                if (g !== lastGuild) { // Server gewechselt → neu einfärben
                    lastGuild = g;
                    document.querySelectorAll("[data-xj-rc]").forEach(el => { delete el.dataset.xjRc; });
                }
                paint();
            });
            paint();
        }
    });

    function draggable(el, onMove, onClick) {
        let sx = null, sy, ox, oy, moved = false;
        el.addEventListener("pointerdown", e => {
            sx = e.clientX; sy = e.clientY; const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; moved = false;
            el.setPointerCapture(e.pointerId);
        });
        el.addEventListener("pointermove", e => {
            if (sx == null) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (!moved && Math.hypot(dx, dy) < 4) return;
            moved = true;
            const x = Math.min(innerWidth - el.offsetWidth, Math.max(0, ox + dx));
            const y = Math.min(innerHeight - el.offsetHeight, Math.max(0, oy + dy));
            Object.assign(el.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
        });
        el.addEventListener("pointerup", () => {
            if (sx == null) return; sx = null;
            if (moved) { const r = el.getBoundingClientRect(); onMove({ x: Math.round(r.left), y: Math.round(r.top) }); }
            else onClick();
        });
    }

    // =======================================================================
    // Theme-System
    // =======================================================================
    const PRESETS = {
        twitch: { name: "Twitch Lila", accent: "#9146ff", lowest: "#0a0a0c", lower: "#0e0e10", low: "#18181b", high: "#1f1f23", text: "#efeff1", muted: "#adadb8" },
        galaxy: { name: "Galaxy", accent: "#b388ff", lowest: "#06061a", lower: "#0b0b24", low: "#121233", high: "#1b1b45", text: "#ebe8ff", muted: "#9d97c9" },
        minecraft: { name: "Minecraft Grün", accent: "#5dbb3a", lowest: "#0c0f0b", lower: "#121611", low: "#191e17", high: "#222920", text: "#e8f2e4", muted: "#9fb398" },
        rot: { name: "Rot", accent: "#ff4655", lowest: "#0d0809", lower: "#130c0d", low: "#1a1112", high: "#241719", text: "#f5e9ea", muted: "#b89a9d" },
        ozean: { name: "Ozean Blau", accent: "#2ec5ff", lowest: "#060c12", lower: "#0a131c", low: "#0f1b27", high: "#152534", text: "#e4f3fb", muted: "#8eaabb" }
    };
    const FONTS = {
        standard: { name: "Discord Standard", css: "" },
        poppins: { name: "Poppins", css: "'Poppins', sans-serif", url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" },
        pixel: { name: "Pixelify Sans (Minecraft)", css: "'Pixelify Sans', sans-serif", url: "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap" },
        nunito: { name: "Nunito", css: "'Nunito', sans-serif", url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" }
    };

    function palette() {
        const t = S.themes.designer, p = PRESETS[t.preset] || PRESETS.twitch;
        const accent = normHex(t.accent) || p.accent;
        return { ...p, accent, hover: shade(accent, -0.12), light: shade(accent, 0.25) };
    }

    function designerCss() {
        const t = S.themes.designer;
        if (!t.enabled) return "";
        const p = palette(), A = p.accent;
        const hasBg = String(t.bg || "").trim().length > 0;
        const a = hasBg ? t.opacity / 100 : 1;
        const bg = x => hasBg ? rgba(x, a) : x;
        const font = FONTS[t.font] || FONTS.standard;
        const fill = t.gradient ? `linear-gradient(135deg, ${A}, ${p.light})` : A;
        return `
${font.url ? `@import url("${font.url}");` : ""}
:root, .theme-dark, .theme-light, .visual-refresh, .visual-refresh.theme-dark {
  --xj-accent: ${A}; --xj-accent-light: ${p.light};
  --brand-500: ${A} !important; --brand-560: ${p.hover} !important; --brand-600: ${shade(A, -0.22)} !important; --brand-360: ${p.light} !important;
  --brand-experiment: ${A} !important; --brand-experiment-560: ${p.hover} !important;
  --button-filled-brand-background: ${A} !important; --button-filled-brand-background-hover: ${p.hover} !important;
  --control-brand-foreground: ${A} !important; --text-link: ${p.light} !important;
  --background-base-lowest: ${bg(p.lowest)} !important; --background-base-lower: ${bg(p.lower)} !important; --background-base-low: ${bg(p.low)} !important;
  --background-surface-high: ${bg(p.high)} !important; --background-surface-higher: ${bg(shade(p.high, 0.04))} !important; --background-surface-highest: ${bg(shade(p.high, 0.08))} !important;
  --chat-background-default: ${bg(p.low)} !important; --bg-overlay-chat: ${bg(p.low)} !important;
  --bg-base-primary: ${bg(p.low)} !important; --bg-base-secondary: ${bg(p.lower)} !important; --bg-base-tertiary: ${bg(p.lowest)} !important;
  --background-primary: ${bg(p.low)} !important; --background-secondary: ${bg(p.lower)} !important; --background-secondary-alt: ${bg(shade(p.lower, 0.03))} !important;
  --background-tertiary: ${bg(p.lowest)} !important; --background-floating: ${p.high} !important; --channeltextarea-background: ${bg(p.high)} !important; --modal-background: ${p.low} !important;
  --background-modifier-hover: ${rgba(A, 0.08)} !important; --background-modifier-active: ${rgba(A, 0.14)} !important; --background-modifier-selected: ${rgba(A, 0.18)} !important;
  --background-mentioned: ${rgba(A, 0.1)} !important; --background-mentioned-hover: ${rgba(A, 0.15)} !important;
  --text-default: ${p.text} !important; --text-normal: ${p.text} !important; --header-primary: ${p.text} !important;
  --text-muted: ${p.muted} !important; --header-secondary: ${p.muted} !important; --channels-default: ${p.muted} !important;
  --interactive-normal: ${p.muted} !important; --interactive-hover: ${p.text} !important; --interactive-active: #fff !important;
  --scrollbar-thin-thumb: ${rgba(A, 0.5)} !important; --scrollbar-auto-thumb: ${rgba(A, 0.5)} !important; --scrollbar-auto-track: transparent !important;
}
${font.css ? `:root, body, .theme-dark, .visual-refresh { --font-primary: ${font.css} !important; --font-display: ${font.css} !important; --font-headline: ${font.css} !important; }` : ""}
${hasBg ? `
body, #app-mount { background: ${p.lowest} !important; }
#app-mount::before { content: ""; position: fixed; inset: -${t.blur * 2}px; background: url("${cssUrl(t.bg)}") center / cover no-repeat; filter: blur(${t.blur}px); z-index: -1; pointer-events: none; }
#app-mount [class*="bg_"], #app-mount [class^="app_"], #app-mount [class*="app_"] > [class*="app_"] { background: transparent !important; }` : ""}
::selection { background: ${rgba(A, 0.45)}; }
button[class*="colorBrand"], [class*="lookFilled"][class*="colorBrand"] { background: ${fill} !important; border: none !important; transition: filter .15s, transform .15s; }
button[class*="colorBrand"]:hover { filter: brightness(1.1); transform: translateY(-1px); }
[class*="numberBadge"] { background-color: ${A} !important; }
[class*="listItem_"] [class*="item_"] { background-color: ${A} !important; }
[class*="channelTextArea"] [class*="scrollableContainer"] { border-radius: ${t.round}px !important; }
[class*="menu_"], [class*="userPopoutOuter"], [class*="autocomplete_"], [class*="embedFull"] { border-radius: ${t.round}px !important; }
[class*="imageWrapper"], [class*="imageContainer"] img { border-radius: ${Math.max(0, t.round - 4)}px !important; }
${t.glow ? `
[class*="mentioned_"] { box-shadow: inset 3px 0 0 ${A}, 0 0 14px ${rgba(A, 0.18)} !important; }
[class*="mentioned_"]::before { background: ${A} !important; }
.mention { background: ${rgba(A, 0.22)} !important; color: ${p.light} !important; border-radius: 4px; }` : ""}`;
    }

    // Lokale Themes: %APPDATA%\xImJxstinnCord\themes\*.css
    let localThemes = [];
    function parseMeta(css) {
        const meta = {};
        const m = /\/\*\*([\s\S]*?)\*\//.exec(css);
        if (m) for (const line of m[1].split("\n")) {
            const r = /@(\w+)\s+(.+)/.exec(line);
            if (r) meta[r[1].toLowerCase()] = r[2].trim();
        }
        return meta;
    }
    function loadLocalThemes() {
        try {
            localThemes = N.getThemes().map(t => ({ ...t, meta: parseMeta(t.content) }));
        } catch (e) { console.error(e); localThemes = []; }
    }

    let appliedThemeIds = new Set();
    function applyThemes() {
        const T = S.themes;
        styleTag("xj-designer", designerCss());

        const want = new Set();
        localThemes.forEach((t, i) => {
            if (!T.enabled.includes(t.file)) return;
            const id = "xj-theme-" + i;
            want.add(id);
            styleTag(id, t.content + `\n/*# sourceURL=xjcord-theme://${encodeURIComponent(t.file)} */`);
        });
        T.links.filter(Boolean).forEach((u, i) => {
            const id = "xj-link-" + i;
            want.add(id);
            let l = document.getElementById(id);
            if (!l) { l = h("link", { id, rel: "stylesheet" }); document.head.append(l); }
            if (l.getAttribute("href") !== u) l.setAttribute("href", u);
        });
        for (const id of appliedThemeIds) if (!want.has(id)) document.getElementById(id)?.remove();
        appliedThemeIds = want;

        // Eigenes CSS immer als Letztes
        styleTag("xj-quickcss", T.quickCssEnabled ? T.quickCss : "");
        const q = document.getElementById("xj-quickcss"); if (q) document.head.append(q);
    }

    // =======================================================================
    // Updates
    // =======================================================================
    let upd = { status: "idle", current: N.version };
    let bannerEl = null;
    const UPD_TEXT = {
        idle: "Noch nicht geprüft", checking: "Suche nach Updates …", downloading: "Lade Update herunter …",
        uptodate: "Du hast die neueste Version ✓", available: "Neue Version verfügbar", installed: "Update installiert",
        norelease: "Noch kein Release auf GitHub", error: "Update-Prüfung fehlgeschlagen"
    };
    function showBanner(text, btnText, action) {
        bannerEl?.remove();
        bannerEl = h("div", { class: "xj-banner" },
            h("span", {}, text),
            btnText ? h("button", { class: "xj-btn", onclick: action }, btnText) : null,
            h("button", { class: "xj-btn sec", onclick: () => { bannerEl?.remove(); bannerEl = null; } }, "Später"));
        document.body.append(bannerEl);
    }
    function applyUpdate() { upd.needs === "restart" ? N.restart() : location.reload(); }
    function onUpdateState(state) {
        const prev = upd.status;
        upd = state;
        rerenderAll();
        if (state.status === "installed" && prev !== "installed")
            showBanner(`✨ xImJxstinnCord ${state.latest} ist installiert`, state.needs === "restart" ? "Discord neu starten" : "Neu laden", applyUpdate);
        else if (state.status === "available" && prev !== "available")
            showBanner(`⬆️ Update ${state.latest} für xImJxstinnCord verfügbar`, "Jetzt installieren", () => { bannerEl?.remove(); N.checkUpdate(); });
    }

    // =======================================================================
    // UI-Bausteine
    // =======================================================================
    const views = new Set(); // offene Seiten, die bei Änderungen neu gezeichnet werden
    function rerenderAll() { for (const v of views) v(); }

    const sw = (checked, onchange) => h("label", { class: "xj-sw" },
        h("input", { type: "checkbox", checked: !!checked, onchange: e => onchange(e.target.checked) }), h("span"));

    const row = (title, desc, ctl) => h("div", { class: "xj-row" },
        h("div", { class: "xj-row-text" }, h("div", { class: "t" }, title), desc ? h("div", { class: "d" }, desc) : null), ctl);

    function rangeCtl(min, max, step, value, unit, oninput) {
        const val = h("span", { class: "xj-val" }, value + (unit || ""));
        return h("div", { class: "xj-ctl" },
            h("input", { type: "range", class: "xj-range", min, max, step: step || 1, value, oninput: e => { val.textContent = e.target.value + (unit || ""); oninput(+e.target.value); } }),
            val);
    }

    function settingControl(o, value, set) {
        switch (o.type) {
            case "boolean": return sw(value, set);
            case "slider": return rangeCtl(o.min ?? 0, o.max ?? 100, o.step ?? 1, value, o.unit, set);
            case "number": return h("input", { class: "xj-in", type: "number", value, min: o.min, max: o.max, style: "width:110px", onchange: e => set(+e.target.value) });
            case "select": return h("select", { class: "xj-in", onchange: e => set(e.target.value) },
                (o.options || []).map(op => h("option", { value: op.value, selected: op.value === value }, op.label)));
            case "color": return h("input", { type: "color", class: "xj-color", value: normHex(value) || "#9146ff", oninput: e => set(e.target.value) });
            case "text": return h("textarea", { class: "xj-in", value: value ?? "", rows: 4, style: "width:100%", onchange: e => set(e.target.value), onkeydown: e => e.stopPropagation() });
            default: return h("input", { class: "xj-in", value: value ?? "", placeholder: o.placeholder || "", style: "width:240px", onchange: e => set(e.target.value), onkeydown: e => e.stopPropagation() });
        }
    }

    // Overlays (Modal-Stapel)
    const overlays = [];
    function openOverlay(content, cls) {
        const ov = h("div", { class: "xj-overlay", onmousedown: e => { if (e.target === ov) closeOverlay(ov); } }, h("div", { class: cls || "xj-dialog" }, content));
        document.body.append(ov);
        overlays.push(ov);
        return ov;
    }
    function closeOverlay(ov) {
        const i = overlays.indexOf(ov);
        if (i >= 0) overlays.splice(i, 1);
        ov.__onClose?.();
        ov.remove();
    }
    function closeTopOverlay() {
        const ov = overlays[overlays.length - 1];
        if (!ov) return false;
        closeOverlay(ov);
        return true;
    }

    // =======================================================================
    // Seiten
    // =======================================================================
    const ICONS = {
        general: "M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.88 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.65 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.08.63-.08.94s.02.63.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.48 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z",
        plugins: "M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5Z",
        themes: "M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3Zm13.71-9.37-1.34-1.34a1 1 0 0 0-1.41 0L9 12.25 11.75 15l8.96-8.96a1 1 0 0 0 0-1.41Z",
        updater: "M12 16 7 11l1.4-1.45 2.6 2.6V4h2v8.15l2.6-2.6L17 11l-5 5Zm-6 4c-.55 0-1.02-.2-1.41-.59A1.93 1.93 0 0 1 4 18v-3h2v3h12v-3h2v3c0 .55-.2 1.02-.59 1.41-.39.4-.86.59-1.41.59H6Z",
        backup: "M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8Zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3Z"
    };
    const svgIcon = (id, size = 20) => {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", size); svg.setAttribute("height", size);
        svg.setAttribute("aria-hidden", "true"); svg.classList.add("xj-svg");
        const path = document.createElementNS(ns, "path");
        path.setAttribute("fill", "currentColor"); path.setAttribute("d", ICONS[id] || ICONS.general);
        svg.append(path);
        return svg;
    };

    const PAGES = [
        { id: "general", label: "xImJxstinnCord", render: pageGeneral },
        { id: "plugins", label: "Plugins", render: pagePlugins },
        { id: "themes", label: "Themes", render: pageThemes },
        { id: "updater", label: "Updater", render: pageUpdater },
        { id: "backup", label: "Backup & Restore", render: pageBackup, badge: "NEU" }
    ];

    // Mountet eine Seite in einen Container und zeichnet sie bei Änderungen neu
    function mountPage(container, pageId, state = {}) {
        const page = PAGES.find(p => p.id === pageId) || PAGES[0];
        const draw = () => {
            const scroll = container.scrollTop;
            container.replaceChildren(h("div", { class: "xj-page" }, page.render(state, draw)));
            container.scrollTop = scroll;
        };
        draw();
        views.add(draw);
        return () => views.delete(draw);
    }

    function pageHeader(title, sub, ...extra) {
        return h("div", { class: "xj-head" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null), h("div", { class: "xj-head-actions" }, extra));
    }

    function pageGeneral() {
        const running = [...plugins.values()].filter(p => p.running).length;
        return [
            pageHeader("xImJxstinnCord", "Dein eigener Discord-Mod – Version " + (upd.current || N.version)),
            h("div", { class: "xj-cards3" },
                h("div", { class: "xj-stat" }, h("b", {}, String(running)), h("span", {}, "Plugins aktiv")),
                h("div", { class: "xj-stat" }, h("b", {}, String(S.themes.enabled.length + (S.themes.designer.enabled ? 1 : 0))), h("span", {}, "Themes aktiv")),
                h("div", { class: "xj-stat" }, h("b", {}, upd.status === "uptodate" ? "✓" : (upd.status === "installed" || upd.status === "available") ? "!" : "–"), h("span", {}, "Updates"))),
            h("h3", {}, "Schnellzugriff"),
            h("div", { class: "xj-quick" },
                h("button", { class: "xj-btn sec", onclick: () => N.openFolder("themes") }, "📁 Themes-Ordner"),
                h("button", { class: "xj-btn sec", onclick: () => N.openFolder("plugins") }, "📁 Plugins-Ordner"),
                h("button", { class: "xj-btn sec", onclick: () => N.openFolder("") }, "📁 Einstellungs-Ordner"),
                h("button", { class: "xj-btn sec", onclick: () => location.reload() }, "🔄 Discord neu laden"),
                h("button", { class: "xj-btn sec", onclick: () => N.restart() }, "⏻ Discord neu starten")),
            h("h3", {}, "Allgemein"),
            row("Bereich in den Discord-Einstellungen", "xImJxstinnCord, Plugins, Themes, Updater und Backup in den Benutzereinstellungen",
                sw(S.settingsEntry, v => { S.settingsEntry = v; save(); if (!v) removeSettingsEntries(); })),
            row("Notfall-Kürzel Strg + Shift + X", "Öffnet das Menü auch dann, wenn Discord seine Einstellungen umgebaut hat",
                sw(S.hotkey, v => { S.hotkey = v; save(); })),
            h("h3", {}, "Gefahrenzone"),
            row("Alles zurücksetzen", "Setzt alle Plugins, Themes und Einstellungen auf Standard",
                h("button", { class: "xj-btn danger", onclick: () => {
                    if (!confirm("Wirklich alle xImJxstinnCord-Einstellungen zurücksetzen?")) return;
                    for (const id of plugins.keys()) stopPlugin(id);
                    S = merge(DEFAULTS, { welcomed: true });
                    for (const [id, e] of plugins) { const st = pluginStore(id); st.enabled = !!e.def.enabledByDefault; for (const [k, o] of Object.entries(e.def.settings || {})) st[k] = o.default; }
                    save(); applyThemes();
                    for (const [id] of plugins) if (pluginStore(id).enabled) startPlugin(id);
                    rerenderAll(); toast("Einstellungen zurückgesetzt");
                } }, "Zurücksetzen"))
        ];
    }

    function pagePlugins(state, redraw) {
        state.q ??= ""; state.filter ??= "all";
        const q = state.q.toLowerCase();
        const list = [...plugins.values()]
            .filter(p => {
                const st = pluginStore(p.def.id);
                if (state.filter === "on" && !st.enabled) return false;
                if (state.filter === "off" && st.enabled) return false;
                if (state.filter === "own" && p.builtin) return false;
                if (!q) return true;
                return [p.def.name, p.def.id, p.def.description, ...(p.def.tags || [])].join(" ").toLowerCase().includes(q);
            })
            .sort((a, b) => (a.def.name || a.def.id).localeCompare(b.def.name || b.def.id));

        const search = h("input", { class: "xj-in xj-search", placeholder: "Plugins durchsuchen …", value: state.q,
            oninput: e => { state.q = e.target.value; const pos = e.target.selectionStart; redraw(); const s = document.querySelector(".xj-search"); s?.focus(); s?.setSelectionRange(pos, pos); },
            onkeydown: e => e.stopPropagation() });
        const filter = h("select", { class: "xj-in", onchange: e => { state.filter = e.target.value; redraw(); } },
            [["all", "Alle"], ["on", "Aktiviert"], ["off", "Deaktiviert"], ["own", "Eigene Plugins"]].map(([v, l]) => h("option", { value: v, selected: state.filter === v }, l)));

        const errors = [...N.getPluginErrors(), ...userPluginErrors];
        return [
            pageHeader("Plugins", `${plugins.size} Plugins · ${[...plugins.values()].filter(p => p.running).length} aktiv`,
                h("button", { class: "xj-btn sec", onclick: () => N.openFolder("plugins") }, "📁 Plugins-Ordner"),
                h("button", { class: "xj-btn sec", onclick: () => location.reload(), title: "Neue Plugin-Dateien laden" }, "🔄 Neu laden")),
            errors.length ? h("div", { class: "xj-alert" }, h("b", {}, "Fehler in eigenen Plugins:"), errors.map(e => h("div", {}, `${e.file}: ${e.error}`))) : null,
            h("div", { class: "xj-toolbar" }, search, filter),
            list.length ? h("div", { class: "xj-grid" }, list.map(p => pluginCard(p, redraw)))
                : h("div", { class: "xj-empty" }, "Keine Plugins gefunden."),
            h("p", { class: "xj-hint" }, "Eigene Plugins: Lege .js-Dateien in den Plugins-Ordner und drücke „Neu laden“. Ein Beispiel liegt dort schon bereit.")
        ];
    }

    function pluginCard(p, redraw) {
        const st = pluginStore(p.def.id);
        const visibleSettings = Object.entries(p.def.settings || {}).filter(([, o]) => o.type !== "hidden");
        return h("div", { class: "xj-card" + (st.enabled ? " on" : "") },
            h("div", { class: "xj-card-top" },
                h("div", { class: "xj-card-name" }, p.def.name || p.def.id, p.builtin ? null : h("span", { class: "xj-tag own" }, "Eigenes")),
                h("div", { class: "xj-ctl" },
                    visibleSettings.length ? h("button", { class: "xj-icon-btn", title: "Einstellungen", onclick: () => openPluginSettings(p) }, "⚙") : null,
                    sw(st.enabled, v => { setPluginEnabled(p.def.id, v); redraw(); }))),
            h("div", { class: "xj-card-desc" }, p.def.description || ""),
            p.error ? h("div", { class: "xj-card-err" }, "⚠️ " + p.error) : null,
            (p.def.tags || []).length || p.file ? h("div", { class: "xj-card-tags" },
                (p.def.tags || []).map(t => h("span", { class: "xj-tag" }, t)),
                p.file ? h("span", { class: "xj-tag" }, "📄 " + p.file) : null) : null);
    }

    function openPluginSettings(p) {
        const id = p.def.id;
        const body = h("div", { class: "xj-dialog-body" });
        const draw = () => {
            const st = pluginStore(id);
            body.replaceChildren(...[
                h("div", { class: "xj-dialog-head" }, h("div", {}, h("h2", {}, p.def.name || id), h("p", {}, p.def.description || "")),
                    h("button", { class: "xj-close", onclick: () => closeOverlay(ov) }, "✕")),
                row("Plugin aktiviert", null, sw(st.enabled, v => { setPluginEnabled(id, v); rerenderAll(); })),
                Object.entries(p.def.settings || {}).filter(([, o]) => o.type !== "hidden").map(([k, o]) =>
                    o.type === "text"
                        ? h("div", { class: "xj-row col" }, h("div", { class: "t" }, o.label || k), o.description ? h("div", { class: "d" }, o.description) : null,
                            settingControl(o, st[k], v => { st[k] = v; pluginSettingChanged(id, k); }))
                        : row(o.label || k, o.description, settingControl(o, st[k], v => { st[k] = v; pluginSettingChanged(id, k); })))
            ].flat());
        };
        const ov = openOverlay(body);
        draw();
    }

    function pageThemes(state, redraw) {
        state.tab ??= "local";
        const tabs = [["local", "Lokale Themes"], ["designer", "Designer"], ["online", "Online-Themes"], ["css", "Eigenes CSS"]];
        const tabBar = h("div", { class: "xj-tabs" }, tabs.map(([id, l]) =>
            h("button", { class: "xj-tabbtn" + (state.tab === id ? " sel" : ""), onclick: () => { state.tab = id; redraw(); } }, l)));
        const T = S.themes;
        let content;

        if (state.tab === "local") {
            content = [
                h("div", { class: "xj-toolbar" },
                    h("button", { class: "xj-btn sec", onclick: () => N.openFolder("themes") }, "📁 Themes-Ordner öffnen"),
                    h("button", { class: "xj-btn sec", onclick: () => { loadLocalThemes(); applyThemes(); redraw(); toast("Themes neu geladen"); } }, "🔄 Neu laden")),
                localThemes.length ? h("div", { class: "xj-grid" }, localThemes.map(t => {
                    const on = T.enabled.includes(t.file);
                    return h("div", { class: "xj-card" + (on ? " on" : "") },
                        h("div", { class: "xj-card-top" },
                            h("div", { class: "xj-card-name" }, t.meta.name || t.file.replace(/\.css$/i, "")),
                            h("div", { class: "xj-ctl" },
                                h("button", { class: "xj-icon-btn", title: "Löschen", onclick: () => {
                                    if (!confirm(`Theme „${t.meta.name || t.file}“ löschen?`)) return;
                                    N.deleteTheme(t.file); T.enabled = T.enabled.filter(f => f !== t.file); save(); loadLocalThemes(); applyThemes(); redraw();
                                } }, "🗑"),
                                sw(on, v => { T.enabled = v ? [...T.enabled, t.file] : T.enabled.filter(f => f !== t.file); save(); applyThemes(); redraw(); }))),
                        h("div", { class: "xj-card-desc" }, t.meta.description || "Kein Beschreibungstext"),
                        h("div", { class: "xj-card-tags" },
                            t.meta.author ? h("span", { class: "xj-tag" }, "von " + t.meta.author) : null,
                            t.meta.version ? h("span", { class: "xj-tag" }, "v" + t.meta.version) : null,
                            h("span", { class: "xj-tag" }, "📄 " + t.file)));
                })) : h("div", { class: "xj-empty" }, "Noch keine Themes. Lege .css-Dateien in den Themes-Ordner – sie erscheinen hier automatisch."),
                h("p", { class: "xj-hint" }, "Vencord- und BetterDiscord-Themes (.theme.css) funktionieren meistens auch. Änderungen an den Dateien werden live übernommen.")
            ];
        } else if (state.tab === "designer") {
            content = designerUi(redraw);
        } else if (state.tab === "online") {
            const ta = h("textarea", { class: "xj-in xj-code", rows: 8, value: T.links.join("\n"), placeholder: "https://raw.githubusercontent.com/…/theme.css\nEin Link pro Zeile", onkeydown: e => e.stopPropagation() });
            content = [
                h("p", { class: "xj-hint" }, "Themes direkt aus dem Internet laden – ein Link pro Zeile. Gut geeignet für Themes von GitHub."),
                ta,
                h("div", { class: "xj-toolbar" }, h("button", { class: "xj-btn", onclick: () => {
                    T.links = ta.value.split("\n").map(s => s.trim()).filter(s => /^https:\/\//i.test(s));
                    save(); applyThemes(); redraw(); toast("Online-Themes gespeichert");
                } }, "Speichern & anwenden"))
            ];
        } else {
            let tm;
            const ta = h("textarea", { class: "xj-in xj-code", rows: 18, value: T.quickCss, spellcheck: false,
                placeholder: "/* Dein CSS – wird live angewendet */\n[class*=\"username_\"] { color: hotpink !important; }",
                oninput: e => { T.quickCss = e.target.value; clearTimeout(tm); tm = setTimeout(() => { save(); applyThemes(); }, 300); },
                onkeydown: e => {
                    e.stopPropagation();
                    if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
                } });
            content = [row("Eigenes CSS aktiv", "Wird nach allen Themes geladen", sw(T.quickCssEnabled, v => { T.quickCssEnabled = v; save(); applyThemes(); })), ta];
        }
        return [pageHeader("Themes", "Lokale Themes, dein Designer, Online-Themes und eigenes CSS"), tabBar, h("div", { class: "xj-tabcontent" }, content)];
    }

    function designerUi(redraw) {
        const t = S.themes.designer, p = palette();
        const live = () => { save(); applyThemes(); };
        const out = [row("Designer aktiv", "Dein xImJxstinn-Farbschema über Discord legen", sw(t.enabled, v => { t.enabled = v; live(); redraw(); }))];
        if (!t.enabled) return out;
        out.push(h("div", { class: "xj-presets" }, Object.entries(PRESETS).map(([k, pr]) =>
            h("button", { class: "xj-preset" + (t.preset === k ? " sel" : ""), onclick: () => { t.preset = k; t.accent = ""; live(); redraw(); } },
                h("div", { class: "sw" }, h("b", { style: "background:" + pr.lowest }), h("b", { style: "background:" + pr.low }), h("b", { style: "background:" + pr.accent })),
                pr.name))));
        const hex = h("input", { class: "xj-in", value: p.accent, maxLength: 7, style: "width:90px", onkeydown: e => e.stopPropagation() });
        const color = h("input", { type: "color", class: "xj-color", value: p.accent });
        color.oninput = e => { t.accent = e.target.value; hex.value = t.accent; live(); };
        hex.oninput = e => { const v = normHex(e.target.value); if (v) { t.accent = v; color.value = v; live(); } };
        out.push(row("Akzentfarbe", "Buttons, Links, Erwähnungen", h("div", { class: "xj-ctl" }, color, hex,
            h("button", { class: "xj-btn sec", onclick: () => { t.accent = ""; live(); redraw(); } }, "Zurücksetzen"))));
        out.push(row("Farbverlauf auf Buttons", null, sw(t.gradient, v => { t.gradient = v; live(); })));
        const bgIn = h("input", { class: "xj-in", value: t.bg, placeholder: "https://… .png / .jpg / .gif", style: "width:300px", onkeydown: e => e.stopPropagation() });
        bgIn.onchange = () => { t.bg = bgIn.value.trim(); live(); redraw(); };
        out.push(row("Hintergrundbild", "Direkter Bildlink, leer = kein Bild", bgIn));
        if (t.bg) {
            out.push(row("Deckkraft der Flächen", null, rangeCtl(30, 100, 1, t.opacity, " %", v => { t.opacity = v; live(); })));
            out.push(row("Unschärfe des Bilds", null, rangeCtl(0, 20, 1, t.blur, " px", v => { t.blur = v; live(); })));
        }
        out.push(row("Schriftart", null, h("select", { class: "xj-in", onchange: e => { t.font = e.target.value; live(); } },
            Object.entries(FONTS).map(([k, f]) => h("option", { value: k, selected: t.font === k }, f.name)))));
        out.push(row("Ecken-Rundung", "Eingabefeld, Popups, Bilder", rangeCtl(0, 20, 1, t.round, " px", v => { t.round = v; live(); })));
        out.push(row("Leuchtende @-Erwähnungen", null, sw(t.glow, v => { t.glow = v; live(); })));
        return out;
    }

    function pageUpdater() {
        const busyNow = upd.status === "checking" || upd.status === "downloading";
        let statusText = UPD_TEXT[upd.status] || upd.status;
        if (upd.status === "available" || upd.status === "installed") statusText += " – " + upd.latest;
        if (upd.status === "error" && upd.error) statusText += ": " + upd.error;
        const action = upd.status === "installed"
            ? h("button", { class: "xj-btn", onclick: applyUpdate }, upd.needs === "restart" ? "Discord neu starten" : "Neu laden")
            : h("button", { class: "xj-btn" + (busyNow ? " sec" : ""), disabled: busyNow, onclick: () => N.checkUpdate() }, busyNow ? "Bitte warten …" : "Nach Updates suchen");
        return [
            pageHeader("Updater", "Neue Versionen kommen automatisch von GitHub (ximjxstinn/ximjxstinncord)"),
            row("Version " + (upd.current || N.version), statusText, action),
            upd.notes && (upd.status === "available" || upd.status === "installed") ? h("div", { class: "xj-notes" }, "Neu in " + upd.latest + ":\n" + upd.notes) : null,
            row("Automatische Updates", "Neue Versionen automatisch installieren (sonst nur Hinweis)", sw(S.autoUpdate, v => { S.autoUpdate = v; save(); }))
        ];
    }

    function pageBackup(state, redraw) {
        const exportBackup = () => {
            const data = { app: "xImJxstinnCord", version: upd.current || N.version, date: new Date().toISOString(), settings: S };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = h("a", { href: URL.createObjectURL(blob), download: `xImJxstinnCord-backup-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            toast("💾 Backup wird gespeichert");
        };
        const restore = text => {
            let data;
            try { data = JSON.parse(text); } catch { return toast("❌ Das ist keine gültige Backup-Datei"); }
            const settings = data && data.app === "xImJxstinnCord" ? data.settings : data;
            if (!settings || typeof settings !== "object" || (!settings.plugins && !settings.themes)) return toast("❌ Das ist keine xImJxstinnCord-Backup-Datei");
            if (!confirm("Backup wiederherstellen? Deine aktuellen Einstellungen werden ersetzt und Discord lädt neu.")) return;
            S = merge(DEFAULTS, settings);
            N.setSettings(JSON.stringify(S, null, 2));
            location.reload();
        };
        const file = h("input", { type: "file", accept: ".json,application/json", style: "display:none", onchange: async e => {
            const f = e.target.files && e.target.files[0];
            if (f) restore(await f.text());
        } });
        return [
            pageHeader("Backup & Restore", "Sichere alle Plugin-Einstellungen, Themes-Auswahl, Designer und eigenes CSS in einer Datei"),
            h("div", { class: "xj-cards2" },
                h("div", { class: "xj-bigcard" },
                    h("div", { class: "xj-bigcard-icon" }, svgIcon("updater", 26)),
                    h("b", {}, "Backup erstellen"),
                    h("span", {}, "Speichert deine Einstellungen als .json-Datei."),
                    h("button", { class: "xj-btn", onclick: exportBackup }, "Backup speichern")),
                h("div", { class: "xj-bigcard" },
                    h("div", { class: "xj-bigcard-icon" }, svgIcon("backup", 26)),
                    h("b", {}, "Backup wiederherstellen"),
                    h("span", {}, "Lädt eine Backup-Datei und ersetzt die aktuellen Einstellungen."),
                    h("button", { class: "xj-btn sec", onclick: () => file.click() }, "Datei auswählen …"), file)),
            h("p", { class: "xj-hint" }, "Die Theme- und Plugin-Dateien selbst liegen in deinem xImJxstinnCord-Ordner – kopiere sie mit, wenn du auf einen anderen PC umziehst.")
        ];
    }

    // =======================================================================
    // Menü als Fenster (Strg+Shift+X)
    // =======================================================================
    function openMenu(pageId = "general") {
        const existing = overlays.find(o => o.__xjMenu);
        if (existing) { closeOverlay(existing); return; }
        const content = h("div", { class: "xj-content" });
        let unmount = () => { };
        const nav = h("div", { class: "xj-nav" });
        const select = id => {
            unmount();
            unmount = mountPage(content, id);
            nav.querySelectorAll(".xj-navitem").forEach(n => n.classList.toggle("sel", n.dataset.id === id));
        };
        nav.append(...[
            h("div", { class: "xj-brand" }, h("i", {}, "X"), h("div", {}, "xImJxstinnCord", h("small", {}, "v" + (upd.current || N.version)))),
            h("div", { class: "xj-sidehead xj-navhead" }, "xImJxstinnCord"),
            PAGES.map(p => h("div", { class: "xj-navitem", "data-id": p.id, onclick: () => select(p.id) }, svgIcon(p.id), h("span", {}, p.label), p.badge ? h("span", { class: "xj-badge" }, p.badge) : null)),
            h("div", { style: "flex:1" })].flat());
        const wrap = h("div", { class: "xj-menu" }, nav, h("div", { class: "xj-menu-main" }, h("button", { class: "xj-close", onclick: () => closeOverlay(ov) }, "✕"), content));
        const ov = openOverlay(wrap, "xj-menu-wrap");
        ov.__xjMenu = true;
        ov.__onClose = () => unmount();
        select(pageId);
    }

    // =======================================================================
    // Einträge in Discords Einstellungen (wie Vencord)
    // =======================================================================
    let settingsPage = null; // { el, unmount, region }

    // Sucht die Liste der Einträge in Discords Einstellungs-Seitenleiste (alte und neue Einstellungen)
    function findSettingsSidebar() {
        const isSettingsLayer = el => {
            const layer = el.closest('[class*="standardSidebarView"]') || el.closest('[class*="layer_"]') || el.closest('[role="dialog"]');
            return !!layer && !!(layer.querySelector('[class*="contentRegion"]') || layer.querySelector('[class*="standardSidebarView"]') || /settings/i.test(layer.className));
        };
        // 1) viele role="tab"-Geschwister
        const counts = new Map();
        for (const t of document.querySelectorAll('[role="tab"]')) {
            if (t.classList.contains("xj-sidetab")) continue;
            counts.set(t.parentElement, (counts.get(t.parentElement) || 0) + 1);
        }
        for (const [p, n] of counts) if (n >= 8 && p.closest('[class*="sidebar"]') && isSettingsLayer(p)) return p;
        // 2) neue Einstellungen: nav/tablist mit vielen Einträgen
        for (const nav of document.querySelectorAll('[class*="sidebar"] nav, [class*="sidebar"] [role="tablist"], nav[class*="sidebar"]')) {
            if (!isSettingsLayer(nav)) continue;
            const items = [...nav.querySelectorAll('[role="tab"], [role="button"], [class*="item"]')]
                .filter(e => !e.classList.contains("xj-sidetab") && e.textContent.trim() && e.children.length < 6);
            if (items.length < 8) continue;
            const parents = new Map();
            for (const it of items) parents.set(it.parentElement, (parents.get(it.parentElement) || 0) + 1);
            const [best, n] = [...parents].sort((a, b) => b[1] - a[1])[0];
            if (n >= 6) return best;
        }
        return null;
    }

    function findContentRegion(list) {
        const layer = list.closest('[class*="standardSidebarView"]') || list.closest('[class*="layer_"]') || list.closest('[role="dialog"]') || document;
        const region = layer.querySelector('[class*="contentRegion"]');
        if (region) return region;
        // Ersatz: größter Bereich neben der Seitenleiste
        const side = list.closest('[class*="sidebarRegion"]') || list.closest('[class*="sidebar"]');
        let best = null, area = 0;
        for (const el of side?.parentElement?.children || []) {
            if (el === side || el.contains(list)) continue;
            const r = el.getBoundingClientRect(), a = r.width * r.height;
            if (a > area) { area = a; best = el; }
        }
        return best;
    }

    // Baut einen Eintrag so, dass er wie Discords eigene Einträge aussieht (Klon), aber mit eigenem Icon/Text
    function buildSideItem(nativeItem, page) {
        const it = nativeItem.cloneNode(true);
        const strip = el => {
            [...el.classList].filter(c => /selected|active/i.test(c)).forEach(c => el.classList.remove(c));
            for (const a of ["aria-selected", "aria-controls", "id", "aria-label", "data-tab-id", "data-list-item-id", "href"]) el.removeAttribute(a);
        };
        strip(it); it.querySelectorAll("*").forEach(strip);
        // vorhandenes Icon ersetzen oder neues davorsetzen
        const oldSvg = it.querySelector("svg");
        const icon = svgIcon(page.id, oldSvg ? (oldSvg.getAttribute("width") || 20) : 20);
        if (oldSvg) { icon.setAttribute("class", (oldSvg.getAttribute("class") || "") + " xj-svg"); oldSvg.replaceWith(icon); }
        // Text ersetzen: ersten Textknoten nehmen, alle anderen (Badges usw.) entfernen
        const walker = document.createTreeWalker(it, NodeFilter.SHOW_TEXT);
        const texts = []; while (walker.nextNode()) if (walker.currentNode.textContent.trim()) texts.push(walker.currentNode);
        if (texts.length) { texts[0].textContent = page.label; texts.slice(1).forEach(t => t.remove()); }
        else it.append(page.label);
        it.querySelectorAll("img").forEach(i => i.remove());
        if (!oldSvg) it.prepend(icon);
        if (page.badge) it.append(h("span", { class: "xj-badge" }, page.badge));
        it.classList.add("xj-sidetab");
        it.dataset.id = page.id;
        it.setAttribute("role", nativeItem.getAttribute("role") || "tab");
        it.tabIndex = 0;
        return it;
    }

    function injectSettingsEntries() {
        if (!S.settingsEntry) return;
        const list = findSettingsSidebar();
        if (!list) { if (settingsPage && !document.contains(settingsPage.el)) closeSettingsPage(); return; }
        if (list.querySelector(".xj-sidetab")) return;

        const natives = [...list.children].filter(c => !c.classList.contains("xj-sidetab") && (c.getAttribute("role") === "tab" || /item/i.test(c.className)) && c.textContent.trim());
        const nativeItem = natives.find(t => t.getAttribute("aria-selected") !== "true" && !/selected|active/i.test(t.className)) || natives[0];
        if (!nativeItem) return;

        const head = h("div", { class: "xj-sidehead" }, "xImJxstinnCord");
        const items = PAGES.map(p => {
            const it = buildSideItem(nativeItem, p);
            const open = e => { e.preventDefault(); e.stopPropagation(); openSettingsPage(p.id, list); };
            it.addEventListener("click", open, true);
            it.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") open(e); }, true);
            return it;
        });
        const sep = h("div", { class: "xj-sidesep" });

        const first = list.firstElementChild;
        list.insertBefore(head, first);
        items.forEach(i => list.insertBefore(i, first));
        list.insertBefore(sep, first);

        // Klick auf einen normalen Discord-Eintrag schließt unsere Seite
        list.addEventListener("click", e => {
            const item = e.target.closest('[role="tab"], [class*="item"]');
            if (item && !item.closest(".xj-sidetab")) closeSettingsPage();
        }, true);
    }

    function removeSettingsEntries() {
        closeSettingsPage();
        document.querySelectorAll(".xj-sidehead, .xj-sidetab, .xj-sidesep").forEach(e => e.remove());
    }

    function closeSettingsPage() {
        if (!settingsPage) return;
        settingsPage.unmount();
        settingsPage.el.remove();
        settingsPage.region?.classList.remove("xj-region");
        document.querySelectorAll(".xj-sidetab.sel").forEach(e => e.classList.remove("sel"));
        document.documentElement.classList.remove("xj-page-open");
        settingsPage = null;
    }

    function openSettingsPage(pageId, list) {
        const region = findContentRegion(list);
        if (!region) { openMenu(pageId); return; }
        closeSettingsPage();
        const el = h("div", { class: "xj-settings-page" });
        region.classList.add("xj-region");
        region.append(el);
        settingsPage = { el, region, unmount: mountPage(el, pageId) };
        document.documentElement.classList.add("xj-page-open");
        list.querySelectorAll(".xj-sidetab").forEach(t => t.classList.toggle("sel", t.dataset.id === pageId));
    }

    // =======================================================================
    // Styles
    // =======================================================================
    const UI_CSS = `
.xj-overlay{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;animation:xjfade .15s}
@keyframes xjfade{from{opacity:0}}
.xj-overlay,.xj-settings-page{--xj-bg:var(--background-base-low,var(--background-primary,#1e1f22));--xj-bg2:var(--background-base-lower,var(--background-secondary,#2b2d31));--xj-bg3:var(--background-base-lowest,var(--background-tertiary,#111214));--xj-tx:var(--text-default,var(--text-normal,#dbdee1));--xj-mu:var(--text-muted,#949ba4);--xj-ac:var(--xj-accent,var(--brand-500,#9146ff));--xj-line:rgba(255,255,255,.07);color:var(--xj-tx);font-family:var(--font-primary,"gg sans",sans-serif)}
.xj-menu-wrap{width:min(1000px,95vw);height:min(720px,92vh)}
.xj-menu{display:flex;width:100%;height:100%;border-radius:16px;overflow:hidden;background:var(--xj-bg);box-shadow:0 24px 70px rgba(0,0,0,.6);border:1px solid var(--xj-line)}
.xj-nav{width:210px;flex:none;background:var(--xj-bg2);padding:18px 10px;display:flex;flex-direction:column;gap:2px}
.xj-brand{display:flex;align-items:center;gap:10px;padding:0 8px 16px;font-weight:800;font-size:15px}
.xj-brand i{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,var(--xj-ac),var(--xj-accent-light,#b07bff));display:grid;place-items:center;font-style:normal;color:#fff}
.xj-brand small{display:block;font-weight:500;font-size:11px;color:var(--xj-mu)}
.xj-navitem{padding:9px 11px;border-radius:8px;cursor:pointer;font-size:14.5px;color:var(--interactive-normal,#aaa);user-select:none;display:flex;align-items:center;gap:10px}
.xj-navhead{margin:0 0 8px}
.xj-navitem:hover{background:var(--background-modifier-hover,rgba(255,255,255,.05));color:var(--interactive-hover,#fff)}
.xj-navitem.sel{background:var(--xj-ac);color:#fff}
.xj-navfoot{font-size:11px;color:var(--xj-mu);padding:0 10px}
.xj-menu-main{flex:1;position:relative;min-width:0;display:flex}
.xj-content{flex:1;overflow:auto;padding:26px 30px}
.xj-close{position:absolute;top:16px;right:18px;z-index:2;width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:var(--xj-bg);color:inherit;cursor:pointer;font-size:15px}
.xj-close:hover{background:rgba(255,255,255,.08)}
.xj-region{position:relative!important}
.xj-settings-page{position:absolute;inset:0;z-index:5;overflow:auto;background:var(--xj-bg);padding:60px 40px 80px 40px}
.xj-settings-page .xj-page{max-width:740px}
.xj-page-open [class*="sidebar"] [role="tab"][aria-selected="true"]:not(.xj-sidetab),.xj-page-open [class*="sidebar"] [class*="selected"]:not(.xj-sidetab):not(.xj-sidetab *){background:transparent!important;color:var(--interactive-normal)!important}
.xj-sidehead{display:flex;align-items:center;gap:8px;margin:4px 0 6px;padding:0 4px;color:var(--xj-accent,var(--brand-500,#9146ff));font-size:12.5px;font-weight:700;letter-spacing:.01em;white-space:nowrap;text-transform:none}
.xj-sidehead::before,.xj-sidehead::after{content:"";flex:1;height:1.5px;border-radius:2px;background:currentColor;opacity:.9}
.xj-sidesep{height:1px;margin:8px 10px;background:var(--background-modifier-accent,rgba(255,255,255,.08))}
.xj-sidetab{cursor:pointer;display:flex!important;align-items:center;gap:10px;position:relative}
.xj-sidetab .xj-svg{flex:none;width:20px;height:20px}
.xj-sidetab.sel{background:var(--xj-accent,var(--brand-500,#9146ff))!important;color:#fff!important;border-radius:8px}
.xj-sidetab.sel *{color:#fff!important}
.xj-badge{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.03em;padding:2px 6px;border-radius:6px;background:#da373c;color:#fff;line-height:1.3}
.xj-sidetab.sel .xj-badge{background:rgba(255,255,255,.25)}
.xj-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px;padding-right:40px}
.xj-head h1{margin:0;font-size:22px;color:var(--header-primary,#fff);font-weight:700}
.xj-head p{margin:4px 0 0;font-size:13.5px;color:var(--xj-mu)}
.xj-head-actions{display:flex;gap:8px;flex-wrap:wrap}
.xj-page h3{margin:24px 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--xj-mu)}
.xj-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--xj-line)}
.xj-row.col{flex-direction:column;align-items:stretch;gap:6px}
.xj-row .t{font-size:15px;font-weight:500;color:var(--header-primary,#fff)}
.xj-row .d{font-size:13px;color:var(--xj-mu);margin-top:2px}
.xj-ctl{display:flex;align-items:center;gap:8px;flex:none}
.xj-sw{position:relative;width:42px;height:24px;flex:none;cursor:pointer;display:inline-block}
.xj-sw input{opacity:0;width:0;height:0;position:absolute}
.xj-sw span{position:absolute;inset:0;border-radius:99px;background:rgba(255,255,255,.2);transition:.15s}
.xj-sw span::after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s}
.xj-sw input:checked+span{background:var(--xj-ac)}
.xj-sw input:checked+span::after{transform:translateX(18px)}
.xj-in{padding:8px 10px;border-radius:8px;border:1px solid var(--xj-line);background:var(--xj-bg3);color:inherit;font:inherit;font-size:14px;outline:none;box-sizing:border-box}
.xj-in:focus{border-color:var(--xj-ac)}
.xj-code{width:100%;font:13px/1.5 Consolas,"Cascadia Code",monospace;tab-size:4;resize:vertical;margin-top:10px}
.xj-color{width:38px;height:32px;border:0;background:none;cursor:pointer;padding:0}
.xj-range{width:180px;accent-color:var(--xj-ac)}
.xj-val{min-width:48px;text-align:right;font-size:13px;color:var(--xj-mu)}
.xj-btn{padding:8px 14px;border-radius:8px;border:0;cursor:pointer;font:inherit;font-size:14px;font-weight:600;background:var(--xj-ac);color:#fff;white-space:nowrap}
.xj-btn:hover{filter:brightness(1.1)}
.xj-btn.sec{background:rgba(255,255,255,.08);color:inherit}
.xj-btn.danger{background:#da373c;color:#fff}
.xj-btn:disabled{opacity:.6;cursor:wait}
.xj-icon-btn{width:30px;height:30px;border-radius:8px;border:0;background:rgba(255,255,255,.06);color:inherit;cursor:pointer;font-size:15px}
.xj-icon-btn:hover{background:rgba(255,255,255,.12)}
.xj-toolbar{display:flex;gap:8px;margin:6px 0 14px;flex-wrap:wrap}
.xj-search{flex:1;min-width:200px}
.xj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.xj-card{background:var(--xj-bg2);border:1px solid var(--xj-line);border-radius:12px;padding:13px 14px;display:flex;flex-direction:column;gap:7px}
.xj-card.on{border-color:color-mix(in srgb,var(--xj-ac) 55%,transparent)}
.xj-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.xj-card-name{font-weight:700;font-size:15px;color:var(--header-primary,#fff);display:flex;align-items:center;gap:6px;min-width:0}
.xj-card-desc{font-size:13px;color:var(--xj-mu);line-height:1.4}
.xj-card-err{font-size:12.5px;color:#f23f43}
.xj-card-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:auto}
.xj-tag{font-size:11px;padding:2px 7px;border-radius:99px;background:rgba(255,255,255,.07);color:var(--xj-mu)}
.xj-tag.own{background:color-mix(in srgb,var(--xj-ac) 30%,transparent);color:#fff}
.xj-empty{padding:30px;text-align:center;color:var(--xj-mu);background:var(--xj-bg2);border-radius:12px}
.xj-hint{font-size:12.5px;color:var(--xj-mu);margin:14px 0 0}
.xj-alert{background:rgba(242,63,67,.12);border:1px solid rgba(242,63,67,.4);border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px}
.xj-tabs{display:flex;gap:4px;border-bottom:1px solid var(--xj-line);margin-bottom:14px}
.xj-tabbtn{background:none;border:0;color:var(--xj-mu);font:inherit;font-size:14.5px;font-weight:500;padding:9px 12px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
.xj-tabbtn:hover{color:var(--xj-tx)}
.xj-tabbtn.sel{color:var(--header-primary,#fff);border-bottom-color:var(--xj-ac)}
.xj-presets{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0 4px}
.xj-preset{border:2px solid transparent;border-radius:10px;padding:7px;background:var(--xj-bg2);cursor:pointer;font-size:12px;color:inherit;text-align:left;font-family:inherit}
.xj-preset.sel{border-color:var(--xj-ac)}
.xj-preset .sw{height:26px;border-radius:6px;display:flex;overflow:hidden;margin-bottom:5px}
.xj-preset .sw b{flex:1}
.xj-cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px}
.xj-stat{background:var(--xj-bg2);border:1px solid var(--xj-line);border-radius:12px;padding:14px;display:flex;flex-direction:column}
.xj-stat b{font-size:26px;color:var(--header-primary,#fff)}
.xj-stat span{font-size:12.5px;color:var(--xj-mu)}
.xj-quick{display:flex;gap:8px;flex-wrap:wrap}
.xj-cards2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px}
.xj-bigcard{background:var(--xj-bg2);border:1px solid var(--xj-line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.xj-bigcard b{font-size:16px;color:var(--header-primary,#fff)}
.xj-bigcard span{font-size:13px;color:var(--xj-mu);flex:1}
.xj-bigcard-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--xj-ac) 22%,transparent);color:var(--xj-ac)}
.xj-kbd{display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.1);font-size:12.5px;font-family:Consolas,monospace}
.xj-notes{white-space:pre-wrap;font-size:13px;line-height:1.5;background:var(--xj-bg3);border-radius:10px;padding:10px 12px;margin-top:10px;max-height:200px;overflow:auto}
.xj-dialog{width:min(560px,92vw);max-height:84vh;overflow:auto;border-radius:14px;background:var(--xj-bg);box-shadow:0 20px 60px rgba(0,0,0,.6);border:1px solid var(--xj-line)}
.xj-dialog-body{padding:20px 22px}
.xj-dialog-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:6px}
.xj-dialog-head h2{margin:0;font-size:19px;color:var(--header-primary,#fff)}
.xj-dialog-head p{margin:4px 0 0;font-size:13px;color:var(--xj-mu)}
.xj-dialog .xj-close{position:static;flex:none}
.xj-toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,20px);opacity:0;z-index:100003;padding:10px 16px;border-radius:10px;background:#111;color:#fff;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.5);border-left:3px solid var(--xj-accent,#9146ff);transition:.25s;pointer-events:none;font-family:var(--font-primary,sans-serif)}
.xj-toast.show{transform:translate(-50%,0);opacity:1}
.xj-banner{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:100002;display:flex;align-items:center;gap:10px;padding:9px 10px 9px 16px;border-radius:12px;background:#121218;color:#fff;font:500 14px var(--font-primary,sans-serif);box-shadow:0 10px 40px rgba(0,0,0,.55);border:1px solid var(--xj-accent,#9146ff);animation:xjfade .2s}
.xj-banner .xj-btn{background:var(--xj-accent,#9146ff)}
.xj-banner .xj-btn.sec{background:rgba(255,255,255,.1)}
.xj-twitch{position:fixed;z-index:99999;display:flex;align-items:center;gap:7px;padding:6px 12px 6px 10px;border-radius:99px;background:rgba(14,14,16,.9);color:#efeff1;font:600 12.5px/1 var(--font-primary,sans-serif);cursor:pointer;user-select:none;box-shadow:0 4px 16px rgba(0,0,0,.4);border:1px solid rgba(145,70,255,.45);touch-action:none}
.xj-twitch .dot{width:9px;height:9px;border-radius:50%;background:#777}
.xj-twitch.live{border-color:#eb0400}
.xj-twitch.live .dot{background:#eb0400;animation:xjpulse 1.6s infinite}
.xj-clock{cursor:grab;border-color:rgba(255,255,255,.15)}
@keyframes xjpulse{0%{box-shadow:0 0 0 0 rgba(235,4,0,.7)}70%{box-shadow:0 0 0 7px rgba(235,4,0,0)}100%{box-shadow:0 0 0 0 rgba(235,4,0,0)}}
`;

    // =======================================================================
    // Start
    // =======================================================================
    function start() {
        styleTag("xj-ui", UI_CSS);
        loadLocalThemes();
        applyThemes();
        N.onThemesChanged?.(() => { loadLocalThemes(); applyThemes(); rerenderAll(); });

        started = true;
        for (const [id] of plugins) if (pluginStore(id).enabled) startPlugin(id);

        addKeybind("ctrl+shift+x", () => { if (S.hotkey) openMenu(); });
        startDomObserver();
        onDom(injectSettingsEntries);
        onDom(() => { if (settingsPage && !document.contains(settingsPage.el)) closeSettingsPage(); });

        N.onUpdate?.(onUpdateState);
        N.updateState?.().then(st => { if (st) onUpdateState(st); }).catch(() => { });

        if (!S.welcomed) {
            S.welcomed = true; save();
            setTimeout(() => toast("✨ xImJxstinnCord ist aktiv – du findest alles in den Discord-Einstellungen", 8000), 4000);
        }
        LOG("geladen –", plugins.size, "Plugins,", localThemes.length, "lokale Themes");
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
