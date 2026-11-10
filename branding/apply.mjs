// Setzt den Namen "xImJxstinnCord" in den Vencord-Quellcode ein (wird im GitHub-Build ausgeführt).
// Aufruf: node branding/apply.mjs <pfad-zum-vencord-checkout>
// Wenn sich Vencord ändert und eine Stelle nicht mehr gefunden wird, gibt es nur eine Warnung –
// der Build läuft trotzdem weiter.
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

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
            ['useTitle: () => "Vencord Settings"', `useTitle: () => "${NAME} Settings"`]
        ]
    }
];

let warnings = 0;
for (const { file, replace } of edits) {
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
    writeFileSync(path, src);
}
console.log(warnings ? `Fertig mit ${warnings} Warnung(en).` : "Branding vollständig angewendet.");
