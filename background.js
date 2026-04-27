"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Background Service Worker
//  Handles: OpenAI API calls · Chrome storage · History management
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "ANALYZE_TICKET":
      analyzeTicket(request.data)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true; // keep channel open for async

    case "CUSTOM_PROMPT_ANALYZE":
      customPromptAnalyze(request.data)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true;

    case "GET_SETTINGS":
      chrome.storage.local.get(
        ["apiKey", "model", "customPrompt", "useCustomPrompt"],
        sendResponse,
      );
      return true;

    case "SAVE_SETTINGS":
      chrome.storage.local.set(request.data, () => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        chrome.storage.local.get(
          ["apiKey", "model", "customPrompt", "useCustomPrompt"],
          (saved) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: false,
                error: chrome.runtime.lastError.message,
              });
              return;
            }

            sendResponse({
              success: saved.apiKey === request.data.apiKey,
              saved,
              error:
                saved.apiKey === request.data.apiKey
                  ? null
                  : "No se pudo verificar el guardado del token.",
            });
          },
        );
      });
      return true;

    case "GET_HISTORY":
      chrome.storage.local.get(["analysisHistory"], (result) =>
        sendResponse({ history: result.analysisHistory || [] }),
      );
      return true;

    case "CLEAR_HISTORY":
      chrome.storage.local.set({ analysisHistory: [] }, () =>
        sendResponse({ success: true }),
      );
      return true;

    // ── Run insert in page's MAIN world (bypasses Zoho CSP) ─────────────────
    case "EXEC_INSERT": {
      const { text } = request.data;
      (async () => {
        try {
          const tabId = sender?.tab?.id;
          if (!tabId) {
            sendResponse({
              ok: false,
              error: "No se encontró la pestaña activa.",
            });
            return;
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            world: "MAIN",
            func: async (txt) => {
              if (location.protocol === "chrome-extension:") return false;

              const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

              const isVisible = (el) => {
                if (!el) return false;
                const win = el.ownerDocument?.defaultView || window;
                const rect = el.getBoundingClientRect();
                const style = win.getComputedStyle(el);
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  style.visibility !== "hidden" &&
                  style.display !== "none"
                );
              };

              const findReplyAllButton = () => {
                const btns = document.querySelectorAll(
                  'button, [role="button"], a, [data-action]',
                );
                for (const btn of btns) {
                  if (!isVisible(btn)) continue;
                  const text = (btn.textContent || "").trim().toLowerCase();
                  const label = (
                    btn.getAttribute("aria-label") ||
                    btn.getAttribute("title") ||
                    ""
                  )
                    .trim()
                    .toLowerCase();
                  if (
                    text.includes("responder a todos") ||
                    label.includes("responder a todos") ||
                    text.includes("reply all") ||
                    label.includes("reply all")
                  ) {
                    return btn;
                  }
                }
                return null;
              };

              const editorSelectors = [
                ".ql-editor",
                ".ProseMirror",
                ".public-DraftEditor-content",
                '[contenteditable="true"][role="textbox"]',
                'body[contenteditable="true"]',
                'html[contenteditable="true"]',
                '[contenteditable="true"]',
                "textarea",
              ];

              const hasEditor = () => {
                for (const sel of editorSelectors) {
                  const el = document.querySelector(sel);
                  if (el && isVisible(el)) return true;
                }
                return false;
              };

              const collectDocs = () => {
                const docs = [document];
                try {
                  document.querySelectorAll("iframe").forEach((frame) => {
                    try {
                      if (frame.contentDocument) docs.push(frame.contentDocument);
                    } catch (_) {}
                  });
                } catch (_) {}
                return docs;
              };

              const getCandidates = (doc) =>
                editorSelectors
                  .flatMap((sel) => Array.from(doc.querySelectorAll(sel)))
                  .filter(
                    (el) =>
                      isVisible(el) && !el.closest("#emchile-sidebar-frame"),
                  )
                  .map((el) => ({
                    el,
                    doc,
                    win: doc.defaultView || window,
                  }));

              const getAllCandidates = () =>
                collectDocs().flatMap((doc) => getCandidates(doc));

              const marker = txt.trim().slice(0, 40);
              const hasMarker = (el) => {
                if (!marker) return true;
                if (el.tagName === "TEXTAREA") {
                  return (el.value || "").includes(marker);
                }
                return (el.innerText || "").includes(marker);
              };

              const scoreEditor = (el) => {
                let score = 0;
                const cls = `${el.className || ""} ${el.id || ""}`;
                if (el.classList.contains("ql-editor")) score += 50;
                if (el.classList.contains("ProseMirror")) score += 40;
                if (el.classList.contains("public-DraftEditor-content")) score += 35;
                if (el.getAttribute("role") === "textbox") score += 20;
                if (/reply|compose|editor|mail|response|comment/i.test(cls)) score += 15;
                const rect = el.getBoundingClientRect();
                score += Math.min((rect.width * rect.height) / 5000, 30);
                const active = document.activeElement;
                if (active && (el === active || el.contains(active))) score += 40;
                return score;
              };

              // Ensure Reply All is open before inserting
              if (window.top === window) {
                if (!hasEditor()) {
                  const replyAll = findReplyAllButton();
                  if (replyAll) replyAll.click();
                  await sleep(700);
                }
              } else {
                // give time for reply editor to render in nested frames
                await sleep(700);
              }

              const htmlText = txt.replace(/\n/g, "<br>");
              let candidates = getAllCandidates();
              if (!candidates.length) {
                for (let i = 0; i < 12; i += 1) {
                  await sleep(400);
                  candidates = getAllCandidates();
                  if (candidates.length) break;
                }
              }
              if (!candidates.length) return false;

              candidates = candidates
                .map((item) => ({
                  ...item,
                  score: scoreEditor(item.el),
                }))
                .sort((a, b) => b.score - a.score);

              for (const candidate of candidates) {
                const { el: editor, doc, win } = candidate;
                if (editor.tagName === "TEXTAREA") {
                  try {
                    editor.focus();
                    const setter = Object.getOwnPropertyDescriptor(
                      win.HTMLTextAreaElement.prototype,
                      "value",
                    )?.set;
                    if (setter) setter.call(editor, txt);
                    else editor.value = txt;
                    editor.dispatchEvent(new win.Event("input", { bubbles: true }));
                    editor.dispatchEvent(
                      new win.Event("change", { bubbles: true }),
                    );
                    if (hasMarker(editor)) return true;
                  } catch (_) {}
                }

                if (editor.classList.contains("ql-editor")) {
                  try {
                    const container = editor.closest(".ql-container");
                    if (container && win.Quill) {
                      const quill = win.Quill.find(container);
                      if (quill) {
                        quill.setText("");
                        quill.clipboard.dangerouslyPasteHTML(0, htmlText);
                        editor.dispatchEvent(
                          new win.Event("input", { bubbles: true }),
                        );
                        if (hasMarker(editor)) return true;
                      }
                    }
                  } catch (_) {}
                }

                try {
                  editor.focus();
                  const selection = win.getSelection();
                  const range = doc.createRange();
                  range.selectNodeContents(editor);
                  range.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  if (doc.execCommand("insertText", false, txt)) {
                    editor.dispatchEvent(new win.Event("input", { bubbles: true }));
                    editor.dispatchEvent(
                      new win.Event("change", { bubbles: true }),
                    );
                    if (hasMarker(editor)) return true;
                  }
                } catch (_) {}

                try {
                  editor.innerHTML = htmlText;
                  editor.dispatchEvent(new win.Event("input", { bubbles: true }));
                  editor.dispatchEvent(new win.Event("change", { bubbles: true }));
                  if (hasMarker(editor)) return true;
                } catch (_) {}
              }

              return false;
            },
            args: [text],
          });
          sendResponse({ ok: results.some((f) => f.result === true) });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }

    // ── Run auto-fill in page's MAIN world (bypasses Zoho CSP + React) ──────
    case "EXEC_AUTOFILL": {
      (async () => {
        try {
          const tabId = sender?.tab?.id;
          if (!tabId) {
            sendResponse({
              filled: [],
              failed: ["No se encontró la pestaña activa."],
              saved: false,
            });
            return;
          }

          const results = await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            world: "MAIN",
            func: async (data) => {
              const filled = [],
                failed = [];
              const wait = (ms) => new Promise((r) => setTimeout(r, ms));

              const isVisible = (el) => {
                if (!el) return false;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  style.visibility !== "hidden" &&
                  style.display !== "none"
                );
              };

              function setVal(inp, val) {
                if (!inp) return false;
                try {
                  inp.focus();
                  const P =
                    inp.tagName === "TEXTAREA"
                      ? HTMLTextAreaElement.prototype
                      : HTMLInputElement.prototype;
                  const setter = Object.getOwnPropertyDescriptor(
                    P,
                    "value",
                  )?.set;
                  if (setter) setter.call(inp, val);
                  else inp.value = val;
                  for (const ev of ["input", "change", "keyup", "blur"])
                    inp.dispatchEvent(new Event(ev, { bubbles: true }));
                  return true;
                } catch (_) {
                  return false;
                }
              }

              const FIELD_SELECTOR =
                "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea";
              const DROPDOWN_TRIGGER_SELECTOR =
                "[role=combobox],[role=menuitem],[aria-haspopup=listbox]," +
                "button[class*=dropdown],div[class*=dropdown],span[class*=dropdown]," +
                "button[class*=select],div[class*=select],span[class*=select]," +
                "button[class*=picker],div[class*=picker],span[class*=picker]," +
                "button[class*=chosen],div[class*=chosen],span[class*=chosen]," +
                "input[aria-label*='select options'],input[data-selector-id='textBoxIcon']";

              function normalizeText(text) {
                return String(text || "")
                  .toLowerCase()
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[*\s]/g, "");
              }

              function textMatches(el, partial) {
                // Only match the label's own text, not text of its children inputs
                const ownText = Array.from(el.childNodes)
                  .filter((n) => n.nodeType === Node.TEXT_NODE)
                  .map((n) => n.textContent)
                  .join("")
                  .replace(/[*\s]/g, "");
                // Fallback to full textContent but capped to avoid matching huge wrappers
                const own = normalizeText(ownText);
                const full = normalizeText(el.textContent);
                const text = own.length >= 3 ? own : full;
                // Avoid matching wrappers with long text (e.g. entire panel labels)
                if (full.length > 60) return false;
                return Boolean(text && text.includes(partial));
              }

              function findWrapper(labelEl) {
                const wrapper = labelEl.closest(
                  '[class*="field"],[class*="Field"],[class*="row"],[class*="Row"],' +
                    '[class*="item"],[class*="Item"],[class*="property"],[class*="Property"]',
                );
                if (wrapper && wrapper.querySelector(FIELD_SELECTOR))
                  return wrapper;

                let node = labelEl.parentElement;
                for (
                  let depth = 0;
                  depth < 6 && node;
                  depth++, node = node.parentElement
                ) {
                  if (node.querySelector(FIELD_SELECTOR)) return node;
                }
                return null;
              }

              function getWrapperValue(wrapper) {
                if (!wrapper) return "";
                const input = wrapper.querySelector("input,select,textarea");
                if (input) {
                  if (input.tagName === "SELECT") {
                    const opt = input.selectedOptions?.[0];
                    return opt?.textContent || input.value || "";
                  }
                  return input.value || "";
                }
                const textEl = wrapper.querySelector(
                  '[class*="value"],[class*="Value"],[class*="selected"],' +
                    '[class*="select-value"],[class*="selectValue"],' +
                    '[class*="current"],[class*="display"],[class*="text"]',
                );
                return textEl?.textContent || "";
              }

              function optionTargets(target) {
                const t = normalizeText(target);
                const list = [t];
                if (t === "high") list.push("alta");
                if (t === "medium") list.push("media");
                if (t === "low") list.push("baja");
                if (t === "otros") list.push("other");
                return list;
              }

              function preferredOptionText(target) {
                const t = normalizeText(target);
                if (t === "high") return "Alta";
                if (t === "medium") return "Media";
                if (t === "low") return "Baja";
                if (t === "otros") return "Otros";
                return target;
              }

              function optionMatches(text, target) {
                const norm = normalizeText(text);
                return optionTargets(target).some((t) => t && norm.includes(t));
              }

              function getOptionText(option) {
                if (!option) return "";
                const direct =
                  option.getAttribute("data-value") ||
                  option.getAttribute("data-title") ||
                  option.getAttribute("title") ||
                  option.getAttribute("aria-label");
                if (direct) return direct;

                const valueEl = option.querySelector?.(
                  '[data-selector-id="box"],[data-id="boxComponent"],[class*="listitem-value"],.zd_v2-listitem-value',
                );
                if (valueEl?.textContent) return valueEl.textContent;

                const labelledBy = option.getAttribute("aria-labelledby");
                if (labelledBy) {
                  const labelEl = document.getElementById(labelledBy);
                  if (labelEl?.textContent) return labelEl.textContent;
                }

                return option.textContent || "";
              }

              function findOptionInScope(scope, optText) {
                const options = collectOptionElements(scope);
                for (const o of options) {
                  if (!isVisible(o)) continue;
                  if (optionMatches(getOptionText(o), optText)) return o;
                }
                return null;
              }

              async function scrollListForOption(listbox, optText) {
                if (!listbox) return null;
                const step = Math.max(
                  80,
                  Math.floor(listbox.clientHeight * 0.8),
                );
                const maxScrolls = 10;
                for (let i = 0; i < maxScrolls; i += 1) {
                  const found = findOptionInScope(listbox, optText);
                  if (found) return found;
                  listbox.scrollTop += step;
                  await wait(120);
                }
                listbox.scrollTop = 0;
                return null;
              }

              function findDropdownTrigger(labelEl) {
                const scopes = [];
                const wrapper = findWrapper(labelEl);
                if (wrapper) scopes.push(wrapper);
                if (labelEl.parentElement) scopes.push(labelEl.parentElement);
                for (const scope of scopes) {
                  const trigger = scope.querySelector(
                    DROPDOWN_TRIGGER_SELECTOR,
                  );
                  if (trigger && isVisible(trigger)) return trigger;
                }
                return null;
              }

              function getListboxFromTrigger(trigger) {
                const id =
                  trigger.getAttribute("aria-controls") ||
                  trigger.getAttribute("aria-owns");
                if (id) return document.getElementById(id);
                return null;
              }

              function getTextBoxValue(input) {
                return (
                  input?.value ||
                  input?.getAttribute("data-title") ||
                  input?.getAttribute("aria-activedescendant") ||
                  ""
                );
              }

              function fireOptionClick(option) {
                const events = ["pointerdown", "mousedown", "mouseup", "click"];
                for (const type of events) {
                  option.dispatchEvent(
                    new MouseEvent(type, {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                    }),
                  );
                }
              }

              function tryApplyValueToInput(input, optText, optionId) {
                if (!input) return false;
                const preferred = preferredOptionText(optText);
                setVal(input, preferred);
                if (optionId)
                  input.setAttribute("aria-activedescendant", optionId);
                input.setAttribute("data-title", preferred);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return optionMatches(getTextBoxValue(input), optText);
              }

              function collectOptionElements(scope) {
                const selectors = [
                  '[role="option"]',
                  '[role="menuitem"]',
                  "[data-value]",
                  "[data-title]",
                  '[data-selector-id="box"]',
                  '[data-id="boxComponent"]',
                  '[class*="listitem"]',
                  "li",
                  "button",
                  "div",
                  "span",
                ];
                return scope.querySelectorAll(selectors.join(","));
              }

              function findClickableOption(option) {
                if (!option) return null;
                return (
                  option.closest?.(
                    '[data-selector-id="box"],[data-id="boxComponent"],[class*="listitem"]',
                  ) || option
                );
              }

              function findZohoTextBox(partial) {
                const p = normalizeText(partial);
                let key = "";
                if (p.includes("prioridad")) key = "priority";
                if (p.includes("clasificaci")) key = "class";
                if (!key) return null;
                const inputs = document.querySelectorAll(
                  'input[data-id$="_textBox"],input[data-test-id$="_textBox"]',
                );
                for (const input of inputs) {
                  const dataId = (
                    input.getAttribute("data-id") || ""
                  ).toLowerCase();
                  const testId = (
                    input.getAttribute("data-test-id") || ""
                  ).toLowerCase();
                  if (dataId.includes(key) || testId.includes(key))
                    return input;
                }
                return null;
              }

              function tryTypeSelect(wrapper, optText) {
                const preferred = preferredOptionText(optText);
                const input = wrapper?.querySelector(
                  'input[type="text"],input[role="combobox"],input[aria-haspopup="listbox"]',
                );
                if (!input || !isVisible(input)) return false;
                if (!setVal(input, preferred)) return false;
                try {
                  input.dispatchEvent(
                    new KeyboardEvent("keydown", {
                      bubbles: true,
                      key: "Enter",
                      keyCode: 13,
                      which: 13,
                    }),
                  );
                } catch (_) {}
                return true;
              }

              // Walk UP from label to find the wrapping field container,
              // then DOWN inside that container to find the input.
              function nearbyField(labelEl) {
                const wrapper = findWrapper(labelEl);
                if (wrapper) {
                  const inp = wrapper.querySelector(FIELD_SELECTOR);
                  if (inp && inp !== labelEl && isVisible(inp)) return inp;
                }
                return null;
              }

              function fieldFor(partial) {
                const n = normalizeText(partial);
                // Prefer real <label> elements first — most precise
                for (const lbl of document.querySelectorAll("label")) {
                  if (!isVisible(lbl) || !textMatches(lbl, n)) continue;
                  const fid = lbl.getAttribute("for");
                  if (fid) {
                    const el = document.getElementById(fid);
                    if (el && isVisible(el)) return el;
                  }
                  const near = nearbyField(lbl);
                  if (near) return near;
                }
                // Fallback: elements with explicit label-like classes, short text only
                for (const lbl of document.querySelectorAll(
                  '[class*="label"],[class*="Label"],[class*="field-title"],[class*="fieldTitle"]',
                )) {
                  if (!isVisible(lbl) || !textMatches(lbl, n)) continue;
                  const near = nearbyField(lbl);
                  if (near) return near;
                }
                return null;
              }

              async function fillDropdown(partial, optText) {
                const directTextBox = findZohoTextBox(partial);
                if (directTextBox && isVisible(directTextBox)) {
                  directTextBox.click();
                  await wait(400);
                  const listbox = getListboxFromTrigger(directTextBox);
                  if (listbox) {
                    let option = findOptionInScope(listbox, optText);
                    if (!option)
                      option = await scrollListForOption(listbox, optText);
                    if (option) {
                      const clickable = findClickableOption(option);
                      fireOptionClick(clickable || option);
                      await wait(200);
                      if (
                        optionMatches(getTextBoxValue(directTextBox), optText)
                      )
                        return true;
                      return tryApplyValueToInput(
                        directTextBox,
                        optText,
                        option.id,
                      );
                    }
                  } else {
                    const option = findOptionInScope(document, optText);
                    if (option) {
                      const clickable = findClickableOption(option);
                      fireOptionClick(clickable || option);
                      await wait(200);
                      if (
                        optionMatches(getTextBoxValue(directTextBox), optText)
                      )
                        return true;
                      return tryApplyValueToInput(
                        directTextBox,
                        optText,
                        option.id,
                      );
                    }
                  }
                  if (tryApplyValueToInput(directTextBox, optText)) return true;
                }

                const sel = fieldFor(partial);
                if (sel && sel.tagName === "SELECT") {
                  const opt = Array.from(sel.options).find(
                    (o) =>
                      optionMatches(o.text, optText) ||
                      optionMatches(o.value, optText),
                  );
                  if (!opt) return false;
                  const setter = Object.getOwnPropertyDescriptor(
                    HTMLSelectElement.prototype,
                    "value",
                  )?.set;
                  if (setter) setter.call(sel, opt.value);
                  else sel.value = opt.value;
                  sel.dispatchEvent(new Event("change", { bubbles: true }));
                  const selected =
                    sel.selectedOptions?.[0]?.textContent || sel.value;
                  return optionMatches(selected, optText);
                }
                // Custom Zoho dropdown
                const n = normalizeText(partial);
                // Same precise label search as fieldFor
                const labelSets = [
                  document.querySelectorAll("label"),
                  document.querySelectorAll(
                    '[class*="label"],[class*="Label"],[class*="field-title"],[class*="fieldTitle"]',
                  ),
                ];
                for (const set of labelSets) {
                  for (const lbl of set) {
                    if (!isVisible(lbl) || !textMatches(lbl, n)) continue;
                    const wrapper = findWrapper(lbl);
                    const trigger = findDropdownTrigger(lbl);
                    if (trigger) {
                      trigger.click();
                      await wait(600);
                    }

                    const listScopes = document.querySelectorAll(
                      '[role="listbox"],[class*="dropdown-menu"],[class*="dropdownMenu"],' +
                        '[class*="select-list"],[class*="selectList"],' +
                        '[class*="picklist"],[class*="options"]',
                    );
                    const optionScopes = listScopes.length
                      ? Array.from(listScopes)
                      : [document];

                    const triggerListbox = trigger
                      ? getListboxFromTrigger(trigger)
                      : null;
                    const scopedOptions = triggerListbox
                      ? [triggerListbox]
                      : optionScopes;

                    for (const scope of scopedOptions) {
                      let option = findOptionInScope(scope, optText);
                      if (!option && scope === triggerListbox) {
                        option = await scrollListForOption(scope, optText);
                      }
                      if (!option) continue;

                      fireOptionClick(option);
                      await wait(200);
                      const valueNow = getWrapperValue(wrapper);
                      if (optionMatches(valueNow, optText)) return true;
                      const input = wrapper?.querySelector("input");
                      if (tryApplyValueToInput(input, optText, option.id))
                        return true;
                      return false;
                    }
                    if (wrapper && tryTypeSelect(wrapper, optText)) {
                      await wait(200);
                      const valueNow = getWrapperValue(wrapper);
                      return optionMatches(valueNow, optText);
                    }
                    const active = document.activeElement;
                    if (active && active.tagName === "INPUT") {
                      if (setVal(active, preferredOptionText(optText))) {
                        try {
                          active.dispatchEvent(
                            new KeyboardEvent("keydown", {
                              bubbles: true,
                              key: "Enter",
                              keyCode: 13,
                              which: 13,
                            }),
                          );
                        } catch (_) {}
                        await wait(200);
                        const valueNow = wrapper
                          ? getWrapperValue(wrapper)
                          : active.value;
                        return optionMatches(valueNow, optText);
                      }
                    }
                    document.body.click();
                    return false;
                  }
                }
                return false;
              }

              try {
                if (data.ocValue) {
                  const inp =
                    fieldFor("ordendecompra") ||
                    fieldFor("ordencompra") ||
                    fieldFor("orden");
                  if (setVal(inp, data.ocValue)) filled.push("Orden de Compra");
                  else failed.push("Orden de Compra");
                }
                if (data.priority) {
                  if (await fillDropdown("prioridad", data.priority))
                    filled.push("Prioridad");
                  else failed.push("Prioridad");
                }
                if (await fillDropdown("clasificaci", "Otros"))
                  filled.push("Clasificaciones");
                else failed.push("Clasificaciones");
                await wait(400);
                let saved = false;
                for (const btn of document.querySelectorAll(
                  'button,[role="button"],input[type=submit]',
                )) {
                  if (btn.textContent.trim().toLowerCase() === "guardar") {
                    btn.click();
                    saved = true;
                    break;
                  }
                }
                return { filled, failed, saved };
              } catch (e) {
                console.error("[EMChile fill]", e);
                return { filled, failed, saved: false };
              }
            },
            args: [request.data],
          });
          const merged = results
            .map((r) => r.result)
            .filter(Boolean)
            .reduce(
              (best, cur) =>
                (cur.filled?.length || 0) > (best.filled?.length || 0)
                  ? cur
                  : best,
              { filled: [], failed: [], saved: false },
            );
          sendResponse(merged || { filled: [], failed: [], saved: false });
        } catch (e) {
          sendResponse({ filled: [], failed: [e.message], saved: false });
        }
      })();
      return true;
    }
  }
});

