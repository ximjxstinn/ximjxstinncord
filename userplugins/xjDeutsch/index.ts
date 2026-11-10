/*
 * xImJxstinnCord – Deutsch
 * Zeigt die Beschreibungen aller Plugins auf Deutsch.
 * (Die Menü-Oberfläche selbst wird schon beim Bauen übersetzt.)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import definePlugin from "@utils/types";

import { setStyle } from "../_xjShared";
import { PLUGIN_DESCRIPTIONS_DE } from "./plugins.de";

const STYLE_ID = "xj-deutsch";
const originals = new Map<string, string>();

function translate() {
    for (const [name, plugin] of Object.entries(plugins)) {
        const de = PLUGIN_DESCRIPTIONS_DE[name];
        if (!de || plugin.description === de) continue;
        if (!originals.has(name)) originals.set(name, plugin.description);
        (plugin as any).description = de;
    }
}

function restore() {
    for (const [name, text] of originals) {
        const plugin = plugins[name];
        if (plugin) (plugin as any).description = text;
    }
    originals.clear();
}

export default definePlugin({
    name: "XJDeutsch",
    description: "Zeigt alle Plugin-Beschreibungen in xImJxstinnCord auf Deutsch.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    enabledByDefault: true,
    start() {
        translate();
        // „by Autor“ → „von Autor“ auf den Plugin-Karten
        setStyle(STYLE_ID, `.vc-addon-author::before { content: "von " !important; }`);
    },
    stop() {
        restore();
        setStyle(STYLE_ID, null);
    }
});
