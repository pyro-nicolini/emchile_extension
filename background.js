"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
//  EMChile AI Desk — Background Service Worker
//  Handles: OpenAI API calls · Chrome storage · History management
// ═══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.type) {
    case "ANALYZE_TICKET":
      analyzeTicket(request.data)
        .then(sendResponse)
        .catch((err) => sendResponse({ error: err.message }));
      return true; // keep channel open for async

    case "GET_SETTINGS":
      chrome.storage.local.get(
        ["apiKey", "model", "customPrompt", "useCustomPrompt"],
        sendResponse,
      );
      return true;

    case "SAVE_SETTINGS":
      chrome.storage.local.set(request.data, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        chrome.storage.local.get(
          ["apiKey", "model", "customPrompt", "useCustomPrompt"],
          (saved) => {
            if (chrome.runtime.lastError) {
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
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
• Una OC válida en EMChile termina en uno de estos sufijos: AG25, AG26, COT25, LE, LP, SE, LE25, LP25, SE25, LE26, LP26, SE26
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
  const conversationText = ticketData.conversation || "No se pudo extraer la conversación del ticket.";
  const criticalSignals = detectCriticalSignals(`${ticketData.subject || ""}\n${conversationText}\n${ticketData.additionalData || ""}`);

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
    lines.push(`ÓRDENES DE COMPRA DETECTADAS EN EL TICKET (${ticketData.ocNumbers.length}):`);
    ticketData.ocNumbers.forEach((oc, i) => lines.push(`  OC ${i + 1}: ${oc}`));
    lines.push("IMPORTANTE: Usa estos números exactos en la comunicación interna y no los reemplaces por 'sin OC'.");
    lines.push("IMPORTANTE: Solo consideres como OC válidas las que terminan en AG25, AG26, COT25, LE, LP, SE, LE25, LP25, SE25, LE26, LP26 o SE26.");
    if (ticketData.ocNumbers.length > 1) {
      lines.push("IMPORTANTE: La respuesta al cliente debe dejar claro que la solicitud corresponde a TODAS las OCs detectadas, no solo a una.");
    }
  }

  if (criticalSignals.length) {
    lines.push("");
    lines.push(`SEÑALES CRÍTICAS DETECTADAS (${criticalSignals.length}):`);
    criticalSignals.forEach((signal, i) => lines.push(`  ${i + 1}. ${signal}`));
    lines.push("IMPORTANTE: Si existe multa, sanción, incumplimiento o plazo de descargos, el summary debe mencionarlo explícitamente en la primera oración.");
  }

  lines.push(
    "",
    "CONVERSACIÓN COMPLETA:",
    conversationText,
  );

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
    { pattern: /sanci[oó]n|sanciones/, label: "Mención de sanción o sanciones" },
    { pattern: /incumplimiento|incumple|incumplido/, label: "Mención de incumplimiento" },
    { pattern: /descargos?/, label: "Existe plazo o solicitud de descargos" },
    { pattern: /procedimiento de aplicaci[oó]n de multa/, label: "Inicio de procedimiento de aplicación de multa" },
    { pattern: /resoluci[oó]n exenta/, label: "Mención de resolución exenta" },
    { pattern: /notificaci[oó]n|notifica/, label: "Existe notificación formal" },
    { pattern: /productos defectuosos|deficiencias en su calidad|mal estado/, label: "Mención de productos defectuosos o problemas de calidad" },
    { pattern: /plazo.*48 horas|48 horas/, label: "Existe plazo de 48 horas u otro plazo administrativo" },
    { pattern: /devoluci[oó]n|devolver/, label: "Mención de devolución de productos" },
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
    shouldReply: typeof result.shouldReply === "boolean" ? result.shouldReply : true,
    confidence: clampConfidence(result.confidence),
  };

  const criticalContext = getCriticalContext(ticketData);

  if (criticalContext.hasRisk) {
    normalized.summary = ensureCriticalSummary(normalized.summary, criticalContext, ticketData);
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

  return normalized;
}

function getCriticalContext(ticketData) {
  const text = `${ticketData.subject || ""}\n${ticketData.conversation || ""}\n${ticketData.additionalData || ""}`;
  const normalized = text.toLowerCase();
  const signals = detectCriticalSignals(text);
  const hasPenalty = /multa|multas|sanci[oó]n|sanciones|procedimiento de aplicaci[oó]n de multa/.test(normalized);
  const hasBreach = /incumplimiento|productos defectuosos|deficiencias en su calidad|mal estado/.test(normalized);
  const hasDeadline = /descargos?|48 horas|plazo/.test(normalized);
  const hasFormalNotice = /notificaci[oó]n|resoluci[oó]n exenta/.test(normalized);
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
  if (/(multa|sanci[oó]n|incumplimiento|descargos?|notificaci[oó]n formal)/.test(lower)) {
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

function ensureCriticalInternalMessage(internalMessage, criticalContext, ticketData) {
  const lines = String(internalMessage || "").split("\n").filter(Boolean);
  const firstLine = lines[0] || buildFallbackInternalHeader(ticketData);
  const rest = lines.slice(1);
  const combined = rest.join(" ").toLowerCase();

  if (!/(multa|sanci[oó]n|incumplimiento|descargos?)/.test(combined)) {
    const bullet = buildCriticalInternalBullet(criticalContext);
    rest.unshift(`• ${bullet}`);
  }

  return [firstLine, ...rest].join("\n");
}

function buildFallbackInternalHeader(ticketData) {
  const ticketId = ticketData.ticketId || "SIN-ID";
  const ocText = ticketData.ocNumbers?.length ? ticketData.ocNumbers.join(", ") : "sin OC";
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
    reasons: [...criticalContext.signals.slice(0, 4), ...(ocText ? [ocText] : [])],
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
