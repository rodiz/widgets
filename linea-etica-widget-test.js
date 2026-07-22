/**
 * Línea Ética — Widget embebible (burbuja de chat)
 * ---------------------------------------------------
 * Uso en el sitio del cliente:
 *
 * <script>
 *   window.LineaEticaWidgetConfig = {
 *     webhookUrl: "https://TU-N8N.dominio.com/webhook/le-web-chat",
 *   };
 * </script>
 * <script src="https://tu-cdn.com/linea-etica-widget.js" defer></script>
 *
 * Contrato con el backend (n8n):
 *   Request  POST webhookUrl
 *     { session_id, message, attachment?: { filename, mime, data_base64 } }
 *   Response JSON
 *     { messages: [ { type: "text", text }, { type: "buttons", text, options: [...] } ] }
 */
(function () {
  "use strict";

  var cfg = Object.assign(
    {
      webhookUrl: "",
      title: "Línea Ética",
      subtitle: "Escríbenos tu denuncia ",
      primaryColor: "#249a38",
      position: "right",
      greeting: "Hola, bienvenido a la Línea Ética. Escribe *iniciar* para presentar una denuncia.",
    
    // --- imagen del botón flotante ---
    buttonImageUrl: "https://www.puertoaguadulce.com/wp-content/uploads/2026/04/boton-linea-etica.jpeg",
    buttonWidth: "120px",
    buttonHeight: "170px",
    buttonBorderRadius: "8px",
    buttonImageFit: "contain",   // que no recorte tu tarjeta
    buttonBoxShadow: "none",     // tu imagen ya trae su propia sombra
    buttonOffsetX: "-10px",  // pon "none" si tu imagen ya trae su propia sombra
    buttonOffsetY: "20px"
    },
    window.LineaEticaWidgetConfig || {}
  );

  if (!cfg.webhookUrl) {
    console.error("[LineaEticaWidget] Falta configurar webhookUrl en window.LineaEticaWidgetConfig");
    return;
  }

  // ---------- Sesión persistente ----------
  var SESSION_KEY = "le_widget_session_id";
  function getSessionId() {
    try {
      var sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = "web:" + (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + "-" + Math.random().toString(36).slice(2)));
        localStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch (e) {
      // localStorage bloqueado (modo incógnito estricto, etc.)
      return "web:" + Date.now();
    }
  }
  var sessionId = getSessionId();

  // ---------- Estilos ----------
  var css = `
    .le-widget-btn {
      position: fixed;
      bottom: calc(20px + ${cfg.buttonOffsetY});
      ${cfg.position}: calc(20px + ${cfg.buttonOffsetX});
      z-index: 999998;
      width: ${cfg.buttonWidth}; height: ${cfg.buttonHeight}; border-radius: ${cfg.buttonBorderRadius};
      background: ${cfg.buttonImageUrl ? "transparent" : cfg.primaryColor};
      ${cfg.buttonImageUrl ? `background-image: url('${cfg.buttonImageUrl}'); background-size: ${cfg.buttonImageFit}; background-position: center; background-repeat: no-repeat;` : ""}
      box-shadow: ${cfg.buttonBoxShadow};
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform .15s ease-in-out;
    }
    .le-widget-btn:hover { transform: scale(1.06); }
    .le-widget-btn svg { width: 26px; height: 26px; fill: #fff; display: ${cfg.buttonImageUrl ? "none" : "block"}; }

    .le-widget-panel {
      position: fixed; bottom: 90px; ${cfg.position}: 20px; z-index: 999999;
      width: 360px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 120px);
      background: #fff; border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.3);
      display: none; flex-direction: column; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .le-widget-panel.le-open { display: flex; }

    .le-widget-header {
      background: ${cfg.primaryColor}; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .le-widget-header-text strong { display: block; font-size: 15px; }
    .le-widget-header-text span { display: block; font-size: 12px; opacity: .85; }
    .le-widget-close { cursor: pointer; opacity: .85; font-size: 20px; line-height: 1; background: none; border: none; color: #fff; }
    .le-widget-close:hover { opacity: 1; }

    .le-widget-body {
      flex: 1; overflow-y: auto; padding: 12px; background: #f7f7f8;
      display: flex; flex-direction: column; gap: 8px;
    }
    .le-msg { max-width: 80%; padding: 9px 12px; border-radius: 10px; font-size: 13.5px; line-height: 1.4; white-space: pre-wrap; word-wrap: break-word; }
    .le-msg-bot { background: #fff; border: 1px solid #e5e5e5; align-self: flex-start; color: #222; }
    .le-msg-user { background: ${cfg.primaryColor}; color: #fff; align-self: flex-end; }
    .le-msg-typing { align-self: flex-start; display: flex; gap: 4px; padding: 10px 12px; }
    .le-msg-typing span { width: 6px; height: 6px; border-radius: 50%; background: #bbb; animation: le-blink 1.2s infinite; }
    .le-msg-typing span:nth-child(2) { animation-delay: .2s; }
    .le-msg-typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes le-blink { 0%,80%,100%{opacity:.3} 40%{opacity:1} }

    .le-widget-buttons { display: flex; flex-wrap: wrap; gap: 6px; align-self: flex-start; max-width: 90%; }
    .le-widget-buttons button {
      border: 1px solid ${cfg.primaryColor}; color: ${cfg.primaryColor}; background: #fff;
      border-radius: 20px; padding: 6px 12px; font-size: 13px; cursor: pointer;
    }
    .le-widget-buttons button:hover { background: ${cfg.primaryColor}; color: #fff; }

    .le-widget-footer {
      border-top: 1px solid #eee; padding: 8px; display: flex; align-items: center; gap: 6px; background: #fff;
    }
    .le-widget-input {
      flex: 1 !important; border: 1px solid #ddd !important; outline: none !important; resize: none !important; font-size: 13.5px !important;
      padding: 8px 10px !important; max-height: 80px !important; font-family: inherit !important; color: #000 !important; background: #fafafa !important; border-radius: 6px !important;
    }
    .le-widget-input::placeholder { color: #aaa !important; }
    .le-widget-input:focus { border-color: ${cfg.primaryColor} !important; background: #fff !important; }
    .le-widget-iconbtn {
      border: none; background: none; cursor: pointer; opacity: .6; padding: 4px; display: flex;
    }
    .le-widget-iconbtn:hover { opacity: 1; }
    .le-widget-iconbtn svg { width: 20px; height: 20px; fill: #555; }
    .le-widget-send { fill: ${cfg.primaryColor} !important; }

    @media (max-width: 460px) {
      .le-widget-panel { width: 100vw; height: 100vh; max-height: 100vh; bottom: 0; ${cfg.position}: 0; border-radius: 0; }
    }
  `;
  var styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // ---------- Estructura HTML ----------
  var btn = document.createElement("div");
  btn.className = "le-widget-btn";
  btn.innerHTML =
    '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  document.body.appendChild(btn);

  var panel = document.createElement("div");
  panel.className = "le-widget-panel";
  panel.innerHTML =
    '<div class="le-widget-header">' +
    '  <div class="le-widget-header-text"><strong>' + cfg.title + '</strong><span>' + cfg.subtitle + '</span></div>' +
    '  <button class="le-widget-close" aria-label="Cerrar">×</button>' +
    '</div>' +
    '<div class="le-widget-body" id="le-widget-body"></div>' +
    '<div class="le-widget-footer">' +
    '  <button class="le-widget-iconbtn" id="le-widget-attach" title="Adjuntar evidencia">' +
    '    <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5a4 4 0 0 1-8 0V5a2.5 2.5 0 0 1 5 0v10.5a1 1 0 0 1-2 0V6H10v9.5a2.5 2.5 0 0 0 5 0V5a4 4 0 0 0-8 0v12.5a5.5 5.5 0 0 0 11 0V6h-1.5z"/></svg>' +
    '  </button>' +
    '  <textarea class="le-widget-input" id="le-widget-input" rows="1" placeholder="Escribe tu mensaje..."></textarea>' +
    '  <input type="file" id="le-widget-file" style="display:none" accept="image/*,video/*,audio/*,application/pdf" />' +
    '  <button class="le-widget-iconbtn" id="le-widget-send" title="Enviar">' +
    '    <svg class="le-widget-send" viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>' +
    '  </button>' +
    '</div>';
  document.body.appendChild(panel);

  var bodyEl = panel.querySelector("#le-widget-body");
  var inputEl = panel.querySelector("#le-widget-input");
  var sendBtn = panel.querySelector("#le-widget-send");
  var attachBtn = panel.querySelector("#le-widget-attach");
  var fileInput = panel.querySelector("#le-widget-file");
  var closeBtn = panel.querySelector(".le-widget-close");

  var opened = false;
  var greeted = false;

  btn.addEventListener("click", function () {
    opened = !opened;
    panel.classList.toggle("le-open", opened);
    btn.style.display = opened ? "none" : "flex";
    if (opened && !greeted) {
      greeted = true;
      addBotMessage(cfg.greeting);
    }
  });
  closeBtn.addEventListener("click", function () {
    opened = false;
    panel.classList.remove("le-open");
    btn.style.display = "flex";
  });

  // ---------- Render de mensajes ----------
  function scrollToBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function addUserMessage(text) {
    var div = document.createElement("div");
    div.className = "le-msg le-msg-user";
    div.textContent = text;
    bodyEl.appendChild(div);
    scrollToBottom();
  }

   function formatBotText(text) {
  var escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  escaped = escaped.replace(/\*(.+?)\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\n/g, "<br>");
  return escaped;
}

function addBotMessage(text) {
  var div = document.createElement("div");
  div.className = "le-msg le-msg-bot";
  div.innerHTML = formatBotText(text);
  bodyEl.appendChild(div);
  scrollToBottom();
}

  function addBotButtons(text, options) {
    if (text) addBotMessage(text);
    var wrap = document.createElement("div");
    wrap.className = "le-widget-buttons";
    options.forEach(function (opt) {
      var b = document.createElement("button");
      b.textContent = opt;
      b.addEventListener("click", function () {
        wrap.remove();
        sendToBackend(opt);
      });
      wrap.appendChild(b);
    });
    bodyEl.appendChild(wrap);
    scrollToBottom();
  }

  var typingEl = null;
  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "le-msg-typing";
    typingEl.innerHTML = "<span></span><span></span><span></span>";
    bodyEl.appendChild(typingEl);
    scrollToBottom();
  }
  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  // ---------- Comunicación con n8n ----------
function sendToBackend(text, attachment) {
  if (text) addUserMessage(text);
  if (attachment) addUserMessage("📎 " + attachment.filename);
  showTyping();

  var chatInputValue = text || "";
  if (attachment) {
    chatInputValue = JSON.stringify({
      __is_attachment: true,
      filename: attachment.filename,
      mime: attachment.mime,
      data_base64: attachment.data_base64,
    });
  }

  fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sendMessage",
      sessionId: sessionId,
      chatInput: chatInputValue,
    }),
  })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      hideTyping();
      (data.messages || []).forEach(function (m) {
        if (m.type === "buttons") {
          addBotButtons(m.text, m.options || []);
        } else {
          addBotMessage(m.text || "");
        }
      });
    })
    .catch(function (err) {
      hideTyping();
      addBotMessage("Hubo un problema de conexión. Intenta de nuevo en unos segundos.");
      console.error("[LineaEticaWidget]", err);
    });
}

  sendBtn.addEventListener("click", function () {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    sendToBackend(text);
  });

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // ---------- Adjuntos (evidencia) ----------
  var MAX_FILE_MB = 8;
  attachBtn.addEventListener("click", function () {
    fileInput.click();
  });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      addBotMessage("El archivo supera el límite de " + MAX_FILE_MB + " MB. Intenta con uno más liviano.");
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var base64 = reader.result.split(",")[1];
      sendToBackend(null, {
        filename: file.name,
        mime: file.type || "application/octet-stream",
        data_base64: base64,
      });
    };
    reader.readAsDataURL(file);
  });
})();