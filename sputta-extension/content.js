(() => {
  if (window.__sputtaLoaded) return;
  window.__sputtaLoaded = true;

  const host = document.createElement("div");
  host.style.cssText = "all:initial;position:fixed;top:0;left:0;z-index:2147483647;";
  document.documentElement.appendChild(host);
  const root = host.attachShadow({ mode: "open" });

  root.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .pill { display: none; position: fixed; background: #a8cc5a; color: #0e0e0d; border: none; border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.35); }
      .pill:hover { filter: brightness(1.08); }
      .panel { display: none; position: fixed; right: 20px; bottom: 20px; width: 360px; max-width: calc(100vw - 24px); max-height: 70vh; flex-direction: column; background: #161614; color: #e8e4d8; border: 1px solid #383834; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); overflow: hidden; }
      .panel.open { display: flex; }
      .head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #2a2a26; }
      .brand { font-family: Georgia, serif; font-weight: 700; font-size: 17px; color: #a8cc5a; }
      .close { width: 28px; height: 28px; border: 1px solid #383834; border-radius: 8px; background: none; color: #9a968a; font-size: 16px; line-height: 1; cursor: pointer; }
      .close:hover { color: #a8cc5a; border-color: #a8cc5a; }
      .quote { padding: 10px 14px; font-size: 12px; line-height: 1.5; color: #8a867a; border-bottom: 1px solid #2a2a26; max-height: 64px; overflow: hidden; }
      .body { flex: 1; overflow-y: auto; padding: 12px 14px; font-size: 14px; line-height: 1.65; }
      .msg { margin-bottom: 12px; }
      .msg p { margin: 0 0 8px; }
      .msg.you { background: #1e1e1b; border: 1px solid #383834; border-radius: 12px; padding: 8px 12px; }
      .msg.err { color: #f0a0a0; }
      .ask { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #2a2a26; }
      .ask input { flex: 1; min-width: 0; background: #1e1e1b; border: 1px solid #383834; border-radius: 10px; padding: 9px 12px; color: #e8e4d8; font-size: 13px; outline: none; }
      .ask input:focus { border-color: #a8cc5a; }
      .ask button { background: #a8cc5a; color: #0e0e0d; border: none; border-radius: 10px; padding: 0 14px; font-size: 13px; font-weight: 700; cursor: pointer; }
      .ask button:disabled { opacity: 0.5; cursor: not-allowed; }
    </style>
    <button class="pill" id="pill" type="button">Explain</button>
    <div class="panel" id="panel">
      <div class="head"><span class="brand">sPutta</span><button class="close" id="close" type="button">&times;</button></div>
      <div class="quote" id="quote"></div>
      <div class="body" id="body"></div>
      <div class="ask">
        <input id="ask" type="text" placeholder="Ask a follow up..." />
        <button id="send" type="button">Ask</button>
      </div>
    </div>`;

  const pill    = root.getElementById("pill");
  const panel   = root.getElementById("panel");
  const closeEl = root.getElementById("close");
  const quoteEl = root.getElementById("quote");
  const bodyEl  = root.getElementById("body");
  const askEl   = root.getElementById("ask");
  const sendEl  = root.getElementById("send");

  let selected = "";
  let history  = [];
  let busy     = false;

  function hidePill() { pill.style.display = "none"; }

  function showPillFor(sel) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    pill.style.left = Math.min(window.innerWidth - 100, Math.max(8, rect.right - 40)) + "px";
    pill.style.top  = Math.min(window.innerHeight - 48, rect.bottom + 8) + "px";
    pill.style.display = "block";
  }

  document.addEventListener("mouseup", e => {
    if (e.composedPath().includes(host)) return;
    setTimeout(() => {
      const sel  = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text.length >= 3 && sel.rangeCount) {
        selected = text.slice(0, 3000);
        showPillFor(sel);
      } else {
        hidePill();
      }
    }, 10);
  });
  document.addEventListener("scroll", hidePill, { capture: true, passive: true });

  pill.addEventListener("mousedown", e => e.preventDefault());

  function addMsg(kind, text) {
    const div = document.createElement("div");
    div.className = "msg " + kind;
    String(text).split(/\n{2,}/).forEach(part => {
      const p = document.createElement("p");
      p.textContent = part.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
      div.appendChild(p);
    });
    bodyEl.appendChild(div);
    bodyEl.scrollTop = bodyEl.scrollHeight;
    return div;
  }

  function ask(message, shownText) {
    if (busy) return;
    busy = true;
    sendEl.disabled = true;
    if (shownText) addMsg("you", shownText);
    const loading = addMsg("ai", "Thinking...");
    try {
      chrome.runtime.sendMessage({ type: "explain", message, history }, res => {
        busy = false;
        sendEl.disabled = false;
        loading.remove();
        if (chrome.runtime.lastError || !res || !res.ok) {
          addMsg("err", "Could not get an explanation. " + (res && res.error ? res.error : "Try again in a moment."));
          return;
        }
        history.push({ role: "user", content: message }, { role: "assistant", content: res.reply });
        addMsg("ai", res.reply);
      });
    } catch (_) {
      busy = false;
      sendEl.disabled = false;
      loading.remove();
      addMsg("err", "The extension was updated. Refresh this page and try again.");
    }
  }

  pill.addEventListener("click", () => {
    hidePill();
    history = [];
    bodyEl.innerHTML = "";
    quoteEl.textContent = selected;
    panel.classList.add("open");
    ask("Explain the following text in simple everyday words, as if to a curious child. Keep it short.\n\n\"" + selected + "\"", null);
  });

  closeEl.addEventListener("click", () => panel.classList.remove("open"));

  function sendFollowUp() {
    const q = askEl.value.trim();
    if (!q) return;
    askEl.value = "";
    ask(q, q);
  }
  sendEl.addEventListener("click", sendFollowUp);
  askEl.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Enter") sendFollowUp();
  });
  askEl.addEventListener("keyup", e => e.stopPropagation());
  askEl.addEventListener("keypress", e => e.stopPropagation());
})();