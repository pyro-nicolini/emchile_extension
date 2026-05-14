"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Sidebar Script
//  Runs inside the sidebar.html extension page (has full chrome.* access)
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── Provider configuration ─────────────────────────────────────────────────
  var PROVIDER_MODELS = {
    openai: [
      { value: "gpt-4o-mini",  label: "GPT-4o Mini · Rápido" },
      { value: "gpt-4o",       label: "GPT-4o · Preciso" },
      { value: "gpt-4-turbo",  label: "GPT-4 Turbo · Avanzado" },
    ],
    github_copilot: [
      { value: "gpt-4o-mini",       label: "GPT-4o Mini · Rápido" },
      { value: "gpt-4o",            label: "GPT-4o · Balanceado" },
      { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet · Avanzado" },
      { value: "o1-mini",           label: "o1-mini · Razonamiento" },
      { value: "o3-mini",           label: "o3-mini · Razonamiento avanzado" },
    ],
    claude: [
      { value: "claude-3-5-haiku-20241022",  label: "Claude 3.5 Haiku · Rápido" },
      { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet · Balanceado" },
      { value: "claude-3-opus-20240229",     label: "Claude 3 Opus · Avanzado" },
    ],
    gemini: [
      { value: "gemini-2.0-flash",            label: "Gemini 2.0 Flash · Rápido" },
      { value: "gemini-2.0-flash-lite",       label: "Gemini 2.0 Flash-Lite · Ultra rápido" },
      { value: "gemini-1.5-flash",            label: "Gemini 1.5 Flash · Rápido" },
      { value: "gemini-1.5-flash-8b",         label: "Gemini 1.5 Flash-8B · Ligero" },
      { value: "gemini-1.5-pro",              label: "Gemini 1.5 Pro · Máxima capacidad" },
      { value: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro Preview · Más inteligente" },
    ],
    cerebras: [
      { value: "llama3.1-8b",                          label: "Llama 3.1 8B · Ultra rápido" },
      { value: "llama3.3-70b",                         label: "Llama 3.3 70B · Balanceado" },
      { value: "gpt-oss-120b",                         label: "GPT-OSS 120B · Razonamiento" },
      { value: "qwen-3-235b-a22b-instruct-2507",        label: "Qwen 3 235B · Avanzado" },
    ],
  };

  var PROVIDER_UI = {
    openai:         { label: "OpenAI API Key",                    placeholder: "sk-…" },
    github_copilot: { label: "GitHub Token (models:read)",        placeholder: "ghp_…" },
    claude:         { label: "Claude API Key",                    placeholder: "sk-ant-…" },
    gemini:         { label: "Gemini API Key (Google AI Studio)", placeholder: "AIza…" },
    cerebras:       { label: "Cerebras API Key",                  placeholder: "csk-…" },
  };

  var PROVIDER_STORAGE_KEY = {
    openai:         "apiKeyOpenAI",
    github_copilot: "apiKeyGitHubCopilot",
    claude:         "apiKeyClaude",
    gemini:         "apiKeyGemini",
    cerebras:       "apiKeyCerebras",
  };
  // ─── State ─────────────────────────────────────────────────────────────────
  let currentResult = null;
  let currentTicket = null;
  let previousView = "idle";
  let activeView = "idle";
  let el = {}; // populated in init() once DOM is ready
  let cpAttachment = null; // { type: 'image'|'pdf', base64, mimeType, name }
  let cpContextSaveTimer = null;
  let analysisContextSaveTimer = null;
  const isExpMode = window.location.href.includes("mode=exp") || window.location.hash.includes("exp");

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    const $ = (id) => document.getElementById(id);
    el = {
      btnSettings: $("js-settings"),
      btnHistory: $("js-history"),
      btnClose: $("js-close"),
      btnHdrAnalyze: $("js-hdr-analyze"),
      btnIdleAnalyze: $("js-idle-analyze"),
      tid: $("js-tid"),
      tsub: $("js-tsub"),
      cat: $("js-cat"),
      svIdle: $("sv-idle"),
      svLoading: $("sv-loading"),
      svError: $("sv-error"),
      svResults: $("sv-results"),
      svHistory: $("sv-history"),
      svSettings: $("sv-settings"),
      errMsg: $("js-errmsg"),
      btnRetry: $("js-retry"),
      btnGotoCfg: $("js-goto-cfg"),
      warnBar: $("js-warn"),
      riskBar: $("js-riskbar"),
      riskTitle: $("js-risktitle"),
      riskReasons: $("js-riskreasons"),
      ocBar: $("js-ocbar"),
      ocList: $("js-oclist"),
      btnCopyOcs: $("js-copy-ocs"),
      btnAutoFill: $("js-autofill"),
      clientContextInput: $("js-client-context"),
      internalContextInput: $("js-internal-context"),
      clientText: $("js-client"),
      internalText: $("js-internal"),
      summaryText: $("js-summary"),
      dataGrid: $("js-datagrid"),
      btnInsert: $("js-insert"),
      confFill: $("js-conf"),
      confVal: $("js-confval"),
      btnReanalyze: $("js-reanalyze"),
      histList: $("js-hist"),
      btnClearHist: $("js-clear-hist"),
      apiKeyInput: $("js-apikey"),
      apikeyLabel: $("js-apikey-label"),
      eyeBtn: $("js-eye"),
      providerSelect: $("js-provider"),
      modelSelect: $("js-model"),
      useCustom: $("js-use-custom"),
      customWrap: $("js-custom-wrap"),
      customPrompt: $("js-custom-prompt"),
      btnSaveCfg: $("js-save-cfg"),
      btnBackCfg: $("js-back-cfg"),
      toast: $("js-toast"),
      cpInput: $("js-cp-input"),
      cpContextInput: $("js-cp-context"),
      btnCpRun: $("js-cp-run"),
      cpResultCard: $("js-cp-result-card"),
      cpResponse: $("js-cp-response"),
      btnCpCopy: $("js-cp-copy"),
      btnCpInsert: $("js-cp-insert"),
      cpFile: $("js-cp-file"),
      cpPreview: $("js-cp-preview"),
      cpAttachIcon: $("js-cp-attach-icon"),
      cpAttachName: $("js-cp-attach-name"),
      btnCpRemove: $("js-cp-remove"),
      btnAntiSample: $("js-anti-sample"),
      // Tabla
      btnTabla:    $("js-tabla"),
      tblInput:    $("js-tbl-input"),
      // Experimental
      btnExp:              $("js-experimental"),
      expCount:            $("js-exp-count"),
      expMode:             $("js-exp-mode"),
      expDate:             $("js-exp-date"),
      btnExpScan:          $("js-exp-scan"),
      btnExpRun:           $("js-exp-run"),
      btnExpClear:         $("js-exp-clear"),
      expProgressWrap:     $("js-exp-progress-wrap"),
      expProgressLabel:    $("js-exp-progress-label"),
      expProgressPct:      $("js-exp-progress-pct"),
      expProgressFill:     $("js-exp-progress-fill"),
      expTicketList:       $("js-exp-ticket-list"),
      expListCount:        $("js-exp-list-count"),
      expTicketsScroll:    $("js-exp-tickets-scroll"),
      expResultsWrap:      $("js-exp-results-wrap"),
      expTbody:            $("js-exp-tbody"),
      btnExpCopyTable:     $("js-exp-copy-table"),
      btnExpExport:        $("js-exp-export"),
      expLogBody:          $("js-exp-log-body"),
      btnExpLogClear:      $("js-exp-log-clear"),
      expStatusBadge:      $("js-exp-status-badge"),
      expStatusText:       $("js-exp-status-text"),
      btnTblAdd:   $("js-tbl-add"),
      tblBody:     $("js-tbl-body"),
      tblCount:    $("js-tbl-count"),
      tblEmpty:    $("js-tbl-empty"),
      tblName:     $("js-tbl-name"),
      btnTblClear: $("js-tbl-clear"),
      btnTblCopy:  $("js-tbl-copy"),
      btnTblCsv:   $("js-tbl-csv"),
      btnTblGs:    $("js-tbl-gs"),
      btnTblImport:$("js-tbl-import"),
      fileImport:  $("js-tbl-file-import"),
    };

    if (!el.btnClose || !el.btnSettings || !el.toast) {
      console.error("[EMChile] sidebar init failed: missing DOM nodes");
      return;
    }

    bindUI();
    loadCustomPromptContext();
    loadAnalysisContexts();
    loadTabla();
    showView("idle");
    notifyContent({ type: "SIDEBAR_READY" });

    // Enlazar checkboxes del header para ocultar/mostrar columnas
    document.querySelectorAll(".col-checker").forEach(chk => {
      chk.addEventListener("change", (e) => {
        let colIdx = parseInt(e.target.dataset.col);
        visibleCols[colIdx] = e.target.checked;
        chrome.storage.local.set({ visibleCols });
        applyColVisibility();
      });
    });
  }
  // ─── EVENT BINDING ─────────────────────────────────────────────────────────
  function bindUI() {
    // Header
    el.btnClose.addEventListener("click", () =>
      notifyContent({ type: "CLOSE_SIDEBAR" }),
    );

    el.btnHistory.addEventListener("click", () => {
      if (activeView === "history") showView(previousView);
      else {
        previousView = activeView;
        showView("history");
        loadHistory();
      }
    });

    el.btnSettings.addEventListener("click", () => {
      if (activeView === "settings") showView(previousView);
      else {
        previousView = activeView;
        showView("settings");
        loadSettings();
      }
    });

    // Error
    el.btnRetry.addEventListener("click", () =>
      notifyContent({ type: "RE_ANALYZE", data: { responseContext: getAnalysisContexts() } }),
    );
    el.btnGotoCfg.addEventListener("click", () => {
      previousView = "error";
      showView("settings");
      loadSettings();
    });

    // Results — Re-analyze
    el.btnReanalyze.addEventListener("click", () =>
      notifyContent({ type: "RE_ANALYZE", data: { responseContext: getAnalysisContexts() } }),
    );

    // Results — Insert in Zoho
    el.btnInsert.addEventListener("click", () => {
      if (currentResult?.clientReply) {
        notifyContent({
          type: "INSERT_IN_ZOHO",
          data: { text: currentResult.clientReply },
        });
      }
    });

    // Tabs
    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    // Copy buttons
    document.querySelectorAll(".btn-copy").forEach((btn) => {
      btn.addEventListener("click", () => copyField(btn));
    });

    if (el.btnCopyOcs) {
      el.btnCopyOcs.addEventListener("click", copyOCs);
    }

    if (el.btnAutoFill) {
      el.btnAutoFill.addEventListener("click", runAutoFill);
    }
    if (el.clientContextInput) {
      el.clientContextInput.addEventListener("input", scheduleSaveAnalysisContexts);
    }
    if (el.internalContextInput) {
      el.internalContextInput.addEventListener("input", scheduleSaveAnalysisContexts);
    }

    // History
    el.btnClearHist.addEventListener("click", () => {
      if (confirm("¿Limpiar todo el historial de análisis?")) {
        chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () =>
          loadHistory(),
        );
      }
    });

    // Settings
    el.eyeBtn.addEventListener("click", () => {
      el.apiKeyInput.type =
        el.apiKeyInput.type === "password" ? "text" : "password";
    });
    el.apiKeyInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveSettings();
      }
    });

    // Provider change
    if (el.providerSelect) {
      el.providerSelect.addEventListener("change", () => {
        applyProviderUI(el.providerSelect.value, null);
        const storageKey = PROVIDER_STORAGE_KEY[el.providerSelect.value];
        chrome.storage.local.get([storageKey, "apiKey"], (stored) => {
          el.apiKeyInput.value = stored[storageKey] || "";
          el.apiKeyInput.type = "password";
        });
      });
    }

    el.useCustom.addEventListener("change", () => {
      el.customWrap.classList.toggle("hidden", !el.useCustom.checked);
    });
    el.btnSaveCfg.addEventListener("click", saveSettings);
    el.btnBackCfg.addEventListener("click", () => showView(previousView));

    // Analysis Buttons
    if (el.btnHdrAnalyze) {
      el.btnHdrAnalyze.addEventListener("click", () => {
        showView("loading");
        notifyContent({ type: "RE_ANALYZE" });
      });
    }
    if (el.btnIdleAnalyze) {
      el.btnIdleAnalyze.addEventListener("click", () => {
        showView("loading");
        notifyContent({ type: "RE_ANALYZE" });
      });
    }

    // Custom Prompt
    el.btnCpRun.addEventListener("click", runCustomPrompt);
    if (el.btnAntiSample) {
      el.btnAntiSample.addEventListener("click", runAntiSample);
    }
    el.btnCpCopy.addEventListener("click", () => {
      const text = el.cpResponse.textContent;
      if (text && text !== "—")
        copyText(text).then(() => showToast("✓ Respuesta copiada"));
    });
    el.btnCpInsert.addEventListener("click", () => {
      const text = el.cpResponse.textContent;
      if (text && text !== "—") {
        notifyContent({ type: "INSERT_IN_ZOHO", data: { text } });
      }
    });
    el.cpFile.addEventListener("change", handleCpFileSelect);
    el.btnCpRemove.addEventListener("click", clearCpAttachment);
    el.cpInput.addEventListener("paste", handleCpPaste);
    if (el.cpContextInput) {
      el.cpContextInput.addEventListener("input", scheduleSaveCustomPromptContext);
    }

    // Tabla
    if (el.btnTabla) {
      el.btnTabla.addEventListener("click", () => {
        if (activeView === "tabla") {
          el.btnTabla.classList.remove("active");
          showView(previousView);
        } else {
          previousView = activeView;
          el.btnTabla.classList.add("active");
          if (el.btnExp) el.btnExp.classList.remove("active");
          showView("tabla");
        }
      });
    }
    if (el.btnExp) {
      el.btnExp.addEventListener("click", () => {
        if (activeView === "experimental") {
          el.btnExp.classList.remove("active");
          showView(previousView);
        } else {
          previousView = activeView;
          el.btnExp.classList.add("active");
          if (el.btnTabla) el.btnTabla.classList.remove("active");
          showView("experimental");
        }
      });
    }
    if (el.btnExpScan)      el.btnExpScan.addEventListener("click", expScanTickets);
    if (el.btnExpRun)       el.btnExpRun.addEventListener("click", expRunAnalysis);
    if (el.btnExpClear)     el.btnExpClear.addEventListener("click", expClear);
    if (el.btnExpCopyTable) el.btnExpCopyTable.addEventListener("click", expCopyTable);
    if (el.btnExpExport)    el.btnExpExport.addEventListener("click", expExportExcel);
    if (el.btnExpLogClear)  el.btnExpLogClear.addEventListener("click", () => { if(el.expLogBody) el.expLogBody.innerHTML = ""; });
    if (el.btnTblAdd) {
      el.btnTblAdd.addEventListener("click", handleTblAdd);
    }
    if (el.tblInput) {
      el.tblInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleTblAdd();
      });
    }
    if (el.btnTblClear) {
      el.btnTblClear.addEventListener("click", () => {
        if (confirm("¿Limpiar toda la tabla de OCs?")) {
          chrome.storage.local.set({ ocTracking: [] }, () => loadTabla());
        }
      });
      if (el.tblName) {
        el.tblName.addEventListener("input", () => {
          let val = el.tblName.value.trim();
          chrome.storage.local.set({ ocTableName: val });
        });
      }
    }
    if (el.btnTblCopy) {
      el.btnTblCopy.addEventListener("click", copyTablaText);
    }
    if (el.btnTblCsv) {
      el.btnTblCsv.addEventListener("click", () => exportTablaCsv(";"));
    }
    if (el.btnTblGs) {
      el.btnTblGs.addEventListener("click", () => exportTablaCsv(","));
    }
    if (el.btnTblImport && el.fileImport) {
      el.btnTblImport.addEventListener("click", () => el.fileImport.click());
      el.fileImport.addEventListener("change", handleImportFile);
    }

    if (isExpMode) {
      var header = document.querySelector(".sh");
      var tbar = document.querySelector(".tbar");
      var footer = document.querySelector(".footer");
      if (header) header.style.display = "none";
      if (tbar) tbar.style.display = "none";
      if (footer) footer.style.display = "none";
      showView("experimental");
    }

    // Messages from content.js
    window.addEventListener("message", onContentMessage);

    // Listen for storage changes to sync OC table across tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.ocTracking || changes.visibleCols)) {
        if (changes.ocTracking) ocRows = changes.ocTracking.newValue || [];
        if (changes.visibleCols) visibleCols = changes.visibleCols.newValue || [true,true,true,true,true,true,true,true];
        renderTabla();
      }
    });
  }

  // ─── INCOMING MESSAGES ─────────────────────────────────────────────────────
  function onContentMessage(evt) {
    const { type, data, error, ticketData, ticketId, message } = evt.data || {};
    
    // Experimental mode shield: ignore main AI Desk events to prevent getting stuck
    if (isExpMode) {
      if (type === "OPEN_TICKETS_RESULT") {
        expHandleScanResult(data);
      } else if (type === "FETCH_CONV_RESULT") {
        if (window._expConvResolve && window._expConvId === data?.id) {
          window._expConvResolve(data?.conversation || "");
          window._expConvResolve = null;
          window._expConvId = null;
        }
      }
      return; // Do NOT process LOADING_START, ANALYSIS_RESULT, etc.
    }

    switch (type) {
      case "LOADING_START":
        showView("loading");
        break;
      case "ANALYSIS_RESULT":
        if (ticketData?.latestEmailDate) {
          window.currentLatestEmailDate = ticketData.latestEmailDate;
        }
        currentResult = data;
        currentTicket = ticketData;
        renderResult(data, ticketData);
        break;
      case "ANALYSIS_ERROR":
        el.errMsg.textContent =
          error || "Error desconocido. Revisa tu API Key y conexión.";
        showView("error");
        break;
      case "TICKET_CHANGED":
        if (data?.latestEmailDate) {
          window.currentLatestEmailDate = data.latestEmailDate;
        }
        onTicketChanged(ticketId || data?.ticketId);
        break;
      case "LATEST_DATE_RESULT":
        if (!data?.date) {
           showToast("⚠ No se pudo extraer la fecha de este ticket");
           return;
        }
        window.currentLatestEmailDate = data.date;
        
        if (typeof data.rowIdx === 'number') {
          if (ocRows[data.rowIdx]) {
            ocRows[data.rowIdx].ultimo_correo = data.date;
            saveTabla();
            renderTabla();
            showToast("✓ Fecha (" + data.date + ") actualizada en la OC");
          }
        }
        break;
      case "INSERT_SUCCESS":
        showToast("✓ Texto insertado en el editor de Zoho");
        break;
      case "INSERT_FALLBACK":
        showToast(message || "✓ Copiado al portapapeles");
        break;
      case "INSERT_FALLBACK":
        showToast(message || "✓ Copiado al portapapeles");
        break;
      case "UPDATE_OC_FROM_MP":
        let updated = false;
        (data || []).forEach(mpRes => {
          let row = ocRows.find(r => r.oc.toUpperCase() === mpRes.oc.toUpperCase());
          if (row) {
            let changed = false;
            if (mpRes.estado && row.mp !== mpRes.estado) {
              row.mp = mpRes.estado;
              changed = true;
            }
            if (mpRes.monto && row.monto !== mpRes.monto) {
              row.monto = mpRes.monto;
              changed = true;
            }
            if (changed) updated = true;
          }
        });
        if (updated) {
          saveTabla();
          renderTabla();
        }
        break;
      case "AUTO_FILL_RESULT": {
        const { filled = [], failed = [], saved } = data || {};
        // Cancel safety timer
        if (el.btnAutoFill?._safetyTimer) {
          clearTimeout(el.btnAutoFill._safetyTimer);
          el.btnAutoFill._safetyTimer = null;
        }
        if (el.btnAutoFill) {
          el.btnAutoFill.disabled = false;
          el.btnAutoFill.textContent = "⚡ AUTO-COMPLETAR-OC";
        }
        if (saved) {
          showToast(`✓ Guardado — ${filled.length} campo(s) completado(s)`);
        } else if (filled.length) {
          showToast(
            `✓ ${filled.join(", ")} completado(s) — haz clic en Guardar`,
          );
        } else {
          showToast("⚠ No se encontraron campos para completar");
        }
        break;
      }
    }
  }

  function notifyContent(msg) {
    console.log("%c[EMChile] Sidebar notifying:", "color:lime;font-weight:bold;", msg);
    // Send to background script which will forward to content script
    chrome.runtime.sendMessage({ type: "NOTIFY_CONTENT", msg }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[EMChile] notifyContent error:", chrome.runtime.lastError.message);
        // If we're in loading state and communication failed, show error
        if (activeView === "loading") {
          el.errMsg.textContent = "Error de conexión con la extensión. Recarga la página e intenta de nuevo.";
          showView("error");
        }
      }
    });
  }

  // ─── VIEW MANAGEMENT ───────────────────────────────────────────────────────
  const VIEW_IDS = [
    "idle",
    "loading",
    "error",
    "results",
    "history",
    "settings",
    "tabla",
    "experimental",
  ];

  function showView(name) {
    VIEW_IDS.forEach((v) => {
      const node = document.getElementById(`sv-${v}`);
      if (node) node.classList.toggle("hidden", v !== name);
    });
    activeView = name;

    // Safety timeout: if loading takes > 75s, show a timeout error
    if (name === "loading") {
      clearTimeout(showView._loadingTimer);
      showView._loadingTimer = setTimeout(() => {
        if (activeView === "loading") {
          el.errMsg.textContent = "Tiempo de espera agotado. El análisis tardó demasiado. Intenta de nuevo.";
          showView("error");
        }
      }, 75000);
    } else {
      clearTimeout(showView._loadingTimer);
    }
  }

  // ─── RENDER RESULT ─────────────────────────────────────────────────────────
  function renderResult(result, ticketData) {
    if (!result) {
      showView("error");
      el.errMsg.textContent = "Respuesta vacía del servidor.";
      return;
    }

    // Populate text panels
    el.clientText.textContent = result.clientReply || "Sin respuesta generada.";
    el.internalText.textContent =
      result.internalMessage || "Sin mensaje interno generado.";
    el.summaryText.textContent = result.summary || "Sin resumen generado.";

    // Ticket bar
    if (ticketData?.ticketId && ticketData.ticketId !== "UNKNOWN") {
      el.tid.textContent = `#${ticketData.ticketId}`;
    }
    const subject = ticketData?.subject || "Ticket analizado";
    el.tsub.textContent =
      subject.length > 48 ? subject.slice(0, 45) + "…" : subject;

    // Category badge
    const catMap = {
      despacho: "Despacho",
      produccion: "Producción",
      muestras: "Muestras",
      informacion: "Información",
    };
    const catClass = {
      despacho: "cat-despacho",
      produccion: "cat-produccion",
      muestras: "cat-muestras",
      informacion: "cat-informacion",
    };
    if (result.category && catMap[result.category]) {
      el.cat.textContent = catMap[result.category];
      el.cat.className = `cat-badge ${catClass[result.category]}`;
    } else {
      el.cat.classList.add("hidden");
    }

    // shouldReply warning
    el.warnBar.classList.toggle("hidden", result.shouldReply !== false);

    renderRiskAlert(result.riskAlert);

    renderOCs(ticketData?.ocNumbers || []);

    // Confidence
    renderConfidence(result.confidence ?? 0);

    // Data grid
    if (ticketData) renderDataGrid(ticketData);

    showView("results");
    switchTab("client");

    // Reset custom prompt section for fresh analysis
    if (el.cpInput) el.cpInput.value = "";
    if (el.cpResultCard) el.cpResultCard.classList.add("hidden");
    if (el.cpResponse) el.cpResponse.textContent = "—";
    clearCpAttachment();
  }

  function renderConfidence(value) {
    const pct = Math.min(100, Math.max(0, Number(value) || 0));
    el.confFill.style.width = `${pct}%`;
    el.confVal.textContent = `${pct}%`;
    el.confFill.classList.remove("conf-low", "conf-mid", "conf-high");
    if (pct < 40) el.confFill.classList.add("conf-low");
    else if (pct < 70) el.confFill.classList.add("conf-mid");
    else el.confFill.classList.add("conf-high");
  }

  function renderDataGrid(td) {
    const fields = [
      { k: "ID Ticket", v: td.ticketId },
      { k: "Cliente", v: td.customerName },
      { k: "Email", v: td.customerEmail },
      { k: "Estado", v: td.status },
      { k: "Prioridad", v: td.priority },
      { k: "Creado", v: td.createdAt },
    ].filter(
      (f) => f.v && !["No detectado", "No detectada", "UNKNOWN"].includes(f.v),
    );

    el.dataGrid.innerHTML = fields
      .map(
        (f) => `
      <div class="dg-item">
        <span class="dg-key">${f.k}</span>
        <span class="dg-val" title="${esc(f.v)}">${esc(f.v)}</span>
      </div>`,
      )
      .join("");
  }

  function renderOCs(ocNumbers) {
    if (!el.ocBar || !el.ocList) return;
    const hasOcs = ocNumbers.length > 0;
    el.ocBar.classList.remove("hidden");
    if (el.btnCopyOcs) el.btnCopyOcs.disabled = !hasOcs;
    if (!hasOcs) {
      el.ocList.innerHTML =
        '<span class="oc-empty">No se detectaron OCs</span>';
      return;
    }

    el.ocList.innerHTML = ocNumbers
      .map(
        (oc) =>
          `<div class="oc-chip-wrapper" style="display:inline-flex; align-items:center; background:var(--bg-b); border:1px solid var(--border-a); border-radius:8px; margin:2px; overflow:hidden;">
            <button class="oc-chip" type="button" data-oc="${esc(oc)}" style="border:none; background:transparent; padding:4px 8px; cursor:pointer; color:var(--text-a); font-size:11px;">${esc(oc)}</button>
            <button class="oc-search-mp" type="button" data-oc="${esc(oc)}" title="Buscar en Mercado Público" style="border:none; border-left:1px solid var(--border-a); background:rgba(255,255,255,0.05); padding:4px 6px; cursor:pointer; color:var(--accent); font-size:10px;">🔍</button>
          </div>`,
      )
      .join("");

    el.ocList.querySelectorAll(".oc-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        copyText(chip.dataset.oc || "").then(() => showToast("✓ OC copiada"));
      });
    });

    el.ocList.querySelectorAll(".oc-search-mp").forEach((btn) => {
      btn.addEventListener("click", () => {
        notifyContent({ type: "SEARCH_OC_MP", data: { oc: btn.dataset.oc } });
      });
    });
  }

  function renderRiskAlert(riskAlert) {
    if (!el.riskBar || !el.riskTitle || !el.riskReasons) return;

    if (!riskAlert?.title) {
      el.riskBar.classList.add("hidden");
      el.riskReasons.innerHTML = "";
      return;
    }

    el.riskBar.classList.remove("hidden");
    el.riskTitle.textContent = riskAlert.title;
    el.riskReasons.innerHTML = (riskAlert.reasons || [])
      .map((reason) => `<span class="risk-chip">${esc(reason)}</span>`)
      .join("");
  }

  // ─── CUSTOM PROMPT ─────────────────────────────────────────────────────────
  function loadAnalysisContexts() {
    chrome.storage.local.get(
      ["analysisClientContext", "analysisInternalContext"],
      (result) => {
        if (chrome.runtime.lastError) return;
        if (el.clientContextInput) {
          el.clientContextInput.value = String(result.analysisClientContext || "");
        }
        if (el.internalContextInput) {
          el.internalContextInput.value = String(result.analysisInternalContext || "");
        }
      },
    );
  }

  function scheduleSaveAnalysisContexts() {
    clearTimeout(analysisContextSaveTimer);
    analysisContextSaveTimer = setTimeout(() => {
      chrome.storage.local.set({
        analysisClientContext: el.clientContextInput?.value?.trim() || "",
        analysisInternalContext: el.internalContextInput?.value?.trim() || "",
      });
    }, 250);
  }

  function getAnalysisContexts() {
    return {
      client: el.clientContextInput?.value?.trim() || "",
      internal: el.internalContextInput?.value?.trim() || "",
    };
  }

  function loadCustomPromptContext() {
    chrome.storage.local.get(["customPromptContext"], (result) => {
      if (chrome.runtime.lastError) return;
      if (el.cpContextInput) {
        el.cpContextInput.value = String(result.customPromptContext || "");
      }
    });
  }

  function scheduleSaveCustomPromptContext() {
    clearTimeout(cpContextSaveTimer);
    cpContextSaveTimer = setTimeout(() => {
      const customPromptContext = el.cpContextInput?.value?.trim() || "";
      chrome.storage.local.set({ customPromptContext });
    }, 250);
  }

  function getCustomPromptContext() {
    return el.cpContextInput?.value?.trim() || "";
  }

  function runCustomPrompt() {
    const userPrompt = el.cpInput.value.trim();
    if (!userPrompt) {
      showToast("⚠ Escribe un prompt primero");
      return;
    }
    if (!currentTicket && !currentResult && !cpAttachment) {
      showToast("⚠ Analiza el ticket primero");
      return;
    }

    // Set loading state
    el.btnCpRun.disabled = true;
    el.btnCpRun.querySelector(".cp-run-label").textContent = "Analizando…";
    el.btnCpRun.classList.add("cp-loading");

    chrome.runtime.sendMessage(
      {
        type: "CUSTOM_PROMPT_ANALYZE",
        data: {
          ticketData: currentTicket,
          currentResult,
          userPrompt,
          persistentContext: getCustomPromptContext(),
          attachment: cpAttachment,
        },
      },
      (response) => {
        el.btnCpRun.disabled = false;
        el.btnCpRun.querySelector(".cp-run-label").textContent =
          "Generar respuesta";
        el.btnCpRun.classList.remove("cp-loading");

        if (chrome.runtime.lastError || response?.error) {
          showToast(
            `✗ ${response?.error || chrome.runtime.lastError?.message || "Error desconocido"}`,
          );
          return;
        }

        el.cpResponse.textContent = response.reply || "Sin respuesta generada.";
        el.cpResultCard.classList.remove("hidden");
        el.cpResultCard.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      },
    );
  }

  // ─── ANTI-MUESTRAS ───────────────────────────────────────────────────────
  const ANTI_SAMPLE_PROMPT =
    "Redacta una respuesta cordial: saluda por nombre y agradece la información. " +
    "Explica que momentáneamente NO estamos fabricando muestras individuales hasta nuevo aviso, " +
    "por lo que no podemos comprometer plazos de entrega para muestras. " +
    "Aclara que solo se despachan si hay stock físico disponible; de lo contrario, avisaremos cualquier novedad. " +
    "Mantén disposición a ayudar pero sé firme en no dar fechas. Firma: Equipo EMChile.";

  function runAntiSample() {
    if (!currentTicket && !currentResult) {
      showToast("⚠ Analiza el ticket primero");
      return;
    }

    const btn = el.btnAntiSample;
    if (btn) {
      btn.disabled = true;
      btn.querySelector(".cp-run-label").textContent = "Generando…";
      btn.classList.add("cp-loading");
    }

    chrome.runtime.sendMessage(
      {
        type: "CUSTOM_PROMPT_ANALYZE",
        data: {
          ticketData: currentTicket,
          currentResult,
          userPrompt: ANTI_SAMPLE_PROMPT,
          persistentContext: getCustomPromptContext(),
          attachment: null,
        },
      },
      (response) => {
        if (btn) {
          btn.disabled = false;
          btn.querySelector(".cp-run-label").textContent =
            "Generar anti-muestras";
          btn.classList.remove("cp-loading");
        }

        if (chrome.runtime.lastError || response?.error) {
          showToast(
            `✗ ${response?.error || chrome.runtime.lastError?.message || "Error desconocido"}`,
          );
          return;
        }

        el.cpResponse.textContent = response.reply || "Sin respuesta generada.";
        el.cpResultCard.classList.remove("hidden");
        el.cpResultCard.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      },
    );
  }

  // ─── ATTACHMENT HANDLING ───────────────────────────────────────────────────
  function handleCpPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        readFileAsBase64(blob).then((base64) => {
          cpAttachment = {
            type: "image",
            base64,
            mimeType: item.type,
            name: "imagen_pegada.png",
          };
          showCpPreview("🖼", "Imagen pegada del portapapeles");
          showToast("✓ Imagen capturada del portapapeles");
        });
        return;
      }
    }
  }

  function handleCpFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      showToast("⚠ Solo se aceptan imágenes o PDFs");
      return;
    }
    readFileAsBase64(file).then((base64) => {
      cpAttachment = {
        type: isImage ? "image" : "pdf",
        base64,
        mimeType: file.type,
        name: file.name,
      };
      showCpPreview(isImage ? "🖼" : "📄", file.name);
      showToast("✓ Archivo adjuntado");
    });
    e.target.value = ""; // allow re-selecting same file
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function showCpPreview(icon, name) {
    if (!el.cpPreview) return;
    el.cpAttachIcon.textContent = icon;
    el.cpAttachName.textContent = name;
    el.cpPreview.classList.remove("hidden");
  }

  function clearCpAttachment() {
    cpAttachment = null;
    if (!el.cpPreview) return;
    el.cpPreview.classList.add("hidden");
    el.cpAttachIcon.textContent = "🖼";
    el.cpAttachName.textContent = "";
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ─── TABS ──────────────────────────────────────────────────────────────────
  function switchTab(name) {
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.toggle("active", p.id === `panel-${name}`));
  }

  // ─── COPY ──────────────────────────────────────────────────────────────────
  function copyField(btn) {
    const key = btn.dataset.key;
    const text = currentResult?.[key] || "";
    if (!text) return;

    copyText(text).then(() => {
      animateCopy(btn);
    });
  }

  function copyOCs() {
    const ocs = currentTicket?.ocNumbers || [];
    if (!ocs.length) return;
    copyText(ocs.join("\n")).then(() => {
      if (el.btnCopyOcs) animateCopy(el.btnCopyOcs);
      showToast("✓ OCs copiadas");
    });
  }

  // ─── AUTO-FILL FIELDS ──────────────────────────────────────────────────────
  function runAutoFill() {
    const ocs = currentTicket?.ocNumbers || [];

    // Determine priority from analysis
    let priority = "Medium";
    if (currentResult?.riskAlert?.title) {
      priority = "High";
    } else if ((currentResult?.confidence ?? 0) >= 70) {
      priority = "Medium";
    } else {
      priority = "Low";
    }
    // Override if ticket already has an explicit priority
    const existingPrio = currentTicket?.priority;
    if (
      existingPrio &&
      !["No detectada", "No detectado", "—"].includes(existingPrio)
    ) {
      priority = existingPrio;
    }

    if (!ocs.length) {
      showToast("⚠ No se detectaron OCs en el ticket");
      return;
    }

    if (el.btnAutoFill) {
      el.btnAutoFill.disabled = true;
      el.btnAutoFill.textContent = "Completando…";
    }

    // Safety timeout — unlock button if content.js never responds
    const safetyTimer = setTimeout(() => {
      if (el.btnAutoFill) {
        el.btnAutoFill.disabled = false;
        el.btnAutoFill.textContent = "⚡ AUTO-COMPLETAR-OC";
      }
      showToast("⚠ No se encontraron campos para completar en esta página");
    }, 10000);

    // Store so AUTO_FILL_RESULT can cancel it
    el.btnAutoFill._safetyTimer = safetyTimer;

    notifyContent({
      type: "AUTO_FILL_FIELDS",
      data: { ocNumbers: ocs, priority, licitacion: null },
    });
  }

  function copyText(text) {
    if (!text) return Promise.resolve();

    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });

    return Promise.resolve();
  }

  function animateCopy(btn) {
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = "✓ Copiado";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove("copied");
    }, 2200);
  }

  // ─── TICKET CHANGE ─────────────────────────────────────────────────────────
  function onTicketChanged(id) {
    if (!id) return;
    el.tid.textContent = `#${id}`;
    el.tsub.textContent = "Ticket detectado — listo para analizar";
    el.cat.classList.add("hidden");
    if (activeView !== "loading") showView("idle");
  }

  // ─── HISTORY ───────────────────────────────────────────────────────────────
  function loadHistory() {
    chrome.runtime.sendMessage({ type: "GET_HISTORY" }, ({ history = [] }) => {
      if (!history.length) {
        el.histList.innerHTML =
          '<div class="hist-empty">Sin historial de análisis.<br>Los análisis se guardarán aquí automáticamente.</div>';
        return;
      }
      el.histList.innerHTML = history
        .map(
          (item) => `
        <div class="hist-item" data-hid="${item.id}">
          <div class="hist-id">#${item.ticketId || "—"}</div>
          <div class="hist-subject">${esc(item.subject || "Sin asunto")}</div>
          <div class="hist-time">${formatDate(item.timestamp)}</div>
        </div>`,
        )
        .join("");

      el.histList.querySelectorAll(".hist-item").forEach((node) => {
        node.addEventListener("click", () => {
          const id = Number(node.dataset.hid);
          const entry = history.find((h) => h.id === id);
          if (entry) {
            currentResult = entry.result;
            renderResult(entry.result, {
              ticketId: entry.ticketId,
              subject: entry.subject,
            });
          }
        });
      });
    });
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso || "—";
    }
  }

  // ─── SETTINGS ──────────────────────────────────────────────────────────────
  function applyProviderUI(provider, savedModel) {
    var ui = PROVIDER_UI[provider] || PROVIDER_UI.openai;
    if (el.apikeyLabel) el.apikeyLabel.textContent = ui.label;
    if (el.apiKeyInput) el.apiKeyInput.placeholder = ui.placeholder;

    var models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
    if (el.modelSelect) {
      el.modelSelect.innerHTML = models
        .map((m) => `<option value="${m.value}">${m.label}</option>`)
        .join("");
      if (savedModel) el.modelSelect.value = savedModel;
      if (!el.modelSelect.value) el.modelSelect.value = models[0].value;
    }
  }

  function loadSettings() {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
      settings = settings || {};
      if (chrome.runtime.lastError) {
        showToast("✗ Error cargando configuración");
        return;
      }

      var provider = settings.aiProvider || "openai";
      if (el.providerSelect) el.providerSelect.value = provider;

      // Load provider-specific key (fall back to legacy apiKey)
      var storageKey = PROVIDER_STORAGE_KEY[provider] || "apiKey";
      var key = settings[storageKey] || settings.apiKey || "";
      if (key) el.apiKeyInput.value = key;

      applyProviderUI(provider, settings.model);

      if (settings.customPrompt) el.customPrompt.value = settings.customPrompt;
      el.useCustom.checked = !!settings.useCustomPrompt;
      el.customWrap.classList.toggle("hidden", !settings.useCustomPrompt);
    });
  }

  function saveSettings() {
    var provider = el.providerSelect ? el.providerSelect.value : "openai";
    var key = el.apiKeyInput.value.trim();

    if (!key) {
      showToast("⚠ Ingresa tu API Key");
      return;
    }
    if (provider === "openai" && !key.startsWith("sk-")) {
      showToast('⚠ La API Key de OpenAI debe comenzar con "sk-"');
      return;
    }
    if (provider === "claude" && !key.startsWith("sk-ant-")) {
      showToast('⚠ La API Key de Claude debe comenzar con "sk-ant-"');
      return;
    }
    if (provider === "gemini" && !key.startsWith("AIza")) {
      showToast('⚠ La API Key de Gemini debe comenzar con "AIza"');
      return;
    }
    if (provider === "cerebras" && !key.startsWith("csk-")) {
      showToast('⚠ La API Key de Cerebras debe comenzar con "csk-"');
      return;
    }

    var providerStorageKey = PROVIDER_STORAGE_KEY[provider];
    var data = {
      aiProvider:      provider,
      apiKey:          key,
      model:           el.modelSelect.value,
      customPrompt:    el.customPrompt.value.trim(),
      useCustomPrompt: el.useCustom.checked,
    };
    data[providerStorageKey] = key;

    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", data }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("✗ Error al guardar configuración");
        return;
      }
      if (!response || !response.success) {
        showToast(`✗ ${response?.error || "No se pudo guardar"}`);
        return;
      }
      showToast("✓ Configuración guardada");
      setTimeout(() => showView(previousView || "idle"), 800);
    });
  }

  // ─── TOAST ─────────────────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2600);
  }

  // ─── TABLA OC MODULE ───────────────────────────────────────────────────────
  var MP_ESTADO_OC = [
    { value: "pendiente",            label: "Pendiente" },
    { value: "aceptada",             label: "Aceptada" },
    { value: "recepcion_conforme",   label: "Recepción Conforme" },
    { value: "cancelada",            label: "Cancelada" },
    { value: "solicita_cancelacion", label: "Solicita cancelación" },
    { value: "rechazada",            label: "Rechazada" },
    { value: "sin_info",             label: "Sin info" },
  ];

  var TICKET_ESTADO_OC = [
    { value: "sin_ticket", label: "Sin ticket" },
    { value: "aceptado", label: "Aceptado" },
    { value: "consulta_despacho", label: "Consulta despacho" },
    { value: "reclamo_documento", label: "Reclamo documento" },
    { value: "reclamo_pedido", label: "Reclamo pedido" },
    { value: "reclamo_rotulado", label: "Reclamo rotulado" },
    { value: "consulta", label: "Consulta" },
    { value: "rechazada", label: "Rechazada" },
    { value: "pide_nc", label: "Pide NC" },
    { value: "solicita_cancelar", label: "Solicita cancelar" },
    { value: "cancelada", label: "Cancelada" },
    { value: "multa_amenaza", label: "Multa / amenaza" },
    { value: "esperamos_respuesta", label: "Esperamos respuesta" },
    { value: "cliente_espera_respuesta", label: "Cliente espera respuesta" }
  ];

  var TABLA_DEFAULTS = {
    estado_oc:       "sin_ticket",
    mp:              "sin_info",
    ultima_comunicacion: "ninguna",
    resolucion:      "sin_acciones",
    ultimo_correo:   "",
    observaciones:   "",
    monto:           "",
  };

  let ocRows = []; // Array<{ oc, estado_oc, mp, ticket_desk, cancelacion, cliente_escribio, ultimo_correo, observaciones }>
  let visibleCols = [true, true, true, true, true, true, true, true];

  function loadTabla() {
    chrome.storage.local.get(["ocTracking", "ocTableName", "visibleCols"], (res) => {
      if (chrome.runtime.lastError) return;
      ocRows = res.ocTracking || [];
      if (res.visibleCols) visibleCols = res.visibleCols;
      if (el.tblName) {
        el.tblName.value = res.ocTableName || "Tabla_OCs";
      }
      // Migrar datos antiguos al nuevo nombre de estado
      ocRows.forEach(row => {
        if (row.estado_oc === "pide_cancelacion") row.estado_oc = "solicita_cancelacion";
        if (row.mp === "no" || row.mp === "si") row.mp = "sin_info";
        
        // Migrar estado_oc a TICKET_ESTADO_OC
        if (row.estado_oc === "aceptada") row.estado_oc = "aceptado";
        if (row.estado_oc === "pendiente") row.estado_oc = "esperamos_respuesta";
        if (row.estado_oc === "recepcion_conforme") row.estado_oc = "aceptado";
        if (row.estado_oc === "solicita_cancelacion") row.estado_oc = "pide_nc";
        if (row.estado_oc === "sin_info") row.estado_oc = "sin_ticket";

        if (!TICKET_ESTADO_OC.some(e => e.value === row.estado_oc)) {
           row.estado_oc = "sin_ticket";
        }

        // Migrar cliente_escribio a ultima_comunicacion
        if (row.cliente_escribio !== undefined) {
           if (row.cliente_escribio === "si") row.ultima_comunicacion = "de_ellos";
           else row.ultima_comunicacion = "ninguna";
           delete row.cliente_escribio;
        }
        if (!row.ultima_comunicacion) row.ultima_comunicacion = "ninguna";
        if (!row.resolucion) row.resolucion = "sin_acciones";
      });
      renderTabla();
    });
  }

  function saveTabla() {
    chrome.storage.local.set({ ocTracking: ocRows });
  }

  function handleTblAdd() {
    if (!el.tblInput) return;
    var raw = el.tblInput.value.trim();
    if (!raw) { showToast("⚠ Pega al menos una OC"); return; }
    // Split by comma, semicolon, or whitespace
    var tokens = raw.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    var added = 0;
    tokens.forEach(oc => {
      var norm = oc.toUpperCase();
      if (!ocRows.find(r => r.oc === norm)) {
        ocRows.unshift(Object.assign({ 
          oc: norm, 
          ...TABLA_DEFAULTS,
          ultimo_correo: window.currentLatestEmailDate || ""
        }));
        added++;
      }
    });
    el.tblInput.value = "";
    saveTabla();
    renderTabla();
    if (added > 0) showToast(`✓ ${added} OC${added > 1 ? "s" : ""} agregada${added > 1 ? "s" : ""}`);
    else showToast("⚠ Todas esas OCs ya estaban en la tabla");
  }

  function renderTabla() {
    if (!el.tblBody || !el.tblCount || !el.tblEmpty) return;
    el.tblCount.textContent = `${ocRows.length} OC${ocRows.length !== 1 ? "s" : ""}`;

    if (!ocRows.length) {
      el.tblBody.innerHTML = "";
      el.tblEmpty.classList.remove("hidden");
      return;
    }
    el.tblEmpty.classList.add("hidden");

    el.tblBody.innerHTML = ocRows.map((row, idx) => buildRow(row, idx)).join("");

    // Bind change events
    el.tblBody.querySelectorAll("[data-field]").forEach(input => {
      input.addEventListener("change", () => {
        var idx = Number(input.closest("tr").dataset.idx);
        var field = input.dataset.field;
        ocRows[idx][field] = input.value;
        if (field === "estado_oc" || field === "mp") applyEstadoClass(input, input.value);
        saveTabla();
      });
      input.addEventListener("input", () => {
        var idx = Number(input.closest("tr").dataset.idx);
        var field = input.dataset.field;
        ocRows[idx][field] = input.value;
        saveTabla();
      });
    });

    // Bind OC click to search in Mercado Publico or Zoho
    el.tblBody.querySelectorAll(".tbl-oc-clickable").forEach(cell => {
      cell.title = "Buscar esta OC en Zoho Desk";
      cell.addEventListener("click", () => {
        var idx = Number(cell.closest("tr").dataset.idx);
        var oc = ocRows[idx].oc;
        notifyContent({ type: "SEARCH_OC_GLOBAL", data: { oc } });
      });
    });

    // Bind MP search button
    el.tblBody.querySelectorAll(".js-search-mp").forEach(btn => {
      btn.addEventListener("click", () => {
        var idx = Number(btn.closest("tr").dataset.idx);
        var oc = ocRows[idx].oc;
        notifyContent({ type: "SEARCH_OC_MP", data: { oc } });
      });
    });

    // Bind row date extraction
    el.tblBody.querySelectorAll(".js-row-date").forEach(btn => {
      btn.addEventListener("click", (e) => {
        var idx = Number(btn.closest("tr").dataset.idx);
        notifyContent({ type: "REQUEST_LATEST_DATE", data: { rowIdx: idx } });
      });
    });

    // Bind delete buttons
    el.tblBody.querySelectorAll(".btn-tbl-del").forEach(btn => {
      btn.addEventListener("click", () => {
        var idx = Number(btn.closest("tr").dataset.idx);
        ocRows.splice(idx, 1);
        saveTabla();
        renderTabla();
      });
    });

    applyColVisibility();
  }

  function applyColVisibility() {
    let thead = document.querySelector("#js-oc-table thead");
    if (thead) {
      thead.querySelectorAll("th.tbl-th[data-col]").forEach(th => {
        let colIdx = parseInt(th.dataset.col);
        if (visibleCols[colIdx]) {
          th.classList.remove("excluded-col");
        } else {
          th.classList.add("excluded-col");
        }
        let checkbox = th.querySelector(".col-checker");
        if (checkbox) checkbox.checked = visibleCols[colIdx];
      });
    }

    // Asegurarse de que ninguna celda tenga la clase hidden-col si quedó pegada antes
    el.tblBody.querySelectorAll("tr").forEach(tr => {
      tr.querySelectorAll("td.hidden-col").forEach(td => td.classList.remove("hidden-col"));
    });
  }

  function buildRow(row, idx) {
    var estadoOpts = TICKET_ESTADO_OC.map(o =>
      `<option value="${o.value}"${row.estado_oc === o.value ? " selected" : ""}>${o.label}</option>`
    ).join("");

    var mpOpts = MP_ESTADO_OC.map(o =>
      `<option value="${o.value}"${row.mp === o.value ? " selected" : ""}>${o.label}</option>`
    ).join("");

    var comOpts = ["ninguna", "de_nosotros", "de_ellos"].map(v => {
      let lbl = v === "ninguna" ? "Ninguna" : (v === "de_nosotros" ? "De nosotros" : "De ellos");
      return `<option value="${v}"${row.ultima_comunicacion === v ? " selected" : ""}>${lbl}</option>`;
    }).join("");

    var resOptsArray = [
      { v: "sin_acciones", l: "Sin acciones" },
      { v: "hay_respuesta", l: "Hay respuesta" },
      { v: "reenvio_hoy", l: "Re envio HOY" },
      { v: "reenvio_pasado", l: "Re enviado EN EL PASADO" },
      { v: "esperamos_respuesta", l: "Esperamos respuesta" },
      { v: "sin_respuesta", l: "Sin respuesta" }
    ];
    var resOpts = resOptsArray.map(o => 
      `<option value="${o.v}"${row.resolucion === o.v ? " selected" : ""}>${o.l}</option>`
    ).join("");

    var estadoClass = `estado-${row.estado_oc || "sin_ticket"}`;
    var mpClass = `estado-${row.mp || "sin_info"}`;
    var comClass = `com-${row.ultima_comunicacion || "ninguna"}`;
    var resClass = `res-${row.resolucion || "sin_acciones"}`;

    return `<tr class="tbl-tr" data-idx="${idx}">
      <td class="tbl-td tbl-oc-cell">
        <div style="display:flex; align-items:center; gap:4px;">
          <div class="tbl-oc-clickable" style="flex:1;">${esc(row.oc)}</div>
          <button class="btn-ghost-sm js-search-mp" title="Buscar en Mercado Público" style="padding:2px; font-size:10px;">🔍MP</button>
        </div>
        <button class="btn-ghost-sm js-row-date" style="font-size:8px; padding:2px 4px; margin-top:4px; opacity:0.8; width:100%; border:1px dashed var(--border-a);" title="Extraer fecha del último correo">📅 Extraer Fecha</button>
      </td>
      <td class="tbl-td">
        <select class="tbl-select ${estadoClass}" data-field="estado_oc">${estadoOpts}</select>
      </td>
      <td class="tbl-td">
        <select class="tbl-select ${mpClass}" data-field="mp">${mpOpts}</select>
      </td>
      <td class="tbl-td">
        <select class="tbl-select ${comClass}" data-field="ultima_comunicacion">${comOpts}</select>
      </td>
      <td class="tbl-td">
        <select class="tbl-select ${resClass}" data-field="resolucion">${resOpts}</select>
      </td>
      <td class="tbl-td">
        <input class="tbl-date" type="date" data-field="ultimo_correo" value="${esc(row.ultimo_correo || "")}" />
      </td>
      <td class="tbl-td">
        <input class="tbl-text" type="text" data-field="observaciones" value="${esc(row.observaciones || "")}" placeholder="Comentario…" />
      </td>
      <td class="tbl-td">
        <input class="tbl-text" style="width: 70px; text-align: right;" type="text" data-field="monto" value="${esc(row.monto || "")}" placeholder="$0" />
      </td>
      <td class="tbl-td">
        <button class="btn-tbl-del" title="Eliminar fila">✕</button>
      </td>
    </tr>`;
  }

  function applyEstadoClass(sel, val) {
    sel.className = sel.className.replace(/\bestado-\S+/g, "").trim();
    sel.classList.add(`estado-${val || "pendiente"}`);
  }

  async function copyTablaText() {
    if (!ocRows.length) {
      showToast("⚠ Tabla vacía");
      return;
    }

    let resLabels = {
      "sin_acciones": "Sin acciones", "hay_respuesta": "Hay respuesta",
      "reenvio_hoy": "Re envio HOY", "reenvio_pasado": "Re enviado EN EL PASADO",
      "esperamos_respuesta": "Esperamos respuesta", "sin_respuesta": "Sin respuesta"
    };

    const getColors = (field, val) => {
      let bg = "#f3f4f6", text = "#374151";
      if (field === "estado_oc") {
        if (val === "aceptado") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "consulta_despacho") { bg = "#3b82f6"; text = "#ffffff"; }
        if (val === "reclamo_documento") { bg = "#f97316"; text = "#ffffff"; }
        if (val === "reclamo_pedido") { bg = "#ef4444"; text = "#ffffff"; }
        if (val === "reclamo_rotulado") { bg = "#ea580c"; text = "#ffffff"; }
        if (val === "consulta") { bg = "#0ea5e9"; text = "#ffffff"; }
        if (val === "rechazada") { bg = "#ff4757"; text = "#ffffff"; }
        if (val === "pide_nc") { bg = "#eab308"; text = "#000000"; }
        if (val === "solicita_cancelar") { bg = "#f59e0b"; text = "#ffffff"; }
        if (val === "cancelada") { bg = "#dc2626"; text = "#ffffff"; }
        if (val === "multa_amenaza") { bg = "#b91c1c"; text = "#ffffff"; }
        if (val === "esperamos_respuesta") { bg = "#8b5cf6"; text = "#ffffff"; }
        if (val === "cliente_espera_respuesta") { bg = "#d946ef"; text = "#ffffff"; }
      }
      if (field === "mp") {
        if (val === "aceptada") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "recepcion_conforme") { bg = "#00d4ff"; text = "#000000"; }
        if (val === "solicita_cancelacion") { bg = "#fbbf24"; text = "#000000"; }
      }
      if (field === "com") {
        if (val === "de_nosotros") { bg = "#3b82f6"; text = "#ffffff"; }
        if (val === "de_ellos") { bg = "#f97316"; text = "#ffffff"; }
      }
      if (field === "res") {
        if (val === "hay_respuesta") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "reenvio_hoy") { bg = "#0ea5e9"; text = "#ffffff"; }
        if (val === "reenvio_pasado") { bg = "#8b5cf6"; text = "#ffffff"; }
        if (val === "esperamos_respuesta") { bg = "#eab308"; text = "#000000"; }
        if (val === "sin_respuesta") { bg = "#ff4757"; text = "#ffffff"; }
      }
      return { bg, text };
    };

    let thsHtml = [
      "OC", "Ticket OC", "MP", "Última com.", "Resolución", "Último correo", "Observaciones", "Monto"
    ].filter((_, i) => visibleCols[i])
     .map(name => `<th style="border:1px solid #ccc; padding:6px; background:#e5e7eb;">${name}</th>`)
     .join("");

    let html = `<table style="border-collapse: collapse; font-family: sans-serif; font-size: 12px;">`;
    html += `<tr>${thsHtml}</tr>`;

    let waText = ""; // WhatsApp-friendly text
    let tsv = [
      "OC", "Ticket OC", "MP", "Última comunicación", "Resolución", "Último correo", "Observaciones", "Monto"
    ].filter((_, i) => visibleCols[i]).join("\t") + "\n";

    ocRows.forEach(row => {
      let estado = TICKET_ESTADO_OC.find(e => e.value === row.estado_oc)?.label || row.estado_oc;
      let mpState = MP_ESTADO_OC.find(e => e.value === row.mp)?.label || row.mp;
      let comStr = row.ultima_comunicacion === "de_nosotros" ? "De nosotros" : (row.ultima_comunicacion === "de_ellos" ? "De ellos" : "Ninguna");
      let resStr = resLabels[row.resolucion] || "Sin acciones";

      let cEst = getColors("estado_oc", row.estado_oc);
      let cMp = getColors("mp", row.mp);
      let cCom = getColors("com", row.ultima_comunicacion);
      let cRes = getColors("res", row.resolucion);

      let cells = [
        { text: row.oc || "" },
        { text: estado, bg: cEst.bg, color: cEst.text, bold: true },
        { text: mpState, bg: cMp.bg, color: cMp.text, bold: true },
        { text: comStr, bg: cCom.bg, color: cCom.text, bold: true },
        { text: resStr, bg: cRes.bg, color: cRes.text, bold: true },
        { text: row.ultimo_correo || "" },
        { text: row.observaciones || "" },
        { text: row.monto || "" }
      ];

      html += `<tr>` + cells.filter((_, i) => visibleCols[i]).map(c => {
        let style = "border:1px solid #ccc; padding:6px;";
        if (c.bg) style += ` background-color:${c.bg};`;
        if (c.color) style += ` color:${c.color};`;
        if (c.bold) style += ` font-weight:bold;`;
        return `<td style="${style}">${c.text}</td>`;
      }).join("") + `</tr>`;

      let labels = [
        "OC", "Ticket OC", "MP", "Última com.", "Resolución", "Último correo", "Observaciones", "Monto"
      ];
      let rowWa = [];
      let rowTsv = [];

      let rawCells = [
        row.oc || "", estado, mpState, comStr, resStr, row.ultimo_correo || "",
        row.observaciones || "", row.monto || ""
      ];

      rawCells.forEach((val, i) => {
        if (visibleCols[i]) {
          rowWa.push(`*${labels[i]}:* ${val || "—"}`);
          rowTsv.push(String(val || "").replace(/\n/g, " "));
        }
      });

      waText += rowWa.join("\n") + "\n\n";
      tsv += rowTsv.join("\t") + "\n";
    });

    html += `</table>`;

    try {
      const clipboardItem = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([waText.trim()], { type: "text/plain" })
      });
      await navigator.clipboard.write([clipboardItem]);
      if (el.btnTblCopy) animateCopy(el.btnTblCopy);
      showToast("✓ Tabla copiada con colores (pégala en Sheets)");
    } catch (e) {
      // Fallback
      copyText(waText.trim()).then(() => {
        if (el.btnTblCopy) animateCopy(el.btnTblCopy);
        showToast("✓ Copiado para WhatsApp");
      });
    }
  }

  function exportTablaCsv(separator) {
    if (!ocRows.length) {
      showToast("⚠ Tabla vacía");
      return;
    }

    let resLabels = {
      "sin_acciones": "Sin acciones", "hay_respuesta": "Hay respuesta",
      "reenvio_hoy": "Re envio HOY", "reenvio_pasado": "Re enviado EN EL PASADO",
      "esperamos_respuesta": "Esperamos respuesta", "sin_respuesta": "Sin respuesta"
    };

    const getColors = (field, val) => {
      let bg = "#f3f4f6", text = "#374151";
      if (field === "estado_oc") {
        if (val === "aceptado") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "consulta_despacho") { bg = "#3b82f6"; text = "#ffffff"; }
        if (val === "reclamo_documento") { bg = "#f97316"; text = "#ffffff"; }
        if (val === "reclamo_pedido") { bg = "#ef4444"; text = "#ffffff"; }
        if (val === "reclamo_rotulado") { bg = "#ea580c"; text = "#ffffff"; }
        if (val === "consulta") { bg = "#0ea5e9"; text = "#ffffff"; }
        if (val === "rechazada") { bg = "#ff4757"; text = "#ffffff"; }
        if (val === "pide_nc") { bg = "#eab308"; text = "#000000"; }
        if (val === "solicita_cancelar") { bg = "#f59e0b"; text = "#ffffff"; }
        if (val === "cancelada") { bg = "#dc2626"; text = "#ffffff"; }
        if (val === "multa_amenaza") { bg = "#b91c1c"; text = "#ffffff"; }
        if (val === "esperamos_respuesta") { bg = "#8b5cf6"; text = "#ffffff"; }
        if (val === "cliente_espera_respuesta") { bg = "#d946ef"; text = "#ffffff"; }
      }
      if (field === "mp") {
        if (val === "aceptada") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "recepcion_conforme") { bg = "#00d4ff"; text = "#000000"; }
        if (val === "solicita_cancelacion") { bg = "#fbbf24"; text = "#000000"; }
      }
      if (field === "com") {
        if (val === "de_nosotros") { bg = "#3b82f6"; text = "#ffffff"; }
        if (val === "de_ellos") { bg = "#f97316"; text = "#ffffff"; }
      }
      if (field === "res") {
        if (val === "hay_respuesta") { bg = "#06ffa5"; text = "#000000"; }
        if (val === "reenvio_hoy") { bg = "#0ea5e9"; text = "#ffffff"; }
        if (val === "reenvio_pasado") { bg = "#8b5cf6"; text = "#ffffff"; }
        if (val === "esperamos_respuesta") { bg = "#eab308"; text = "#000000"; }
        if (val === "sin_respuesta") { bg = "#ff4757"; text = "#ffffff"; }
      }
      return { bg, text };
    };

    let thsHtml = [
      "OC", "Ticket OC", "MP", "Última com.", "Resolución", "Último correo", "Observaciones", "Monto"
    ].filter((_, i) => visibleCols[i])
     .map(name => `<th style="background:#e5e7eb;">${name}</th>`)
     .join("");

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
    html += `<head><meta charset="utf-8"></head><body>`;
    html += `<table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 12px;">`;
    html += `<tr>${thsHtml}</tr>`;

    ocRows.forEach(row => {
      let estado = TICKET_ESTADO_OC.find(e => e.value === row.estado_oc)?.label || row.estado_oc;
      let mpState = MP_ESTADO_OC.find(e => e.value === row.mp)?.label || row.mp;
      let comStr = row.ultima_comunicacion === "de_nosotros" ? "De nosotros" : (row.ultima_comunicacion === "de_ellos" ? "De ellos" : "Ninguna");
      let resStr = resLabels[row.resolucion] || "Sin acciones";

      let cEst = getColors("estado_oc", row.estado_oc);
      let cMp = getColors("mp", row.mp);
      let cCom = getColors("com", row.ultima_comunicacion);
      let cRes = getColors("res", row.resolucion);

      let cells = [
        { text: row.oc || "" },
        { text: estado, bg: cEst.bg, color: cEst.text, bold: true },
        { text: mpState, bg: cMp.bg, color: cMp.text, bold: true },
        { text: comStr, bg: cCom.bg, color: cCom.text, bold: true },
        { text: resStr, bg: cRes.bg, color: cRes.text, bold: true },
        { text: row.ultimo_correo || "" },
        { text: row.observaciones || "" },
        { text: row.monto || "" }
      ];

      html += `<tr>` + cells.filter((_, i) => visibleCols[i]).map(c => {
        let style = "";
        if (c.bg) style += ` background-color:${c.bg};`;
        if (c.color) style += ` color:${c.color};`;
        if (c.bold) style += ` font-weight:bold;`;
        return `<td${style ? ` style="${style.trim()}"` : ""}>${c.text}</td>`;
      }).join("") + `</tr>`;
    });

    html += `</table></body></html>`;

    let tableName = el.tblName?.value?.trim() || "Tabla_OCs";
    let dateStr = new Date().toISOString().split("T")[0];
    let suffix = separator === ";" ? "Excel" : "GoogleSheets";
    let filename = `${tableName.replace(/[^a-z0-9_-]/gi, '_')}_${dateStr}_${suffix}.xls`;

    let blob = new Blob([html], { type: "application/vnd.ms-excel" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("✓ Archivo Excel exportado con colores");
  }

  function handleImportFile(e) {
    let file = e.target.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function(evt) {
      let content = evt.target.result;
      let newOcs = [];

      function reverseRes(lbl) {
        let map = {"sin acciones": "sin_acciones", "hay respuesta": "hay_respuesta", "re envio hoy": "reenvio_hoy", "re enviado en el pasado": "reenvio_pasado", "esperamos respuesta": "esperamos_respuesta", "sin respuesta": "sin_respuesta"};
        return map[lbl.toLowerCase().trim()] || "sin_acciones";
      }
      function reverseCom(lbl) {
        let map = {"de nosotros": "de_nosotros", "de ellos": "de_ellos", "ninguna": "ninguna"};
        return map[lbl.toLowerCase().trim()] || "ninguna";
      }

      // Try HTML parser (.xls)
      let parser = new DOMParser();
      let doc = parser.parseFromString(content, "text/html");
      let rows = doc.querySelectorAll("table tr");

      if (rows && rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          let tds = rows[i].querySelectorAll("td");
          if (tds.length < 8) continue;

          let oc = tds[0].innerText.trim();
          if (!oc) continue;

          let estadoLbl = tds[1].innerText.trim();
          let mpLbl = tds[2].innerText.trim();
          let comLbl = tds[3].innerText.trim();
          let resLbl = tds[4].innerText.trim();

          let estado = TICKET_ESTADO_OC.find(e => e.label.toLowerCase() === estadoLbl.toLowerCase())?.value || "sin_ticket";
          let mp = MP_ESTADO_OC.find(e => e.label.toLowerCase() === mpLbl.toLowerCase())?.value || "sin_info";

          newOcs.push({
            oc: oc, estado_oc: estado, mp: mp, ultima_comunicacion: reverseCom(comLbl),
            resolucion: reverseRes(resLbl), ultimo_correo: tds[5].innerText.trim(),
            observaciones: tds[6].innerText.trim(), monto: tds[7].innerText.trim()
          });
        }
      } else {
        // Fallback: Try CSV
        let lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
           let separator = content.indexOf(";") > -1 ? ";" : ",";
           for (let i = 1; i < lines.length; i++) {
             // Basic regex split that handles quotes
             let cols = lines[i].split(new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`));
             if (cols.length >= 8) {
                cols = cols.map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
                let oc = cols[0];
                if (!oc) continue;

                let estado = TICKET_ESTADO_OC.find(e => e.label.toLowerCase() === cols[1].toLowerCase())?.value || "sin_ticket";
                let mp = MP_ESTADO_OC.find(e => e.label.toLowerCase() === cols[2].toLowerCase())?.value || "sin_info";
                
                newOcs.push({
                  oc: oc, estado_oc: estado, mp: mp, ultima_comunicacion: reverseCom(cols[3]),
                  resolucion: reverseRes(cols[4]), ultimo_correo: cols[5],
                  observaciones: cols[6], monto: cols[7]
                });
             }
           }
        }
      }

      if (newOcs.length > 0) {
        if (confirm(`Se encontraron ${newOcs.length} OCs en el archivo.\n¿Deseas reemplazar tu tabla actual con estos datos?`)) {
          ocRows = newOcs;
          saveTabla();
          renderTabla();
          showToast(`✓ Se importaron ${newOcs.length} OCs`);
        }
      } else {
        showToast("⚠ No se pudieron extraer datos del archivo");
      }
      
      el.fileImport.value = "";
    };
    reader.readAsText(file);
  }

  // ─── EXPERIMENTAL MODULE ───────────────────────────────────────────────────
  let expTickets = [];      // Array of { id, subject, date, status }
  let expResults = [];      // Array of { ticket, summary, resolution, error }
  let expRunning = false;

  function expLog(msg, type) {
    if (!el.expLogBody) return;
    var line = document.createElement("span");
    line.className = "exp-log-line exp-log-" + (type || "info");
    var ts = new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    line.textContent = "[" + ts + "] " + msg;
    el.expLogBody.appendChild(line);
    el.expLogBody.scrollTop = el.expLogBody.scrollHeight;
  }

  function expSetStatus(state, text) {
    if (!el.expStatusBadge || !el.expStatusText) return;
    el.expStatusBadge.className = "exp-status-badge" + (state ? " " + state : "");
    el.expStatusText.textContent = text || state.toUpperCase();
  }

  function expScanTickets() {
    var count = Math.min(50, Math.max(1, parseInt(el.expCount?.value) || 10));
    var mode  = el.expMode?.value || "last";
    var since = el.expDate?.value || "";

    expLog("Iniciando escaneo: " + count + " tickets " + (mode === "last" ? "(más recientes)" : "(más antiguos)") + (since ? " desde " + since : ""), "info");
    expSetStatus("running", "ESCANEANDO");

    if (el.btnExpScan) { el.btnExpScan.disabled = true; }

    notifyContent({
      type: "SCAN_OPEN_TICKETS",
      data: { count, mode, since }
    });

    // Safety timeout if content.js doesn't respond
    var _timer = setTimeout(function() {
      if (el.btnExpScan) el.btnExpScan.disabled = false;
      expSetStatus("error", "TIMEOUT");
      expLog("No se recibió respuesta del escaneo. Asegúrate de estar en la lista de tickets de Zoho Desk.", "error");
    }, 12000);
    el.btnExpScan._timer = _timer;
  }

  function expHandleScanResult(data) {
    if (el.btnExpScan) {
      el.btnExpScan.disabled = false;
      clearTimeout(el.btnExpScan._timer);
    }
    var tickets = data?.tickets || [];
    if (!tickets.length) {
      expSetStatus("error", "SIN DATOS");
      expLog("No se encontraron tickets abiertos en la vista actual.", "warn");
      return;
    }
    expTickets = tickets;
    expResults = [];
    expLog("Encontrados " + tickets.length + " ticket(s) abierto(s).", "ok");
    expSetStatus("", "LISTO");

    // Render preview list
    if (el.expTicketList) el.expTicketList.classList.remove("hidden");
    if (el.expListCount)  el.expListCount.textContent = tickets.length;
    if (el.expTicketsScroll) {
      el.expTicketsScroll.innerHTML = tickets.map(function(t) {
        return '<div class="exp-ticket-chip" data-tid="' + esc(t.id) + '">' +
          '<span class="exp-chip-id">#' + esc(t.id) + '</span>' +
          '<span class="exp-chip-subject">' + esc(t.subject || '—') + '</span>' +
          '<span class="exp-chip-date">' + esc(t.date || '') + '</span>' +
          '<span class="exp-chip-status pending"></span>' +
        '</div>';
      }).join("");
    }

    // Prepare results table rows (loading state)
    if (el.expResultsWrap) el.expResultsWrap.classList.remove("hidden");
    if (el.expTbody) {
      el.expTbody.innerHTML = tickets.map(function(t) {
        return '<tr class="exp-tr exp-tr-loading" id="exp-row-' + esc(t.id) + '">' +
          '<td class="exp-td exp-td-ticket">' +
            '<span class="exp-ticket-id">#' + esc(t.id) + '</span>' +
            '<span class="exp-ticket-subject" title="' + esc(t.subject || '') + '">' + esc((t.subject || '').slice(0, 35)) + '</span>' +
          '</td>' +
          '<td class="exp-td exp-td-summary"><div class="exp-cell-loading"><div class="exp-cell-spinner"></div>Pendiente…</div></td>' +
          '<td class="exp-td exp-td-resolution"><div class="exp-cell-loading"><div class="exp-cell-spinner"></div>—</div></td>' +
        '</tr>';
      }).join("");
    }

    if (el.btnExpRun) el.btnExpRun.disabled = false;
    showToast("✓ " + tickets.length + " tickets detectados");
  }

  async function expRunAnalysis() {
    if (expRunning || !expTickets.length) return;
    expRunning = true;
    expResults = [];

    if (el.btnExpRun) { el.btnExpRun.disabled = true; el.btnExpRun.classList.add("running"); }
    if (el.btnExpScan) el.btnExpScan.disabled = true;
    if (el.expProgressWrap) el.expProgressWrap.classList.remove("hidden");
    expSetStatus("running", "ANALIZANDO");
    expLog("Iniciando análisis IA de " + expTickets.length + " ticket(s)…", "info");

    var total = expTickets.length;

    for (var i = 0; i < total; i++) {
      var ticket = expTickets[i];
      var pct = Math.round(((i) / total) * 100);

      // Update progress
      if (el.expProgressLabel) el.expProgressLabel.textContent = "Analizando ticket " + (i+1) + " de " + total + ": #" + ticket.id;
      if (el.expProgressPct)   el.expProgressPct.textContent   = pct + "%";
      if (el.expProgressFill)  el.expProgressFill.style.width  = pct + "%";

      // Mark chip as running
      var chip = el.expTicketsScroll?.querySelector('[data-tid="' + ticket.id + '"] .exp-chip-status');
      if (chip) chip.className = "exp-chip-status running";

      // Mark row as running
      var row = document.getElementById("exp-row-" + ticket.id);
      if (row) {
        row.querySelectorAll(".exp-td-summary, .exp-td-resolution").forEach(function(td) {
          td.innerHTML = '<div class="exp-cell-loading"><div class="exp-cell-spinner"></div>Analizando…</div>';
        });
      }

      expLog("[" + (i+1) + "/" + total + "] Analizando #" + ticket.id + " — " + (ticket.subject || '').slice(0,40), "info");

      try {
        var reply = await expAnalyzeTicket(ticket);
        expResults.push({ ticket, summary: reply.summary, resolution: reply.resolution });

        // Update row
        if (row) {
          row.className = "exp-tr exp-tr-done";
          var sumTd = row.querySelector(".exp-td-summary");
          var resTd = row.querySelector(".exp-td-resolution");
          if (sumTd) sumTd.textContent = reply.summary || "Sin resumen";
          if (resTd) {
            var badge = expResolutionBadge(reply.resolution);
            resTd.innerHTML = badge + ' <span style="display:block;margin-top:4px;font-size:9px;color:var(--t2)">' + esc(reply.resolution || '') + '</span>';
          }
        }
        if (chip) chip.className = "exp-chip-status done";
        expLog("  ✓ #" + ticket.id + " analizado.", "ok");
      } catch(err) {
        expResults.push({ ticket, summary: null, resolution: null, error: err.message });
        if (row) {
          row.className = "exp-tr exp-tr-error";
          row.querySelectorAll(".exp-td-summary, .exp-td-resolution").forEach(function(td) {
            td.innerHTML = '<span class="exp-cell-error">✗ ' + esc(err.message || 'Error') + '</span>';
          });
        }
        if (chip) chip.className = "exp-chip-status error";
        expLog("  ✗ #" + ticket.id + " — " + err.message, "error");
      }

      // Small delay to avoid API throttling
      await new Promise(function(r) { setTimeout(r, 600); });
    }

    // Done
    if (el.expProgressLabel) el.expProgressLabel.textContent = "Análisis completo — " + total + " ticket(s) procesados";
    if (el.expProgressPct)   el.expProgressPct.textContent   = "100%";
    if (el.expProgressFill)  el.expProgressFill.style.width  = "100%";
    expSetStatus("done", "COMPLETO");
    expLog("Análisis finalizado. " + expResults.filter(function(r){ return !r.error; }).length + " OK · " + expResults.filter(function(r){ return r.error; }).length + " errores.", "ok");
    expRunning = false;
    if (el.btnExpRun)  { el.btnExpRun.disabled = false; el.btnExpRun.classList.remove("running"); }
    if (el.btnExpScan) el.btnExpScan.disabled = false;
    showToast("✓ Análisis masivo completado");
  }

  function expFetchConversation(ticketId) {
    return new Promise(function(resolve) {
      window._expConvId = ticketId;
      window._expConvResolve = resolve;
      notifyContent({ type: "FETCH_TICKET_CONVERSATION", data: { id: ticketId } });
      // Timeout fallback
      setTimeout(function() {
        if (window._expConvId === ticketId) {
          window._expConvResolve("");
          window._expConvResolve = null;
          window._expConvId = null;
        }
      }, 8000);
    });
  }

  async function expAnalyzeTicket(ticket) {
    var convText = await expFetchConversation(ticket.id);
    ticket.conversation = convText;

    return new Promise(function(resolve, reject) {
      var prompt = [
        "Analiza el siguiente ticket de soporte y responde EXCLUSIVAMENTE con un JSON con este formato exacto:",
        '{ "summary": "<resumen de lo que se comunicó y acordó en 2-3 oraciones>", "resolution": "<estado: Resuelto | Pendiente | Sin respuesta | En espera de cliente | Escalado | En revisión>"}',
        "",
        "Ticket ID: #" + ticket.id,
        "Asunto: " + (ticket.subject || "Sin asunto"),
        "Fecha: " + (ticket.date || ""),
        "Conversación:",
        ticket.conversation || "(sin conversación disponible)"
      ].join("\n");

      chrome.runtime.sendMessage(
        {
          type: "CUSTOM_PROMPT_ANALYZE",
          data: {
            ticketData: { ticketId: ticket.id, subject: ticket.subject },
            currentResult: null,
            userPrompt: prompt,
            persistentContext: "",
            attachment: null
          }
        },
        function(response) {
          if (chrome.runtime.lastError || response?.error) {
            return reject(new Error(response?.error || chrome.runtime.lastError?.message || "Error IA"));
          }
          var raw = (response.reply || "").trim();
          // Strip markdown code fences if present
          raw = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
          try {
            var parsed = JSON.parse(raw);
            resolve({ summary: parsed.summary || raw, resolution: parsed.resolution || "" });
          } catch(_) {
            // If not JSON, use raw text as summary
            resolve({ summary: raw, resolution: "" });
          }
        }
      );
    });
  }

  function expResolutionBadge(resolution) {
    if (!resolution) return '';
    var r = resolution.toLowerCase();
    var cls = "exp-badge-open";
    if (r.includes("resuelto") || r.includes("cerrado")) cls = "exp-badge-resolved";
    else if (r.includes("pendiente") || r.includes("espera") || r.includes("revisión")) cls = "exp-badge-pending";
    else if (r.includes("escalado") || r.includes("urgente") || r.includes("sin respuesta")) cls = "exp-badge-urgent";
    return '<span class="exp-badge ' + cls + '">' + esc(resolution) + '</span>';
  }

  function expClear() {
    expTickets = [];
    expResults = [];
    expRunning = false;
    if (el.expTicketList)  el.expTicketList.classList.add("hidden");
    if (el.expResultsWrap) el.expResultsWrap.classList.add("hidden");
    if (el.expProgressWrap) el.expProgressWrap.classList.add("hidden");
    if (el.expTbody)       el.expTbody.innerHTML = "";
    if (el.expTicketsScroll) el.expTicketsScroll.innerHTML = "";
    if (el.expLogBody)     el.expLogBody.innerHTML = "";
    if (el.btnExpRun)      el.btnExpRun.disabled = true;
    expSetStatus("", "IDLE");
    expLog("Panel limpiado. Listo para nuevo escaneo.", "info");
  }

  async function expCopyTable() {
    if (!expResults.length) { showToast("⚠ Sin resultados para copiar"); return; }
    var html = '<table style="border-collapse:collapse;font-family:sans-serif;font-size:12px">';
    html += '<tr><th style="border:1px solid #ccc;padding:6px;background:#1a1a2e;color:#00d4ff">TICKET</th><th style="border:1px solid #ccc;padding:6px;background:#1a1a2e;color:#a78bfa">RESUMEN DE COMUNICACIONES</th><th style="border:1px solid #ccc;padding:6px;background:#1a1a2e;color:#06ffa5">RESOLUCIÓN</th></tr>';
    expResults.forEach(function(r) {
      var id = '#' + (r.ticket?.id || '—');
      var subj = r.ticket?.subject || '';
      var summary = r.error ? '✗ ERROR: ' + r.error : (r.summary || '—');
      var res = r.resolution || '—';
      html += '<tr>';
      html += '<td style="border:1px solid #ccc;padding:6px;font-weight:700">' + id + '<br><small>' + subj + '</small></td>';
      html += '<td style="border:1px solid #ccc;padding:6px">' + summary + '</td>';
      html += '<td style="border:1px solid #ccc;padding:6px;font-weight:700">' + res + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    var plain = expResults.map(function(r) {
      return '#' + (r.ticket?.id||'') + ' | ' + (r.summary||r.error||'—') + ' | ' + (r.resolution||'—');
    }).join('\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html],{type:'text/html'}), 'text/plain': new Blob([plain],{type:'text/plain'}) })]);
      showToast("✓ Tabla copiada con colores");
    } catch(_) {
      copyText(plain).then(function(){ showToast("✓ Copiado como texto"); });
    }
  }

  function expExportExcel() {
    if (!expResults.length) { showToast("⚠ Sin resultados para exportar"); return; }
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>';
    html += '<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:11px">';
    html += '<tr><th style="background:#1a1a2e;color:#00d4ff">TICKET</th><th style="background:#1a1a2e;color:#00d4ff">ASUNTO</th><th style="background:#1a1a2e;color:#a78bfa">RESUMEN DE COMUNICACIONES</th><th style="background:#1a1a2e;color:#06ffa5">RESOLUCIÓN</th></tr>';
    expResults.forEach(function(r) {
      html += '<tr>';
      html += '<td style="font-weight:700">#' + (r.ticket?.id||'') + '</td>';
      html += '<td>' + (r.ticket?.subject||'') + '</td>';
      html += '<td>' + (r.error ? '✗ ERROR: '+r.error : (r.summary||'—')) + '</td>';
      html += '<td style="font-weight:700">' + (r.resolution||'—') + '</td>';
      html += '</tr>';
    });
    html += '</table></body></html>';
    var dateStr = new Date().toISOString().split('T')[0];
    var blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'Analisis_Tickets_' + dateStr + '.xls';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("✓ Excel exportado");
  }

  // ─── START ─────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
