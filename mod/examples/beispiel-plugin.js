/*
 * Beispiel-Plugin für xImJxstinnCord
 * -----------------------------------
 * Lege .js-Dateien in diesen Ordner (%APPDATA%\xImJxstinnCord\plugins) und klicke in
 * Discord unter Einstellungen → Plugins auf „Neu laden“. Danach kannst du sie dort einschalten.
 *
 * Was du in start(ctx) benutzen kannst:
 *   ctx.settings            – deine Einstellungen (werden automatisch gespeichert)
 *   ctx.css("…")            – CSS setzen (wird beim Ausschalten entfernt)
 *   ctx.interval(fn, ms)    – Timer (wird beim Ausschalten gestoppt)
 *   ctx.timeout(fn, ms)
 *   ctx.listen(el, "click", fn)
 *   ctx.onDom(fn)           – wird aufgerufen, wenn sich Discord verändert
 *   ctx.keybind("ctrl+shift+h", fn)
 *   ctx.element(el)         – Element, das beim Ausschalten entfernt wird
 *   ctx.toast("Text")       – kleine Meldung unten
 *   ctx.h("div", { class: "x" }, "Inhalt")  – Elemente bauen
 *   ctx.onCleanup(fn)       – eigenes Aufräumen
 *
 * Einstellungstypen: boolean, string, text, number, slider (min/max/step/unit), select (options), color
 * Mit restart: false wird das Plugin bei Änderungen nicht neu gestartet (nur css wird neu berechnet).
 */

XJ.definePlugin({
    id: "BeispielHallo",
    name: "Beispiel: Hallo",
    description: "Zeigt beim Start eine Begrüßung und färbt deinen Namen in der Nachrichtenliste. Strg+Shift+H sagt nochmal Hallo.",
    tags: ["Beispiel"],

    settings: {
        name: { type: "string", label: "Wie heißt du?", default: "Justin" },
        color: { type: "color", label: "Farbe für Benutzernamen", default: "#9146ff", restart: false },
        colorNames: { type: "boolean", label: "Benutzernamen einfärben", default: false, restart: false }
    },

    // CSS kann direkt von den Einstellungen abhängen
    css: s => s.colorNames ? `[class*="username_"] { color: ${s.color} !important; }` : "",

    start(ctx) {
        ctx.toast(`👋 Hallo ${ctx.settings.name}! Dein Beispiel-Plugin läuft.`);
        ctx.keybind("ctrl+shift+h", () => ctx.toast(`Hallo nochmal, ${ctx.settings.name}!`));
    },

    stop(ctx) {
        // Alles von ctx.* wird automatisch aufgeräumt. Hier nur Eigenes.
    }
});