// ─── Core analysis ────────────────────────────────────────────────────────────
async function analyzeTicket(ticketData) {
  const settings = await getSettings();

  if (!settings.apiKey || !settings.apiKey.startsWith("sk-")) {
    throw new Error(
      "API Key no configurada. Haz clic en el ícono ⚡ de la extensión para agregarla.",
    );
  }

  const model = settings.model || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(settings) },
        { role: "user", content: buildUserPrompt(ticketData) },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    let msg = `Error HTTP ${response.status}`;
    try {
      const err = await response.json();
      if (err.error?.message) msg = err.error.message;
      if (response.status === 401)
        msg = "API Key inválida o revocada. Verifica tu clave en los ajustes.";
      if (response.status === 429)
        msg =
          "Límite de solicitudes alcanzado. Espera un momento e intenta de nuevo.";
      if (response.status === 503)
        msg = "OpenAI no disponible. Intenta en unos minutos.";
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content)
    throw new Error("Respuesta vacía del modelo. Intenta nuevamente.");

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error(
      "Formato de respuesta inválido del modelo. Intenta nuevamente.",
    );
  }

  // Validate required fields
  if (!result.clientReply || !result.internalMessage) {
    throw new Error("Respuesta incompleta del modelo. Intenta nuevamente.");
  }

  result = normalizeAnalysis(ticketData, result);

  await saveToHistory(ticketData, result);
  return result;
}

