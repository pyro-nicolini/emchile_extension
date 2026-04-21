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
  let currentTicketId = null;
  let isAnalyzing = false;
  let sidebarOpen = false;

  // ─── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    injectStyles();
    injectUI();
    setupMutationObserver();
    setupHistoryListeners();
    setupEmergencyClose();
    setTimeout(checkTicketChange, 1600);
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
      #emchile-fab.fab-open { right: 516px; }
      @keyframes emchile-pulse {
        0%,100% { box-shadow: 0 0 22px rgba(168,85,247,0.4), 0 6px 24px rgba(0,0,0,0.5); }
        50%      { box-shadow: 0 0 44px rgba(168,85,247,0.75), 0 0 88px rgba(0,212,255,0.18), 0 6px 24px rgba(0,0,0,0.5); }
      }
      #emchile-sidebar-frame {
        position: fixed;
        top: 0; right: -510px;
        width: 500px; height: 100vh;
        border: none;
        z-index: 2147483641;
        transition: right 0.32s cubic-bezier(0.4,0,0.2,1);
        box-shadow: -8px 0 48px rgba(0,0,0,0.65);
      }
      #emchile-sidebar-frame.frame-open { right: 0; }
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

    // Sidebar iframe (loads sidebar.html from extension)
    sidebarFrame = document.createElement("iframe");
    sidebarFrame.id = "emchile-sidebar-frame";
    sidebarFrame.title = "EMChile AI Desk";
    sidebarFrame.src = chrome.runtime.getURL("sidebar.html");
    document.body.appendChild(sidebarFrame);
  }

  // ─── FAB CLICK ─────────────────────────────────────────────────────────────
  function handleFabClick() {
    if (sidebarOpen) {
      closeSidebar();
    } else {
      openSidebar();
      if (!isAnalyzing) triggerAnalysis();
    }
  }

  function openSidebar() {
    sidebarFrame.classList.add("frame-open");
    floatingBtn.classList.add("fab-open");
    floatingBtn.querySelector(".ef-text").textContent = "Cerrar";
    sidebarOpen = true;
  }

  function closeSidebar() {
    sidebarFrame.classList.remove("frame-open");
    floatingBtn.classList.remove("fab-open");
    floatingBtn.querySelector(".ef-text").textContent = "AI Desk";
    sidebarOpen = false;
  }

  // ─── ANALYSIS FLOW ─────────────────────────────────────────────────────────
  async function triggerAnalysis() {
    isAnalyzing = true;
    floatingBtn.classList.add("fab-analyzing");
    postToSidebar({ type: "LOADING_START" });
    try {
      const ticketData = extractTicketData();
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
  function extractTicketData() {
    const subject = extractSubject();
    const conversation = extractConversation();
    const additionalData = extractCustomFields();
    return {
      ticketId: extractTicketId(),
      subject,
      customerName: extractCustomerName(),
      customerEmail: extractCustomerEmail(),
      status: extractStatus(),
      priority: extractPriority(),
      createdAt: extractCreatedAt(),
      conversation,
      ocNumbers: extractOCNumbers(conversation, additionalData, subject),
      additionalData,
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
    const pathMatch = window.location.pathname.match(/\/tickets\/(\d{3,})(?:[/?]|$)/i);
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
      '.page-title, .ticket-header'
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
    const rawText = sources.filter(Boolean).join("\n") || document.body.innerText || "";
    const preparedText = prepareOCExtractionText(rawText);
    const suffixPattern = "(?:AG25|AG26|COT25|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?)";
    const strictOcRegex = new RegExp(
      `\\b(\\d{3,8}-+\\d{2,6}-+${suffixPattern})\\b`,
      "gi",
    );
    const labeledOcRegex = new RegExp(
      `\\bOC[:\\s#-]*(\\d{3,8}-+\\d{2,6}-+${suffixPattern})\\b`,
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
        /(AG25|AG26|COT25|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?)(?=\d{3,8}-+\d{2,6}-+)/gi,
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

    if (!/^\d{3,8}-\d{2,6}-(AG25|AG26|COT25|LE(?:25|26)?|LP(?:25|26)?|SE(?:25|26)?)$/.test(normalized)) {
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
        try { btn.click(); } catch (_) {}
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
      '[class*="thread-item"]:not([class*="thread-items"])',  // avoid wrapper
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
      try { nodes = document.querySelectorAll(sel); }
      catch (_) { continue; }
      if (!nodes.length) continue;

      const msgs = extractMessagesFromNodes(nodes);
      // Prefer the selector that yields the MOST distinct messages
      if (msgs.length > bestResult.length) {
        bestResult = msgs;
      }
    }

    if (bestResult.length) {
      return bestResult.join("\n\n─────\n\n");
    }

    // ── Step 3: brute-force — scan all visible text blocks in ticket area ────
    const ticketRoot = document.querySelector(
      '#ticketDetail, .ticket-detail, [class*="ticket-detail"], ' +
      '[class*="ticket-view"], [class*="ticketView"], ' +
      '[class*="conversations"], [role="main"], main'
    );

    if (ticketRoot) {
      // Look for direct children with substantial text
      const blocks = [];
      ticketRoot.querySelectorAll(
        'div[class], article, section, li[class]'
      ).forEach((el) => {
        // Skip if it's a wrapper that contains other matches
        const childHits = el.querySelectorAll('div[class], article, li[class]');
        if (childHits.length > 4) return; // likely a container, skip

        const text = el.textContent.replace(/\s+/g, ' ').trim();
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
        return "[Contenido extraído — texto completo del área]:\n" + raw.substring(0, 8000);
      }
    }

    return "No se pudo extraer la conversación. Asegúrate de estar dentro del detalle de un ticket específico.";
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
        '.sender-name, .from-name, .author-name, ' +
        '[class*="sender"], [class*="author"], [class*="from-name"], ' +
        '[class*="fromName"], [class*="contact-name"]'
      );
      const sender = senderEl?.textContent.trim() || `Mensaje ${i + 1}`;

      // Timestamp
      const timeEl =
        node.querySelector("time[datetime]") ||
        node.querySelector('[class*="time"], [class*="date"], [class*="timestamp"]');
      const ts =
        timeEl?.getAttribute("datetime") ||
        timeEl?.textContent.trim() ||
        "";

      // Prefer an inner body element, but keep the full node text if it contains
      // more OC references than the narrowed body selection.
      const bodyEl = node.querySelector(
        '[class*="body"], [class*="content"], [class*="text"], ' +
        '[class*="mail-body"], [class*="mailBody"], blockquote'
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
    return arr.filter((t, i) =>
      !arr.some((other, j) => j !== i && other.includes(t) && other.length > t.length)
    );
  }

  function extractCustomFields() {
    const lines = [];
    document
      .querySelectorAll(
        '[class*="custom-field"],[class*="customField"],.field-wrap',
      )
      .forEach((w) => {
        const label = w
          .querySelector('label,[class*="label"]')
          ?.textContent.trim();
        const value = w
          .querySelector('[class*="value"],span,p')
          ?.textContent.trim();
        if (label && value && value !== label) lines.push(`${label}: ${value}`);
      });
    return lines.slice(0, 10).join("\n") || null;
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
        if (!isAnalyzing) triggerAnalysis();
        break;
      case "CLOSE_SIDEBAR":
        closeSidebar();
        break;
      case "INSERT_IN_ZOHO":
        insertTextInZoho(data?.text || "");
        break;
    }
  });

  // ─── INSERT IN ZOHO EDITOR ─────────────────────────────────────────────────
  function insertTextInZoho(text) {
    if (!text) return;
    const editors = [
      ".ql-editor",
      '[class*="replyEditor"] [contenteditable="true"]',
      '[class*="reply-editor"] [contenteditable="true"]',
      '[contenteditable="true"]',
      ".mce-content-body",
      'textarea[name*="reply"]',
      'textarea[id*="reply"]',
      'textarea[class*="reply"]',
      "#replyTextArea",
      "textarea",
    ];
    for (const sel of editors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.focus();
      if (el.tagName === "TEXTAREA") {
        el.value = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        const sel2 = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel2.removeAllRanges();
        sel2.addRange(range);
        document.execCommand("insertText", false, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      postToSidebar({ type: "INSERT_SUCCESS" });
      return;
    }
    // Clipboard fallback
    navigator.clipboard.writeText(text).then(() => {
      postToSidebar({
        type: "INSERT_FALLBACK",
        message: "✓ Copiado al portapapeles (editor no detectado)",
      });
    });
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
      postToSidebar({ type: "TICKET_CHANGED", ticketId: newId });
    }
  }

  // ─── BOOTSTRAP ─────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
