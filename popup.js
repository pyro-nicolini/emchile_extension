'use strict';
// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Popup Settings Script
// ═══════════════════════════════════════════════════════════════════════════════

// ── Provider configuration ───────────────────────────────────────────────────
var PROVIDER_MODELS = {
  openai: [
    { value: 'gpt-4o-mini',  label: 'GPT-4o Mini — Rápido y económico' },
    { value: 'gpt-4o',       label: 'GPT-4o — Preciso y balanceado' },
    { value: 'gpt-4-turbo',  label: 'GPT-4 Turbo — Máxima capacidad' },
  ],
  github_copilot: [
    { value: 'gpt-4o-mini',       label: 'GPT-4o Mini — Rápido' },
    { value: 'gpt-4o',            label: 'GPT-4o — Balanceado' },
    { value: 'claude-3.5-sonnet', label: 'Claude 3.5 Sonnet — Avanzado' },
    { value: 'o1-mini',           label: 'o1-mini — Razonamiento' },
    { value: 'o3-mini',           label: 'o3-mini — Razonamiento avanzado' },
  ],
  claude: [
    { value: 'claude-3-5-haiku-20241022',  label: 'Claude 3.5 Haiku — Rápido' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet — Balanceado' },
    { value: 'claude-3-opus-20240229',     label: 'Claude 3 Opus — Avanzado' },
  ],
};

var PROVIDER_UI = {
  openai:         { label: 'OpenAI API Key',     placeholder: 'sk-…' },
  github_copilot: { label: 'GitHub Token (models:read)', placeholder: 'ghp_…' },
  claude:         { label: 'Claude API Key',      placeholder: 'sk-ant-…' },
};

// ── Storage key per provider ──────────────────────────────────────────────────
var PROVIDER_STORAGE_KEY = {
  openai:         'apiKeyOpenAI',
  github_copilot: 'apiKeyGitHubCopilot',
  claude:         'apiKeyClaude',
};

function initPopup() {

  // ── Element refs ─────────────────────────────────────────────────────────
  var providerSelect = document.getElementById('p-provider');
  var apikeyLabel    = document.getElementById('p-apikey-label');
  var apiKeyInput    = document.getElementById('p-apikey');
  var eyeBtn         = document.getElementById('p-eye');
  var modelSelect    = document.getElementById('p-model');
  var useCustomCb    = document.getElementById('p-use-custom');
  var customBlock    = document.getElementById('p-custom-block');
  var customArea     = document.getElementById('p-custom');
  var saveBtn        = document.getElementById('p-save');
  var clearBtn       = document.getElementById('p-clear-hist');
  var statusEl       = document.getElementById('p-status');

  if (!apiKeyInput || !saveBtn || !providerSelect) {
    console.error('[EMChile] popup elements not found');
    return;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function currentProvider() {
    return providerSelect.value || 'openai';
  }

  function applyProviderUI(provider, savedModel) {
    var ui = PROVIDER_UI[provider] || PROVIDER_UI.openai;
    apikeyLabel.textContent = ui.label;
    apiKeyInput.placeholder = ui.placeholder;

    var models = PROVIDER_MODELS[provider] || PROVIDER_MODELS.openai;
    modelSelect.innerHTML = models
      .map(function (m) { return '<option value="' + m.value + '">' + m.label + '</option>'; })
      .join('');

    if (savedModel) modelSelect.value = savedModel;
    // If savedModel not in list, default to first option
    if (!modelSelect.value) modelSelect.value = models[0].value;
  }

  // ── Load saved settings ───────────────────────────────────────────────────
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function (prefs) {
    prefs = prefs || {};
    if (chrome.runtime.lastError) {
      console.error('[EMChile] load error:', chrome.runtime.lastError.message);
      showStatus('✗ Error cargando configuración', 'warn');
      return;
    }

    var provider = prefs.aiProvider || 'openai';
    providerSelect.value = provider;

    // Load provider-specific key (fall back to legacy apiKey)
    var storageKey = PROVIDER_STORAGE_KEY[provider] || 'apiKey';
    var key = prefs[storageKey] || prefs.apiKey || '';
    if (key) apiKeyInput.value = key;

    applyProviderUI(provider, prefs.model);

    if (prefs.customPrompt) customArea.value = prefs.customPrompt;
    useCustomCb.checked = !!prefs.useCustomPrompt;
    customBlock.classList.toggle('hidden', !prefs.useCustomPrompt);
  });

  // ── Provider change ───────────────────────────────────────────────────────
  providerSelect.addEventListener('change', function () {
    var provider = currentProvider();
    applyProviderUI(provider, null);

    // Load the saved key for this provider
    var storageKey = PROVIDER_STORAGE_KEY[provider];
    chrome.storage.local.get([storageKey, 'apiKey'], function (stored) {
      apiKeyInput.value = stored[storageKey] || '';
      apiKeyInput.type = 'password';
    });
  });

  // ── Toggle password visibility ────────────────────────────────────────────
  eyeBtn.addEventListener('click', function () {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  // ── Toggle custom prompt block ────────────────────────────────────────────
  useCustomCb.addEventListener('change', function () {
    customBlock.classList.toggle('hidden', !useCustomCb.checked);
  });

  // ── Save ──────────────────────────────────────────────────────────────────
  saveBtn.addEventListener('click', function () {
    var key      = apiKeyInput.value.trim();
    var provider = currentProvider();

    if (!key) {
      showStatus('⚠ Ingresa tu API Key', 'warn');
      return;
    }

    if (provider === 'openai' && !key.startsWith('sk-')) {
      showStatus('⚠ La API Key de OpenAI debe comenzar con "sk-"', 'warn');
      return;
    }
    if (provider === 'claude' && !key.startsWith('sk-ant-')) {
      showStatus('⚠ La API Key de Claude debe comenzar con "sk-ant-"', 'warn');
      return;
    }

    var providerStorageKey = PROVIDER_STORAGE_KEY[provider];
    var data = {
      aiProvider:       provider,
      apiKey:           key,           // backward compat — active provider key
      model:            modelSelect.value,
      customPrompt:     customArea.value.trim(),
      useCustomPrompt:  useCustomCb.checked,
    };
    data[providerStorageKey] = key;    // remember key per provider

    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', data: data }, function (response) {
      if (chrome.runtime.lastError) {
        showStatus('✗ Error al guardar: ' + chrome.runtime.lastError.message, 'warn');
        return;
      }
      if (!response || !response.success) {
        showStatus('✗ ' + (response && response.error ? response.error : 'No se pudo guardar la configuración'), 'warn');
        return;
      }
      showStatus('✓ Configuración guardada', 'ok');
    });
  });

  apiKeyInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') saveBtn.click();
  });

  // ── Clear history ─────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', function () {
    chrome.storage.local.remove('analysisHistory', function () {
      showStatus('✓ Historial eliminado', 'ok');
    });
  });

  // ── Status helper ─────────────────────────────────────────────────────────
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

