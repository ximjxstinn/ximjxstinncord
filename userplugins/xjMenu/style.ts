/*
 * xImJxstinnCord – Design des eigenen Menüs
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const CSS = `
.xjm-mount { display: block; }
.xjm {
    --a: var(--xj-accent, #9146ff);
    --a2: color-mix(in srgb, var(--a) 55%, #ff4fd8);
    --glass: color-mix(in srgb, var(--a) 5%, rgba(255,255,255,.035));
    --glass2: color-mix(in srgb, var(--a) 9%, rgba(255,255,255,.05));
    --line: color-mix(in srgb, var(--a) 18%, rgba(255,255,255,.07));
    --tx: var(--text-default, var(--text-normal, #e6e6ef));
    --mu: var(--text-muted, #9a9ab0);
    --hd: var(--header-primary, #fff);
    color: var(--tx);
    font-family: var(--font-primary, inherit);
    display: flex; flex-direction: column; gap: 14px;
    padding-bottom: 40px;
}
.xjm.intro { animation: xjm-in .25s ease; }
@keyframes xjm-in { from { opacity: 0; transform: translateY(6px); } }
.xjm button { font-family: inherit; }

/* ---------- Hero ---------- */
.xjm-hero {
    position: relative; overflow: hidden;
    display: flex; align-items: center; gap: 18px;
    padding: 26px 24px; border-radius: 20px;
    background: linear-gradient(125deg, color-mix(in srgb, var(--a) 55%, #0b0b12), #0d0d14 70%);
    border: 1px solid color-mix(in srgb, var(--a) 40%, transparent);
    box-shadow: 0 18px 50px -24px var(--a);
}
.xjm-hero-glow { position: absolute; border-radius: 50%; filter: blur(40px); opacity: .55; pointer-events: none; }
.xjm-hero-glow.a { width: 220px; height: 220px; right: -40px; top: -90px; background: var(--a2); animation: xjm-float 7s ease-in-out infinite; }
.xjm-hero-glow.b { width: 160px; height: 160px; right: 160px; bottom: -110px; background: var(--a); animation: xjm-float 9s ease-in-out infinite reverse; }
@keyframes xjm-float { 50% { transform: translate(-20px, 14px) scale(1.08); } }
.xjm-logo {
    position: relative; z-index: 1; flex: none;
    width: 68px; height: 68px; border-radius: 20px;
    display: grid; place-items: center;
    font-size: 34px; font-weight: 900; color: #fff;
    background: linear-gradient(135deg, var(--a), var(--a2));
    box-shadow: 0 10px 30px -8px var(--a), inset 0 1px 0 rgba(255,255,255,.35);
    transform: rotate(-6deg);
}
.xjm-hero-text { position: relative; z-index: 1; }
.xjm-hero-text h1 { margin: 0; font-size: 28px; font-weight: 900; color: #fff; letter-spacing: -.01em; }
.xjm-hero-text p { margin: 2px 0 10px; color: rgba(255,255,255,.75); font-size: 14.5px; }
.xjm-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.xjm-chip { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 99px; background: rgba(255,255,255,.12); color: #fff; backdrop-filter: blur(6px); }
.xjm-chip.ok { background: rgba(61, 220, 132, .2); color: #7ff0b0; }
.xjm-chip.warn { background: rgba(255, 184, 77, .2); color: #ffcf85; }

/* ---------- Kacheln ---------- */
.xjm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.xjm-stat {
    padding: 16px; border-radius: 16px; background: var(--glass); border: 1px solid var(--line);
    display: flex; flex-direction: column; gap: 2px;
}
.xjm-stat b {
    font-size: 30px; font-weight: 900; line-height: 1.1;
    background: linear-gradient(135deg, #fff, color-mix(in srgb, var(--a) 60%, #fff));
    -webkit-background-clip: text; background-clip: text; color: transparent;
}
.xjm-stat span { font-size: 12.5px; color: var(--mu); }

.xjm-section { margin: 10px 0 0; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--mu); }

.xjm-actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.xjm-action {
    display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
    padding: 14px; border-radius: 16px; cursor: pointer; text-align: left;
    background: var(--glass); border: 1px solid var(--line); color: var(--tx);
    font-size: 13.5px; font-weight: 600;
    transition: transform .15s, border-color .15s, background .15s;
}
.xjm-action:hover { transform: translateY(-2px); border-color: var(--a); background: var(--glass2); }
.xjm-action-icon { width: 36px; height: 36px; border-radius: 12px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--a), var(--a2)); }

/* ---------- Kopf jeder Seite ---------- */
.xjm-head { display: flex; align-items: center; gap: 14px; padding: 4px 0 6px; }
.xjm-head-icon {
    width: 52px; height: 52px; border-radius: 16px; flex: none; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, var(--a), var(--a2)); box-shadow: 0 10px 24px -10px var(--a);
}
.xjm-head-text { flex: 1; min-width: 0; }
.xjm-head h1 { margin: 0; font-size: 24px; font-weight: 900; color: var(--hd); }
.xjm-head p { margin: 2px 0 0; color: var(--mu); font-size: 13.5px; }
.xjm-head-actions { display: flex; gap: 6px; }

/* ---------- Buttons & Eingaben ---------- */
.xjm-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 16px; border-radius: 12px; border: 0; cursor: pointer;
    font-size: 14px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, var(--a), var(--a2));
    box-shadow: 0 6px 18px -8px var(--a);
    transition: filter .15s, transform .15s;
}
.xjm-btn:hover { filter: brightness(1.12); transform: translateY(-1px); }
.xjm-btn:disabled { opacity: .6; cursor: wait; transform: none; }
.xjm-btn.ghost { background: var(--glass2); box-shadow: none; border: 1px solid var(--line); color: var(--tx); }
.xjm-iconbtn {
    width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line); cursor: pointer;
    display: grid; place-items: center; background: var(--glass); color: var(--mu);
    transition: color .15s, background .15s, border-color .15s;
}
.xjm-iconbtn:hover { color: var(--hd); border-color: var(--a); background: var(--glass2); }
.xjm-iconbtn.fav { color: #ffc93c; border-color: rgba(255, 201, 60, .5); }
.xjm-input {
    width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 12px;
    background: rgba(0,0,0,.25); border: 1px solid var(--line); color: var(--tx); font: inherit; font-size: 14px; outline: none;
}
.xjm-input:focus { border-color: var(--a); box-shadow: 0 0 0 3px color-mix(in srgb, var(--a) 25%, transparent); }
.xjm-input.small { width: 120px; }
.xjm-input.code { font-family: Consolas, "Cascadia Code", monospace; font-size: 13px; resize: vertical; }
select.xjm-input { width: auto; min-width: 160px; }

.xjm-switch { position: relative; width: 46px; height: 26px; flex: none; cursor: pointer; display: inline-block; }
.xjm-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.xjm-switch span { position: absolute; inset: 0; border-radius: 99px; background: rgba(255,255,255,.14); transition: .2s; }
.xjm-switch span::after {
    content: ""; position: absolute; left: 3px; top: 3px; width: 20px; height: 20px; border-radius: 50%;
    background: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.35); transition: .2s cubic-bezier(.3,1.4,.6,1);
}
.xjm-switch input:checked + span { background: linear-gradient(135deg, var(--a), var(--a2)); box-shadow: 0 0 14px -2px var(--a); }
.xjm-switch input:checked + span::after { transform: translateX(20px); }
.xjm-switch.off { opacity: .5; cursor: not-allowed; }

