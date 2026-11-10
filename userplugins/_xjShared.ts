/*
 * xImJxstinnCord – gemeinsame Helfer für die eigenen Plugins
 * (keine eigene Plugin-Datei, wird nur importiert)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const STYLE_ID = "xj-shared-style";

const CSS = `
.xj-badge{position:fixed;z-index:999;display:flex;align-items:center;gap:7px;padding:6px 12px 6px 10px;border-radius:99px;
background:rgba(14,14,16,.9);color:#efeff1;font:600 12.5px/1 var(--font-primary,sans-serif);cursor:pointer;user-select:none;
box-shadow:0 4px 16px rgba(0,0,0,.4);border:1px solid rgba(145,70,255,.45);touch-action:none}
.xj-badge .xj-dot{width:9px;height:9px;border-radius:50%;background:#777}
.xj-badge.xj-live{border-color:#eb0400}
.xj-badge.xj-live .xj-dot{background:#eb0400;animation:xj-pulse 1.6s infinite}
@keyframes xj-pulse{0%{box-shadow:0 0 0 0 rgba(235,4,0,.7)}70%{box-shadow:0 0 0 7px rgba(235,4,0,0)}100%{box-shadow:0 0 0 0 rgba(235,4,0,0)}}
`;

export function ensureSharedStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.append(s);
}

/** Setzt/entfernt ein <style>-Element mit eigener ID. */
export function setStyle(id: string, css: string | null) {
    let s = document.getElementById(id) as HTMLStyleElement | null;
    if (!css) { s?.remove(); return; }
    if (!s) {
        s = document.createElement("style");
        s.id = id;
        document.head.append(s);
    }
    if (s.textContent !== css) s.textContent = css;
}

interface PosStore { posX: number; posY: number; }

/** Verschiebbares Abzeichen; Position wird in den Plugin-Einstellungen gespeichert. */
export function makeBadge(id: string, store: PosStore, def: { right: number; bottom: number; }, onClick: () => void) {
    ensureSharedStyle();
    removeBadge(id);
    const el = document.createElement("div");
    el.id = id;
    el.className = "xj-badge";
    if (store.posX >= 0 && store.posY >= 0) {
        el.style.left = store.posX + "px";
        el.style.top = store.posY + "px";
    } else {
        el.style.right = def.right + "px";
        el.style.bottom = def.bottom + "px";
    }
    document.body.append(el);

    let sx: number | null = null, sy = 0, ox = 0, oy = 0, moved = false;
    el.addEventListener("pointerdown", e => {
        sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect(); ox = r.left; oy = r.top; moved = false;
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
        if (sx == null) return;
        sx = null;
        if (moved) {
            const r = el.getBoundingClientRect();
            store.posX = Math.round(r.left);
            store.posY = Math.round(r.top);
        } else onClick();
    });
    return el;
}

export function removeBadge(id: string) {
    document.getElementById(id)?.remove();
}
