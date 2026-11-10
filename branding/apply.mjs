// Setzt den Namen "xImJxstinnCord" in den Vencord-Quellcode ein (wird im GitHub-Build ausgeführt).
// Aufruf: node branding/apply.mjs <pfad-zum-vencord-checkout>
// Wenn sich Vencord ändert und eine Stelle nicht mehr gefunden wird, gibt es nur eine Warnung –
// der Build läuft trotzdem weiter.
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = process.argv[2];
if (!root) {
    console.error("Pfad zum Vencord-Checkout fehlt");
    process.exit(1);
}

const NAME = "xImJxstinnCord";

const edits = [
    {
        file: "src/plugins/_core/settings.tsx",
        replace: [
            ['title: "Vencord",', `title: "${NAME}",`],
            ['panelTitle: "Vencord Settings"', `panelTitle: "${NAME} Settings"`],
            ['useTitle: () => "Vencord Settings"', `useTitle: () => "${NAME} Settings"`],
            // Eigenes Menü: die Einträge zeigen unsere Seiten statt der Vencord-Seiten
            ["Component: VencordTab,", "Component: XJPages.main,"],
            ["Component: PluginsTab,", "Component: XJPages.plugins,"],
            ["Component: ThemesTab,", "Component: XJPages.themes,"],
            ["Component: UpdaterTab,", "Component: XJPages.updater,"],
            ["Component: BackupAndRestoreTab,", "Component: XJPages.backup,"]
        ],
        prepend: 'import { XJPages } from "../../userplugins/xjMenu/pages";\n'
    }
];

let warnings = 0;
for (const { file, replace, prepend } of edits) {
    const path = join(root, file);
    let src;
    try { src = readFileSync(path, "utf8"); } catch {
        console.warn(`⚠ Datei nicht gefunden: ${file}`);
        warnings++;
        continue;
    }
    for (const [from, to] of replace) {
        if (!src.includes(from)) {
            console.warn(`⚠ ${file}: "${from}" nicht gefunden`);
            warnings++;
            continue;
        }
        src = src.split(from).join(to);
        console.log(`✔ ${file}: ${from} → ${to}`);
    }
    if (typeof prepend === "string" && !src.includes(prepend.trim())) src = prepend + src;
    writeFileSync(path, src);
}
// ---------------------------------------------------------------------------
// Deutsche Oberfläche: Texte in den Einstellungsseiten ersetzen
// (nur exakte Texte in Anführungszeichen oder als JSX-Text – Code bleibt unberührt)
// ---------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const dict = JSON.parse(readFileSync(join(here, "ui.de.json"), "utf8"));
const uiFiles = [];
const walk = dir => {
    for (const n of readdirSync(dir)) {
        const p = join(dir, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(n)) uiFiles.push(p);
    }
};
walk(join(root, "src/components/settings"));
uiFiles.push(join(root, "src/plugins/_core/settings.tsx"));
for (const n of ["src/components/VencordSettings", "src/plugins/_api/notices.ts"]) { /* optional, falls vorhanden */ }

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let count = 0;
const used = new Set();
for (const file of uiFiles) {
    let src = readFileSync(file, "utf8");
    const before = src;
    for (const [en, de] of Object.entries(dict)) {
        // "Text" als String-Literal
        const q = JSON.stringify(en);
        if (src.includes(q)) { src = src.split(q).join(JSON.stringify(de)); used.add(en); }
        // >Text< als JSX-Text (auch mit Zeilenumbrüchen drumherum)
        const re = new RegExp(">(\\s*)" + esc(en) + "(\\s*)<", "g");
        if (re.test(src)) { src = src.replace(re, (_, a, b) => ">" + a + de.replace(/[{}<>]/g, "") + b + "<"); used.add(en); }
    }
    if (src !== before) { writeFileSync(file, src); count++; }
}
console.log(`✔ Deutsche Texte: ${used.size}/${Object.keys(dict).length} gefunden, ${count} Dateien angepasst`);
const missing = Object.keys(dict).filter(k => !used.has(k));
if (missing.length) console.log("  (nicht gefunden: " + missing.join(" | ") + ")");

console.log(warnings ? `Fertig mit ${warnings} Warnung(en).` : "Branding vollständig angewendet.");