/* ---------- Listen ---------- */
.xjm-list { display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: var(--glass); }
.xjm-opt { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 16px; }
.xjm-list .xjm-opt + .xjm-opt { border-top: 1px solid var(--line); }
.xjm-opt.col { flex-direction: column; align-items: stretch; }
.xjm-opt-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.xjm-opt-text b { font-size: 14.5px; color: var(--hd); font-weight: 650; }
.xjm-opt-text span { font-size: 12.5px; color: var(--mu); }
.xjm-slider { display: flex; align-items: center; gap: 10px; }
.xjm-slider input { width: 180px; accent-color: var(--a); }
.xjm-val { min-width: 34px; text-align: right; font-size: 13px; color: var(--mu); font-variant-numeric: tabular-nums; }

/* ---------- Suche & Filter ---------- */
.xjm-search {
    display: flex; align-items: center; gap: 10px; padding: 0 14px; border-radius: 14px;
    background: rgba(0,0,0,.25); border: 1px solid var(--line); color: var(--mu);
    transition: border-color .15s, box-shadow .15s;
}
.xjm-search:focus-within { border-color: var(--a); box-shadow: 0 0 0 3px color-mix(in srgb, var(--a) 22%, transparent); }
.xjm-search-input { flex: 1; padding: 12px 0; background: none; border: 0; outline: none; color: var(--tx); font: inherit; font-size: 15px; }
.xjm-chiprow, .xjm-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.xjm-filter, .xjm-tab {
    padding: 7px 14px; border-radius: 99px; cursor: pointer; font-size: 13px; font-weight: 700;
    background: var(--glass); border: 1px solid var(--line); color: var(--mu); transition: .15s;
}
.xjm-filter:hover, .xjm-tab:hover { color: var(--hd); border-color: color-mix(in srgb, var(--a) 50%, transparent); }
.xjm-filter.sel, .xjm-tab.sel { color: #fff; border-color: transparent; background: linear-gradient(135deg, var(--a), var(--a2)); box-shadow: 0 6px 16px -8px var(--a); }
.xjm-tabbody { display: flex; flex-direction: column; gap: 12px; }

/* ---------- Karten ---------- */
.xjm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
.xjm-card {
    position: relative; display: flex; gap: 12px; align-items: flex-start;
    padding: 14px; border-radius: 16px; background: var(--glass); border: 1px solid var(--line);
    transition: transform .15s, border-color .15s, box-shadow .15s, background .15s;
}
.xjm-card:hover { transform: translateY(-2px); background: var(--glass2); border-color: color-mix(in srgb, var(--a) 55%, transparent); }
.xjm-card.on { border-color: color-mix(in srgb, var(--a) 60%, transparent); box-shadow: 0 8px 26px -16px var(--a); }
.xjm-card.on::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background: radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--a) 14%, transparent), transparent 60%);
}
.xjm-avatar {
    flex: none; width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center;
    font-size: 19px; font-weight: 900; color: #fff;
    background: linear-gradient(135deg, hsl(var(--h) 70% 58%), hsl(calc(var(--h) + 40) 75% 45%));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.3);
}
.xjm-card-main { flex: 1; min-width: 0; position: relative; z-index: 1; }
.xjm-card-title { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.xjm-card-title b { font-size: 15px; color: var(--hd); font-weight: 800; }
.xjm-card-main p { margin: 4px 0 0; font-size: 12.8px; line-height: 1.4; color: var(--mu);
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.xjm-card-main small { display: block; margin-top: 6px; font-size: 11.5px; color: var(--mu); opacity: .8; }
.xjm-card-side { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; position: relative; z-index: 1; }
.xjm-card-buttons { display: flex; gap: 4px; }
.xjm-tag { font-size: 10.5px; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: rgba(255,255,255,.08); color: var(--mu); letter-spacing: .02em; }
.xjm-tag.own { background: linear-gradient(135deg, var(--a), var(--a2)); color: #fff; }
.xjm-tag.warn { background: rgba(255, 184, 77, .2); color: #ffcf85; }

.xjm-empty { padding: 34px; text-align: center; color: var(--mu); border-radius: 16px; border: 1px dashed var(--line); }
.xjm-empty.small { padding: 18px; }
.xjm-hint { margin: 0; font-size: 13px; color: var(--mu); }
.xjm-row-actions { display: flex; gap: 8px; flex-wrap: wrap; }

/* ---------- Tastenkürzel ---------- */
.xjm-hklist { display: flex; flex-direction: column; gap: 8px; }
.xjm-hk {
    display: flex; align-items: center; gap: 14px; padding: 13px 14px; border-radius: 16px;
    background: var(--glass); border: 1px solid var(--line); transition: border-color .15s, background .15s;
}
.xjm-hk.set { border-color: color-mix(in srgb, var(--a) 45%, transparent); }
.xjm-hk:hover { background: var(--glass2); }
.xjm-hk-icon { width: 38px; height: 38px; flex: none; border-radius: 12px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--a), var(--a2)); }
.xjm-hk .xjm-opt-text { flex: 1; }
.xjm-hk-meta { margin-top: 5px; }
.xjm-hk-side { display: flex; align-items: center; gap: 6px; }
.xjm-key {
    min-width: 128px; padding: 9px 14px; border-radius: 11px; cursor: pointer;
    font: 700 13px Consolas, "Cascadia Code", monospace; letter-spacing: .02em; color: var(--hd);
    background: rgba(0,0,0,.3); border: 1px solid color-mix(in srgb, var(--a) 45%, transparent);
    box-shadow: inset 0 -3px 0 rgba(0,0,0,.35); transition: .15s;
}
.xjm-key:hover { border-color: var(--a); }
.xjm-key.empty { color: var(--mu); font-family: inherit; font-weight: 600; border-style: dashed; box-shadow: none; }
.xjm-key.rec { color: #fff; border-color: var(--a); background: color-mix(in srgb, var(--a) 30%, transparent); animation: xjm-pulse 1s infinite; }
@keyframes xjm-pulse { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--a) 30%, transparent); } }
.xjm-hkadd { position: relative; }
.xjm-suggest {
    margin-top: 6px; display: flex; flex-direction: column; gap: 4px; padding: 6px; border-radius: 14px;
    background: var(--glass2); border: 1px solid var(--line);
}
.xjm-suggest-item {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; cursor: pointer;
    background: none; border: 0; color: var(--tx); text-align: left; font-size: 14px;
}
.xjm-suggest-item:hover { background: color-mix(in srgb, var(--a) 18%, transparent); }
.xjm-suggest-item b { flex: 1; color: var(--hd); }
.xjm-suggest-plus { color: var(--a); display: grid; }
.xjm-avatar.small { width: 30px; height: 30px; border-radius: 9px; font-size: 14px; }
.xjm-hk .xjm-switch { margin-right: 4px; }
.xjm-hk-meta { display: flex; gap: 5px; }
.xjm-hk.custom .xjm-hk-icon { background: linear-gradient(135deg, var(--a2), var(--a)); }
.xjm-hk-icon.big { width: 46px; height: 46px; border-radius: 14px; }
.xjm-emptyadd {
    display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 24px; border-radius: 18px; cursor: pointer;
    background: var(--glass); border: 2px dashed color-mix(in srgb, var(--a) 45%, transparent); color: var(--tx); text-align: center;
    transition: border-color .15s, background .15s, transform .15s;
}
.xjm-emptyadd:hover { border-color: var(--a); background: var(--glass2); transform: translateY(-2px); }
.xjm-emptyadd svg { color: var(--a); }
.xjm-emptyadd b { font-size: 15px; color: var(--hd); }
.xjm-emptyadd span { font-size: 12.5px; color: var(--mu); }
.xjm-typegrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 4px 0 8px; }
.xjm-typebtn {
    padding: 10px 8px; border-radius: 12px; cursor: pointer; font-size: 12.5px; font-weight: 700; line-height: 1.25;
    background: var(--glass); border: 1px solid var(--line); color: var(--mu); transition: .15s;
}
.xjm-typebtn:hover { color: var(--hd); border-color: color-mix(in srgb, var(--a) 50%, transparent); }
.xjm-typebtn.sel { color: #fff; border-color: transparent; background: linear-gradient(135deg, var(--a), var(--a2)); }
.xjm-field { display: flex; flex-direction: column; gap: 6px; padding: 10px 2px; }
.xjm-field b { font-size: 13px; color: var(--hd); }
.xjm-field span { font-size: 12px; color: var(--mu); }
.xjm-row-actions.end { justify-content: flex-end; margin-top: 6px; }
.xjm-tag.ok { background: rgba(61, 220, 132, .15); color: #7ff0b0; }
.xjm-tag.key { background: rgba(0,0,0,.3); color: var(--hd); font-family: Consolas, monospace; border: 1px solid var(--line); }

/* ---------- Neustart-Hinweis ---------- */
.xjm-restart {
    display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px;
    background: linear-gradient(135deg, rgba(255, 184, 77, .18), rgba(255, 120, 77, .1));
    border: 1px solid rgba(255, 184, 77, .45); color: #ffd79a;
}
.xjm-restart > div { flex: 1; display: flex; flex-direction: column; }
.xjm-restart b { color: #fff; }
.xjm-restart span { font-size: 12.5px; }

/* ---------- Updates ---------- */
.xjm-update-card {
    display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 18px;
    background: var(--glass); border: 1px solid var(--line);
}
.xjm-update-card.warn { border-color: rgba(255, 184, 77, .5); background: linear-gradient(135deg, rgba(255,184,77,.12), var(--glass)); }
.xjm-update-ring {
    width: 58px; height: 58px; border-radius: 50%; flex: none; display: grid; place-items: center; color: #fff;
    background: conic-gradient(from 120deg, var(--a), var(--a2), var(--a));
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--a) 18%, transparent);
}
.xjm-update-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.xjm-update-text b { font-size: 17px; color: var(--hd); }
.xjm-update-text span { font-size: 13px; color: var(--mu); }
.xjm-changes { display: flex; flex-direction: column; gap: 6px; }
.xjm-change { display: flex; gap: 10px; align-items: baseline; padding: 8px 12px; border-radius: 10px; background: var(--glass); font-size: 13.5px; }
.xjm-change code { font-size: 12px; color: var(--a2); }

/* ---------- Backup ---------- */
.xjm-twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.xjm-bigcard {
    display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 20px; border-radius: 18px;
    background: var(--glass); border: 1px solid var(--line);
}
.xjm-bigcard b { font-size: 17px; color: var(--hd); }
.xjm-bigcard span { flex: 1; font-size: 13px; color: var(--mu); line-height: 1.45; }
.xjm-bigcard-icon {
    width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, var(--a), var(--a2)); margin-bottom: 4px;
}

