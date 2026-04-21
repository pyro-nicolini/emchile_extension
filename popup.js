'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Popup Settings Script
// ═══════════════════════════════════════════════════════════════════════════════

function initPopup() {

  // ── Element refs (after DOM is ready) ─────────────────────────────────────
  const apiKeyInput = document.getElementById('p-apikey');
  const eyeBtn      = document.getElementById('p-eye');
  const modelSelect = document.getElementById('p-model');
  const useCustomCb = document.getElementById('p-use-custom');
  const customBlock = document.getElementById('p-custom-block');
  const customArea  = document.getElementById('p-custom');
  const saveBtn     = document.getElementById('p-save');
  const clearBtn    = document.getElementById('p-clear-hist');
  const statusEl    = document.getElementById('p-status');

  // Safety check — abort silently if HTML doesn't match
  if (!apiKeyInput || !saveBtn) {
    console.error('[EMChile] popup elements not found');
    return;
  }

  // ── Load saved settings ──────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function (prefs = {}) {
    if (chrome.runtime.lastError) {
      console.error('[EMChile] load error:', chrome.runtime.lastError.message);
      showStatus('✗ Error cargando configuración', 'warn');
      return;
    }
    if (prefs.apiKey) apiKeyInput.value = prefs.apiKey;
    if (prefs.model) modelSelect.value = prefs.model;
    if (prefs.customPrompt) customArea.value = prefs.customPrompt;
    useCustomCb.checked = !!prefs.useCustomPrompt;
    customBlock.classList.toggle('hidden', !prefs.useCustomPrompt);
  });

  // ── Toggle password visibility ───────────────────────────────────────────
  eyeBtn.addEventListener('click', function () {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  // ── Toggle custom prompt block ───────────────────────────────────────────
  useCustomCb.addEventListener('change', function () {
    customBlock.classList.toggle('hidden', !useCustomCb.checked);
  });

  // ── Save ─────────────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', function () {
    const key = apiKeyInput.value.trim();

    if (!key) {
      showStatus('⚠ Ingresa tu API Key de OpenAI', 'warn');
      return;
    }

    // Accept any OpenAI key format (sk-... or sk-proj-...)
    if (!key.startsWith('sk-')) {
      showStatus('⚠ La API Key debe comenzar con "sk-"', 'warn');
      return;
    }

    const data = {
      apiKey:          key,
      model:           modelSelect.value,
      customPrompt:    customArea.value.trim(),
      useCustomPrompt: useCustomCb.checked,
    };

    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', data }, function (response) {
      if (chrome.runtime.lastError) {
        showStatus('✗ Error al guardar: ' + chrome.runtime.lastError.message, 'warn');
        console.error('[EMChile] save error:', chrome.runtime.lastError.message);
        return;
      }
      if (!response?.success) {
        showStatus('✗ ' + (response?.error || 'No se pudo guardar la configuración'), 'warn');
        return;
      }
      apiKeyInput.value = response.saved?.apiKey || key;
      showStatus('✓ Configuración guardada', 'ok');
    });
  });

  apiKeyInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') saveBtn.click();
  });

  // ── Clear history ────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', function () {
    chrome.storage.local.remove('analysisHistory', function () {
      showStatus('✓ Historial eliminado', 'ok');
    });
  });

  // ── Status helper ────────────────────────────────────────────────────────
  var statusTimer;
  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className   = 'p-status p-status-' + type;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      statusEl.className = 'p-status hidden';
    }, 3000);
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPopup, { once: true });
} else {
  initPopup();
}