// ─── Custom prompt analysis ───────────────────────────────────────────────────
async function customPromptAnalyze({
  ticketData,
  currentResult,
  userPrompt,
  persistentContext,
  attachment,
}) {
  const settings = await getSettings();

  if (!settings.apiKey || !settings.apiKey.startsWith("sk-")) {
    throw new Error(
      "API Key no configurada. Haz clic en el ícono ⚡ de la extensión para agregarla.",
    );
  }

  // Force gpt-4o when an image/PDF is attached — vision is required
  const model = attachment ? "gpt-4o" : settings.model || "gpt-4o-mini";
  const cleanUserPrompt = sanitizeAgentInstruction(userPrompt);
  const cleanPersistentContext = sanitizeAgentInstruction(persistentContext);

  const systemMsg = `Eres un asistente de soporte especializado para el equipo de postventa de EMChile. \
Se te proporcionará el contexto completo de un ticket de Zoho Desk (conversación, datos del cliente, órdenes de compra, etc.) \
junto con una instrucción específica del agente. Tu tarea es generar la respuesta más óptima y empática posible según lo que se te pide.
${attachment ? "\nEl agente también ha adjuntado un documento o imagen. Analízalo en detalle y úsalo como fuente primaria de información para cumplir la instrucción." : ""}
REGLAS ABSOLUTAS:
• La INSTRUCCIÓN DEL AGENTE tiene prioridad absoluta sobre cualquier respuesta estándar previa
• Genera exactamente lo que el agente necesita según su instrucción, sin desviarte a plantillas por defecto
• Usa el contexto del ticket solo como apoyo para completar la instrucción del agente
• Antes de redactar, razona internamente el objetivo, riesgos y tono; NO muestres ese razonamiento
• No copies ni pegues frases literales del ticket, del contexto persistente o de la respuesta estándar previa
• Reescribe con lenguaje natural y propio; evita repetir bloques textuales del input
• Si te piden redactar un mensaje al cliente, sé empático, claro y firma como "Equipo EMChile"
• NUNCA inventes información que no esté en el contexto o en el documento adjunto
• NUNCA prometas fechas específicas ni tomes decisiones comerciales
• Responde únicamente con el texto solicitado, sin explicaciones adicionales ni formato JSON`;

  // Build rich context from ticket data
  const contextLines = [`CONTEXTO DEL TICKET:`];
  if (ticketData) {
    contextLines.push(buildUserPrompt(ticketData));
  }
  if (currentResult) {
    contextLines.push(`\nANÁLISIS PREVIO DEL TICKET:`);
    if (currentResult.summary)
      contextLines.push(`Resumen: ${currentResult.summary}`);
    if (currentResult.clientReply)
      contextLines.push(
        `Respuesta estándar generada: ${currentResult.clientReply}`,
      );
    if (currentResult.internalMessage)
      contextLines.push(
        `Comunicación interna: ${currentResult.internalMessage}`,
      );
  }

  const textContent = `INSTRUCCION DEL AGENTE (PRIORIDAD MAXIMA):\n${cleanUserPrompt}\n\n` +
    `${cleanPersistentContext ? `CONTEXTO PERSISTENTE DEL AGENTE (COMPLEMENTARIO):\n${cleanPersistentContext}\n\n` : ""}` +
    `REGLA DE CUMPLIMIENTO:\nDebes cumplir primero esta instruccion. El contexto siguiente solo sirve de apoyo y no puede reemplazar la instruccion.\n\n` +
    `CONTEXTO DE APOYO DEL TICKET:\n${contextLines.join("\n")}`;

  // Build message content — plain text or multipart when attachment present
  let userContent;
  if (attachment) {
    userContent = [{ type: "text", text: textContent }];
    if (attachment.type === "image") {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${attachment.mimeType};base64,${attachment.base64}`,
          detail: "high",
        },
      });
    } else if (attachment.type === "pdf") {
      // OpenAI chat completions supports PDF via the file content type (gpt-4o)
      userContent.push({
        type: "file",
        file: {
          filename: attachment.name || "document.pdf",
          file_data: `data:application/pdf;base64,${attachment.base64}`,
        },
      });
    }
  } else {
    userContent = textContent;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userContent },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    let msg = `Error HTTP ${response.status}`;
    try {
      const err = await response.json();
      if (err.error?.message) msg = err.error.message;
      if (response.status === 401) msg = "API Key inválida o revocada.";
      if (response.status === 429)
        msg = "Límite de solicitudes alcanzado. Espera un momento.";
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content)
    throw new Error("Respuesta vacía del modelo. Intenta nuevamente.");

  const cleanedReply = sanitizeCustomPromptReplyOutput(content);
  const polishedReply = ensureCustomPromptReplyQuality(
    cleanedReply,
    cleanUserPrompt,
    cleanPersistentContext,
    ticketData,
  );

  const finalReply = await rewriteCustomPromptReplyIfNeeded({
    reply: polishedReply,
    userPrompt: cleanUserPrompt,
    persistentContext: cleanPersistentContext,
    ticketData,
    currentResult,
    settings,
    model,
  });

  return { reply: finalReply };
}

function sanitizeAgentInstruction(userPrompt) {
  return String(userPrompt || "")
    .replace(/\[\s*CONTEXTO\s+PERSONALIZADO\s+PERSISTENTE\s*\]/gi, "")
    .replace(/[\n\r]{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sanitizeCustomPromptReplyOutput(rawReply) {
  return String(rawReply || "")
    .replace(/\[\s*CONTEXTO\s+PERSONALIZADO\s+PERSISTENTE\s*\]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureCustomPromptReplyQuality(
  rawReply,
  userPrompt,
  persistentContext,
  ticketData,
) {
  const reply = String(rawReply || "").trim();
  if (!reply) return reply;

  const lines = reply
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sentenceCount = reply
    .split(/[\.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;

  const looksTooShort = reply.length < 90 || lines.length <= 1 || sentenceCount < 2;
  if (!looksTooShort) return reply;

  const customer =
    ticketData?.customerName && ticketData.customerName !== "No detectado"
      ? ticketData.customerName
      : "cliente";

  const ocText = Array.isArray(ticketData?.ocNumbers) && ticketData.ocNumbers.length
    ? ` para la${ticketData.ocNumbers.length > 1 ? "s" : ""} OC ${ticketData.ocNumbers.join(", ")}`
    : "";

  const intent = buildAgentClientContextSentence(userPrompt || "");
  const context = intent || String(userPrompt || "").trim();
  const persistent = buildAgentClientContextSentence(persistentContext || "");

  return [
    `Estimado/a ${customer},`,
    "",
    context,
    persistent,
    `Gracias por contactarnos. Hemos revisado su solicitud${ocText}.`,
    "Estamos gestionando su caso con el area correspondiente y le compartiremos una actualizacion a la brevedad.",
    "",
    "Saludos cordiales,",
    "Equipo EMChile",
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function rewriteCustomPromptReplyIfNeeded({
  reply,
  userPrompt,
  persistentContext,
  ticketData,
  currentResult,
  settings,
  model,
}) {
  const currentReply = String(reply || "").trim();
  if (!currentReply) return currentReply;

  const sourceTexts = [
    String(userPrompt || ""),
    String(persistentContext || ""),
    String(ticketData?.conversation || ""),
    String(currentResult?.clientReply || ""),
    String(currentResult?.summary || ""),
  ].filter(Boolean);

  const needsRewrite =
    looksLikePromptEcho(currentReply) ||
    hasHighVerbatimOverlap(currentReply, sourceTexts);

  if (!needsRewrite) return currentReply;

  const rewriteSystem = `Eres editor senior de postventa EMChile. Reescribe respuestas para que queden naturales, humanas y profesionales.
REGLAS:
• Mantén el mismo objetivo y datos clave
• No copies frases literales del texto fuente
• Evita muletillas y repeticiones
• Si es respuesta al cliente, mantén tono cordial y firma "Equipo EMChile"
• Entrega solo el texto final`;

  const rewriteUser = [
    "OBJETIVO DEL AGENTE:",
    userPrompt || "(sin objetivo explícito)",
    "",
    persistentContext ? "CONTEXTO PERSISTENTE:\n" + persistentContext + "\n" : "",
    "BORRADOR A REESCRIBIR:",
    currentReply,
    "",
    "Instrucción final: reescribe completamente con redacción propia, sin copiar frases exactas del borrador ni del contexto.",
  ]
    .filter(Boolean)
    .join("\n");

  const rewriteResponse = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: rewriteSystem },
        { role: "user", content: rewriteUser },
      ],
      temperature: 0.35,
    }),
  });

  if (!rewriteResponse.ok) return currentReply;

  const rewriteData = await rewriteResponse.json();
  const rewritten = sanitizeCustomPromptReplyOutput(
    rewriteData?.choices?.[0]?.message?.content || "",
  );

  return rewritten || currentReply;
}

function looksLikePromptEcho(text) {
  const normalized = normalizeForComparison(text);
  return (
    normalized.includes("instruccion del agente") ||
    normalized.includes("contexto de apoyo del ticket") ||
    normalized.includes("regla de cumplimiento")
  );
}

function hasHighVerbatimOverlap(reply, sources) {
  const out = normalizeLoose(reply);
  if (!out) return false;

  for (const src of sources) {
    const srcSentences = splitSentences(src);
    for (const sentence of srcSentences) {
      const normSentence = normalizeLoose(sentence);
      if (!normSentence) continue;
      // Long copied chunks are a strong signal of copy/paste behavior.
      if (normSentence.length >= 70 && out.includes(normSentence)) {
        return true;
      }
    }
  }

  return false;
}

function splitSentences(text) {
  return String(text || "")
    .split(/[\n\.!?;:]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeLoose(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Prompts ──────────────────────────────────────────────────────────────────
function buildSystemPrompt(settings) {
  if (settings.useCustomPrompt && settings.customPrompt?.trim()) {
    return settings.customPrompt.trim();
  }

  return `Eres un asistente de IA especializado para el equipo de postventa de EMChile, empresa chilena que gestiona tickets de atención al cliente en Zoho Desk.

Tu función es analizar tickets y generar tres salidas estructuradas: respuesta al cliente externo, comunicación interna para el equipo, y un resumen ejecutivo.

══════════════════════════════════════════
 REGLAS ABSOLUTAS (nunca se violan)
══════════════════════════════════════════
• NUNCA prometas fechas específicas de entrega, despacho o resolución
• NUNCA tomes decisiones comerciales, técnicas ni operativas
• NUNCA inventes datos que no estén en el ticket
• NUNCA uses tecnicismos internos en la respuesta al cliente
• Mantén estricta separación de salidas: clientReply solo para cliente, internalMessage solo para comunicación interna
• La respuesta al cliente SIEMPRE termina firmada como "Equipo EMChile"
• Si el caso es ambiguo, incompleto o sensible → establece shouldReply = false

══════════════════════════════════════════
 PRIORIZACIÓN DE RIESGO
══════════════════════════════════════════
• Si el ticket menciona multa, sanción, incumplimiento, descargos, notificación formal, resolución exenta, cobranza, devolución por calidad, productos defectuosos, o un plazo legal/administrativo, eso es PRIORIDAD MÁXIMA
• En esos casos, el summary DEBE mencionarlo explícitamente en la primera oración
• En esos casos, internalMessage DEBE dejar explícito que existe riesgo de multa, sanción o incumplimiento
• En esos casos sensibles o con riesgo legal/comercial, shouldReply debe tender a false salvo que la acción de respuesta sea inequívoca y segura
• Nunca ocultes ni minimices una multa o procedimiento sancionatorio detrás de un resumen genérico

══════════════════════════════════════════
 COMUNICACIÓN EXTERNA (clientReply)
══════════════════════════════════════════
• Tono cordial, claro, directo y empático
• Si el ticket menciona más de una OC, la respuesta al cliente debe reconocer explícitamente que la solicitud aplica a todas las OCs detectadas
• Si falta información → solicitar al cliente de forma específica y concisa
• Si hay retraso → reconocer brevemente sin justificar en exceso
• Si piden fecha exacta → indicar que se gestiona sin comprometer un plazo
• Si el cliente está molesto → aumentar empatía, reducir formalidad
• Para despachos/envíos → "hemos escalado al área correspondiente para gestionar"
• Para muestras sin stock → indicar que se verifica disponibilidad
• Lenguaje simple, sin tecnicismos, sin jerga interna

══════════════════════════════════════════
 COMUNICACIÓN INTERNA (internalMessage)
══════════════════════════════════════════
• Primera línea OBLIGATORIA: #[ID_TICKET] – ID OC [número si existe / "sin OC" si no]
• Si hay más de una OC detectada, incluye TODAS las OCs exactas en esa primera línea separadas por comas
• Una OC válida en EMChile termina en uno de estos sufijos: AG25, AG26, COT25, LE, LP, SE, LE25, LP25, SE25, LE26, LP26, SE26, LR25, LR26
• Lista concisa: qué solicita el cliente y qué información falta para resolver
• NO dar instrucciones al equipo, NO tomar decisiones, NO repetir lo obvio
• Lenguaje técnico interno permitido
• Máximo 8 líneas
• No escribas frases genéricas como "no hay información de contacto" o "no hay estado" salvo que sea estrictamente relevante para resolver el caso

══════════════════════════════════════════
 CLASIFICACIÓN (campo category)
══════════════════════════════════════════
• "muestras"     → solicitud/seguimiento de muestras de productos
• "despacho"     → envíos, logística, seguimiento de despacho, delivery
• "produccion"   → tiempos de fabricación, estado de producción, manufactura
• "informacion"  → consultas generales, dudas, cotizaciones, precios

══════════════════════════════════════════
 INDICADORES
══════════════════════════════════════════
• shouldReply: false si el caso es ambiguo, faltan datos clave, o es sensible
• confidence: 0-100 refleja qué tan completa y clara es la información del ticket

RESPONDE ÚNICAMENTE con un objeto JSON válido con esta estructura exacta (sin texto extra):
{
  "summary": "Resumen ejecutivo del ticket en 2-3 oraciones concretas",
  "clientReply": "Respuesta completa y lista para enviar al cliente",
  "internalMessage": "#TICKETID – ID OC NÚMERO\\n• punto 1\\n• punto 2",
  "shouldReply": true,
  "confidence": 85,
  "category": "despacho"
}`;
}

function buildUserPrompt(ticketData) {
  const lines = [`TICKET ID: ${ticketData.ticketId || "No detectado"}`];
  const conversationText =
    ticketData.conversation || "No se pudo extraer la conversación del ticket.";
  const criticalSignals = detectCriticalSignals(
    `${ticketData.subject || ""}\n${conversationText}\n${ticketData.additionalData || ""}`,
  );

  if (ticketData.subject) lines.push(`ASUNTO: ${ticketData.subject}`);
  if (ticketData.customerName && ticketData.customerName !== "No detectado") {
    lines.push(`CLIENTE: ${ticketData.customerName}`);
  }
  if (ticketData.customerEmail && ticketData.customerEmail !== "No detectado") {
    lines.push(`EMAIL: ${ticketData.customerEmail}`);
  }
  if (ticketData.status && ticketData.status !== "No detectado") {
    lines.push(`ESTADO: ${ticketData.status}`);
  }
  if (ticketData.priority && ticketData.priority !== "No detectada") {
    lines.push(`PRIORIDAD: ${ticketData.priority}`);
  }
  if (ticketData.createdAt && ticketData.createdAt !== "No detectada") {
    lines.push(`FECHA CREACIÓN: ${ticketData.createdAt}`);
  }

  // Explicitly list extracted OC numbers so the AI always sees them
  if (ticketData.ocNumbers && ticketData.ocNumbers.length) {
    lines.push("");
    lines.push(
      `ÓRDENES DE COMPRA DETECTADAS EN EL TICKET (${ticketData.ocNumbers.length}):`,
    );
    ticketData.ocNumbers.forEach((oc, i) => lines.push(`  OC ${i + 1}: ${oc}`));
    lines.push(
      "IMPORTANTE: Usa estos números exactos en la comunicación interna y no los reemplaces por 'sin OC'.",
    );
    lines.push(
      "IMPORTANTE: Solo consideres como OC válidas las que terminan en AG25, AG26, COT25, COT26, LE, LP, SE, LE25, LP25, SE25, LE26, LP26, SE26, LR25 o LR26.",
    );
    if (ticketData.ocNumbers.length > 1) {
      lines.push(
        "IMPORTANTE: La respuesta al cliente debe dejar claro que la solicitud corresponde a TODAS las OCs detectadas, no solo a una.",
      );
    }
  }

  if (criticalSignals.length) {
    lines.push("");
    lines.push(`SEÑALES CRÍTICAS DETECTADAS (${criticalSignals.length}):`);
    criticalSignals.forEach((signal, i) => lines.push(`  ${i + 1}. ${signal}`));
    lines.push(
      "IMPORTANTE: Si existe multa, sanción, incumplimiento o plazo de descargos, el summary debe mencionarlo explícitamente en la primera oración.",
    );
  }

  lines.push("", "CONVERSACIÓN COMPLETA:", conversationText);

  if (ticketData.additionalData) {
    lines.push("", "CAMPOS ADICIONALES DEL TICKET:", ticketData.additionalData);
  }

  lines.push(
    "",
    "Genera el análisis siguiendo estrictamente las reglas EMChile.",
  );
  return lines.join("\n");
}

function detectCriticalSignals(text) {
  const normalized = String(text || "").toLowerCase();
  const signalPatterns = [
    { pattern: /multa|multas/, label: "Mención de multa o multas" },
    {
      pattern: /sanci[oó]n|sanciones/,
      label: "Mención de sanción o sanciones",
    },
    {
      pattern: /incumplimiento|incumple|incumplido/,
      label: "Mención de incumplimiento",
    },
    { pattern: /descargos?/, label: "Existe plazo o solicitud de descargos" },
    {
      pattern: /procedimiento de aplicaci[oó]n de multa/,
      label: "Inicio de procedimiento de aplicación de multa",
    },
    { pattern: /resoluci[oó]n exenta/, label: "Mención de resolución exenta" },
    {
      pattern: /notificaci[oó]n|notifica/,
      label: "Existe notificación formal",
    },
    {
      pattern: /productos defectuosos|deficiencias en su calidad|mal estado/,
      label: "Mención de productos defectuosos o problemas de calidad",
    },
    {
      pattern: /plazo.*48 horas|48 horas/,
      label: "Existe plazo de 48 horas u otro plazo administrativo",
    },
    {
      pattern: /devoluci[oó]n|devolver/,
      label: "Mención de devolución de productos",
    },
  ];

  return signalPatterns
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ label }) => label);
}

function normalizeAnalysis(ticketData, result) {
  const normalized = {
    ...result,
    summary: String(result.summary || "").trim(),
    clientReply: String(result.clientReply || "").trim(),
    internalMessage: String(result.internalMessage || "").trim(),
    shouldReply:
      typeof result.shouldReply === "boolean" ? result.shouldReply : true,
    confidence: clampConfidence(result.confidence),
  };

  const criticalContext = getCriticalContext(ticketData);

  if (criticalContext.hasRisk) {
    normalized.summary = ensureCriticalSummary(
      normalized.summary,
      criticalContext,
      ticketData,
    );
    normalized.internalMessage = ensureCriticalInternalMessage(
      normalized.internalMessage,
      criticalContext,
      ticketData,
    );
    normalized.shouldReply = false;
    normalized.confidence = Math.min(normalized.confidence, 65);
    normalized.riskAlert = buildRiskAlert(criticalContext, ticketData);
  } else {
    normalized.riskAlert = null;
  }

  normalized.clientReply = ensureClientReplyCompleteness(
    normalized.clientReply,
    ticketData,
  );
  normalized.clientReply = ensureAgentClientContext(
    normalized.clientReply,
    ticketData,
  );

  normalized.internalMessage = ensureAgentInternalContext(
    normalized.internalMessage,
    ticketData,
  );

  return normalized;
}

function ensureClientReplyCompleteness(clientReply, ticketData) {
  const text = String(clientReply || "").trim();
  const normalized = normalizeForComparison(text);
  const sentenceCount = text
    .split(/[\.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  const lineCount = text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean).length;

  const looksTooShort =
    text.length < 80 ||
    sentenceCount < 2 ||
    lineCount <= 1 ||
    /^estimad[oa]/i.test(text) ||
    /^hola\b/i.test(text) ||
    normalized === "";

  if (!looksTooShort) return text;

  const customer =
    ticketData?.customerName && ticketData.customerName !== "No detectado"
      ? ticketData.customerName
      : "cliente";
  const subject = String(ticketData?.subject || "su solicitud").trim();
  const hasOc = Array.isArray(ticketData?.ocNumbers) && ticketData.ocNumbers.length;
  const ocText = hasOc
    ? ` para la${ticketData.ocNumbers.length > 1 ? "s" : ""} OC ${ticketData.ocNumbers.join(", ")}`
    : "";

  return [
    `Estimado/a ${customer},`,
    "",
    `Gracias por contactarnos. Hemos recibido ${subject}${ocText}.`,
    "Estamos gestionando su caso con el area correspondiente para entregar una actualizacion a la brevedad.",
    "Le mantendremos informado/a sobre el avance.",
    "",
    "Saludos cordiales,",
    "Equipo EMChile",
  ].join("\n");
}

function ensureAgentClientContext(clientReply, ticketData) {
  const clientContext = String(ticketData?.responseContext?.client || "").trim();
  if (!clientContext) return String(clientReply || "").trim();

  const reply = String(clientReply || "").trim();
  if (!reply) return reply;

  const replyNorm = normalizeForComparison(reply);
  const ctxNorm = normalizeForComparison(clientContext);
  const contextSentence = buildAgentClientContextSentence(clientContext);
  const ctxSentenceNorm = normalizeForComparison(contextSentence);
  if (
    (ctxNorm && replyNorm.includes(ctxNorm)) ||
    (ctxSentenceNorm && replyNorm.includes(ctxSentenceNorm))
  ) {
    return reply;
  }

  const lines = reply.split("\n");

  // Try to place context right after greeting block for better readability.
  let insertAt = 0;
  while (insertAt < lines.length && !lines[insertAt].trim()) insertAt += 1;
  if (insertAt < lines.length) insertAt += 1;
  while (insertAt < lines.length && !lines[insertAt].trim()) insertAt += 1;

  lines.splice(insertAt, 0, "", contextSentence);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildAgentClientContextSentence(clientContext) {
  let ctx = String(clientContext || "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!ctx) return "";

  // Keep the user's wording as the main source, with minimal tone adaptation.
  ctx = ctx
    .replace(/^disculpate\b[:\s-]*/i, "Nos disculpamos ")
    .replace(/^disculparse\b[:\s-]*/i, "Nos disculpamos ")
    .replace(/^disculpa(?:nos)?\b[:\s-]*/i, "Nos disculpamos ")
    .replace(/\bteniamos\b/gi, "tuvimos");

  if (ctx.length) {
    ctx = ctx.charAt(0).toUpperCase() + ctx.slice(1);
  }
  return ctx.endsWith(".") ? ctx : `${ctx}.`;
}

function getCriticalContext(ticketData) {
  const text = `${ticketData.subject || ""}\n${ticketData.conversation || ""}\n${ticketData.additionalData || ""}`;
  const normalized = text.toLowerCase();
  const signals = detectCriticalSignals(text);
  const hasPenalty =
    /multa|multas|sanci[oó]n|sanciones|procedimiento de aplicaci[oó]n de multa/.test(
      normalized,
    );
  const hasBreach =
    /incumplimiento|productos defectuosos|deficiencias en su calidad|mal estado/.test(
      normalized,
    );
  const hasDeadline = /descargos?|48 horas|plazo/.test(normalized);
  const hasFormalNotice = /notificaci[oó]n|resoluci[oó]n exenta/.test(
    normalized,
  );
  const amountMatch = text.match(/\$\s?[\d\.]+/g) || [];

  return {
    hasRisk: hasPenalty || (hasBreach && hasDeadline) || hasFormalNotice,
    hasPenalty,
    hasBreach,
    hasDeadline,
    hasFormalNotice,
    signals,
    amounts: amountMatch,
  };
}

function ensureCriticalSummary(summary, criticalContext, ticketData) {
  const lower = summary.toLowerCase();
  if (
    /(multa|sanci[oó]n|incumplimiento|descargos?|notificaci[oó]n formal)/.test(
      lower,
    )
  ) {
    return summary;
  }

  const ocText = ticketData.ocNumbers?.length
    ? ` para la${ticketData.ocNumbers.length > 1 ? "s OCs" : " OC"} ${ticketData.ocNumbers.join(", ")}`
    : "";

  let lead = `Ticket sensible por procedimiento de multa y/o incumplimiento${ocText}.`;
  if (criticalContext.hasPenalty && criticalContext.hasDeadline) {
    lead = `Ticket sensible: existe notificación de multa${ocText} y plazo para presentar descargos.`;
  } else if (criticalContext.hasPenalty) {
    lead = `Ticket sensible: existe riesgo de multa o sanción${ocText}.`;
  } else if (criticalContext.hasBreach) {
    lead = `Ticket sensible por incumplimiento y observaciones de calidad${ocText}.`;
  }

  return `${lead} ${summary}`.trim();
}

function ensureCriticalInternalMessage(
  internalMessage,
  criticalContext,
  ticketData,
) {
  const lines = String(internalMessage || "")
    .split("\n")
    .filter(Boolean);
  const firstLine = lines[0] || buildFallbackInternalHeader(ticketData);
  const rest = lines.slice(1);
  const combined = rest.join(" ").toLowerCase();

  if (!/(multa|sanci[oó]n|incumplimiento|descargos?)/.test(combined)) {
    const bullet = buildCriticalInternalBullet(criticalContext);
    rest.unshift(`• ${bullet}`);
  }

  return [firstLine, ...rest].join("\n");
}

function ensureAgentInternalContext(internalMessage, ticketData) {
  const internalContext = String(ticketData?.responseContext?.internal || "").trim();
  if (!internalContext) return internalMessage;

  const normalizedContext = normalizeForComparison(internalContext);
  if (isInternalDataExtractionIntent(normalizedContext)) {
    return buildInternalDataExtractionMessage(ticketData, internalMessage);
  }

  const lines = String(internalMessage || "")
    .split("\n")
    .filter(Boolean);
  const firstLine = lines[0] || buildFallbackInternalHeader(ticketData);
  const rest = lines.slice(1);
  const existing = normalizeForComparison(rest.join(" "));
  const ctxNorm = normalizeForComparison(internalContext);

  if (ctxNorm && existing.includes(ctxNorm)) {
    return [firstLine, ...rest].join("\n");
  }

  const bullet = buildAgentInternalContextBullet(internalContext);
  // Keep this context near the top so it is visible and actionable.
  rest.unshift(`• ${bullet}`);
  return [firstLine, ...rest].join("\n");
}

function buildAgentInternalContextBullet(internalContext) {
  const ctx = String(internalContext || "").trim();
  const normalized = normalizeForComparison(ctx);

  if (/pedido|orden|oc/.test(normalized) && /figura(n)? en produccion|produccion/.test(normalized)) {
    return 'Pedido dice figurar "en Produccion en sistema".';
  }

  if (/figura(n)? en produccion|produccion/.test(normalized)) {
    return 'Pedido figura "en Produccion en sistema".';
  }

  const clean = ctx.replace(/[\n\r]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return clean.endsWith(".") ? `Contexto agente: ${clean}` : `Contexto agente: ${clean}.`;
}

function isInternalDataExtractionIntent(normalizedContext) {
  return /dame|extrae|listar|lista|muestra|indica/.test(normalizedContext) &&
    /(datos|info|informacion|senal|senala|cliente)/.test(normalizedContext);
}

function buildInternalDataExtractionMessage(ticketData, internalMessage) {
  const lines = String(internalMessage || "")
    .split("\n")
    .filter(Boolean);
  const header = lines[0] || buildFallbackInternalHeader(ticketData);
  const textPool = [
    ticketData?.subject || "",
    ticketData?.conversation || "",
    ticketData?.additionalData || "",
  ].join("\n");

  const extracted = extractInternalOperationalData(textPool);
  const bullets = [];

  if (extracted.address) {
    bullets.push(`• Direccion de retiro reportada: ${extracted.address}`);
  }
  if (extracted.schedule) {
    bullets.push(`• Horario reportado: ${extracted.schedule}`);
  }
  if (extracted.responsible) {
    bullets.push(`• Responsable reportado: ${extracted.responsible}`);
  }
  if (extracted.availability) {
    bullets.push(`• Estado de disponibilidad: ${extracted.availability}`);
  }
  if (extracted.extra.length) {
    extracted.extra.forEach((item) => bullets.push(`• ${item}`));
  }

  if (!bullets.length) {
    bullets.push("• No se identifican datos operativos explicitos del cliente en el ticket.");
  }

  return [header, ...bullets].join("\n");
}

function extractInternalOperationalData(text) {
  const source = String(text || "");
  const normalizedLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const valueAfterLine = (lineRegex) => {
    for (let i = 0; i < normalizedLines.length; i += 1) {
      if (!lineRegex.test(normalizedLines[i])) continue;
      for (let j = i + 1; j < Math.min(i + 4, normalizedLines.length); j += 1) {
        const candidate = normalizedLines[j];
        if (!candidate || lineRegex.test(candidate)) continue;
        if (candidate.length < 3) continue;
        return sanitizeInternalDataValue(candidate);
      }
    }
    return "";
  };

  const valueInSameLine = (regex) => {
    const hit = source.match(regex);
    return sanitizeInternalDataValue(hit?.[1] || "");
  };

  const address =
    valueInSameLine(/direcci[oó]n(?: exacta)?[^:\n]*[:\-]\s*([^\n\r]+)/i) ||
    valueAfterLine(/direcci[oó]n(?: exacta)?/i);

  const schedule =
    valueInSameLine(/horario[^:\n]*[:\-]\s*([^\n\r]+)/i) ||
    valueAfterLine(/horario/i);

  const responsible =
    valueInSameLine(/nombre de la persona responsable[^:\n]*[:\-]\s*([^\n\r]+)/i) ||
    valueAfterLine(/nombre de la persona responsable/i);

  const availability =
    valueInSameLine(/confirmaci[oó]n[^:\n]*[:\-]\s*([^\n\r]+)/i) ||
    valueAfterLine(/confirmaci[oó]n.*(disponible|retiro)/i);

  const extra = [];
  const directAttendance = source.match(/presentarse directamente[^\n\r]*/i)?.[0];
  if (directAttendance) {
    extra.push(sanitizeInternalDataValue(directAttendance));
  }

  return { address, schedule, responsible, availability, extra };
}

function sanitizeInternalDataValue(value) {
  const clean = String(value || "")
    .replace(/[\t ]{2,}/g, " ")
    .replace(/^[•\-:\s]+/, "")
    .trim();
  if (!clean) return "";
  return clean.endsWith(".") ? clean : `${clean}.`;
}

function normalizeForComparison(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFallbackInternalHeader(ticketData) {
  const ticketId = ticketData.ticketId || "SIN-ID";
  const ocText = ticketData.ocNumbers?.length
    ? ticketData.ocNumbers.join(", ")
    : "sin OC";
  return `#${ticketId} – ID OC ${ocText}`;
}

function buildCriticalInternalBullet(criticalContext) {
  if (criticalContext.hasPenalty && criticalContext.hasDeadline) {
    return "Existe procedimiento de multa/notificación formal con plazo de descargos.";
  }
  if (criticalContext.hasPenalty) {
    return "Existe riesgo de multa o sanción asociado al incumplimiento.";
  }
  if (criticalContext.hasBreach) {
    return "Se reporta incumplimiento y/o productos observados por calidad.";
  }
  return "Caso sensible con riesgo administrativo/comercial.";
}

function buildRiskAlert(criticalContext, ticketData) {
  const labels = [];
  if (criticalContext.hasPenalty) labels.push("Multa / Sanción");
  if (criticalContext.hasDeadline) labels.push("Plazo de descargos");
  if (criticalContext.hasBreach) labels.push("Incumplimiento / Calidad");
  if (criticalContext.hasFormalNotice) labels.push("Notificación formal");

  const uniqueLabels = [...new Set(labels)];
  const title = uniqueLabels.length
    ? `RIESGO ALTO · ${uniqueLabels.join(" · ")}`
    : "RIESGO ALTO · Caso sensible";

  const ocText = ticketData.ocNumbers?.length
    ? `OC${ticketData.ocNumbers.length > 1 ? "s" : ""}: ${ticketData.ocNumbers.join(", ")}`
    : null;

  return {
    level: "high",
    title,
    reasons: [
      ...criticalContext.signals.slice(0, 4),
      ...(ocText ? [ocText] : []),
    ],
  };
}

function clampConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 75;
  return Math.max(0, Math.min(100, Math.round(num)));
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
function getSettings() {
  return new Promise((resolve) =>
    chrome.storage.local.get(
      ["apiKey", "model", "customPrompt", "useCustomPrompt"],
      resolve,
    ),
  );
}

async function saveToHistory(ticketData, result) {
  const stored = await new Promise((resolve) =>
    chrome.storage.local.get(["analysisHistory"], resolve),
  );
  const history = stored.analysisHistory || [];
  const entry = {
    id: Date.now(),
    ticketId: ticketData.ticketId,
    subject: ticketData.subject,
    timestamp: new Date().toISOString(),
    result,
  };
  const updated = [entry, ...history].slice(0, 50); // keep last 50
  await new Promise((resolve) =>
    chrome.storage.local.set({ analysisHistory: updated }, resolve),
  );
}