/* ---------- Dialog ---------- */
.xjm-overlay {
    position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
    background: rgba(5, 5, 10, .65); backdrop-filter: blur(4px); animation: xjm-in .15s ease;
}
.xjm-dialog {
    --a: var(--xj-accent, #9146ff); --a2: color-mix(in srgb, var(--a) 55%, #ff4fd8);
    --glass: color-mix(in srgb, var(--a) 5%, rgba(255,255,255,.035)); --glass2: color-mix(in srgb, var(--a) 9%, rgba(255,255,255,.05));
    --line: color-mix(in srgb, var(--a) 18%, rgba(255,255,255,.07));
    --tx: var(--text-default, #e6e6ef); --mu: var(--text-muted, #9a9ab0); --hd: var(--header-primary, #fff);
    width: min(600px, 92vw); max-height: 84vh; overflow: auto; border-radius: 22px; color: var(--tx);
    background: linear-gradient(180deg, color-mix(in srgb, var(--a) 12%, #121219), #101016 140px);
    border: 1px solid color-mix(in srgb, var(--a) 35%, transparent);
    box-shadow: 0 30px 80px -20px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.03);
    font-family: var(--font-primary, inherit);
}
.xjm-dialog-body { padding: 20px; }
.xjm-dialog-inner { display: flex; flex-direction: column; gap: 6px; }
.xjm-dialog-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 8px; }
.xjm-dialog-title { flex: 1; min-width: 0; }
.xjm-dialog-title h2 { margin: 0; font-size: 21px; color: var(--hd); font-weight: 900; }
.xjm-dialog-title p { margin: 4px 0 0; font-size: 13px; color: var(--mu); line-height: 1.45; }
.xjm-dialog .xjm-opt { border-radius: 14px; background: var(--glass); border: 1px solid var(--line); }
.xjm-dialog .xjm-opt.main { background: var(--glass2); }
.xjm-authors { margin-top: 6px; font-size: 12px; color: var(--mu); text-align: right; }

/* ---------- Meldung ---------- */
.xjm-toast {
    position: fixed; left: 50%; bottom: 30px; z-index: 10001; transform: translate(-50%, 16px); opacity: 0;
    padding: 11px 18px; border-radius: 14px; font: 600 14px var(--font-primary, sans-serif); color: #fff;
    background: #15151d; border: 1px solid var(--xj-accent, #9146ff); box-shadow: 0 12px 30px rgba(0,0,0,.5);
    transition: .25s; pointer-events: none;
}
.xjm-toast.show { transform: translate(-50%, 0); opacity: 1; }
`;
