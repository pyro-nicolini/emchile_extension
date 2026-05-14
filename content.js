"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Content Script
//  Injects floating button + sidebar iframe, extracts ticket data from Zoho DOM
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  if (window.__emchileInjected) return;
  window.__emchileInjected = true;

  let sidebarFrame = null;
  let floatingBtn = null;
  let fireFab = null;
  let fireMenu = null;
  let fireMenuOpen = false;
  let currentTicketId = null;
  let isAnalyzing = false;
  let sidebarOpen = false;
  let sidebarWidth = 500;
  let isResizing = false;
  let resizerEl = null;

  let expFrame = null;
  let expFab = null;
  let expOpen = false;

  let fireMenuWidth = 450;
  let fireMenuHeight = 600;
  let fireMenuX = 20;
  let fireMenuY = 20;

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get(["emchileSidebarWidth", "emchileFireMenuWidth", "emchileFireMenuHeight", "emchileFireMenuX", "emchileFireMenuY", "emchileFireDebugLogs", "emchileFireSummaryTable", "emchileFireOcInput"], (res) => {
      sidebarWidth = res.emchileSidebarWidth || 500;
      fireMenuWidth = res.emchileFireMenuWidth || 450;
      fireMenuHeight = res.emchileFireMenuHeight || 600;
      fireMenuX = res.emchileFireMenuX || 20;
      fireMenuY = res.emchileFireMenuY || 20;
      
      if (window.top === window) {
        applyWidth(sidebarWidth);
        injectStyles();
        injectUI();
      }
      applyFireMenuSize(fireMenuWidth, fireMenuHeight, fireMenuX, fireMenuY);

      if (res.emchileFireOcInput) {
        const ocInputEl = document.getElementById("fire-oc-input");
        if (ocInputEl) ocInputEl.value = res.emchileFireOcInput;
      }
      if (res.emchileFireDebugLogs) {
        const debugTbody = document.querySelector("#emchile-fire-debug-table tbody");
        if (debugTbody) debugTbody.innerHTML = res.emchileFireDebugLogs;
      }
      if (res.emchileFireSummaryTable) {
        const summaryTbody = document.querySelector("#emchile-fire-summary-table tbody");
        if (summaryTbody) summaryTbody.innerHTML = res.emchileFireSummaryTable;
      }

      setupMutationObserver();
      setupHistoryListeners();
      setupEmergencyClose();
      setTimeout(checkTicketChange, 1600);
      setInterval(scanMercadoPublicoResults, 3000);

      // Inicializar dropdown de OCs en Mercado Público
      if (window.location.href.includes("mercadopublico.cl")) {
        initMPDropdown();
      }

      // Si estamos en Mercado Público y hay una OC en el hash, buscarla automáticamente
      if (window.location.href.includes("mercadopublico.cl")) {
        const hash = window.location.hash;
        if (hash.startsWith("#search=")) {
          const oc = hash.split("=")[1];
          if (oc) {
            console.log("EMChile: Búsqueda automática detectada para OC:", oc);
            // Mayor retraso para asegurar que los scripts del portal carguen
            setTimeout(() => searchOcInMercadoPublico(oc), 3000);
            // Limpiar hash para no repetir
            history.replaceState(null, null, ' ');
          }
        }
      }

      // Check if we were in the middle of a Play X2 flow
      chrome.storage.local.get(["emchilePendingPlay2"], (res2) => {
        if (res2.emchilePendingPlay2) {
          chrome.storage.local.remove("emchilePendingPlay2");
          fireLog("Continuando Play X2: Preparando vista de chat...");
          handleFirePlay2Step2();
        }
      });

      // Polling de URL para SPAs (Zoho Desk) - Detectar navegación a ticket tras PLAY X2
      let lastUrlPlay2 = location.href;
      setInterval(() => {
        if (location.href !== lastUrlPlay2) {
          lastUrlPlay2 = location.href;
          chrome.storage.local.get(["emchilePendingPlay2"], (r) => {
            if (r.emchilePendingPlay2) {
              chrome.storage.local.remove("emchilePendingPlay2");
              fireLog("Navegación detectada: Extrayendo conversación...");
              handleFirePlay2Step2();
            }
          });
        }
      }, 1000);
    });
  }

  function applyWidth(w) {
    document.documentElement.style.setProperty("--emchile-width", `${w}px`);
  }

  // ─── STYLES ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("emchile-styles")) return;
    const s = document.createElement("style");
    s.id = "emchile-styles";
    s.textContent = `
      #emchile-fab {
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        background: linear-gradient(160deg, #080e1e 0%, #0d1a33 100%);
        border: 1px solid rgba(0,212,255,0.55);
        border-radius: 14px;
        padding: 14px 10px;
        cursor: pointer;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 0 22px rgba(0,212,255,0.22), 0 6px 24px rgba(0,0,0,0.5);
        min-width: 60px;
      }
      #emchile-fab:hover {
        border-color: rgba(168,85,247,0.75);
        box-shadow: 0 0 32px rgba(168,85,247,0.5), 0 0 64px rgba(0,212,255,0.12), 0 6px 24px rgba(0,0,0,0.55);
        transform: translateY(-50%) scale(1.07);
      }
      #emchile-fab .ef-icon { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 5px rgba(0,212,255,0.9)); }
      #emchile-fab .ef-text {
        font-family: 'Menlo','Courier New',monospace;
        font-size: 9px; font-weight: 700;
        color: #00d4ff; letter-spacing: 1.5px; text-transform: uppercase;
        text-shadow: 0 0 8px rgba(0,212,255,0.65);
      }
      #emchile-fab.fab-analyzing {
        border-color: rgba(168,85,247,0.85);
        animation: emchile-pulse 1.4s ease-in-out infinite;
      }
      #emchile-fab.fab-open { right: calc(var(--emchile-width, 500px) + 16px); }
      @keyframes emchile-pulse {
        0%,100% { box-shadow: 0 0 22px rgba(168,85,247,0.4), 0 6px 24px rgba(0,0,0,0.5); }
        50%      { box-shadow: 0 0 44px rgba(168,85,247,0.75), 0 0 88px rgba(0,212,255,0.18), 0 6px 24px rgba(0,0,0,0.5); }
      }
      #emchile-sidebar-frame {
        position: fixed;
        top: 0; right: calc(-1 * var(--emchile-width, 500px) - 20px);
        width: var(--emchile-width, 500px); height: 100vh;
        border: none;
        z-index: 2147483641;
        transition: right 0.32s cubic-bezier(0.4,0,0.2,1);
        box-shadow: -8px 0 48px rgba(0,0,0,0.65);
      }
      #emchile-sidebar-frame.frame-open { right: 0; }

      /* Disable transitions during resize/drag */
      body.emchile-resizing #emchile-sidebar-frame,
      body.emchile-resizing #emchile-resizer,
      body.emchile-resizing #emchile-fire-menu {
        transition: none !important;
      }
      body.emchile-resizing {
        user-select: none !important;
      }
      
      #emchile-resizer {
        position: fixed;
        top: 0; right: var(--emchile-width, 500px);
        width: 14px; height: 100vh;
        z-index: 2147483642;
        cursor: col-resize;
        transform: translateX(50%);
        display: none;
        transition: background 0.2s;
      }
      #emchile-resizer.resizer-open { display: block; }
      #emchile-resizer:hover, body.emchile-resizing #emchile-resizer {
        background: rgba(0, 212, 255, 0.15);
        border-left: 1px solid rgba(0, 212, 255, 0.3);
      }

      /* Global overlay to capture events while resizing/dragging */
      #emchile-global-overlay {
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        z-index: 2147483643;
        display: none;
        cursor: inherit;
      }
      body.emchile-resizing #emchile-global-overlay {
        display: block;
      }

      /* EXPERIMENTAL FAB & FRAME */
      #emchile-exp-fab {
        position: fixed;
        left: 20px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        background: linear-gradient(160deg, #10b981 0%, #047857 100%);
        border: 1px solid rgba(52, 211, 153, 0.55);
        border-radius: 14px;
        padding: 14px 10px;
        cursor: pointer;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 0 22px rgba(16, 185, 129, 0.3), 0 6px 24px rgba(0,0,0,0.5);
        min-width: 60px;
      }

      /* OC DROPDOWN - MERCADO PUBLICO */
      .emchile-oc-dropdown {
        position: absolute;
        z-index: 2147483647;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.7);
        max-height: 400px;
        overflow-y: auto;
        min-width: 280px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: emchile-fade-in 0.2s ease-out;
      }
      @keyframes emchile-fade-in {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .emchile-oc-item {
        padding: 10px 14px;
        border-bottom: 1px solid #21262d;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 3px;
        transition: background 0.2s;
      }
      .emchile-oc-item:last-child { border-bottom: none; }
      .emchile-oc-item:hover { background: #161b22; border-left: 3px solid #58a6ff; padding-left: 11px; }
      .emchile-oc-oc { color: #58a6ff; font-weight: 700; font-size: 13px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
      .emchile-oc-meta { display: flex; justify-content: space-between; align-items: center; }
      .emchile-oc-status { color: #8b949e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
      .emchile-oc-monto { color: #3fb950; font-size: 11px; font-weight: 500; }
      .emchile-oc-empty { padding: 20px; text-align: center; color: #8b949e; font-size: 12px; font-style: italic; }
      .emchile-oc-header { padding: 8px 14px; background: #161b22; border-bottom: 1px solid #30363d; font-size: 10px; color: #58a6ff; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-radius: 8px 8px 0 0; }
      #emchile-exp-fab:hover {
        border-color: rgba(52, 211, 153, 0.8);
        box-shadow: 0 0 32px rgba(52, 211, 153, 0.6), 0 6px 24px rgba(0,0,0,0.55);
        transform: translateY(-50%) scale(1.07);
      }
      #emchile-exp-fab .ef-icon { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.9)); }
      #emchile-exp-fab .ef-text {
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 9px; font-weight: 800;
        color: #ecfdf5; letter-spacing: 1.5px; text-transform: uppercase;
        text-shadow: 0 0 8px rgba(52, 211, 153, 0.65);
      }
      #emchile-exp-fab.fab-open { left: calc(var(--emchile-width, 500px) + 16px); }

      #emchile-exp-frame {
        position: fixed;
        top: 0; left: calc(-1 * var(--emchile-width, 500px) - 20px);
        width: var(--emchile-width, 500px); height: 100vh;
        border: none;
        z-index: 2147483641;
        transition: left 0.32s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 8px 0 48px rgba(0,0,0,0.65);
      }
      #emchile-exp-frame.frame-open { left: 0; }

      /* FIRE FAB & MENU - BLUE SKY REDESIGN */
      #emchile-fire-fab {
        position: fixed;
        right: 20px;
        top: 180px;
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        background: linear-gradient(160deg, #0ea5e9 0%, #0369a1 100%);
        border: 1px solid rgba(56, 189, 248, 0.55);
        border-radius: 14px;
        padding: 14px 10px;
        cursor: pointer;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 0 22px rgba(14, 165, 233, 0.3), 0 6px 24px rgba(0,0,0,0.5);
        min-width: 60px;
      }
      #emchile-fire-fab:hover {
        border-color: rgba(56, 189, 248, 0.8);
        box-shadow: 0 0 32px rgba(56, 189, 248, 0.6), 0 6px 24px rgba(0,0,0,0.55);
        transform: translateY(-2px);
      }
      #emchile-fire-fab .ef-icon { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.9)); }
      #emchile-fire-fab .ef-text {
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 9px; font-weight: 800;
        color: #e0f2fe; letter-spacing: 1.5px; text-transform: uppercase;
        text-shadow: 0 0 8px rgba(56, 189, 248, 0.65);
      }
      #emchile-fire-menu {
        position: fixed;
        left: var(--emchile-fire-x, 20px);
        top: var(--emchile-fire-y, 20px);
        width: var(--emchile-fire-width, 450px);
        height: var(--emchile-fire-height, 600px);
        z-index: 2147483645;
        background: #0f172a;
        border: 1px solid rgba(56, 189, 248, 0.2);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: 'Inter', system-ui, sans-serif;
        color: #f1f5f9;
        transition: opacity 0.3s ease;
      }
      #emchile-fire-menu.fire-open {
        display: flex !important;
        opacity: 1;
      }
      /* Custom Scrollbar */
      #emchile-fire-menu ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      #emchile-fire-menu ::-webkit-scrollbar-track {
        background: transparent;
      }
      #emchile-fire-menu ::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 10px;
      }
      #emchile-fire-menu ::-webkit-scrollbar-thumb:hover {
        background: #475569;
      }
      #fire-main-view {
        flex: 1;
        overflow-y: auto;
        padding: 0 20px 20px 20px;
      }
      #emchile-fire-menu input {
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 10px;
        background: #1e293b;
        border: 1px solid #334155;
        color: #f8fafc;
        border-radius: 8px;
        font-size: 13px;
        transition: border-color 0.2s;
      }
      #emchile-fire-menu input:focus {
        border-color: #38bdf8;
        outline: none;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
      }
      #emchile-fire-menu button {
        width: 100%;
        padding: 10px;
        background: #0ea5e9;
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        transition: all 0.2s;
      }
      #emchile-fire-menu button:hover {
        background: #0284c7;
        transform: translateY(-1px);
      }
      #emchile-fire-table-container {
        margin-top: 15px;
      }
      #emchile-fire-table-container table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      #emchile-fire-table-container th, #emchile-fire-table-container td {
        border: 1px solid #800000;
        padding: 6px;
        text-align: left;
      }
      #emchile-fire-table-container th {
        background: #600000;
      }
      /* New Table & Debug Collapsible */
      .fire-summary-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        margin-top: 5px;
        background: #1e293b;
        border-radius: 8px;
        overflow: hidden;
      }
      .fire-summary-table th, .fire-summary-table td {
        border-bottom: 1px solid #334155;
        padding: 10px 12px;
        text-align: left;
      }
      .fire-summary-table th {
        background: #334155;
        color: #38bdf8;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: 0.5px;
      }
      #emchile-fire-debug-toggle {
        cursor: pointer;
        background: #1e293b;
        padding: 10px 15px;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid #334155;
        margin-top: 10px;
      }
      #emchile-fire-debug-toggle:hover {
        background: #334155;
      }
      #emchile-fire-resizer {
        position: absolute;
        right: 0;
        top: 0;
        width: 10px;
        height: 100%;
        cursor: ew-resize;
        z-index: 100;
      }
      #emchile-fire-resizer-v {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 10px;
        cursor: ns-resize;
        z-index: 100;
      }
      .fire-find-section {
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.1) 0%, rgba(14, 165, 233, 0.02) 100%);
        border: 1px solid rgba(14, 165, 233, 0.2);
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 15px;
        position: relative;
        backdrop-filter: blur(10px);
      }
      .fire-find-label {
        font-size: 0.7em;
        font-weight: 800;
        color: #38bdf8;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      #emchile-fire-menu h4 { font-size: 0.9em; font-weight: 700; color: #38bdf8; }
      #emchile-fire-menu input { font-size: 0.9em; }
      #emchile-fire-menu button { font-size: 1em; }
      .fire-summary-table { font-size: 0.8em; }
      #emchile-fire-debug-content { font-size: 0.8em; }

      /* WhatsApp Styles */
      .wa-multi-container {
        display: flex;
        flex-direction: row;
        gap: 20px;
        overflow-x: auto;
        padding: 20px;
        background: #0f172a;
        min-height: 400px;
      }
      .wa-ticket-column {
        min-width: 400px;
        max-width: 480px;
        height: 650px;
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(56, 189, 248, 0.15);
        border-radius: 16px;
        background: #1e293b;
        overflow: hidden;
        flex-shrink: 0;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      }
      .wa-column-header {
        padding: 15px 20px;
        background: #334155;
        border-bottom: 1px solid rgba(56, 189, 248, 0.1);
      }
      .wa-container {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
        background-blend-mode: soft-light;
        background-color: #0f172a;
      }
      .wa-msg {
        max-width: 85%;
        margin-bottom: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 0.75em;
        line-height: 1.4;
        position: relative;
        box-shadow: 0 1px 0.5px rgba(0,0,0,0.13);
      }
      .wa-msg.in {
        align-self: flex-start;
        background: #1e293b;
        color: #f1f5f9;
        border-top-left-radius: 0;
        border: 1px solid rgba(255,255,255,0.03);
      }
      .wa-msg.out {
        align-self: flex-end;
        background: #0ea5e9;
        color: #fff;
        border-top-right-radius: 0;
        box-shadow: 0 4px 12px rgba(14, 165, 233, 0.2);
      }
      .wa-msg-header {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.8em;
        font-weight: bold;
        color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      }
      .wa-msg-time-badge {
        display: inline-block;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75em;
        color: #8696a0;
        font-weight: 600;
      }
      .wa-minimize-btn {
        opacity: 0.4;
        transition: opacity 0.2s;
        padding: 0 4px;
      }
      .wa-minimize-btn:hover { opacity: 1; }
      .wa-text.collapsed { display: none; }
      .wa-back-btn {
        background: transparent;
        border: 1px solid #444;
        color: #aaa;
        padding: 4px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
      }
      .wa-back-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    `;
    document.head.appendChild(s);
  }

  // ─── UI INJECTION ──────────────────────────────────────────────────────────
  function injectUI() {
    if (document.getElementById("emchile-fab")) return;

    // Floating Action Button
    floatingBtn = document.createElement("div");
    floatingBtn.id = "emchile-fab";
    floatingBtn.setAttribute("role", "button");
    floatingBtn.setAttribute("aria-label", "EMChile AI Desk");
    floatingBtn.innerHTML =
      '<div class="ef-icon">⚡</div><div class="ef-text">AI Desk</div>';
    floatingBtn.addEventListener("click", handleFabClick);
    document.body.appendChild(floatingBtn);

    // Fire FAB
    fireFab = document.createElement("div");
    fireFab.id = "emchile-fire-fab";
    fireFab.setAttribute("role", "button");
    fireFab.setAttribute("aria-label", "EMChile Fire Desk");
    fireFab.innerHTML =
      '<div class="ef-icon">🔥</div><div class="ef-text">FUEGO</div>';
    fireFab.addEventListener("click", handleFireFabClick);
    document.body.appendChild(fireFab);

    // Experimental FAB
    expFab = document.createElement("div");
    expFab.id = "emchile-exp-fab";
    expFab.setAttribute("role", "button");
    expFab.setAttribute("aria-label", "EMChile Experimental");
    expFab.innerHTML = '<div class="ef-icon">🧪</div><div class="ef-text">LAB</div>';
    expFab.addEventListener("click", handleExpFabClick);
    document.body.appendChild(expFab);

    // Fire Menu
    fireMenu = document.createElement("div");
    fireMenu.id = "emchile-fire-menu";
    fireMenu.innerHTML = `
      <div id="emchile-fire-drag-handle" style="display:flex; justify-content:space-between; align-items:center; padding: 12px 15px; background: rgba(14, 165, 233, 0.1); border-bottom: 1px solid rgba(56, 189, 248, 0.2); cursor: move; user-select:none;">
        <div style="display:flex; align-items:center; gap:8px; pointer-events:none;">
          <span style="font-size:16px;">🔥</span>
          <span style="font-weight:700; color:#38bdf8; letter-spacing:0.5px; font-size:11px; text-transform:uppercase;">Fire Dashboard</span>
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          <div id="fire-config-gear" title="Configuración" style="cursor:pointer; font-size:16px; opacity:0.6; transition:opacity 0.2s;">⚙️</div>
          <div id="fire-close-x" style="cursor:pointer; font-size:18px; opacity:0.5; font-weight:bold;">×</div>
        </div>
      </div>

      <div id="emchile-fire-resizer-h" style="position:absolute; right:0; top:0; width:6px; height:100%; cursor:ew-resize; z-index:10;"></div>
      <div id="emchile-fire-resizer-v" style="position:absolute; bottom:0; left:0; width:100%; height:6px; cursor:ns-resize; z-index:10;"></div>

      <div id="fire-main-view">
        <div style="padding: 15px 0 0 0;">
          <input type="text" id="fire-oc-input" placeholder="Pegar OC (ej. 1234-56-AG25)" />
        </div>
        
        <div style="display:flex; gap:8px; margin-bottom:15px;">
          <button id="fire-play-btn" style="flex:1;">PLAY X1</button>
          <button id="fire-play2-btn" style="flex:1; background:#0369a1;">PLAY X2</button>
        </div>

        <!-- API Config (Hidden by default) -->
        <div id="emchile-fire-config-panel" style="display:none; margin-bottom: 15px; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 12px; padding: 12px; background: rgba(14, 165, 233, 0.05);">
            <h4 style="margin:0 0 10px 0; color:#38bdf8; font-size:0.8em; text-transform:uppercase;">⚙️ Configuración API</h4>
            <div style="margin-bottom:10px;">
              <label style="display:block; font-size:0.7em; color:#94a3b8; margin-bottom:3px;">Portal Name</label>
              <input type="text" id="fire-portal-input" placeholder="p.ej imcsupplier" style="margin-bottom:0;" />
            </div>
            <div>
              <label style="display:block; font-size:0.7em; color:#94a3b8; margin-bottom:3px;">Org ID</label>
              <input type="text" id="fire-orgid-input" placeholder="p.ej 854243902" style="margin-bottom:0;" />
            </div>
        </div>

        <!-- New Summary Table -->
        <div id="fire-summary-section">
          <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:0.8em; text-transform:uppercase;">Opciones Encontradas</h4>
          <div style="max-height:250px; overflow-y:auto; border:1px solid #334155; border-radius:8px; background: #1e293b;">
            <table id="emchile-fire-summary-table" class="fire-summary-table">
              <thead>
                <tr>
                  <th>OC</th>
                  <th>Ticket</th>
                  <th>Emisor</th>
                  <th>Hora/Fecha</th>
                  <th>Asunto</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

        <div id="fire-whatsapp-view" style="display:none; margin-top: 20px;">
          <h4 style="margin:0 0 8px 0; color:#38bdf8; font-size:0.8em; text-transform:uppercase;">Conversación WhatsApp</h4>
          <div class="wa-container" id="wa-container">
            <!-- WhatsApp messages will be injected here -->
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(fireMenu);

    // Toggle API Config via Gear
    const configGear = document.getElementById("fire-config-gear");
    const configPanel = document.getElementById("emchile-fire-config-panel");
    configGear.addEventListener("click", () => {
      const isHidden = configPanel.style.display === "none";
      configPanel.style.display = isHidden ? "block" : "none";
      configGear.style.opacity = isHidden ? "1" : "0.6";
    });

    const closeX = document.getElementById("fire-close-x");
    closeX.addEventListener("click", () => {
      fireMenuOpen = false;
      fireMenu.classList.remove("fire-open");
    });

    // Interaction State
    let isDragging = false;
    let isFireResizingH = false;
    let isFireResizingV = false;
    let dragStartX, dragStartY, initialLeft, initialTop;
    let rafId = null;

    // Drag Logic for Fire Menu
    const dragHandle = document.getElementById("emchile-fire-drag-handle");
    dragHandle.addEventListener("mousedown", (e) => {
      if (e.target.id === "fire-config-gear" || e.target.id === "fire-close-x") return;
      isDragging = true;
      document.body.classList.add("emchile-resizing");
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = fireMenu.offsetLeft;
      initialTop = fireMenu.offsetTop;
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    // Fire Resizer Logic (Horizontal)
    const fireResizerH = document.getElementById("emchile-fire-resizer-h");
    fireResizerH.addEventListener("mousedown", (e) => {
      isFireResizingH = true;
      document.body.classList.add("emchile-resizing");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    // Fire Resizer Logic (Vertical)
    const fireResizerV = document.getElementById("emchile-fire-resizer-v");
    fireResizerV.addEventListener("mousedown", (e) => {
      isFireResizingV = true;
      document.body.classList.add("emchile-resizing");
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });

    // Unified Window MouseMove
    window.addEventListener("mousemove", (e) => {
      if (!isDragging && !isFireResizingH && !isFireResizingV && !isResizing) return;
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (isDragging) {
          const dx = e.clientX - dragStartX;
          const dy = e.clientY - dragStartY;
          fireMenu.style.left = (initialLeft + dx) + "px";
          fireMenu.style.top = (initialTop + dy) + "px";
        }
        if (isFireResizingH) {
          const newWidth = e.clientX - fireMenu.offsetLeft;
          if (newWidth > 350 && newWidth < 1800) {
            fireMenuWidth = newWidth;
            applyFireMenuSize(fireMenuWidth, fireMenuHeight);
          }
        }
        if (isFireResizingV) {
          const newHeight = e.clientY - fireMenu.offsetTop;
          const maxH = window.innerHeight - 50; 
          if (newHeight > 300 && newHeight < maxH) {
            fireMenuHeight = newHeight;
            applyFireMenuSize(fireMenuWidth, fireMenuHeight);
          }
        }
        if (isResizing) {
          let newW = window.innerWidth - e.clientX;
          // Enforce bounds: min 300px, max window - 50px
          newW = Math.max(300, Math.min(newW, window.innerWidth - 50));
          sidebarWidth = newW;
          applyWidth(sidebarWidth);
        }
        rafId = null;
      });
    });

    // Unified Window MouseUp
    window.addEventListener("mouseup", () => {
      if (isDragging || isFireResizingH || isFireResizingV || isResizing) {
        document.body.classList.remove("emchile-resizing");
        if (isResizing) {
          isResizing = false;
          sidebarFrame.style.pointerEvents = "auto";
          chrome.storage.local.set({ emchileSidebarWidth: sidebarWidth });
        } else {
          isDragging = false;
          isFireResizingH = false;
          isFireResizingV = false;
          chrome.storage.local.set({ 
            emchileFireMenuWidth: fireMenuWidth,
            emchileFireMenuHeight: fireMenuHeight,
            emchileFireMenuX: fireMenu.offsetLeft,
            emchileFireMenuY: fireMenu.offsetTop
          });
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    });

    const ocInputEl = document.getElementById("fire-oc-input");
    ocInputEl.addEventListener("change", (e) => {
      chrome.storage.local.set({ emchileFireOcInput: e.target.value.trim() });
    });

    const playBtn = document.getElementById("fire-play-btn");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        handleFirePlayClick();
      });
    }

    const play2Btn = document.getElementById("fire-play2-btn");
    if (play2Btn) {
      play2Btn.addEventListener("click", () => {
        handleFirePlay2Click();
      });
    }

    const portalInput = document.getElementById("fire-portal-input");
    const orgIdInput = document.getElementById("fire-orgid-input");

    chrome.storage.local.get(['firePortalName', 'fireOrgId'], (res) => {
        if (res.firePortalName) portalInput.value = res.firePortalName;
        if (res.fireOrgId) orgIdInput.value = res.fireOrgId;
    });

    portalInput.addEventListener("input", (e) => chrome.storage.local.set({ firePortalName: e.target.value.trim() }));
    orgIdInput.addEventListener("input", (e) => chrome.storage.local.set({ fireOrgId: e.target.value.trim() }));

    // Sidebar iframe (loads sidebar.html from extension)
    sidebarFrame = document.createElement("iframe");
    sidebarFrame.id = "emchile-sidebar-frame";
    sidebarFrame.title = "EMChile AI Desk";
    sidebarFrame.src = chrome.runtime.getURL("sidebar.html?v=" + Date.now());
    document.body.appendChild(sidebarFrame);

    // Experimental iframe
    expFrame = document.createElement("iframe");
    expFrame.id = "emchile-exp-frame";
    expFrame.title = "EMChile Experimental";
    expFrame.src = chrome.runtime.getURL("sidebar.html?mode=exp&v=" + Date.now() + "#exp");
    document.body.appendChild(expFrame);

    // Resizer handle
    resizerEl = document.createElement("div");
    resizerEl.id = "emchile-resizer";
    document.body.appendChild(resizerEl);

    // Global overlay for resize/drag
    const overlay = document.createElement("div");
    overlay.id = "emchile-global-overlay";
    document.body.appendChild(overlay);

    // Setup drag events for AI Desk sidebar
    resizerEl.addEventListener("mousedown", (e) => {
      isResizing = true;
      document.body.classList.add("emchile-resizing");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      sidebarFrame.style.pointerEvents = "none";
      e.preventDefault();
    });
  }

  // ─── FAB CLICK ─────────────────────────────────────────────────────────────
  function handleFireFabClick() {
    fireMenuOpen = !fireMenuOpen;
    if (fireMenuOpen) {
      fireMenu.classList.add("fire-open");
      if (sidebarOpen) closeSidebar();
      if (expOpen) closeExpSidebar();
    } else {
      fireMenu.classList.remove("fire-open");
    }
  }

  function fireLog(msg) {
    const tbody = document.querySelector("#emchile-fire-debug-table tbody");
    if (!tbody) return;
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const rowHTML = `<tr><td style="padding:2px 4px; border-bottom:1px solid #500; white-space:nowrap; width:1%; color:#aaa;">[${time}]</td><td style="padding:2px 4px; border-bottom:1px solid #500; color:#ddd;">${msg}</td></tr>`;
    tbody.innerHTML = rowHTML + tbody.innerHTML; // Prepend
    chrome.storage.local.set({ emchileFireDebugLogs: tbody.innerHTML });
  }

  function applyFireMenuSize(w, h, x, y) {
    if (fireMenu) {
      fireMenu.style.width = w + "px";
      fireMenu.style.height = h + "px";
      if (x !== undefined) fireMenu.style.left = x + "px";
      if (y !== undefined) fireMenu.style.top = y + "px";
      
      // Scale font-size: base 13px at 400px width.
      const baseFontSize = 13;
      const scaledSize = Math.max(9, Math.min(20, (w / 450) * baseFontSize));
      fireMenu.style.fontSize = scaledSize + "px";
    }
  }

  function handleFirePlayClick() {
    fireLog(`Botón PLAY X1 presionado.`);
    const ocInputEl = document.getElementById("fire-oc-input");
    const ocInput = ocInputEl ? ocInputEl.value.trim() : "";
    
    if (!ocInput) {
      alert("Por favor ingresa una OC.");
      return;
    }

    fireLog(`Iniciando búsqueda de OC: ${ocInput}`);

    // Limpiar tabla resumen antes de empezar
    const summaryTbody = document.querySelector("#emchile-fire-summary-table tbody");
    if (summaryTbody) summaryTbody.innerHTML = "";
    chrome.storage.local.remove("emchileFireSummaryTable");

    // Disparar atajo de teclado '/' para abrir la busqueda en Zoho
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "/",
      code: "Slash",
      keyCode: 191,
      which: 191,
      bubbles: true,
      cancelable: true
    }));
    document.dispatchEvent(new KeyboardEvent("keyup", {
      key: "/",
      code: "Slash",
      keyCode: 191,
      which: 191,
      bubbles: true,
      cancelable: true
    }));
    
    fireLog(`Atajo '/' enviado para abrir búsqueda global`);

    setTimeout(() => {
      // Buscar el input de busqueda que deberia tener el foco
      let searchBox = document.activeElement;
      
      if (!searchBox || (searchBox.tagName !== "INPUT" && searchBox.tagName !== "TEXTAREA")) {
        // Fallback si no tomo el foco automaticamente
        const fallbacks = document.querySelectorAll("input[type='search'], [placeholder*='Search' i], [placeholder*='Buscar' i], #searchword, .search-input, .global-search");
        if (fallbacks.length > 0) {
          searchBox = fallbacks[0];
          searchBox.focus();
        }
      }

      if (searchBox && (searchBox.tagName === "INPUT" || searchBox.tagName === "TEXTAREA")) {
        fireLog(`Caja de búsqueda localizada. Pegando texto.`);
        searchBox.value = ocInput;
        searchBox.dispatchEvent(new Event("input", { bubbles: true }));
        searchBox.dispatchEvent(new Event("change", { bubbles: true }));

        // Presionar Enter
        fireLog(`Ejecutando Enter para iniciar búsqueda...`);
        searchBox.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
        searchBox.dispatchEvent(new KeyboardEvent("keyup", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
      } else {
        fireLog(`Error: Caja de búsqueda de Zoho no encontrada.`);
        return;
      }

      fireLog(`Esperando carga de resultados DOM...`);

      // Polling para esperar los resultados
      let retries = 0;
      const pollTimer = setInterval(() => {
        retries++;
        if (retries > 20) {
          clearInterval(pollTimer);
          fireLog(`Timeout: No se detectaron resultados tras 10 segundos.`);
          return;
        }

        const resultCandidates = [
          ".zd-search-result-item", ".search-result-item", ".zs-list-item", ".zs-item", 
          ".search-list-item", ".search-row", ".zd-search-result", ".zgh-searchRow",
          ".search-record-item", ".search-list-row", ".record-row", ".lyteTableRow",
          ".zd-ticket-row", ".zd-list-row", ".zd-record-row",
          "lyte-table-row", "tr.lyteTableRow", ".dv-row", ".ticket-row", "[class*='listRow']",
          ".zgh-search-result-row", ".search-ticket-row", ".zd-search-item", ".search-record",
          "[data-test-id='search-result-item']", ".zd-list-item-wrapper"
        ];
        
        let listRows = [];
        let matchedSelector = "Ninguno";

        for (const sel of resultCandidates) {
          try {
            const rows = document.querySelectorAll(sel);
            if (rows.length > 0) {
              if (rows.length >= 3) { 
                listRows = Array.from(rows);
                matchedSelector = sel;
                break; 
              } else if (rows.length > listRows.length) {
                listRows = Array.from(rows);
                matchedSelector = sel;
              }
            }
          } catch (_) {}
        }

        fireLog(`Candidatos detectados: ${listRows.length} usando selector: ${matchedSelector}`);

        // Deduplicar y filtrar por visibilidad
        const uniqueTickets = new Map();

        function processPotentialRow(row) {
          const rawText = row.textContent.replace(/\s+/g, " ").trim();
          if (!rawText || row.offsetWidth === 0) return;
          
          const ticketMatch = rawText.match(/#\d+/);
          if (!ticketMatch) return;
          
          const tId = ticketMatch[0];
          // Solo lo guardamos si no lo tenemos o si este nodo es "mejor" (mas especifico)
          if (!uniqueTickets.has(tId) || row.textContent.length < uniqueTickets.get(tId).textContent.length) {
            uniqueTickets.set(tId, row);
          }
        }

        listRows.forEach(processPotentialRow);

        // Fallback agresivo si no tenemos suficientes tickets únicos
        if (uniqueTickets.size < 3) {
          fireLog(`Deduplicación resultó en ${uniqueTickets.size} tickets. Buscando más...`);
          const allPotential = Array.from(document.querySelectorAll("*")).filter(el => {
            // Buscamos cualquier elemento pequeño que tenga el patrón #1234
            return el.textContent.length < 20 && /#\d+/.test(el.textContent.trim());
          });

          allPotential.forEach(el => {
            let parent = el.parentElement;
            // Subir hasta encontrar un contenedor que tenga el ID y el Título
            for (let i = 0; i < 10; i++) {
              if (!parent) break;
              const hasTitle = parent.querySelector(".subject, [class*='subject'], .ticket-title, [class*='title'], h2, h3, .search-title, a[class*='title']");
              const txt = parent.textContent.trim();
              if (hasTitle && txt.length < 1000) {
                processPotentialRow(parent);
                break;
              }
              parent = parent.parentElement;
            }
          });
        }

        const finalRows = Array.from(uniqueTickets.values());
        fireLog(`Extracción final: ${finalRows.length} tickets únicos`);

        if (finalRows.length > 0) {
          clearInterval(pollTimer);
          const comms = [];
          
          finalRows.forEach((row, idx) => {
            fireLog(`Procesando fila ${idx + 1}/${finalRows.length}...`);
            const rawText = row.textContent.replace(/\s+/g, " ").trim();
            const ticketMatch = rawText.match(/#\d+/);
            const ticketId = ticketMatch ? ticketMatch[0] : "N/A";

            // 1.5 Extraer el ID Interno de Zoho (Buscando la secuencia más larga de 17-20 dígitos)
            let internalId = "";
            const rowHtml = row.outerHTML || "";
            const allNumericMatches = rowHtml.match(/\b(\d{17,20})\b/g) || [];
            
            if (allNumericMatches.length > 0) {
                // Ordenar por longitud descendente para quedarnos con el ID más completo (el de 19 dígitos)
                allNumericMatches.sort((a, b) => b.length - a.length);
                internalId = allNumericMatches[0];
            } else {
                internalId = row.getAttribute('data-recordid') || row.getAttribute('data-id') || "";
            }

            // 2. Metadatos (Emisor y Hora/Fecha)
            let sender = "";
            let ts = "";
            const metadataParts = rawText.split(/\s*[.·|]\s*/);
            if (metadataParts.length >= 2) {
              const tIdx = metadataParts.findIndex(p => p.includes(ticketId));
              if (tIdx !== -1 && metadataParts[tIdx + 1]) {
                sender = metadataParts[tIdx + 1].trim();
              } else {
                sender = metadataParts[1].trim();
              }
              ts = metadataParts[metadataParts.length - 1].trim();
            }

            // 3. Asunto (Subject)
            let subject = "";
            const titleEl = row.querySelector(".subject, [class*='subject'], .ticket-title, [class*='title'], h2, h3, .search-title, a[class*='title'], [data-test-id='ticket-subject']");
            if (titleEl) {
              subject = titleEl.textContent.trim();
            } else if (metadataParts.length > 0) {
              subject = metadataParts[0].split("#")[0].trim();
            }
            
            if (!subject || subject.length < 5) {
              subject = rawText.substring(0, 80);
            }

            // 4. OC: Solo si está presente en el Asunto (Título)
            // Usamos un check estricto para evitar falsos positivos
            const hasOc = subject.includes(ocInput);
            const rowOc = hasOc ? ocInput : "";

            fireLog(`Fila: ${ticketId} | Subject: ${subject.substring(0,25)}... | OC Detectada: ${hasOc ? 'SI' : 'NO'}`);

            // Fallbacks finales para el emisor
            if (!sender || sender.length > 70) {
              const senderEl = row.querySelector(".contact-name, [class*='contact'], [class*='requester'], [class*='sender'], .name, [data-test-id='customer-name']");
              sender = senderEl ? senderEl.textContent.trim() : "Desconocido";
            }
            if (!ts) {
              const timeEl = row.querySelector("time[datetime], [class*='time'], [class*='date']");
              ts = timeEl ? (timeEl.getAttribute("datetime") || timeEl.textContent.trim()) : "";
            }

            fireLog(`Ticket: ${ticketId} | OC: ${rowOc || 'No'} | Hora: ${ts} | Asunto: ${subject.substring(0,30)}...`);
            // fireLog(`DEBUG RAW: ${rawText.substring(0,100)}`);

            const logSubject = subject.length > 60 ? subject.substring(0, 60) + "..." : subject;
            const summaryTbody = document.querySelector("#emchile-fire-summary-table tbody");
            if (summaryTbody) {
              const tr = document.createElement("tr");
              tr.innerHTML = `<td style="display:none;" class="internal-id">${internalId}</td><td>${rowOc}</td><td>${ticketId}</td><td>${sender}</td><td>${ts}</td><td>${logSubject}</td>`;
              summaryTbody.appendChild(tr);
              fireLog(`Fila agregada a tabla: ${ticketId} (Internal: ${internalId})`);
              chrome.storage.local.set({ emchileFireSummaryTable: summaryTbody.innerHTML });
            }
            comms.push({ sender, ts, text: subject, ticketId });
          });
          fireLog(`Scraping completado con éxito.`);
        }
      }, 500);
    }, 300); // 300ms delay para que Zoho enfoque el input despues del atajo
  }

  async function handleFirePlay2Click() {
    fireLog(`Botón PLAY X2 presionado. Iniciando extracción múltiple por API de Zoho...`);
    
    const summaryTbody = document.querySelector("#emchile-fire-summary-table tbody");
    if (!summaryTbody || summaryTbody.children.length === 0) {
      alert("No hay resultados previos. Ejecuta PLAY X1 primero.");
      return;
    }

    const waView = document.getElementById("fire-whatsapp-view");
    waView.style.display = "flex";
    waView.style.flexDirection = "column";
    waView.style.minHeight = "600px";
    waView.style.overflow = "visible";

    waView.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px 20px; background: #202c33; border-bottom: 1px solid #111b21;">
        <h4 style="margin:0; color:#e9edef; font-size:1em; font-weight:600;">Panorama Global (Multi-Ticket)</h4>
        <button id="wa-back-btn" class="wa-back-btn">Cerrar Panorama</button>
      </div>
      <div id="wa-multi-container" class="wa-multi-container"></div>
    `;
    
    document.getElementById("wa-back-btn").addEventListener("click", () => {
      document.getElementById("fire-main-view").style.display = "block";
      document.getElementById("fire-whatsapp-view").style.display = "none";
    });

    const multiContainer = document.getElementById("wa-multi-container");

    // Detectar portal actual
    const storage = await new Promise(resolve => chrome.storage.local.get(['firePortalName', 'fireOrgId'], resolve));
    
    let portalName = storage.firePortalName || "emchile"; 
    const manualOrgId = storage.fireOrgId || "";

    if (!storage.firePortalName) {
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 2 && pathParts[1] === 'support') {
            portalName = pathParts[2];
        }
    }

    // Preparar columnas
    for (let i = 0; i < summaryTbody.children.length; i++) {
       const row = summaryTbody.children[i];
       let internalId = row.querySelector('.internal-id')?.textContent;
       const ticketId = row.cells[2].textContent.trim();
       const ticketSubject = row.cells[5].textContent.trim();
       
       if (!internalId) continue;

       const containerId = `wa-container-${internalId}`;
       multiContainer.innerHTML += `
         <div class="wa-ticket-column">
           <div class="wa-column-header">
             <div style="font-weight: bold; color: #e9edef; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ticketId}</div>
             <div style="color: #8696a0; font-size: 0.7em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${ticketSubject}</div>
           </div>
           <div class="wa-container" id="${containerId}">
              <div style="text-align:center; padding:50px 20px; color:#8696a0; font-size: 0.8em;">Cargando historial...</div>
           </div>
         </div>
       `;
    }

    const csrf = (() => {
      const match = document.cookie.match(/iamcsr=([^;]+)/) || document.cookie.match(/_zcsr_tmp=([^;]+)/);
      return match ? match[1] : "";
    })();

    // Procesar todos los tickets simultáneamente
    for (let i = 0; i < summaryTbody.children.length; i++) {
        const row = summaryTbody.children[i];
        const internalId = row.querySelector('.internal-id')?.textContent;
        if (!internalId) continue;
        
        const containerId = `wa-container-${internalId}`;

        try {
            const endpoints = [
                `/supportapi/zd/${portalName}/api/v1/tickets/${internalId}/threads?limit=100`,
                `/api/v1/tickets/${internalId}/threads?limit=100`,
                `https://${window.location.hostname}/supportapi/zd/${portalName}/api/v1/tickets/${internalId}/threads?limit=100`
            ];
            
            let data = null;
            const headers = { 'Accept': 'application/json, text/plain, */*' };
            if (csrf) headers['X-ZCSRF-TOKEN'] = `iamcsr=${csrf}`;
            if (manualOrgId) headers['orgid'] = manualOrgId;

            for (let url of endpoints) {
                try {
                    const res = await fetch(url, { headers });
                    if (res.ok) {
                        const json = await res.json();
                        data = json.data || json;
                        if (data) break;
                    }
                } catch(e) {}
            }

            if (!data) throw new Error("Acceso denegado o no encontrado");

            let msgs = [];
            const threads = Array.isArray(data) ? data : [data];
            
            for (const t of threads) {
                const author = t.author || {};
                const senderName = author.name || t.sender || "Desconocido";
                const d = new Date(t.createdTime);
                const timeStr = t.createdTime ? `${d.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "";
                
                let rawText = t.content || "";
                
                if (!rawText && t.id) {
                    try {
                        const threadUrl = `/supportapi/zd/${portalName}/api/v1/tickets/${internalId}/threads/${t.id}`;
                        const tRes = await fetch(threadUrl, { headers });
                        if (tRes.ok) {
                            const tJson = await tRes.json();
                            if (tJson) rawText = tJson.content || tJson.summary || "";
                        }
                    } catch(e) {}
                }

                if (!rawText) rawText = t.summary || "";

                let safeText = rawText.replace(/<img\b[^>]*>/gi, "");
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = safeText;
                
                const quotes = tempDiv.querySelectorAll('blockquote, .gmail_quote, .zmail_extra, .zd-quoted-text');
                let bodyText = "";
                
                if (quotes.length > 0) {
                    const clone = tempDiv.cloneNode(true);
                    clone.querySelectorAll('blockquote, .gmail_quote, .zmail_extra, .zd-quoted-text').forEach(e => e.remove());
                    bodyText = clone.innerText.trim();
                    if (bodyText.length < 10) bodyText = tempDiv.innerText.trim();
                } else {
                    bodyText = tempDiv.innerText.trim();
                }
                
                if (bodyText.length < 5 && t.summary && !bodyText.includes('...')) {
                    bodyText = t.summary.trim();
                }

                const isAgent = author.type === "AGENT" || 
                                senderName.toLowerCase().includes("soporte") || 
                                senderName.toLowerCase().includes("emchile") || 
                                senderName.toLowerCase().includes("piero") ||
                                senderName.toLowerCase().includes("administrador");

                const senderEmail = author.email || t.email || "";
                const senderDisplay = senderEmail ? `${senderName} <${senderEmail}>` : senderName;

                if (bodyText.length > 2) {
                    msgs.push({
                        sender: senderDisplay,
                        body: bodyText,
                        time: timeStr,
                        rawTime: t.createdTime,
                        type: isAgent ? 'out' : 'in'
                    });
                }
            }

            msgs.reverse(); // Cronológico
            
            // --- CALCULAR URGENCIA DEL FONDO DE LA COLUMNA ---
            const column = document.getElementById(containerId)?.closest('.wa-ticket-column');
            if (column && msgs.length > 0) {
                const lastMsg = msgs[msgs.length - 1]; // El más reciente
                if (lastMsg.rawTime) {
                    const msgDate = new Date(lastMsg.rawTime);
                    const now = new Date();
                    const diffDays = (now - msgDate) / (1000 * 60 * 60 * 24);
                    
                    if (diffDays < 1) {
                        column.style.background = "linear-gradient(180deg, #1e293b 0%, #064e3b 100%)"; // Tono Verde (Nuevo)
                    } else if (diffDays < 3) {
                        column.style.background = "linear-gradient(180deg, #1e293b 0%, #422006 100%)"; // Tono Amarillo/Ambar (Intermedio)
                    } else {
                        column.style.background = "linear-gradient(180deg, #1e293b 0%, #450a0a 100%)"; // Tono Rojo (Viejo)
                    }
                    // Aplicar tambien al header para consistencia
                    const header = column.querySelector('.wa-column-header');
                    if (header) header.style.background = "rgba(0,0,0,0.2)";
                }
            }

            renderWhatsAppConversation(msgs, containerId);

        } catch(err) {
            document.getElementById(containerId).innerHTML = `<div style="color:#f15c5c; padding:20px; font-size: 0.8em; text-align:center;">Error API: ${err.message}</div>`;
        }
    }
  }

  function handleFirePlay2Step2() {
    // Asegurarnos de que el menú esté abierto
    if (!fireMenuOpen) {
      fireMenuOpen = true;
      fireMenu.classList.add("fire-open");
    }

    // Mostrar sección de WhatsApp sin ocultar lo demás
    const waView = document.getElementById("fire-whatsapp-view");
    const container = document.getElementById("wa-container");
    
    if (waView) waView.style.display = "block";
    
    if (container) {
      container.innerHTML = `
        <div id="wa-loading-state" style="text-align:center; padding:30px 10px; color:#ffaaaa; font-style:italic; font-size:0.85em;">
          <div style="font-size:1.5em; margin-bottom:5px; animation: pulse 1.5s infinite;">⚡</div>
          Generando chat...
        </div>
      `;
    }

    let retries = 0;
    const maxRetries = 20; // 10 seconds total
    let lastMsgsLength = 0;
    let stableCount = 0;
    let bestMsgs = [];

    const pollInterval = setInterval(() => {
      // 1. Estrategia de Fuerza Bruta: Buscar contenedores que tengan clases "collapse" o "collapsed"
      // y que parezcan ser hilos de mensajes (contienen avatar, nombre, fecha, etc).
      const allCollapsed = Array.from(document.querySelectorAll('.is-collapsed, .collapsed, [class*="collapse"]')).filter(el => {
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
        // Debe ser un hilo de conversación: verificamos si contiene elementos de usuario/tiempo
        return el.querySelector('[class*="avatar" i], [class*="name" i], [class*="author" i], [class*="time" i], [class*="date" i], [class*="preview" i], [class*="header" i], [class*="user" i]');
      });

      // 2. Hacer clic agresivo en el contenedor y sus hijos visibles
      // Esto asegura que le daremos al nodo exacto que tiene el onClick en React
      allCollapsed.forEach(wrapper => {
        const targets = [wrapper, ...Array.from(wrapper.querySelectorAll('div, span, a, svg, button'))];
        targets.forEach(t => {
          if (t.offsetWidth > 0 || t.offsetHeight > 0) {
            try {
              t.click();
              t.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              t.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            } catch(e) {}
          }
        });
      });

      // 3. También buscar botones explícitos de "Mostrar más" o "Expandir todo"
      const extraButtons = document.querySelectorAll(
        '[data-id="expandAll"], button[aria-label*="Expand" i], button[title*="Expand" i], ' +
        '.show-more, .read-more, [class*="showMore" i], [class*="readMore" i], .zd-thread-expand-icon, ' +
        '.zd-comment-expand, .zd-show-more, .zd-load-more'
      );
      extraButtons.forEach(btn => {
        if (btn.offsetWidth > 0 || btn.offsetHeight > 0) {
           try { 
             btn.click(); 
             btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); 
             btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })); 
           } catch(e){}
        }
      });

      // 4. Evaluar cuántos hilos colapsados quedan
      const remainingCollapsed = allCollapsed.length;
      const areAllExpanded = remainingCollapsed === 0;

      const msgs = extractConversationStructured();
      retries++;

      if (msgs.length > lastMsgsLength) {
        lastMsgsLength = msgs.length;
        bestMsgs = msgs;
        stableCount = 0;
      } else if (msgs.length > 0 && msgs.length === lastMsgsLength && areAllExpanded) {
        // Solo declaramos estabilidad si ya no quedan hilos colapsados en el DOM
        stableCount++;
      }

      // Si tenemos mensajes y se han estabilizado por 4 ciclos (2 segundos), o si llegamos al limite de reintentos
      if ((msgs.length > 0 && stableCount >= 4) || (retries >= maxRetries && bestMsgs.length > 0)) {
        clearInterval(pollInterval);
        fireLog(`Éxito: ${bestMsgs.length} mensajes encontrados y estabilizados.`);
        renderWhatsAppConversation(bestMsgs);
      } else if (retries >= maxRetries && bestMsgs.length === 0) {
        clearInterval(pollInterval);
        fireLog("Error: No se detectaron mensajes tras 10 segundos.");
        if (container) {
          container.innerHTML = '<div style="text-align:center; padding:15px; color:#ffaaaa; font-size:0.8em;">No se detectaron mensajes en este ticket.</div>';
        }
      } else {
        fireLog(`Polling mensajes (${retries}/${maxRetries})... Encontrados: ${msgs.length} (Estables: ${stableCount}/4)`);
      }
    }, 500);
  }

  function extractConversationStructured() {
    // 1. Intentar encontrar contenedores de mensajes conocidos
    const primarySelectors = [
      ".zd-comment-unit", ".threadItem", ".reply-item", ".zd-thread-item",
      ".zgh-userMsg", ".comment-item", ".mail-message-item", ".conversation-item",
      ".zd-comment", ".Thread-item", ".ticket-thread", "article[class*='message']"
    ];
    
    let nodes = [];
    for (const sel of primarySelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        // Filtrar wrappers y nodos colapsados
        nodes = Array.from(found).filter(n => {
          // Ignorar si tiene nodos hijos del mismo tipo (es un wrapper gigante)
          if (n.querySelectorAll(sel).length > 0) return false;
          // Ignorar si está dentro de un hilo colapsado (evita extraer las previsualizaciones truncadas)
          if (n.closest('.is-collapsed, .collapsed, .thread-collapsed, .zd-comment-collapsed, .conversation-collapsed')) return false;
          return true;
        });
        if (nodes.length > 0) break;
      }
    }

    // 2. Fallback Deep Scan si lo anterior falló
    if (nodes.length === 0) {
      fireLog("Deep Scan: Buscando bloques por atributos...");
      const allPossible = document.querySelectorAll('div[class*="comment"], div[class*="thread"], div[class*="message"]');
      nodes = Array.from(allPossible).filter(n => {
        // Ignorar colapsados
        if (n.closest('.is-collapsed, .collapsed, .thread-collapsed, .zd-comment-collapsed, .conversation-collapsed')) return false;
        
        // No queremos contenedores padre
        const hasChildSimilar = n.querySelector('div[class*="comment"], div[class*="thread"], div[class*="message"]');
        if (hasChildSimilar) return false;
        
        const hasDirectText = n.childNodes.length > 0 && Array.from(n.childNodes).some(c => c.nodeType === 3 && c.textContent.trim().length > 10);
        return hasDirectText || n.innerText.length < 2000;
      });
    }

    const msgs = [];
    const seenCanonical = new Set();

    nodes.forEach((originalNode) => {
      // Clonar para limpiar sin alterar el DOM real
      const clone = originalNode.cloneNode(true);

      // Eliminar el historial citado (correos anteriores) y botones ocultos
      const removeSelectors = [
        'blockquote', '.gmail_quote', '.zmail_extra', '.zd-quoted-text', 
        '.quote', '[data-zbl]', '.original-message',
        '[class*="show-more"]', '[class*="expand"]', 'button', '.zd-comment-expand',
        '.zd-thread-expand-icon', 'style', 'script'
      ];
      removeSelectors.forEach(sel => {
        clone.querySelectorAll(sel).forEach(el => el.remove());
      });

      const rawText = clone.innerText.trim();
      if (rawText.length < 15) return;
      
      // LLAVE CANÓNICA
      const canonical = rawText.replace(/[^a-z0-9]/gi, "").substring(0, 150);
      if (seenCanonical.has(canonical)) return;
      seenCanonical.add(canonical);

      // --- SENDER ---
      const senderEl = clone.querySelector(
        ".zd-comment-author, .sender-name, .from-name, .author-name, .name, .zgh-userName, .zd-author-name"
      );
      
      let sender = senderEl?.textContent.trim();
      
      if (!sender) {
        const header = clone.querySelector('[class*="header"], .zd-comment-header');
        if (header) sender = header.innerText.split(/\n|·|\|/)[0].trim();
      }

      if (!sender) {
        const firstLine = clone.innerText.split('\n')[0].trim();
        if (firstLine.length > 2 && firstLine.length < 40) sender = firstLine;
      }

      sender = (sender || "Remitente").split('<')[0].trim();

      // --- BODY ---
      const bodySelectors = [
        ".zd-comment-content", ".mail-content", ".zgh-userMsgText", ".comment-text", 
        ".zd-comment-body", '[class*="body"]', '[class*="content"]'
      ];
      
      let bodyEl = null;
      for (const sel of bodySelectors) {
        bodyEl = clone.querySelector(sel);
        if (bodyEl && bodyEl.innerText.trim().length > 5) break;
      }

      let body = bodyEl ? bodyEl.innerText : clone.innerText;
      
      if (body.startsWith(sender)) {
        body = body.substring(sender.length).trim();
      }

      // Limpiar headers técnicos y ruidos conocidos
      const noiseKeywords = [
        "user-agent:", "message-id:", "received:", "content-type:", "mime-version:",
        "x-zoho", "boundary=", "diagnostic-code:", "reporting-mta:", 
        "( respondido en", "original-recipient:", "mailer-daemon"
      ];
      
      if (noiseKeywords.some(k => body.toLowerCase().includes(k))) return;
      
      body = body.replace(/\s+/g, " ").trim();
      
      // Filtro de seguridad: ignorar si el cuerpo es demasiado corto o son solo fragmentos de la UI
      if (body.length < 20) return;
      if (body.split(/\s+/).length < 4) return; // Menos de 4 palabras no es un mensaje real

      // --- TYPE (In/Out) ---
      const isAgent = sender.toLowerCase().includes("soporte") || 
                      sender.toLowerCase().includes("emchile") || 
                      sender.toLowerCase().includes("piero") || 
                      sender.toLowerCase().includes("administrador") ||
                      originalNode.classList.contains("agent-reply") ||
                      originalNode.querySelector('[class*="agent"]') !== null ||
                      originalNode.querySelector('.zd-comment-private') !== null;
      
      // --- TIME ---
      const timeEl = originalNode.querySelector('time[datetime], [class*="time"], [class*="date"], .zd-comment-date');
      const timeStr = timeEl ? (timeEl.getAttribute("datetime") || timeEl.innerText.trim()) : "";

      if (body.length < 20000) {
        msgs.push({
          sender: sender.split('<')[0].trim().substring(0, 20), 
          body: body,
          time: timeStr,
          type: isAgent ? 'out' : 'in'
        });
      }
    });

    // Invertir para que los mensajes más antiguos queden arriba (orden cronológico)
    // Usualmente Zoho muestra el último mensaje arriba (descendente)
    return msgs.reverse();
  }

  function renderWhatsAppConversation(msgs, containerId = "wa-container") {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = "";

    if (!msgs || msgs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:30px 10px; color:#8696a0; font-style:italic; font-size:0.8em;">
          No se encontraron mensajes en este ticket.
        </div>
      `;
      return;
    }

    const colors = [
      "#34b7f1", "#ff5b5b", "#5cdb5c", "#ffcc00", "#a855f7", "#ec4899", "#3b82f6", "#10b981", "#f97316", "#06b6d4"
    ];
    const getColor = (name) => {
      let hash = 0;
      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
    };

    msgs.forEach(m => {
      const msgDiv = document.createElement("div");
      msgDiv.className = `wa-msg ${m.type}`;
      
      const senderColor = getColor(m.sender);
      
      // Extraer nombre y email para el badge
      const namePart = m.sender.split('<')[0].trim();
      const emailPart = m.sender.includes('<') ? m.sender.match(/<([^>]+)>/)[1] : "";
      const emailHtml = emailPart ? `<span style="opacity:0.6; font-size:0.9em; font-weight:normal; margin-left:5px;">${emailPart}</span>` : "";

      msgDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="wa-msg-header" style="background: ${senderColor};">${namePart}${emailHtml}</div>
            <span class="wa-msg-time-badge">${m.time}</span>
          </div>
          <button class="wa-minimize-btn" style="background:transparent; border:none; color:#8696a0; cursor:pointer; font-size:14px; font-weight:bold;">−</button>
        </div>
        <div class="wa-text">${m.body}</div>
      `;
      
      const minBtn = msgDiv.querySelector(".wa-minimize-btn");
      const textDiv = msgDiv.querySelector(".wa-text");
      minBtn.addEventListener("click", () => {
        const isCollapsed = textDiv.classList.toggle("collapsed");
        minBtn.textContent = isCollapsed ? "+" : "−";
      });

      container.appendChild(msgDiv);
    });

    // Scroll to bottom
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 200);
  }


  function handleFabClick() {
    if (fireMenuOpen) {
      fireMenuOpen = false;
      fireMenu.classList.remove("fire-open");
    }
    if (expOpen) {
      closeExpSidebar();
    }
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function handleExpFabClick() {
    if (fireMenuOpen) {
      fireMenuOpen = false;
      fireMenu.classList.remove("fire-open");
    }
    if (sidebarOpen) {
      closeSidebar();
    }
    if (expOpen) {
      closeExpSidebar();
    } else {
      openExpSidebar();
    }
  }

  function openExpSidebar() {
    expFrame.classList.add("frame-open");
    expFab.classList.add("fab-open");
    expFab.querySelector(".ef-text").textContent = "Cerrar";
    expOpen = true;
  }

  function closeExpSidebar() {
    expFrame.classList.remove("frame-open");
    expFab.classList.remove("fab-open");
    expFab.querySelector(".ef-text").textContent = "LAB";
    expOpen = false;
  }

  function openSidebar() {
    sidebarFrame.classList.add("frame-open");
    floatingBtn.classList.add("fab-open");
    resizerEl.classList.add("resizer-open");
    floatingBtn.querySelector(".ef-text").textContent = "Cerrar";
    sidebarOpen = true;
  }

  function closeSidebar() {
    sidebarFrame.classList.remove("frame-open");
    floatingBtn.classList.remove("fab-open");
    resizerEl.classList.remove("resizer-open");
    floatingBtn.querySelector(".ef-text").textContent = "AI Desk";
    sidebarOpen = false;
  }

  // ─── ANALYSIS FLOW ─────────────────────────────────────────────────────────
  async function triggerAnalysis(responseContext = null) {
    isAnalyzing = true;
    floatingBtn.classList.add("fab-analyzing");
    postToSidebar({ type: "LOADING_START" });
    try {
      const persistedContext = await getPersistedResponseContext();
      const mergedContext = {
        client: String(
          responseContext?.client || persistedContext?.client || "",
        ).trim(),
        internal: String(
          responseContext?.internal || persistedContext?.internal || "",
        ).trim(),
      };
      const ticketData = extractTicketData(mergedContext);

      // Wrap bgMessage with a timeout to avoid indefinite loading
      const analysisPromise = bgMessage({ type: "ANALYZE_TICKET", data: ticketData });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo de espera agotado (70s). El servicio de IA no respondió.")), 70000)
      );
      const result = await Promise.race([analysisPromise, timeoutPromise]);
      postToSidebar({ type: "ANALYSIS_RESULT", data: result, ticketData });
    } catch (err) {
      console.error("[EMChile] triggerAnalysis error:", err);
      postToSidebar({ type: "ANALYSIS_ERROR", error: err.message });
    } finally {
      isAnalyzing = false;
      floatingBtn.classList.remove("fab-analyzing");
    }
  }

  function getPersistedResponseContext() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ["analysisClientContext", "analysisInternalContext"],
        (stored) => {
          if (chrome.runtime.lastError) {
            resolve({ client: "", internal: "" });
            return;
          }
          resolve({
            client: String(stored.analysisClientContext || "").trim(),
            internal: String(stored.analysisInternalContext || "").trim(),
          });
        },
      );
    });
  }

  function bgMessage(msg) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ─── DOM EXTRACTION ────────────────────────────────────────────────────────
  function extractTicketData(responseContext = null) {
    const subject = extractSubject();
    const conversation = extractConversation();
    const additionalData = extractCustomFields();
    const conversationSupplement = extractConversationSupplement();
    return {
      ticketId: extractTicketId(),
      latestEmailDate: extractLatestEmailDate(),
      subject,
      customerName: extractCustomerName(),
      customerEmail: extractCustomerEmail(),
      status: extractStatus(),
      priority: extractPriority(),
      createdAt: extractCreatedAt(),
      conversation,
      ocNumbers: extractOCNumbers(
        conversation,
        conversationSupplement,
        additionalData,
        subject,
      ),
      additionalData,
      responseContext: {
        client: String(responseContext?.client || "").trim(),
        internal: String(responseContext?.internal || "").trim(),
      },
      url: window.location.href,
      extractedAt: new Date().toISOString(),
    };
  }

  /** Try multiple selectors, return first non-empty value */
  function firstMatch(selectors, attr) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const val = attr ? el.getAttribute(attr) : el.textContent.trim();
      if (val) return val;
    }
    return null;
  }

  function extractTicketId() {
    // 1. Standard path-based URL: /tickets/1479
    const pathMatch = window.location.pathname.match(
      /\/tickets\/(\d{3,})(?:[/?]|$)/i,
    );
    if (pathMatch) return pathMatch[1];

    // 2. Hash-based SPA URL: #Cases/dv/1479  or  #Tickets/1479  etc.
    const hash = window.location.hash;
    const hashMatch = hash.match(/(?:#|\/)(\d{3,})(?:[/?#&]|$)/);
    if (hashMatch) return hashMatch[1];

    // 3. Query-string: ?ticketId=1479
    const qsMatch = window.location.search.match(/[?&]ticketId=(\d{3,})/i);
    if (qsMatch) return qsMatch[1];

    // 4. DOM: explicit ticket number fields
    const fromDOM = firstMatch([
      "[data-ticket-number]",
      "[data-ticketno]",
      ".ticket-number",
      ".ticketno",
      "#ticketNumber",
      '[class*="ticket-number"]',
      '[class*="ticketNumber"]',
      '[class*="ticket-no"]',
      '[class*="ticketno"]',
      "[data-test-id='ticket-id']",
      ".zd-ticket-id",
      ".ticket-id-text",
      ".zd-ticketno"
    ]);
    if (fromDOM) {
      const digits = fromDOM.replace(/\D/g, "");
      if (digits.length >= 3) return digits;
    }

    // 5. Scan visible text for "#1479" pattern (header, breadcrumb, title)
    const scanTargets = document.querySelectorAll(
      'h1, h2, h3, [class*="subject"], [class*="title"], [class*="header"], ' +
        '[class*="breadcrumb"], [class*="ticket-id"], [class*="ticketId"], ' +
        ".page-title, .ticket-header",
    );
    for (const el of scanTargets) {
      const hit = el.textContent.match(/#(\d{3,})/);
      if (hit) return hit[1];
    }

    // 5.5 Check for breadcrumbs in V2
    const breadcrumb = document.querySelector('[data-test-id="breadcrumb"], .zd-breadcrumb, .breadcrumb');
    if (breadcrumb) {
      const hit = breadcrumb.textContent.match(/#(\d{3,})/);
      if (hit) return hit[1];
    }

    // 6. Look for a standalone ticket badge element like "#1479"
    for (const el of document.querySelectorAll("span,div,strong,b,a")) {
      const text = el.textContent.trim();
      const hit = text.match(/^#(\d{3,})$/);
      if (hit) return hit[1];
    }

    // 7. Any text on page that looks like a ticket badge "#NNNN"
    const allText = document.body.innerText;
    const bodyHit = allText.match(/#(\d{3,})\b/);
    if (bodyHit) return bodyHit[1];

    return "UNKNOWN";
  }

  /** Extract OC / purchase order numbers from text (e.g. 1070620-38033-ag25) */
  function extractOCNumbers(...sources) {
    const rawText =
      sources.filter(Boolean).join("\n") || document.body.innerText || "";
    const preparedText = prepareOCExtractionText(rawText);
    const suffixPattern =
      "(?:AG25|AG26|COT(?:25|26)|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?|LR(?:25|26)?)";
    const strictOcRegex = new RegExp(
      `\\b(\\d{3,8}-+\\d{1,6}-+${suffixPattern})\\b`,
      "gi",
    );
    const labeledOcRegex = new RegExp(
      `\\bOC[:\\s#-]*(\\d{3,8}-+\\d{1,6}-+${suffixPattern})\\b`,
      "gi",
    );

    const found = new Map();
    [strictOcRegex, labeledOcRegex].forEach((re) => {
      let match;
      re.lastIndex = 0;
      while ((match = re.exec(preparedText)) !== null) {
        const normalized = normalizeOC(match[1] || match[0]);
        if (!normalized) continue;
        const key = normalized.toLowerCase();
        if (!found.has(key)) found.set(key, normalized);
      }
    });

    return [...found.values()];
  }

  function prepareOCExtractionText(text) {
    return String(text || "")
      .replace(/[–]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(
        /(AG25|AG26|COT(?:25|26)|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?|LR(?:25|26)?)(?=\d{3,8}-+\d{1,6}-+)/gi,
        "$1\n",
      );
  }

  function normalizeOC(value) {
    const normalized = String(value || "")
      .trim()
      .replace(/[–]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^OC[:\s#-]*/i, "")
      .toUpperCase();

    if (
      !/^\d{3,8}-\d{1,6}-(AG25|AG26|COT(?:25|26)|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?|LR(?:25|26)?)$/.test(
        normalized,
      )
    ) {
      return null;
    }

    return normalized;
  }

  function extractSubject() {
    return (
      firstMatch([
        ".ticket-title",
        ".subject-text",
        ".ticketSubject",
        '[class*="ticket-title"]',
        '[class*="ticketTitle"]',
        '[class*="subject"]',
        "h1.subject",
        "[data-subject]",
        ".detail-title",
        ".page-title h1",
        "[data-test-id='ticket-subject']",
        ".zd-ticket-subject"
      ]) ||
      (() => {
        const m = document.title.match(/^(.+?)\s*[-|–]/);
        return m ? m[1].trim() : "Sin asunto detectado";
      })()
    );
  }

  function extractCustomerName() {
    return (
      firstMatch([
        ".contact-name",
        ".requester-name",
        ".customer-name",
        '[class*="contact-name"]',
        '[class*="requester"]',
        '[class*="contactName"]',
        "[data-contact-name]",
      ]) || "No detectado"
    );
  }

  function extractCustomerEmail() {
    for (const sel of [
      ".contact-email",
      ".requester-email",
      'a[href^="mailto:"]',
    ]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const v =
        el.getAttribute("href")?.replace("mailto:", "") ||
        el.textContent.trim();
      if (v?.includes("@")) return v;
    }
    return "No detectado";
  }

  function extractStatus() {
    return (
      firstMatch([
        ".ticket-status",
        ".status-badge",
        "[data-status]",
        '[class*="status-badge"]',
        '[class*="ticket-status"]',
      ]) || "No detectado"
    );
  }

  function extractPriority() {
    return (
      firstMatch([
        ".ticket-priority",
        '[class*="priority"]',
        "[data-priority]",
      ]) || "No detectada"
    );
  }

  function extractCreatedAt() {
    const el =
      document.querySelector('[class*="created-time"]') ||
      document.querySelector('[class*="createdTime"]') ||
      document.querySelector("time[datetime]");
    if (el) return el.getAttribute("datetime") || el.textContent.trim();
    return "No detectada";
  }

  function extractLatestEmailDate() {
    const monthMap = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
                       ene:"01", abr:"04", ago:"08", dic:"12" };
    
    let maxDate = null;
    let maxTimestamp = 0;

    function parseAndCompare(dateStr) {
      if (!dateStr) return;
      dateStr = dateStr.toLowerCase().trim();
      
      if (dateStr.match(/\bhoy\b/) || dateStr.match(/\btoday\b/)) {
        let d = new Date();
        let isoStr = d.toISOString().split('T')[0];
        let ts = d.getTime();
        if (ts > maxTimestamp) { maxTimestamp = ts; maxDate = isoStr; }
        return;
      }
      if (dateStr.match(/\bayer\b/) || dateStr.match(/\byesterday\b/)) {
        let d = new Date(); d.setDate(d.getDate() - 1);
        let isoStr = d.toISOString().split('T')[0];
        let ts = d.getTime();
        if (ts > maxTimestamp) { maxTimestamp = ts; maxDate = isoStr; }
        return;
      }

      let regex = /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic)[a-z]*(?:\s+(\d{4}))?/gi;
      let match;
      while ((match = regex.exec(dateStr)) !== null) {
        let year = match[3] || new Date().getFullYear();
        let month = monthMap[match[2].toLowerCase()];
        let day = match[1].padStart(2, '0');
        let isoStr = `${year}-${month}-${day}`;
        let ts = new Date(`${year}-${month}-${day}T00:00:00`).getTime();
        if (ts > maxTimestamp) {
          maxTimestamp = ts;
          maxDate = isoStr;
        }
      }
    }

    // 1. Soportar la nueva UI de Zoho Desk V2 (elementos explícitos de tiempo)
    const v2Els = document.querySelectorAll('[data-id="commonTime"], [data-test-id="commonTime"], [class*="usertime" i], time, .mail-time, .zd-comment-date');
    for (let el of v2Els) {
      parseAndCompare(el.getAttribute("data-title"));
      parseAndCompare(el.getAttribute("aria-label"));
      parseAndCompare(el.getAttribute("datetime"));
      parseAndCompare(el.innerText);
    }
    if (maxDate) return maxDate;

    // 2. Buscar tooltips globales que parezcan fechas
    const titleEls = document.querySelectorAll('[title], [data-title], [data-tooltip]');
    for (let el of titleEls) {
      let t = el.title || el.getAttribute("data-title") || el.getAttribute("data-tooltip");
      if (t && t.match(/(202\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic)/i)) {
        parseAndCompare(t);
      }
    }
    if (maxDate) return maxDate;

    // 3. Fallback iterando por hilos de conversación
    const threadItems = Array.from(document.querySelectorAll('.ticket-thread, [class*="threadItem" i], [class*="thread-item" i], [class*="Conversation" i], [class*="Thread" i], [class*="reply-item" i], [class*="replyItem" i], .zgh-userMsg, [class*="userMsg" i], [data-test-id="containerComponent"]'))
                             .filter(el => el.innerText && el.innerText.trim().length > 10);
    
    for (const thread of threadItems) {
      let lines = thread.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let headerText = lines.slice(0, 3).join(" ");
      parseAndCompare(headerText);
      if (maxDate) return maxDate;
    }
    
    return maxDate;
  }

  function extractConversation() {
    // ── Step 1: expand collapsed messages ────────────────────────────────────
    // Zoho collapses old thread items — click every "show/expand" trigger
    const expandSelectors = [
      '[class*="expand"]',
      '[class*="show-more"]',
      '[class*="showMore"]',
      '[class*="load-more"]',
      '[class*="loadMore"]',
      '[class*="collapsed"]',
      '[class*="toggle-thread"]',
      '[class*="toggleThread"]',
      'button[title*="expand" i]',
      'button[title*="show" i]',
      'span[class*="expand"]',
    ];
    expandSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((btn) => {
        try {
          btn.click();
        } catch (_) {}
      });
    });

    // ── Step 2: candidate selectors — ordered from most to least specific ────
    // Each entry is a CSS selector that should match individual MESSAGE nodes.
    // We try ALL of them, collect results, and keep the best set (most msgs).
    const candidates = [
      // Zoho Desk specific (observed class patterns)
      ".threadItem",
      '[class*="threadItem"]',
      ".zd-thread-item",
      '[class*="zd-thread"]',
      ".thread-item",
      '[class*="thread-item"]:not([class*="thread-items"])', // avoid wrapper
      // Reply / response blocks
      ".reply-item",
      '[class*="reply-item"]',
      ".replyItem",
      '[class*="replyItem"]',
      // Message body wrappers
      ".message-wrap",
      '[class*="message-wrap"]',
      ".msgWrap",
      '[class*="msgWrap"]',
      // Mail / email blocks
      ".mail-message",
      '[class*="mail-message"]',
      ".email-message",
      '[class*="email-message"]',
      // Conversation items
      ".conversation-item",
      '[class*="conversation-item"]',
      // Generic thread messages
      ".thread-message",
      '[class*="thread-message"]',
      '[class*="threadMessage"]',
      // Content bodies (last resort — can be nested)
      '[class*="reply-content"]',
      '[class*="replyContent"]',
      '[class*="message-body"]',
      '[class*="messageBody"]',
      // Zoho Desk V2 specifically
      ".zd-comment-unit",
      ".zgh-userMsg",
      ".comment-item",
      ".mail-message-item",
      ".conversation-item",
      ".zd-comment",
      ".Thread-item",
      ".ticket-thread",
      "article[class*='message']"
    ];

    let bestResult = [];

    for (const sel of candidates) {
      let nodes;
      try {
        nodes = document.querySelectorAll(sel);
      } catch (_) {
        continue;
      }
      if (!nodes.length) continue;

      const msgs = extractMessagesFromNodes(nodes);
      // Prefer the selector that yields the MOST distinct messages
      if (msgs.length > bestResult.length) {
        bestResult = msgs;
      }
    }

    const supplement = extractConversationSupplement();

    if (bestResult.length) {
      const bestText = bestResult.join("\n\n─────\n\n");
      if (shouldAppendConversationSupplement(bestText, supplement)) {
        return `${bestText}\n\n─────\n\n[Contexto complementario visible del hilo]:\n${supplement}`;
      }
      return bestText;
    }

    // ── Step 3: brute-force — scan all visible text blocks in ticket area ────
    const ticketRoot = getConversationRoot();

    if (ticketRoot) {
      // Look for direct children with substantial text
      const blocks = [];
      ticketRoot
        .querySelectorAll("div[class], article, section, li[class]")
        .forEach((el) => {
          // Skip if it's a wrapper that contains other matches
          const childHits = el.querySelectorAll(
            "div[class], article, li[class]",
          );
          if (childHits.length > 4) return; // likely a container, skip

          const text = el.textContent.replace(/\s+/g, " ").trim();
          if (text.length > 40 && text.length < 15000) {
            blocks.push(text);
          }
        });

      // Deduplicate: remove texts fully contained in another text
      const deduped = deduplicateTexts(blocks);
      if (deduped.length) {
        return (
          "[Contenido extraído — análisis estructural]:\n\n" +
          deduped.slice(0, 30).join("\n\n─────\n\n")
        );
      }

      // Last resort: raw text of the ticket area
      const raw = ticketRoot.textContent.replace(/\s+/g, " ").trim();
      if (raw.length > 50) {
        return (
          "[Contenido extraído — texto completo del área]:\n" +
          raw.substring(0, 8000)
        );
      }
    }

    return "No se pudo extraer la conversación. Asegúrate de estar dentro del detalle de un ticket específico.";
  }

  function getConversationRoot() {
    return document.querySelector(
      '#ticketDetail, .ticket-detail, [class*="ticket-detail"], ' +
        '[class*="ticket-view"], [class*="ticketView"], ' +
        '[class*="conversations"], [class*="conversation"], [role="main"], main, ' +
        '[data-test-id*="ticket-view"], [data-test-id*="conversation"]',
    );
  }

  function extractConversationSupplement() {
    const ticketRoot = getConversationRoot();
    if (!ticketRoot) return "";

    const raw = ticketRoot.innerText
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    if (!raw || raw.length < 60) return "";
    return raw.substring(0, 12000);
  }

  function shouldAppendConversationSupplement(bestText, supplement) {
    if (!supplement) return false;

    const bestOcCount = extractOCNumbers(bestText).length;
    const supplementOcCount = extractOCNumbers(supplement).length;
    if (supplementOcCount > bestOcCount) return true;

    const bestNorm = bestText.replace(/\s+/g, " ").trim();
    const supplementNorm = supplement.replace(/\s+/g, " ").trim();
    if (!bestNorm || !supplementNorm) return false;

    const markers = [
      "privado",
      "interna",
      "interno",
      "private",
      "oc",
      "orden de compra",
    ];
    if (
      markers.some(
        (marker) =>
          supplementNorm.toLowerCase().includes(marker) &&
          !bestNorm.toLowerCase().includes(marker),
      )
    ) {
      return true;
    }

    return !bestNorm.includes(
      supplementNorm.slice(0, Math.min(200, supplementNorm.length)),
    );
  }

  /** Extract structured messages from a NodeList */
  function extractMessagesFromNodes(nodes) {
    const msgs = [];
    const seenTexts = new Set();

    nodes.forEach((node, i) => {
      // Skip tiny nodes
      const rawText = node.textContent.replace(/\s+/g, " ").trim();
      if (rawText.length < 20) return;

      // Deduplicate: skip if a parent already captured this same text
      // (avoids counting nested selectors twice)
      const textKey = rawText.substring(0, 120);
      if (seenTexts.has(textKey)) return;
      seenTexts.add(textKey);

      // Sender
      const senderEl = node.querySelector(
        ".sender-name, .from-name, .author-name, " +
          '[class*="sender"], [class*="author"], [class*="from-name"], ' +
          '[class*="fromName"], [class*="contact-name"], .zd-comment-author, .zgh-userName, .zd-author-name',
      );
      const sender = senderEl?.textContent.trim() || `Mensaje ${i + 1}`;

      // Timestamp
      const timeEl =
        node.querySelector("time[datetime]") ||
        node.querySelector(
          '[class*="time"], [class*="date"], [class*="timestamp"], .zd-comment-date, .mail-time'
        );
      const ts =
        timeEl?.getAttribute("datetime") || timeEl?.textContent.trim() || "";

      // Prefer an inner body element, but keep the full node text if it contains
      // more OC references than the narrowed body selection.
      const bodyEl = node.querySelector(
        '[class*="body"], [class*="content"], [class*="text"], ' +
          '[class*="mail-body"], [class*="mailBody"], blockquote, .zd-comment-content, .zgh-userMsgText, .comment-text',
      );
      const bodyText = bodyEl
        ? bodyEl.textContent.replace(/\s+/g, " ").trim()
        : "";
      const rawOcCount = extractOCNumbers(rawText).length;
      const bodyOcCount = bodyText ? extractOCNumbers(bodyText).length : 0;
      const body = rawOcCount > bodyOcCount ? rawText : bodyText || rawText;

      if (body.length > 15) {
        msgs.push(`[${sender}${ts ? " · " + ts : ""}]:\n${body}`);
      }
    });

    return msgs;
  }

  /** Remove texts that are fully contained in (substrings of) another text */
  function deduplicateTexts(arr) {
    return arr.filter(
      (t, i) =>
        !arr.some(
          (other, j) => j !== i && other.includes(t) && other.length > t.length,
        ),
    );
  }

  function extractCustomFields() {
    const lines = [];
    const seen = new Set();

    // Try many wrapper selectors — Zoho uses different class names per version
    const WRAPPERS = [
      '[class*="custom-field"]',
      '[class*="customField"]',
      '[class*="field-wrap"]',
      '[class*="fieldWrap"]',
      '[class*="field-view"]',
      '[class*="fieldView"]',
      '[class*="ticket-field"]',
      '[class*="ticketField"]',
      '[class*="property-item"]',
      '[class*="propertyItem"]',
      '[class*="zd-field"]',
      '[class*="info-field"]',
      '[class*="infoField"]',
      '[class*="field-item"]',
      '[class*="fieldItem"]',
    ];
    for (const sel of WRAPPERS) {
      document.querySelectorAll(sel).forEach((w) => {
        const labelEl = w.querySelector(
          'label,[class*="label"],[class*="Label"],[class*="title"],[class*="Title"]',
        );
        const label = labelEl?.textContent.replace(/[*]/g, "").trim();
        if (!label || seen.has(label) || label.length > 80) return;
        const valueEl = w.querySelector(
          '[class*="value"],[class*="Value"],[class*="content"],[class*="Content"],span[class],p[class]',
        );
        const value = valueEl?.textContent.trim();
        if (value && value !== label) {
          seen.add(label);
          lines.push(`${label}: ${value}`);
        }
      });
    }

    // Brute-force: scan the ticket properties panel (left sidebar)
    const propPanel = document.querySelector(
      '.ticket-properties,[class*="ticket-properties"],[class*="ticketProperties"],' +
        '[class*="ticket-info"],[class*="ticketInfo"],[class*="properties-panel"],' +
        '[class*="side-details"],[class*="sideDetails"],[class*="ticketDetail"]',
    );
    if (propPanel) {
      propPanel
        .querySelectorAll(
          'label,[class*="field-label"],[class*="fieldLabel"],[class*="prop-label"],[class*="propLabel"]',
        )
        .forEach((lbl) => {
          const label = lbl.textContent.replace(/[*]/g, "").trim();
          if (!label || seen.has(label) || label.length > 80) return;
          let valEl = lbl.nextElementSibling;
          if (!valEl?.textContent.trim()) {
            valEl = lbl.parentElement?.querySelector(
              '[class*="value"],[class*="Value"],[class*="content"],span[class],p[class]',
            );
          }
          const value = valEl?.textContent.trim();
          if (value && value !== label) {
            seen.add(label);
            lines.push(`${label}: ${value}`);
          }
        });
    }

    return lines.slice(0, 30).join("\n") || null;
  }

  // ─── SIDEBAR COMMUNICATION ─────────────────────────────────────────────────
  function postToSidebar(msg) {
    sidebarFrame?.contentWindow?.postMessage(msg, "*");
    expFrame?.contentWindow?.postMessage(msg, "*");
  }

  window.addEventListener("message", (evt) => {
    if (evt.data?.source !== "emchile-sidebar") return;
    handleSidebarMessage(evt.data);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    console.log("%c[EMChile] Content received:", "color:cyan;font-weight:bold;", msg);
    handleSidebarMessage(msg);
  });

  function handleSidebarMessage(msg) {
    const { type, data } = msg;
    const isTop = window.top === window;

    switch (type) {
      case "SIDEBAR_READY":
        if (isTop) checkTicketChange();
        break;
      case "RE_ANALYZE":
        if (isTop && !isAnalyzing) triggerAnalysis(data?.responseContext || null);
        break;
      case "CLOSE_SIDEBAR":
        if (isTop) closeSidebar();
        break;
      case "INSERT_IN_ZOHO":
        // El insert se delega a background.js, solo el frame principal debe despacharlo
        if (isTop) insertTextInZoho(data?.text || "");
        break;
      case "AUTO_FILL_FIELDS":
        if (isTop) autoFillTicketFields(data || {});
        break;
      case "REQUEST_LATEST_DATE":
        if (isTop) postToSidebar({ type: "LATEST_DATE_RESULT", data: { date: extractLatestEmailDate(), rowIdx: data?.rowIdx } });
        break;
      case "SEARCH_OC_GLOBAL":
        // Si estamos en Zoho, solo el frame superior debe manejar la búsqueda global
        if (window.location.href.includes("desk.zoho") && !isTop) return;
        searchOcByDomain(data?.oc);
        break;
      case "SEARCH_OC_MP":
        // En Mercado Público dejamos que todos los frames lo intenten
        forceSearchInMercadoPublico(data?.oc);
        break;
      case "SCAN_OPEN_TICKETS":
        if (isTop) scanOpenTicketsDOM(data?.count || 10, data?.mode || "last", data?.since || "");
        break;
      case "FETCH_TICKET_CONVERSATION":
        if (isTop) fetchTicketConversation(data?.id);
        break;
    }
  }

  // ─── EXPERIMENTAL SCAN TICKETS ─────────────────────────────────────────────
  function scanOpenTicketsDOM(count, mode, since) {
    // 1. Selector principal de filas de ticket (aplica a Zoho Desk V1 y V2)
    const rows = Array.from(document.querySelectorAll('.ticket-row, .lv-row, [class*="ticketRow"], tr[data-ticketid], [data-id^="ticket"]'));
    let tickets = [];

    rows.forEach(row => {
      let tid = row.getAttribute('data-ticketid') || row.querySelector('[data-ticketid]')?.getAttribute('data-ticketid');
      if (!tid) {
        // Fallback id extraction
        let textId = row.querySelector('.ticket-id, [class*="ticketId"], a[href*="tickets/"]')?.innerText;
        if (textId) tid = textId.replace(/\D/g, '');
      }

      let subject = row.querySelector('.ticket-subject, .subject, [class*="subject"]')?.innerText?.trim() || "";
      let date = row.querySelector('.ticket-date, .date, [class*="date"], time')?.innerText?.trim() || "";
      let status = row.querySelector('.ticket-status, .status, [class*="status"]')?.innerText?.trim() || "";

      // Si no encontramos ID en DOM elements, intentamos extraer de la URL del enlace del ticket
      if (!tid) {
        let link = row.querySelector('a[href*="/tickets/"]');
        if (link) {
          let match = link.href.match(/\/tickets\/(\d+)/);
          if (match) tid = match[1];
        }
      }

      if (tid) {
        let st = status.toLowerCase();
        // Only include tickets that are explicitly marked as "Abierto" or "Open"
        // Also handling fallback if status might be an icon (if explicitly empty, maybe skip or include?)
        if (st.includes("abierto") || st.includes("open") || !status) {
          tickets.push({ id: tid, subject, date, status: status || "Abierto" });
        }
      }
    });

    // Remove duplicates
    let unique = [];
    let seen = new Set();
    for (let t of tickets) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
    }
    tickets = unique;

    // Filter by 'since' date if provided
    if (since) {
      let sinceTs = new Date(since).getTime();
      if (!isNaN(sinceTs)) {
        tickets = tickets.filter(t => {
           // Basic attempt to parse the ticket date if it matches "dd-mm-yyyy" or similar
           // Or just leave it if unparseable, this is experimental
           return true; 
        });
      }
    }

    // Sort/Slice
    if (mode === "last") {
      tickets = tickets.slice(0, count); // Los primeros N de la lista (asumiendo que arriba están los recientes)
    } else {
      tickets = tickets.slice(Math.max(tickets.length - count, 0)); // Los últimos N de la lista
    }

    postToSidebar({ type: "OPEN_TICKETS_RESULT", data: { tickets } });
  }

  async function fetchTicketConversation(internalId) {
    if (!internalId) {
      postToSidebar({ type: "FETCH_CONV_RESULT", data: { id: internalId, conversation: "" } });
      return;
    }

    try {
      const storage = await new Promise(resolve => chrome.storage.local.get(['firePortalName', 'fireOrgId'], resolve));
      let portalName = storage.firePortalName || "emchile"; 
      if (!storage.firePortalName) {
          const pathParts = window.location.pathname.split('/');
          if (pathParts.length > 2 && pathParts[1] === 'support') {
              portalName = pathParts[2];
          }
      }
      const manualOrgId = storage.fireOrgId || "";
      const csrf = (() => {
        const match = document.cookie.match(/iamcsr=([^;]+)/) || document.cookie.match(/_zcsr_tmp=([^;]+)/);
        return match ? match[1] : "";
      })();

      const endpoints = [
          `/supportapi/zd/${portalName}/api/v1/tickets/${internalId}/threads?limit=100`,
          `/api/v1/tickets/${internalId}/threads?limit=100`,
          `https://${window.location.hostname}/supportapi/zd/${portalName}/api/v1/tickets/${internalId}/threads?limit=100`
      ];
      
      let data = null;
      const headers = { 'Accept': 'application/json, text/plain, */*' };
      if (csrf) headers['X-ZCSRF-TOKEN'] = `iamcsr=${csrf}`;
      if (manualOrgId) headers['orgid'] = manualOrgId;

      for (let url of endpoints) {
          try {
              const res = await fetch(url, { headers });
              if (res.ok) {
                  const json = await res.json();
                  data = json.data || json;
                  if (data) break;
              }
          } catch(e) {}
      }

      if (!data) throw new Error("Acceso denegado o no encontrado");

      const threads = Array.isArray(data) ? data : [data];
      let fullText = [];
      
      // Order older first or newest first? User wants context, so chronological is usually best.
      for (const t of threads) {
          const author = t.author || {};
          const senderName = author.name || t.sender || "Desconocido";
          const d = new Date(t.createdTime);
          const timeStr = t.createdTime ? `${d.toLocaleDateString()} ${d.toLocaleTimeString()}` : "";
          
          let rawText = t.content || t.summary || "";
          if (rawText) {
             let safeText = rawText.replace(/<img\b[^>]*>/gi, "");
             const tempDiv = document.createElement('div');
             tempDiv.innerHTML = safeText;
             // Remove blockquotes for cleaner text
             tempDiv.querySelectorAll('blockquote, .gmail_quote, .zmail_extra, .zd-quoted-text').forEach(e => e.remove());
             let bodyText = tempDiv.innerText.trim();
             if (bodyText) fullText.push(`[${timeStr}] ${senderName}: ${bodyText}`);
          }
      }

      postToSidebar({ type: "FETCH_CONV_RESULT", data: { id: internalId, conversation: fullText.reverse().join('\n\n') } });
    } catch (e) {
      postToSidebar({ type: "FETCH_CONV_RESULT", data: { id: internalId, conversation: "(Error extrayendo conversación: " + e.message + ")" } });
    }
  }

  // ─── DOMAIN BASED SEARCH ───────────────────────────────────────────────────
  function searchOcByDomain(ocNumber) {
    if (!ocNumber) return;
    
    if (window.location.href.includes("mercadopublico.cl")) {
      searchOcInMercadoPublico(ocNumber);
    } else if (window.location.href.includes("desk.zoho")) {
      // En Zoho Desk solo el TOP frame debe actuar
      if (window.top !== window) return;
      searchOcInZoho(ocNumber);
    } else {
      postToSidebar({ type: "TOAST", data: { msg: "⚠ Debes estar en Zoho Desk o Mercado Público" } });
    }
  }

  function forceSearchInMercadoPublico(ocNumber) {
    if (!ocNumber) return;
    if (window.location.href.includes("mercadopublico.cl")) {
      postToSidebar({ type: "TOAST", data: { msg: "EMChile: Iniciando búsqueda en portal..." } });
      searchOcInMercadoPublico(ocNumber);
    } else {
      // Si no estamos en Mercado Público, abrir en nueva pestaña con el comando de búsqueda en el hash
      const url = "https://www.mercadopublico.cl/Home/BusquedaOC#search=" + encodeURIComponent(ocNumber);
      window.open(url, "_blank");
      postToSidebar({ type: "TOAST", data: { msg: "Abriendo Mercado Público..." } });
    }
  }

  // ─── ZOHO DESK SEARCH ──────────────────────────────────────────────────────
  function searchOcInZoho(ocNumber) {
    // Intentar encontrar el input de búsqueda global o cualquier input de búsqueda visible
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"]'));
    let searchInput = inputs.find(i => {
      const ph = (i.placeholder || "").toLowerCase();
      const id = (i.id || "").toLowerCase();
      const isVisible = i.offsetWidth > 0 && i.offsetHeight > 0;
      return isVisible && (ph.includes("buscar") || ph.includes("search") || id.includes("search") || id.includes("buscar"));
    });

    if (!searchInput) {
      // Buscar botón por aria-label, title, tooltip o clase
      const btns = Array.from(document.querySelectorAll('button, div, span, a, svg')).filter(el => {
        if (el.offsetWidth === 0 && el.tagName !== 'svg') return false;
        const txt = (el.title || el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || "").toLowerCase();
        return txt.includes('buscar (/)') || txt.includes('search (/)') || txt.includes('global search') || txt.includes('búsqueda global');
      });
      
      const searchIcon = btns[0] || document.querySelector('.GlobalSearch, #HeadSearch, [class*="search-icon"], [id*="search-icon"], [data-test-id="search-icon"]');

      if (searchIcon && typeof searchIcon.click === 'function') {
        searchIcon.click();
      } else {
        // Fallback: simular la tecla '/'
        if (document.activeElement) document.activeElement.blur();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', code: 'Slash', keyCode: 191, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { key: '/', code: 'Slash', keyCode: 191, bubbles: true }));
      }
      
      postToSidebar({ type: "TOAST", data: { msg: "Abriendo buscador..." } });
      setTimeout(() => searchOcInZoho(ocNumber), 700);
      return;
    }

    if (searchInput) {
      searchInput.focus();
      
      // Setter nativo para frameworks (React/Ember)
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(searchInput, ocNumber);
      } else {
        searchInput.value = ocNumber;
      }
      
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Simular tecla Enter para ejecutar búsqueda (pequeño retraso para que el framework registre el input)
      setTimeout(() => {
        searchInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
        searchInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
        searchInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
        postToSidebar({ type: "TOAST", data: { msg: "Buscando en Zoho: " + ocNumber } });
      }, 100);
    } else {
      postToSidebar({ type: "TOAST", data: { msg: "⚠ No se encontró el buscador de Zoho. Ábrelo manualmente." } });
    }
  }

  let isLearningMode = false;
  let pendingOcToPaste = null;
  let savedMPSelector = null;

  // Cargar selector guardado al inicio
  chrome.storage.local.get(["emchileMPSavedSelector"], (res) => {
    if (res.emchileMPSavedSelector) savedMPSelector = res.emchileMPSavedSelector;
  });

  // Listener global para el modo aprendizaje
  window.addEventListener("mousedown", (e) => {
    if (!isLearningMode || !pendingOcToPaste) return;
    
    const el = e.target.closest("input");
    if (el && (el.type === "text" || !el.type)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Generar selector simple
      let selector = "";
      if (el.id) selector = `#${el.id}`;
      else if (el.name) selector = `input[name="${el.name}"]`;
      else if (el.placeholder) selector = `input[placeholder="${el.placeholder}"]`;
      else selector = "input[type='text']"; // Muy genérico, pero mejor que nada
      
      savedMPSelector = selector;
      chrome.storage.local.set({ emchileMPSavedSelector: selector });
      
      // Ejecutar la búsqueda pendiente
      isLearningMode = false;
      const oc = pendingOcToPaste;
      pendingOcToPaste = null;
      
      // Feedback visual
      el.style.outline = "3px solid #00d4ff";
      el.style.background = "#fff9c4";
      setTimeout(() => { el.style.outline = ""; el.style.background = ""; }, 1500);
      
      // Pegar el valor (el buscador ya está en 'el')
      forceSetInElement(el, oc);
      postToSidebar({ type: "TOAST", data: { msg: "✓ Buscador vinculado y OC pegada" } });
    }
  }, true);

  function forceSetInElement(el, val) {
    try {
      el.focus();
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeSetter) nativeSetter.call(el, val);
      else el.value = val;
      el.setAttribute('value', val);
      ['input', 'change', 'blur'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
      
      // Intentar Enter automático tras un breve delay
      setTimeout(() => {
        const enterProps = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
        el.dispatchEvent(new KeyboardEvent('keydown', enterProps));
        el.dispatchEvent(new KeyboardEvent('keypress', enterProps));
        el.dispatchEvent(new KeyboardEvent('keyup', enterProps));
        if (el.form) el.form.submit();
      }, 500);
    } catch(e) { console.error(e); }
  }

  // ─── MERCADO PUBLICO SEARCH ────────────────────────────────────────────────
  function searchOcInMercadoPublico(ocNumber, retryCount = 0) {
    function findInDocument(doc) {
      let inputEl = null;
      
      // 1. Intentar con el selector guardado si existe
      if (savedMPSelector) {
        inputEl = doc.querySelector(savedMPSelector);
        if (inputEl) return inputEl;
      }

      // 2. Selectores agresivos
      const inputSelectors = [
        'input[placeholder*="697-475"]',
        'input[placeholder*="ID"]',
        'input[placeholder*="OC"]',
        'input[placeholder*="Orden"]',
        '#txtIdOrdenCompra',
        '#txtIdOC',
        '.search-box input',
        'input[name*="OC" i]',
        'input[name*="Orden" i]',
        'input[type="text"][maxlength="30"]'
      ];
      
      for (const sel of inputSelectors) {
        inputEl = doc.querySelector(sel);
        if (inputEl) return inputEl;
      }

      const labels = Array.from(doc.querySelectorAll('label, span, div, h1, h2, h3, h4, h5, h6, p'));
      const idLabel = labels.find(l => {
        const t = l.textContent.trim().toUpperCase();
        return t === "BUSCAR POR ID" || t.includes("BUSCAR POR ID") || t.includes("ORDEN DE COMPRA");
      });
      if (idLabel) {
        const container = idLabel.closest("div, td, tr, table, section, fieldset");
        if (container) {
          inputEl = container.querySelector('input[type="text"], input:not([type])');
        }
      }
      return inputEl;
    }

    // 1. Buscar en el documento principal
    let targetInput = findInDocument(document);
    let targetDoc = document;

    // 2. Si no se encuentra, buscar en IFRAMES
    if (!targetInput) {
      const iframes = document.querySelectorAll('iframe');
      for (const frame of iframes) {
        try {
          const fDoc = frame.contentDocument || frame.contentWindow.document;
          if (fDoc) {
            targetInput = findInDocument(fDoc);
            if (targetInput) {
              targetDoc = fDoc;
              break;
            }
          }
        } catch(e) {}
      }
    }

    // Si no se encuentra y hay reintentos, esperar
    if (!targetInput && retryCount < 5) {
      setTimeout(() => searchOcInMercadoPublico(ocNumber, retryCount + 1), 1000);
      return;
    }

    if (targetInput) {
      forceSetInElement(targetInput, ocNumber);
      postToSidebar({ type: "TOAST", data: { msg: "Buscando: " + ocNumber } });
    } else {
      // Activar modo aprendizaje
      isLearningMode = true;
      pendingOcToPaste = ocNumber;
      postToSidebar({ type: "TOAST", data: { msg: "⚠ Haz clic en el campo de búsqueda de MP para vincularlo" } });
    }
  }

  // ─── MERCADO PUBLICO DROPDOWN ─────────────────────────────────────────────
  let mpDropdownEl = null;

  function initMPDropdown() {
    // Escuchar eventos de foco en inputs
    document.addEventListener("focusin", (e) => {
      const el = e.target;
      if (el.tagName === "INPUT" && (el.type === "text" || el.type === "search")) {
        const ph = (el.placeholder || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const text = el.parentElement ? el.parentElement.textContent.toUpperCase() : "";
        
        // Verificar si parece un campo de búsqueda de OC
        if (ph.includes("697-475") || ph.includes("id") || id.includes("search") || text.includes("BUSCAR POR ID")) {
          showOcDropdown(el);
        }
      }
    });

    document.addEventListener("click", (e) => {
      if (mpDropdownEl && !mpDropdownEl.contains(e.target) && e.target.tagName !== "INPUT") {
        hideOcDropdown();
      }
    });

    window.addEventListener("scroll", hideOcDropdown, true);
    window.addEventListener("resize", hideOcDropdown);
  }

  function showOcDropdown(targetEl) {
    chrome.storage.local.get(["ocTracking"], (res) => {
      const ocs = res.ocTracking || [];
      if (ocs.length === 0) return;

      if (!mpDropdownEl) {
        mpDropdownEl = document.createElement("div");
        mpDropdownEl.className = "emchile-oc-dropdown";
        document.body.appendChild(mpDropdownEl);
      }

      const rect = targetEl.getBoundingClientRect();
      mpDropdownEl.style.top = (window.scrollY + rect.bottom + 5) + "px";
      mpDropdownEl.style.left = (window.scrollX + rect.left) + "px";
      mpDropdownEl.style.width = Math.max(280, rect.width) + "px";
      mpDropdownEl.style.display = "block";

      let html = `<div class="emchile-oc-header">OCs Recientes (AI Desk)</div>`;
      ocs.slice(0, 15).forEach(item => {
        html += `
          <div class="emchile-oc-item" data-oc="${item.oc}">
            <div class="emchile-oc-oc">${item.oc}</div>
            <div class="emchile-oc-meta">
              <span class="emchile-oc-status">${item.mp || 'PENDIENTE'}</span>
              <span class="emchile-oc-monto">${item.monto || ''}</span>
            </div>
          </div>
        `;
      });
      mpDropdownEl.innerHTML = html;

      // Eventos
      mpDropdownEl.querySelectorAll(".emchile-oc-item").forEach(item => {
        item.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const oc = item.getAttribute("data-oc");
          searchOcInMercadoPublico(oc);
          hideOcDropdown();
        };
      });
    });
  }

  function hideOcDropdown() {
    if (mpDropdownEl) mpDropdownEl.style.display = "none";
  }

  function normalizeEstadoMP(raw) {
    const s = String(raw).toLowerCase().trim();
    // exact matches first
    if (s === "aceptada") return "aceptada";
    if (s === "cancelada") return "cancelada";
    if (s === "rechazada") return "rechazada";
    if (s === "recepción conforme" || s === "recepcion conforme") return "recepcion_conforme";
    if (s === "cancelación solicitada" || s === "cancelacion solicitada") return "solicita_cancelacion";
    if (s === "enviada a proveedor" || s === "pendiente") return "pendiente";
    
    // loose matches
    if (s.includes("conforme")) return "recepcion_conforme";
    if (s.includes("solicitada") || s.includes("solicitud de cancel")) return "solicita_cancelacion";
    if (s.includes("en proceso")) return "pendiente";
    
    return null;
  }

  function scanMercadoPublicoResults() {
    if (!window.location.href.includes("mercadopublico.cl")) return;
    
    const rows = document.querySelectorAll('tr');
    let results = [];
    
    for (let r of rows) {
      const text = r.textContent || "";
      // Quick check if row has an OC
      if (!text.match(/\d{3,8}-\d{1,6}-(?:AG|COT|LE|LP|SE|LR)[0-9]{2}/i)) continue;
      
      const cells = Array.from(r.querySelectorAll('td'));
      if (cells.length < 3) continue;
      
      let ocText = "";
      let estado = null;
      let monto = "";
      
      for (let c of cells) {
        const cellText = (c.textContent || "").trim();
        
        if (!ocText) {
          const m = cellText.match(/\b(\d{3,8}-\d{1,6}-(?:AG|COT|LE|LP|SE|LR)[0-9]{2})\b/i);
          if (m) ocText = m[1].toUpperCase();
        }
        
        if (!estado) {
          const mapped = normalizeEstadoMP(cellText);
          if (mapped) estado = mapped;
        }
        
        if (!monto) {
          const m = cellText.match(/\$\s*[\d.]+/);
          if (m) monto = m[0];
        }
      }
      
      if (ocText && (estado || monto)) {
        results.push({ oc: ocText, estado, monto });
      }
    }
    
    if (results.length > 0) {
      // Enviar a la sidebar actual si existe
      postToSidebar({ type: "UPDATE_OC_FROM_MP", data: results });
      
      // Actualizar storage para que otras pestañas (como la de Zoho) se sincronicen
      chrome.storage.local.get(["ocTracking"], (res) => {
        let ocRows = res.ocTracking || [];
        let updated = false;
        results.forEach(mpRes => {
          let row = ocRows.find(r => r.oc.toUpperCase() === mpRes.oc.toUpperCase());
          if (row) {
            if (mpRes.estado && row.mp !== mpRes.estado) {
              row.mp = mpRes.estado;
              updated = true;
            }
            if (mpRes.monto && row.monto !== mpRes.monto) {
              row.monto = mpRes.monto;
              updated = true;
            }
          }
        });
        if (updated) {
          chrome.storage.local.set({ ocTracking: ocRows });
        }
      });
    }
  }

  // ─── INSERT IN ZOHO EDITOR ─────────────────────────────────────────────────
  // Delegates to background.js which uses chrome.scripting.executeScript with
  // world:"MAIN" — this bypasses Zoho's CSP and gives access to window.Quill.
  function insertTextInZoho(text) {
    if (!text) return;
    bgMessage({ type: "EXEC_INSERT", data: { text } })
      .then((res) => {
        if (res?.ok) {
          postToSidebar({ type: "INSERT_SUCCESS" });
        } else {
          navigator.clipboard.writeText(text).then(() =>
            postToSidebar({
              type: "INSERT_FALLBACK",
              message:
                "✓ Copiado al portapapeles — pega con Ctrl+V en el editor",
            }),
          );
        }
      })
      .catch(() => {
        navigator.clipboard.writeText(text).then(() =>
          postToSidebar({
            type: "INSERT_FALLBACK",
            message: "✓ Copiado al portapapeles — pega con Ctrl+V en el editor",
          }),
        );
      });
  }

  // ─── AUTO-FILL TICKET FIELDS ───────────────────────────────────────────────
  // Delegates to background.js which uses chrome.scripting.executeScript with
  // world:"MAIN" — React inputs and custom Zoho dropdowns both respond.
  function autoFillTicketFields({ ocNumbers, licitacion, priority }) {
    const ocValue =
      Array.isArray(ocNumbers) && ocNumbers.length ? ocNumbers[0] : null;
    bgMessage({
      type: "EXEC_AUTOFILL",
      data: {
        ocValue: ocValue || null,
        licitacion: licitacion || null,
        priority: priority || null,
      },
    })
      .then((res) =>
        postToSidebar({
          type: "AUTO_FILL_RESULT",
          data: res || { filled: [], failed: [], saved: false },
        }),
      )
      .catch((err) =>
        postToSidebar({
          type: "AUTO_FILL_RESULT",
          data: { filled: [], failed: [err.message], saved: false },
        }),
      );
  }
  // ─── SPA NAVIGATION OBSERVER ───────────────────────────────────────────────
  function setupMutationObserver() {
    let debounce;
    const obs = new MutationObserver(() => {
      clearTimeout(debounce);
      debounce = setTimeout(checkTicketChange, 900);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function setupHistoryListeners() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(checkTicketChange, 1100);
      }
    };
    const origPush = history.pushState.bind(history);
    history.pushState = (...a) => {
      origPush(...a);
      check();
    };
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (...a) => {
      origReplace(...a);
      check();
    };
    window.addEventListener("popstate", check);
  }

  function setupEmergencyClose() {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && sidebarOpen) {
        closeSidebar();
      }
    });
  }

  function checkTicketChange() {
    const newId = extractTicketId();
    if (newId && newId !== "UNKNOWN" && newId !== currentTicketId) {
      currentTicketId = newId;
      const latestEmailDate = extractLatestEmailDate();
      postToSidebar({ type: "TICKET_CHANGED", ticketId: newId, data: { latestEmailDate } });
    }
  }

  // ─── BOOTSTRAP ─────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
