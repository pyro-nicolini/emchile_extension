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

  let fireMenuWidth = 400;

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get(["emchileSidebarWidth", "emchileFireMenuWidth", "emchileFireDebugLogs", "emchileFireSummaryTable", "emchileFireOcInput"], (res) => {
      sidebarWidth = res.emchileSidebarWidth || 500;
      fireMenuWidth = res.emchileFireMenuWidth || 400;
      applyWidth(sidebarWidth);
      injectStyles();
      injectUI();
      applyFireMenuWidth(fireMenuWidth);

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
      
      #emchile-resizer {
        position: fixed;
        top: 0; right: var(--emchile-width, 500px);
        width: 14px; height: 100vh;
        z-index: 2147483642;
        cursor: col-resize;
        transform: translateX(50%);
        display: none;
      }
      #emchile-resizer.resizer-open { display: block; }

      /* FIRE FAB & MENU */
      #emchile-fire-fab {
        position: fixed;
        right: 20px;
        top: 180px;
        z-index: 2147483640;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        background: linear-gradient(160deg, #500000 0%, #d00000 100%);
        border: 1px solid rgba(255, 77, 77, 0.55);
        border-radius: 14px;
        padding: 14px 10px;
        cursor: pointer;
        user-select: none;
        transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
        box-shadow: 0 0 22px rgba(208, 0, 0, 0.3), 0 6px 24px rgba(0,0,0,0.5);
        min-width: 60px;
      }
      #emchile-fire-fab:hover {
        border-color: rgba(255, 77, 77, 0.8);
        box-shadow: 0 0 32px rgba(255, 77, 77, 0.6), 0 6px 24px rgba(0,0,0,0.55);
      }
      #emchile-fire-fab .ef-icon { font-size: 22px; line-height: 1; filter: drop-shadow(0 0 5px rgba(255, 77, 77, 0.9)); }
      #emchile-fire-fab .ef-text {
        font-family: 'Menlo','Courier New',monospace;
        font-size: 9px; font-weight: 700;
        color: #ffcccc; letter-spacing: 1.5px; text-transform: uppercase;
        text-shadow: 0 0 8px rgba(255, 77, 77, 0.65);
      }
      #emchile-fire-menu {
        position: fixed;
        right: 90px;
        top: 180px;
        transform: translateX(20px);
        opacity: 0;
        pointer-events: none;
        z-index: 2147483640;
        background: linear-gradient(135deg, #4a0000 0%, #1a0000 100%);
        border: 1px solid #ff4d4d;
        border-radius: 12px;
        padding: 15px;
        width: 400px;
        box-shadow: 0 0 20px rgba(255,0,0,0.4);
        transition: all 0.3s ease;
        color: #fff;
        font-family: sans-serif;
        max-height: 80vh;
        overflow-y: auto;
        box-sizing: border-box;
      }
      #emchile-fire-menu * {
        box-sizing: border-box;
      }
      #emchile-fire-menu.fire-open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(-50%) translateX(0);
      }
      #emchile-fire-menu input {
        width: 100%;
        padding: 8px;
        margin-bottom: 10px;
        background: rgba(0,0,0,0.5);
        border: 1px solid #ff4d4d;
        color: #fff;
        border-radius: 4px;
        font-family: monospace;
      }
      #emchile-fire-menu button {
        width: 100%;
        padding: 10px;
        background: #d00000;
        color: #fff;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        text-transform: uppercase;
      }
      #emchile-fire-menu button:hover {
        background: #ff0000;
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
        border-collapse: collapse;
        font-size: 10px;
        margin-top: 5px;
        background: rgba(0,0,0,0.4);
      }
      .fire-summary-table th, .fire-summary-table td {
        border: 1px solid #800;
        padding: 4px;
        text-align: left;
      }
      .fire-summary-table th {
        background: #500;
        color: #ffaaaa;
      }
      #emchile-fire-debug-toggle {
        cursor: pointer;
        background: rgba(255,255,255,0.05);
        padding: 5px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
      }
      #emchile-fire-debug-toggle:hover {
        background: rgba(255,255,255,0.1);
      }
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

    // Fire Menu
    fireMenu = document.createElement("div");
    fireMenu.id = "emchile-fire-menu";
    fireMenu.innerHTML = `
      <div id="emchile-fire-resizer"></div>
      <input type="text" id="fire-oc-input" placeholder="Pegar OC (ej. 1234-56-AG25)" />
      <button id="fire-play-btn">PLAY X1</button>
      
      <!-- Debug Collapsible -->
      <div style="margin-top: 15px;">
        <div id="emchile-fire-debug-toggle">
          <h4 style="margin:0; color:#ffaaaa; font-size:11px;">Tabla Ejecución (Debug)</h4>
          <span id="fire-debug-arrow">▶</span>
        </div>
        <div id="emchile-fire-debug-content" style="display:none; margin-top:5px; max-height:100px; overflow-y:auto; border: 1px solid #800; border-radius: 4px; background: rgba(0,0,0,0.3); font-size:10px;">
          <table id="emchile-fire-debug-table" style="width:100%; border-collapse:collapse;">
            <tbody style="font-family: monospace;"></tbody>
          </table>
        </div>
      </div>

      <!-- New Summary Table -->
      <div style="margin-top: 15px;">
        <h4 style="margin:0 0 5px 0; color:#ffaa55; font-size:11px;">Opciones Encontradas (v1.2)</h4>
        <div style="max-height:150px; overflow-y:auto; border:1px solid #850; border-radius:4px;">
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
    `;
    document.body.appendChild(fireMenu);

    // Toggle Debug
    const debugToggle = document.getElementById("emchile-fire-debug-toggle");
    const debugContent = document.getElementById("emchile-fire-debug-content");
    const debugArrow = document.getElementById("fire-debug-arrow");
    debugToggle.addEventListener("click", () => {
      const isHidden = debugContent.style.display === "none";
      debugContent.style.display = isHidden ? "block" : "none";
      debugArrow.textContent = isHidden ? "▼" : "▶";
    });

    // Fire Resizer Logic
    const fireResizer = document.getElementById("emchile-fire-resizer");
    let isFireResizing = false;
    fireResizer.addEventListener("mousedown", (e) => {
      isFireResizing = true;
      document.body.style.cursor = "ew-resize";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!isFireResizing) return;
      const newWidth = window.innerWidth - e.clientX - 90; // 90 is the new right offset
      if (newWidth > 300 && newWidth < 1200) {
        fireMenuWidth = newWidth;
        applyFireMenuWidth(newWidth);
      }
    });

    window.addEventListener("mouseup", () => {
      if (isFireResizing) {
        isFireResizing = false;
        document.body.style.cursor = "default";
        chrome.storage.local.set({ emchileFireMenuWidth: fireMenuWidth });
      }
    });

    const ocInputEl = document.getElementById("fire-oc-input");
    ocInputEl.addEventListener("change", (e) => {
      chrome.storage.local.set({ emchileFireOcInput: e.target.value.trim() });
    });

    const playBtn = document.getElementById("fire-play-btn");
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        console.log("EMChile: Play button clicked");
        handleFirePlayClick();
      });
    }

    // Sidebar iframe (loads sidebar.html from extension)
    sidebarFrame = document.createElement("iframe");
    sidebarFrame.id = "emchile-sidebar-frame";
    sidebarFrame.title = "EMChile AI Desk";
    sidebarFrame.src = chrome.runtime.getURL("sidebar.html");
    document.body.appendChild(sidebarFrame);

    // Resizer handle
    resizerEl = document.createElement("div");
    resizerEl.id = "emchile-resizer";
    document.body.appendChild(resizerEl);

    // Setup drag events
    resizerEl.addEventListener("mousedown", (e) => {
      isResizing = true;
      document.body.style.userSelect = "none";
      sidebarFrame.style.pointerEvents = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      let newW = window.innerWidth - e.clientX;
      newW = Math.max(350, Math.min(newW, window.innerWidth - 100)); // min 350px, max (width - 100px)
      sidebarWidth = newW;
      applyWidth(sidebarWidth);
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.userSelect = "";
        sidebarFrame.style.pointerEvents = "auto";
        chrome.storage.local.set({ emchileSidebarWidth: sidebarWidth });
      }
    });
  }

  // ─── FAB CLICK ─────────────────────────────────────────────────────────────
  function handleFireFabClick() {
    fireMenuOpen = !fireMenuOpen;
    if (fireMenuOpen) {
      fireMenu.classList.add("fire-open");
      if (sidebarOpen) closeSidebar();
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

  function applyFireMenuWidth(w) {
    if (fireMenu) fireMenu.style.width = w + "px";
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
          ".zgh-search-result-row", ".search-ticket-row"
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
            const titleEl = row.querySelector(".subject, [class*='subject'], .ticket-title, [class*='title'], h2, h3, .search-title, a[class*='title']");
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
              const senderEl = row.querySelector(".contact-name, [class*='contact'], [class*='requester'], [class*='sender'], .name");
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
              tr.innerHTML = `<td>${rowOc}</td><td>${ticketId}</td><td>${sender}</td><td>${ts}</td><td>${logSubject}</td>`;
              summaryTbody.appendChild(tr);
              fireLog(`Fila agregada a tabla: ${ticketId}`);
              chrome.storage.local.set({ emchileFireSummaryTable: summaryTbody.innerHTML });
            }
            comms.push({ sender, ts, text: subject, ticketId });
          });
          fireLog(`Scraping completado con éxito.`);
        }
      }, 500);
    }, 300); // 300ms delay para que Zoho enfoque el input despues del atajo
  }

  function handleFabClick() {
    if (fireMenuOpen) {
      fireMenuOpen = false;
      fireMenu.classList.remove("fire-open");
    }
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
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
      const result = await bgMessage({
        type: "ANALYZE_TICKET",
        data: ticketData,
      });
      postToSidebar({ type: "ANALYSIS_RESULT", data: result, ticketData });
    } catch (err) {
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
    const v2Els = document.querySelectorAll('[data-id="commonTime"], [data-test-id="commonTime"], [class*="usertime" i], time, .mail-time');
    for (let el of v2Els) {
      parseAndCompare(el.getAttribute("data-title"));
      parseAndCompare(el.getAttribute("aria-label"));
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
        '[class*="conversations"], [class*="conversation"], [role="main"], main',
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
          '[class*="fromName"], [class*="contact-name"]',
      );
      const sender = senderEl?.textContent.trim() || `Mensaje ${i + 1}`;

      // Timestamp
      const timeEl =
        node.querySelector("time[datetime]") ||
        node.querySelector(
          '[class*="time"], [class*="date"], [class*="timestamp"]',
        );
      const ts =
        timeEl?.getAttribute("datetime") || timeEl?.textContent.trim() || "";

      // Prefer an inner body element, but keep the full node text if it contains
      // more OC references than the narrowed body selection.
      const bodyEl = node.querySelector(
        '[class*="body"], [class*="content"], [class*="text"], ' +
          '[class*="mail-body"], [class*="mailBody"], blockquote',
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
  }

  window.addEventListener("message", (evt) => {
    if (evt.data?.source !== "emchile-sidebar") return;
    const { type, data } = evt.data;
    switch (type) {
      case "SIDEBAR_READY":
        checkTicketChange();
        break;
      case "RE_ANALYZE":
        if (!isAnalyzing) triggerAnalysis(data?.responseContext || null);
        break;
      case "CLOSE_SIDEBAR":
        closeSidebar();
        break;
      case "INSERT_IN_ZOHO":
        insertTextInZoho(data?.text || "");
        break;
      case "AUTO_FILL_FIELDS":
        autoFillTicketFields(data || {});
        break;
      case "REQUEST_LATEST_DATE":
        postToSidebar({ type: "LATEST_DATE_RESULT", data: { date: extractLatestEmailDate(), rowIdx: data?.rowIdx } });
        break;
      case "SEARCH_OC_GLOBAL":
        searchOcByDomain(data?.oc);
        break;
    }
  });

  // ─── DOMAIN BASED SEARCH ───────────────────────────────────────────────────
  function searchOcByDomain(ocNumber) {
    if (!ocNumber) return;
    
    if (window.location.href.includes("mercadopublico.cl")) {
      searchOcInMercadoPublico(ocNumber);
    } else if (window.location.href.includes("desk.zoho")) {
      searchOcInZoho(ocNumber);
    } else {
      postToSidebar({ type: "TOAST", data: { msg: "⚠ Debes estar en Zoho Desk o Mercado Público" } });
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
        return txt.includes('buscar (/)') || txt.includes('search (/)');
      });
      
      const searchIcon = btns[0] || document.querySelector('.GlobalSearch, #HeadSearch, [class*="search-icon"], [id*="search-icon"]');

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

  // ─── MERCADO PUBLICO SEARCH ────────────────────────────────────────────────
  function searchOcInMercadoPublico(ocNumber) {
    // 1. Buscar input directamente por su placeholder (como se ve en la captura)
    let inputEl = document.querySelector('input[placeholder*="697-475"]');
    let btnEl = null;

    if (!inputEl) {
      // 2. Fallback: buscar cualquier input de texto dentro de algo que diga "Buscar por ID"
      const labels = Array.from(document.querySelectorAll('label, span, div, h1, h2, h3, h4, h5, h6, p'));
      const idLabel = labels.find(l => l.textContent.trim().toUpperCase() === "BUSCAR POR ID");
      if (idLabel) {
        const container = idLabel.closest("div, td, tr, table, section, fieldset");
        if (container) {
          inputEl = container.querySelector('input[type="text"]');
        }
      }
    }

    if (inputEl) {
      // Buscar el botón correspondiente
      // Primero intentar un botón que diga "Buscar ID"
      const allBtns = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button, a.btn'));
      btnEl = allBtns.find(b => {
        const txt = (b.value || b.textContent || "").trim().toUpperCase();
        return txt === "BUSCAR ID" || txt.includes("BUSCAR ID");
      });

      // Si no, buscar el botón de submit más cercano al input
      if (!btnEl) {
        let parent = inputEl.parentElement;
        for (let i = 0; i < 5; i++) { // subir hasta 5 niveles
          if (!parent) break;
          btnEl = parent.querySelector('input[type="submit"], input[type="button"], button');
          if (btnEl) break;
          parent = parent.parentElement;
        }
      }

      // Rellenar el input
      inputEl.value = ocNumber;
      // Disparar eventos nativos para que React/Angular/ASP.NET registren el cambio
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      inputEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      if (btnEl) {
        btnEl.click();
        postToSidebar({ type: "TOAST", data: { msg: "Buscando: " + ocNumber } });
      } else {
        // Fallback: si no hay botón, intentar enviar el formulario
        if (inputEl.form) {
          inputEl.form.submit();
          postToSidebar({ type: "TOAST", data: { msg: "Enviando búsqueda: " + ocNumber } });
        } else {
          postToSidebar({ type: "TOAST", data: { msg: "Pegado: " + ocNumber + " (botón no encontrado)" } });
        }
      }
    } else {
      postToSidebar({ type: "TOAST", data: { msg: "⚠ No se encontró el campo 'Buscar por ID'" } });
    }
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
      postToSidebar({ type: "UPDATE_OC_FROM_MP", data: results });
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
