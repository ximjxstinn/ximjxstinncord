/*
 * xImJxstinnCord – eigenes Menü
 * Die Seiten selbst stehen in pages.ts und werden beim Bauen in die
 * Einstellungs-Einträge eingesetzt (siehe branding/apply.mjs).
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "XJMenu",
    description: "Das eigene xImJxstinnCord-Menü in den Discord-Einstellungen.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    required: true,
    hidden: true
});
