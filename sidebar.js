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
  };

  var PROVIDER_UI = {
    openai:         { label: "OpenAI API Key",  placeholder: "sk-…" },
    github_copilot: { label: "GitHub Token (models:read)", placeholder: "ghp_…" },
    claude:         { label: "Claude API Key",   placeholder: "sk-ant-…" },
  };

  var PROVIDER_STORAGE_KEY = {
    openai:         "apiKeyOpenAI",
    github_copilot: "apiKeyGitHubCopilot",
    claude:         "apiKeyClaude",
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

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    const $ = (id) => document.getElementById(id);
    el = {
      btnSettings: $("js-settings"),
      btnHistory: $("js-history"),
      btnClose: $("js-close"),
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
    };

    if (!el.btnClose || !el.btnSettings || !el.toast) {
      console.error("[EMChile] sidebar init failed: missing DOM nodes");
      return;
    }

    bindUI();
    loadCustomPromptContext();
    loadAnalysisContexts();
    showView("idle");
    notifyContent({ type: "SIDEBAR_READY" });
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

    // Messages from content.js
    window.addEventListener("message", onContentMessage);
  }

  // ─── INCOMING MESSAGES ─────────────────────────────────────────────────────
  function onContentMessage(evt) {
    const { type, data, error, ticketData, ticketId, message } = evt.data || {};
    switch (type) {
      case "LOADING_START":
        showView("loading");
        break;
      case "ANALYSIS_RESULT":
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
        onTicketChanged(ticketId || data?.ticketId);
        break;
      case "INSERT_SUCCESS":
        showToast("✓ Texto insertado en el editor de Zoho");
        break;
      case "INSERT_FALLBACK":
        showToast(message || "✓ Copiado al portapapeles");
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
    window.parent.postMessage({ source: "emchile-sidebar", ...msg }, "*");
  }

  // ─── VIEW MANAGEMENT ───────────────────────────────────────────────────────
  const VIEW_IDS = [
    "idle",
    "loading",
    "error",
    "results",
    "history",
    "settings",
  ];

  function showView(name) {
    VIEW_IDS.forEach((v) => {
      const node = document.getElementById(`sv-${v}`);
      if (node) node.classList.toggle("hidden", v !== name);
    });
    activeView = name;
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
          `<button class="oc-chip" type="button" data-oc="${esc(oc)}">${esc(oc)}</button>`,
      )
      .join("");

    el.ocList.querySelectorAll(".oc-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        copyText(chip.dataset.oc || "").then(() => showToast("✓ OC copiada"));
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
    "Redacta una respuesta cordial y profesional: saludo con nombre y agradece la informacion/ficha tecnica. " +
    "Indica que por el momento/momentaneamente no estamos fabricando muestras individuales hasta nuevo aviso, " +
    "por lo que no es posible comprometer el plazo indicado. Aclara que las muestras solo se entregan si hay " +
    "stock fisico disponible y, si hay stock, se informara a la brevedad. Si no hay stock, comunicar que se " +
    "avisara cualquier novedad. Mantener tono cercano y con disposicion a ayudar. Cierra con saludo cordial y " +
    "firma 'Equipo EMChile'.";

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

  // ─── START ─────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
