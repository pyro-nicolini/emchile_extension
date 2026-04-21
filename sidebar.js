"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Sidebar Script
//  Runs inside the sidebar.html extension page (has full chrome.* access)
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
  // ─── State ─────────────────────────────────────────────────────────────────
  let currentResult = null;
  let currentTicket = null;
  let previousView = "idle";
  let activeView = "idle";
  let el = {}; // populated in init() once DOM is ready

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
      ocBar: $("js-ocbar"),
      ocList: $("js-oclist"),
      btnCopyOcs: $("js-copy-ocs"),
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
      eyeBtn: $("js-eye"),
      modelSelect: $("js-model"),
      useCustom: $("js-use-custom"),
      customWrap: $("js-custom-wrap"),
      customPrompt: $("js-custom-prompt"),
      btnSaveCfg: $("js-save-cfg"),
      btnBackCfg: $("js-back-cfg"),
      toast: $("js-toast"),
    };

    if (!el.btnClose || !el.btnSettings || !el.toast) {
      console.error("[EMChile] sidebar init failed: missing DOM nodes");
      return;
    }

    bindUI();
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
      notifyContent({ type: "RE_ANALYZE" }),
    );
    el.btnGotoCfg.addEventListener("click", () => {
      previousView = "error";
      showView("settings");
      loadSettings();
    });

    // Results — Re-analyze
    el.btnReanalyze.addEventListener("click", () =>
      notifyContent({ type: "RE_ANALYZE" }),
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
    el.useCustom.addEventListener("change", () => {
      el.customWrap.classList.toggle("hidden", !el.useCustom.checked);
    });
    el.btnSaveCfg.addEventListener("click", saveSettings);
    el.btnBackCfg.addEventListener("click", () => showView(previousView));

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

    renderOCs(ticketData?.ocNumbers || []);

    // Confidence
    renderConfidence(result.confidence ?? 0);

    // Data grid
    if (ticketData) renderDataGrid(ticketData);

    showView("results");
    switchTab("client");
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
    if (!ocNumbers.length) {
      el.ocBar.classList.add("hidden");
      el.ocList.innerHTML = "";
      return;
    }

    el.ocBar.classList.remove("hidden");
    el.ocList.innerHTML = ocNumbers
      .map(
        (oc) => `<button class="oc-chip" type="button" data-oc="${esc(oc)}">${esc(oc)}</button>`,
      )
      .join("");

    el.ocList.querySelectorAll(".oc-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        copyText(chip.dataset.oc || "").then(() => showToast("✓ OC copiada"));
      });
    });
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

  function copyText(text) {
    if (!text) return Promise.resolve();

    navigator.clipboard
      .writeText(text)
      .catch(() => {
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
  function loadSettings() {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings = {}) => {
      if (chrome.runtime.lastError) {
        showToast("✗ Error cargando configuración");
        return;
      }
      if (settings.apiKey) el.apiKeyInput.value = settings.apiKey;
      if (settings.model) el.modelSelect.value = settings.model;
      if (settings.customPrompt) el.customPrompt.value = settings.customPrompt;
      el.useCustom.checked = !!settings.useCustomPrompt;
      el.customWrap.classList.toggle("hidden", !settings.useCustomPrompt);
    });
  }

  function saveSettings() {
    const data = {
      apiKey: el.apiKeyInput.value.trim(),
      model: el.modelSelect.value,
      customPrompt: el.customPrompt.value.trim(),
      useCustomPrompt: el.useCustom.checked,
    };
    if (!data.apiKey) {
      showToast("⚠ Ingresa tu API Key de OpenAI");
      return;
    }
    chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", data }, (response) => {
      if (chrome.runtime.lastError) {
        showToast("✗ Error al guardar configuración");
        return;
      }
      if (!response?.success) {
        showToast(`✗ ${response?.error || "No se pudo guardar"}`);
        return;
      }
      if (response.saved?.apiKey) {
        el.apiKeyInput.value = response.saved.apiKey;
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
