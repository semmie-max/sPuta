const API_URL = "https://sputa.onrender.com/chat";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "explain") return;
  (async () => {
    try {
      const fd = new FormData();
      fd.append("message", msg.message);
      fd.append("history", JSON.stringify(msg.history || []));
      fd.append("prefs", "");
      fd.append("plain", "1");
      const res = await fetch(API_URL, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "HTTP " + res.status);
      sendResponse({ ok: true, reply: data.reply || "" });
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true;
});