import { initializeApp }                        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, sendPasswordResetEmail }
                                                from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc,
         setDoc, deleteDoc, query, orderBy }    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const firebaseConfig = {
  apiKey:            "AIzaSyConrGYhTeufziVf4sSkxCMOauEfNIxGiE",
  authDomain:        "pdfsputa.firebaseapp.com",
  projectId:         "pdfsputa",
  storageBucket:     "pdfsputa.firebasestorage.app",
  messagingSenderId: "769052451109",
  appId:             "1:769052451109:web:b7df506c03e2a60834facc",
  measurementId:     "G-PMLWEPGDJZ"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const API_URL = "https://sputa.onrender.com/chat";
const API_BASE = API_URL.replace(/\/chat$/, "");
const SYSTEM = `You are a patient, friendly teacher. Your job is to take complex text and explain it simply as if talking to a curious young child who has never heard these words before.

Rules:
- Use only short everyday words. No jargon.
- Short paragraphs, 2 to 3 sentences each.
- Use simple comparisons: food, toys, family, nature.
- Be warm and encouraging.
- Never use emojis.
- When someone uploads a File, first ask them clearly what they want from it. Give them options: a full simple explanation, a short summary, just the key points, or specific questions answered. Wait for their answer before explaining anything.
- When given a specific instruction about the File, follow it thoroughly.`;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";

const $         = id => document.getElementById(id);
const loadingEl = $("loading-screen");
const authEl    = $("auth-screen");
const tabLogin  = $("tab-login");
const tabSignup = $("tab-signup");
const loginForm = $("login-form");
const signupForm= $("signup-form");
const loginBtn  = $("login-btn");
const signupBtn = $("signup-btn");
const loginErr  = $("login-error");
const signupErr = $("signup-error");
const forgotLink= $("forgot-link");
const messagesEl= $("messages");
const msgField  = $("msg-field");
const sendBtn   = $("send-btn");
const stopBtn   = $("stop-btn");
const retryBtn  = $("retry-btn");
const fileInput = $("file-input");
const piFrame   = $("pi-frame");
const piChips   = $("pi-chips");
const plusBtn   = $("plus-btn");
const plusMenu  = $("plus-menu");
const slashMenu = $("slash-menu");
const slashEmpty= $("slash-empty");
const enhanceBtn= $("enhance-btn");
const enhancingText = $("enhancing-text");

const SKILLS = {
  simple:    { label: "Explain Simply",      instruction: "Explain this in simple, everyday words a curious kid could follow." },
  summary:   { label: "Short Summary",       instruction: "Give me a short summary." },
  keypoints: { label: "Key Points Only",     instruction: "Give me just the key points, as a short list." },
  questions: { label: "Answer My Questions", instruction: "I have specific questions about this — wait for me to ask them, then answer thoroughly." }
};
let pendingLabel = null;
let lastEnhanceOriginal = "";
const historyList=$("history-list");
const chatTitleEl=$("chat-title");
const toastStack    = $("toast-stack");
const toastTemplate = $("toast-template");
const confirmTemplate = $("confirm-template");

function confirmToast(title, message) {
  return new Promise(resolve => {
    const node = confirmTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".toast-title").textContent = title;
    node.querySelector(".toast-desc").textContent = message || "";
    toastStack.appendChild(node);
    requestAnimationFrame(() => node.classList.add("show"));

    function close(result) {
      node.classList.remove("show");
      node.classList.add("hide");
      node.addEventListener("transitionend", () => node.remove(), { once: true });
      resolve(result);
    }
    node.querySelector(".toast-btn-cancel").addEventListener("click", () => close(false));
    node.querySelector(".toast-btn-ok").addEventListener("click", () => close(true));
  });
}
const newChatBtn= $("new-chat");
const clearAllBtn=$("clear-all");
const menuBtn   = $("menu-btn");
const sidebar   = $("sidebar");
const overlay   = $("overlay");
const sidebarBottom = $("sidebar-bottom");
const accountBtn     = $("account-btn");
const accountMenu    = $("account-menu");
const accountAvatarLg= $("account-avatar-lg");
const accountName    = $("account-name");
const accountSub     = $("account-sub");
const menuTheme      = $("menu-theme");
const menuSettings   = $("menu-settings");
const menuExport     = $("menu-export");
const menuSignout    = $("menu-signout");

const onboardingScreen     = $("onboarding-screen");
const onboardStepLabel     = $("onboard-step-label");
const onboardingBarFill    = $("onboarding-bar-fill");
const onboardStepView      = $("onboard-step-view");
const onboardCelebrateView = $("onboard-celebrate-view");
const onboardTitle         = $("onboard-title");
const onboardSub           = $("onboard-sub");
const onboardOptions       = $("onboard-options");
const onboardBackBtn       = $("onboard-back-btn");
const onboardNextBtn       = $("onboard-next-btn");
const onboardingFinishBtn  = $("onboarding-finish-btn");
const onboardingSkipBtn    = $("onboarding-skip-btn");

const settingsScreen       = $("settings-screen");
const settingsBack         = $("settings-back");
const settingsNavItems     = document.querySelectorAll(".settings-nav-item");
const settingsPanels       = document.querySelectorAll(".settings-panel");
const settingsThemeBtn     = $("settings-theme-btn");
const settingsTasks        = $("settings-tasks");
const settingsAccountEmail = $("settings-account-email");
const settingsSignoutBtn   = $("settings-signout-btn");

accountBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = accountMenu.classList.contains("show");
  accountMenu.classList.toggle("show", !open);
  accountBtn.toggleAttribute("data-open", !open);
});
accountMenu.addEventListener("click", e => e.stopPropagation());
document.addEventListener("click", () => {
  accountMenu.classList.remove("show");
  accountBtn.removeAttribute("data-open");
});

menuTheme.addEventListener("click", () => {
  accountMenu.classList.remove("show");
  accountBtn.removeAttribute("data-open");
  toggleTheme();
});
menuSettings.addEventListener("click", () => {
  accountMenu.classList.remove("show");
  accountBtn.removeAttribute("data-open");
  openSettings();
});
menuExport.addEventListener("click", () => { exportChat(); });
menuSignout.addEventListener("click", async () => {
  accountMenu.classList.remove("show");
  accountBtn.removeAttribute("data-open");
  await doSignOut();
});

let currentUser = null;
let chats       = {};   
let activeId    = null;
let pendingFile = null;
let pendingImageContext = null;
let isStreaming = false;
let lightMode   = false;
let saveTimer   = null;
let learningPrefs = null;
let activeQuizState = null;

const LEARNING_CATEGORIES = {
  reading: {
    label: "Reading",
    options: {
      shorter_chunks:   "Shorter chunks",
      more_spacing:     "More spacing",
      highlight_words:  "Highlight important words",
      reduce_clutter:   "Reduce visual clutter",
      larger_text:      "Larger text"
    }
  },
  understanding: {
    label: "Understanding",
    options: {
      step_by_step:     "Step-by-step",
      examples:         "Examples",
      analogies:        "Analogies",
      definitions:      "Definitions for difficult words",
      repeat_concepts:  "Repeat important concepts"
    }
  },
  visual: {
    label: "Visual",
    options: {
      no_color_only:    "Don't rely on colour alone",
      high_contrast:    "High contrast",
      patterns_icons:   "Distinguish information with patterns/icons",
      simplified_layout:"Simplified visual layout"
    }
  },
  interaction: {
    label: "Interaction",
    options: {
      voice_input:          "Voice input",
      keyboard_first:       "Keyboard-first",
      minimal_distractions: "Minimal distractions"
    }
  }
};

function emptyPrefs() {
  const p = {};
  Object.keys(LEARNING_CATEGORIES).forEach(k => p[k] = []);
  return p;
}
function checkSvg() {
  return `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
}

/* ---- Onboarding: step-by-step wizard ---- */
const ONBOARD_STEPS = Object.keys(LEARNING_CATEGORIES);
let onboardStepIndex = 0;
let onboardingPrefs  = emptyPrefs();

function renderOnboardStep() {
  const catId = ONBOARD_STEPS[onboardStepIndex];
  const cat   = LEARNING_CATEGORIES[catId];
  const total = ONBOARD_STEPS.length;

  onboardStepLabel.textContent = `Step ${onboardStepIndex + 1} of ${total}`;
  onboardingBarFill.style.width = `${Math.round((onboardStepIndex / total) * 100)}%`;
  onboardTitle.textContent = cat.label;
  onboardSub.textContent = "Choose whatever helps — this step is optional, you can skip it.";

  onboardOptions.innerHTML = Object.entries(cat.options).map(([optId, optLabel]) => `
    <label class="checklist-option">
      <input type="checkbox" value="${optId}" ${(onboardingPrefs[catId] || []).includes(optId) ? "checked" : ""}>
      <span>${esc(optLabel)}</span>
    </label>
  `).join("");

  onboardBackBtn.disabled = onboardStepIndex === 0;
  onboardNextBtn.textContent = onboardStepIndex === total - 1 ? "Finish" : "Next";
}
function saveCurrentOnboardStep() {
  const catId = ONBOARD_STEPS[onboardStepIndex];
  const checked = Array.from(onboardOptions.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
  onboardingPrefs[catId] = checked;
}
onboardNextBtn.addEventListener("click", async () => {
  saveCurrentOnboardStep();
  if (onboardStepIndex < ONBOARD_STEPS.length - 1) {
    onboardStepIndex++;
    renderOnboardStep();
  } else {
    onboardingBarFill.style.width = "100%";
    await saveLearningPrefs(onboardingPrefs);
    onboardStepView.style.display = "none";
    onboardCelebrateView.style.display = "block";
  }
});
onboardBackBtn.addEventListener("click", () => {
  if (onboardStepIndex === 0) return;
  saveCurrentOnboardStep();
  onboardStepIndex--;
  renderOnboardStep();
});
function showOnboarding() {
  onboardingPrefs  = emptyPrefs();
  onboardStepIndex = 0;
  onboardStepView.style.display = "block";
  onboardCelebrateView.style.display = "none";
  renderOnboardStep();
  onboardingScreen.classList.add("visible");
}
function hideOnboarding() { onboardingScreen.classList.remove("visible"); }
onboardingFinishBtn.addEventListener("click", hideOnboarding);
onboardingSkipBtn.addEventListener("click", async () => {
  saveCurrentOnboardStep();
  await saveLearningPrefs(onboardingPrefs);
  hideOnboarding();
});

/* ---- Learning prefs persistence ---- */
async function loadLearningPrefs() {
  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));
    learningPrefs = (snap.exists() && snap.data().learningPrefs) ? snap.data().learningPrefs : null;
  } catch (_) { learningPrefs = null; }
}
async function saveLearningPrefs(prefs) {
  learningPrefs = prefs;
  try {
    await setDoc(doc(db, "users", currentUser.uid), { learningPrefs: prefs }, { merge: true });
  } catch (_) {}
}

const PREF_INSTRUCTIONS = {
  shorter_chunks:       "Keep every paragraph to one or two short sentences.",
  more_spacing:         "Leave a blank line between every paragraph so the reply feels open and easy on the eyes.",
  highlight_words:      "Put the most important words and terms in bold using markdown.",
  reduce_clutter:       "Keep it plain. No tables, no long lists, no decorative extras.",
  larger_text:          "Use short lines and clear headings so the reply is easy to scan.",

  step_by_step:         "Break the explanation into clear numbered steps.",
  examples:             "Give at least one concrete everyday example.",
  analogies:            "Use a simple analogy from daily life to explain the main idea.",
  definitions:          "Right after any difficult word, explain what it means in brackets.",
  repeat_concepts:      "End by repeating the main idea again in different simple words.",

  no_color_only:        "Never rely on colour to carry meaning. Always say it in words.",
  high_contrast:        "Keep formatting strong and plain. No faint or decorative styling.",
  patterns_icons:       "Separate different ideas with clear markers like numbers, arrows or short labels.",
  simplified_layout:    "Keep the layout very simple. Short blocks, no nested lists.",

  voice_input:          "Write so the reply sounds natural when read out loud.",
  keyboard_first:       "Keep replies compact and quick to scroll through.",
  minimal_distractions: "Answer only what was asked. No side notes, no extra tips."
};

function buildPrefsInstruction() {
  if (!learningPrefs) return "";
  const lines = [];
  Object.values(learningPrefs).forEach(list => {
    (list || []).forEach(optId => {
      if (PREF_INSTRUCTIONS[optId]) lines.push("- " + PREF_INSTRUCTIONS[optId]);
    });
  });
  if (!lines.length) return "";
  return "The user has told us how they learn best. Follow these rules in every reply:\n" + lines.join("\n");
}

/* ---- Settings: full-page, tabbed (accordion reused for learning prefs) ---- */
function renderChecklistTasks(container, prefs, opts = {}) {
  container.innerHTML = "";
  Object.entries(LEARNING_CATEGORIES).forEach(([catId, cat]) => {
    const done = (prefs[catId] || []).length > 0;
    const task = document.createElement("div");
    task.className = "checklist-task" + (done ? " done" : "");
    task.dataset.cat = catId;

    const row = document.createElement("button");
    row.type = "button";
    row.className = "checklist-task-row";
    row.innerHTML = `
      <span class="checklist-marker">${done ? checkSvg() : ""}</span>
      <span class="checklist-task-label">${esc(cat.label)}</span>
      <span class="checklist-task-action">${done ? "" : "Set up"}</span>
    `;

    const panel = document.createElement("div");
    panel.className = "checklist-task-panel";
    const optionsHtml = Object.entries(cat.options).map(([optId, optLabel]) => `
      <label class="checklist-option">
        <input type="checkbox" value="${optId}" ${(prefs[catId] || []).includes(optId) ? "checked" : ""}>
        <span>${esc(optLabel)}</span>
      </label>
    `).join("");
    panel.innerHTML = `
      <div class="checklist-options">${optionsHtml}</div>
      <button type="button" class="checklist-panel-save">Save</button>
    `;

    row.addEventListener("click", () => {
      const isOpen = task.classList.contains("open");
      container.querySelectorAll(".checklist-task.open").forEach(t => t.classList.remove("open"));
      task.classList.toggle("open", !isOpen);
    });
    panel.querySelector(".checklist-panel-save").addEventListener("click", () => {
      const checked = Array.from(panel.querySelectorAll("input[type=checkbox]:checked")).map(cb => cb.value);
      prefs[catId] = checked;
      task.classList.remove("open");
      task.classList.toggle("done", checked.length > 0);
      task.querySelector(".checklist-marker").innerHTML = checked.length > 0 ? checkSvg() : "";
      task.querySelector(".checklist-task-action").textContent = checked.length > 0 ? "" : "Set up";
      if (opts.onChange) opts.onChange(prefs);
    });

    task.appendChild(row);
    task.appendChild(panel);
    container.appendChild(task);
  });
}
function renderSettingsLearningTasks() {
  const prefs = learningPrefs ? JSON.parse(JSON.stringify(learningPrefs)) : emptyPrefs();
  renderChecklistTasks(settingsTasks, prefs, {
    onChange: (updated) => { saveLearningPrefs(updated); }
  });
}
function switchSettingsPanel(panelId) {
  settingsNavItems.forEach(btn => btn.classList.toggle("active", btn.dataset.panel === panelId));
  settingsPanels.forEach(panel => {
    panel.style.display = panel.dataset.panel === panelId ? "block" : "none";
  });
}
settingsNavItems.forEach(btn => {
  btn.addEventListener("click", () => switchSettingsPanel(btn.dataset.panel));
});
function openSettings() {
  if (currentUser) settingsAccountEmail.textContent = currentUser.email || "";
  renderSettingsLearningTasks();
  switchSettingsPanel("appearance");
  settingsScreen.classList.add("visible");
}
function closeSettings() { settingsScreen.classList.remove("visible"); }
settingsBack.addEventListener("click", closeSettings);
settingsThemeBtn.addEventListener("click", toggleTheme);

async function doSignOut() {
  if (!(await confirmToast("Sign out?", "You'll need to sign back in to see your chats."))) return;
  await signOut(auth);
  chats = {}; activeId = null;
  messagesEl.innerHTML = ""; historyList.innerHTML = "";
  chatTitleEl.textContent = "New Chat";
  closeSettings();
}
settingsSignoutBtn.addEventListener("click", doSignOut);

onAuthStateChanged(auth, async user => {
  loadingEl.style.display = "none";
  if (user) {
    currentUser = user;
    showUserUI(user);
    requestNotificationPermission();
    await loadChatsFromFirestore();
    await loadLearningPrefs();
    const ids = Object.keys(chats).sort((a,b) => chats[b].ts - chats[a].ts);
    if (ids.length) loadChat(ids[0]); else createChat();
    if (!learningPrefs) showOnboarding();
  } else {
    currentUser = null;
    chats = {}; activeId = null;
    hideUserUI();
    authEl.classList.add("visible");
  }
});

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active"); tabSignup.classList.remove("active");
  loginForm.style.display = ""; signupForm.style.display = "none";
  loginErr.classList.remove("show"); signupErr.classList.remove("show");
});
tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active"); tabLogin.classList.remove("active");
  signupForm.style.display = ""; loginForm.style.display = "none";
  loginErr.classList.remove("show"); signupErr.classList.remove("show");
});

[$("login-email"), $("login-pass")].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key==="Enter") loginBtn.click(); }));
[$("signup-email"), $("signup-pass"), $("signup-pass2")].forEach(el =>
  el.addEventListener("keydown", e => { if (e.key==="Enter") signupBtn.click(); }));

loginBtn.addEventListener("click", async () => {
  setAuthLoading(loginBtn, true);
  loginErr.classList.remove("show");
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-pass").value);
    authEl.classList.remove("visible");
  } catch (err) {
    showAuthErr(loginErr, friendlyError(err));
  } finally { setAuthLoading(loginBtn, false); }
});

signupBtn.addEventListener("click", async () => {
  const p1 = $("signup-pass").value, p2 = $("signup-pass2").value;
  if (p1 !== p2) { showAuthErr(signupErr, "Passwords do not match."); return; }
  setAuthLoading(signupBtn, true);
  signupErr.classList.remove("show");
  try {
    await createUserWithEmailAndPassword(auth, $("signup-email").value.trim(), p1);
    authEl.classList.remove("visible");
  } catch (err) {
    showAuthErr(signupErr, friendlyError(err));
  } finally { setAuthLoading(signupBtn, false); }
});

forgotLink.addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  if (!email) { showAuthErr(loginErr, "Enter your email above first."); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthErr(loginErr, "Reset email sent! Check your inbox.", true);
  } catch (err) {
    showAuthErr(loginErr, friendlyError(err));
  }
});

function showUserUI(user) {
  authEl.classList.remove("visible");
  accountAvatarLg.textContent = (user.email || "?")[0].toUpperCase();
  accountName.textContent = "My Account";
  accountSub.textContent = user.email || "";
  sidebarBottom.style.display = "block";
}
function hideUserUI() {
  sidebarBottom.style.display = "none";
}
function setAuthLoading(btn, on) {
  btn.disabled = on; btn.classList.toggle("loading", on);
}
function showAuthErr(el, msg, isOk=false) {
  el.textContent = msg;
  el.style.background = isOk ? "rgba(168,204,90,0.1)" : "";
  el.style.borderColor = isOk ? "rgba(168,204,90,0.3)" : "";
  el.style.color       = isOk ? "var(--green)" : "";
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 5000);
}
function friendlyError(err) {
  const map = {
    "auth/user-not-found":      "No account found with that email.",
    "auth/wrong-password":      "Incorrect password.",
    "auth/invalid-credential":  "Email or password is incorrect.",
    "auth/email-already-in-use":"An account with this email already exists.",
    "auth/weak-password":       "Password must be at least 6 characters.",
    "auth/invalid-email":       "Please enter a valid email address.",
    "auth/too-many-requests":   "Too many attempts. Please wait a moment.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[err.code] || err.message || "Something went wrong.";
}

function chatsCol() {
  return collection(db, "users", currentUser.uid, "chats");
}
async function loadChatsFromFirestore() {
  chats = {};
  try {
    const q   = query(chatsCol(), orderBy("ts", "desc"));
    const snap= await getDocs(q);
    snap.forEach(d => { chats[d.id] = d.data(); });
  } catch (_) {}
}
function scheduleSave(chatId) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persistChat(chatId), 800);
}
async function persistChat(chatId) {
  if (!currentUser || !chats[chatId]) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid, "chats", chatId), chats[chatId]);
  } catch (_) {}
}
async function deleteChat(chatId) {
  delete chats[chatId];
  try { await deleteDoc(doc(db, "users", currentUser.uid, "chats", chatId)); } catch (_) {}
}

bindAll();

function bindAll() {
  sendBtn.addEventListener("click", handleSend);
  fileInput.addEventListener("change", e => { if(e.target.files[0]) handleFile(e.target.files[0]); fileInput.value=""; });
  stopBtn.addEventListener("click", () => { isStreaming=false; stopBtn.style.display="none"; retryBtn.style.display="inline-block"; });
  retryBtn.addEventListener("click", regenerate);
  newChatBtn.addEventListener("click", () => { createChat(); closeSidebar(); });
  clearAllBtn.addEventListener("click", async () => {
    if (!(await confirmToast("Delete all chat history?", "This can't be undone."))) return;
    const ids = Object.keys(chats);
    for (const id of ids) await deleteChat(id);
    createChat(); closeSidebar();
  });
  menuBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle("open");
      overlay.classList.toggle("show");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });
  overlay.addEventListener("click", closeSidebar);
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", e => {
    e.preventDefault();
    const f=e.dataTransfer?.files?.[0];
    if(f) handleFile(f);
  });
  bindComposer();
}

function updateFieldEmptyState(){
  const isEmpty = msgField.textContent.trim()==="" && !msgField.querySelector(".pi-skill-pill");
  if(isEmpty) msgField.setAttribute("data-empty",""); else msgField.removeAttribute("data-empty");
}
function placeCaretAtEnd(el){
  const range=document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
function getComposedMessage(){
  let out="";
  msgField.childNodes.forEach(node=>{
    if(node.nodeType===Node.ELEMENT_NODE && node.classList?.contains("pi-skill-pill")){
      const skill = SKILLS[node.dataset.skill];
      if(skill) out += `[${skill.label}: ${skill.instruction}] `;
    } else {
      out += node.textContent;
    }
  });
  return out.trim();
}
function insertSkillPill(id){
  const skill = SKILLS[id];
  if(!skill) return;
  const pill = document.createElement("span");
  pill.className = "pi-skill-pill";
  pill.contentEditable = "false";
  pill.dataset.skill = id;
  pill.innerHTML = `<span>${esc(skill.label)}</span><button type="button" class="pi-skill-pill-x">&times;</button>`;
  msgField.appendChild(pill);
  msgField.appendChild(document.createTextNode(" "));
}
function stripTrailingSlashText(){
  let node = msgField.lastChild;
  while(node && node.nodeType!==Node.TEXT_NODE) node = node.previousSibling;
  if(!node) return;
  node.textContent = node.textContent.replace(/\/\w*$/,"");
  if(node.textContent==="") node.remove();
}
function selectSkill(id){
  stripTrailingSlashText();
  insertSkillPill(id);
  closeSlashMenu();
  closePlusMenu();
  msgField.focus();
  placeCaretAtEnd(msgField);
  updateFieldEmptyState();
}
function openSlashMenu(){ slashMenu.style.display="block"; }
function closeSlashMenu(){ slashMenu.style.display="none"; }
function closePlusMenu(){ plusMenu.style.display="none"; plusBtn.removeAttribute("data-open"); }
function filterSlashMenu(query){
  let anyVisible=false;
  slashMenu.querySelectorAll("[data-skill]").forEach(btn=>{
    const match = btn.textContent.toLowerCase().includes(query.toLowerCase());
    btn.style.display = match ? "flex" : "none";
    if(match) anyVisible=true;
  });
  slashEmpty.style.display = anyVisible ? "none" : "block";
}
async function handleEnhance(){
  const original = getComposedMessage();
  if(!original || enhanceBtn.disabled) return;
  const originalHTML = msgField.innerHTML;
  enhanceBtn.disabled = true;
  piFrame.setAttribute("data-enhancing","");
  msgField.style.display="none";
  enhancingText.style.display="block";
  enhancingText.textContent = original;
  try {
    const formData = new FormData();
    formData.append("message", `Rewrite the following so it is clearer and better phrased. Keep the same intent and language. Reply with ONLY the rewritten text:\n\n${original}`);
    formData.append("history", "[]");
    const res = await fetch(API_URL, { method:"POST", mode:"cors", body: formData });
    const data = await res.json();
    if(!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
    const rewritten = (data?.reply || "").trim();
    if(rewritten){
      msgField.textContent = rewritten;
      lastEnhanceOriginal = originalHTML;
      enhanceBtn.textContent = "Revert";
      enhanceBtn.dataset.mode = "revert";
    }
  } catch(err){
    toast("Could not enhance: " + err.message);
  } finally {
    piFrame.removeAttribute("data-enhancing");
    msgField.style.display="block";
    enhancingText.style.display="none";
    enhanceBtn.disabled = false;
    updateFieldEmptyState();
    placeCaretAtEnd(msgField);
  }
}
function bindComposer(){
  msgField.addEventListener("input", ()=>{
    updateFieldEmptyState();
    const text = msgField.textContent;
    const match = text.match(/\/(\w*)$/);
    if(match){ filterSlashMenu(match[1]); openSlashMenu(); }
    else { closeSlashMenu(); }
  });
  msgField.addEventListener("keydown", e=>{
    if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); closeSlashMenu(); handleSend(); }
    else if(e.key==="Escape"){ closeSlashMenu(); }
  });
  msgField.addEventListener("click", e=>{
    if(e.target.closest(".pi-skill-pill-x")){ e.target.closest(".pi-skill-pill").remove(); updateFieldEmptyState(); }
  });
  slashMenu.querySelectorAll("[data-skill]").forEach(btn=>{
    btn.addEventListener("click", ()=> selectSkill(btn.dataset.skill));
  });
  plusBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    const open = plusMenu.style.display==="block";
    plusMenu.style.display = open ? "none" : "block";
    plusBtn.toggleAttribute("data-open", !open);
  });
  plusMenu.addEventListener("click", e=> e.stopPropagation());
  $("menu-attach").addEventListener("click", ()=>{ fileInput.click(); closePlusMenu(); });
  plusMenu.querySelectorAll("[data-skill]").forEach(btn=>{
    btn.addEventListener("click", ()=> selectSkill(btn.dataset.skill));
  });
  document.addEventListener("click", ()=>{ closePlusMenu(); closeSlashMenu(); });
  enhanceBtn.addEventListener("click", ()=>{
    if(enhanceBtn.dataset.mode==="revert"){
      msgField.innerHTML = lastEnhanceOriginal || "";
      enhanceBtn.textContent = "Enhance";
      enhanceBtn.dataset.mode = "";
      updateFieldEmptyState();
      placeCaretAtEnd(msgField);
    } else {
      handleEnhance();
    }
  });
}

function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("show"); }

function handleFile(file) {
  const name = file.name.toLowerCase();
  const isPDF  = file.type === "application/pdf" || name.endsWith(".pdf");
  const isPPTX = name.endsWith(".pptx");
  const isDOCX = name.endsWith(".docx");
  const isTXT  = name.endsWith(".txt");
  const isIMG  = file.type.startsWith("image/");

  if (!isPDF && !isPPTX && !isDOCX && !isTXT && !isIMG) {
    toast("Unsupported file type. Try PDF, PPTX, DOCX, TXT or an image.");
    return;
  }

  let label = "PDF";
  if (isPPTX) label = "PowerPoint";
  else if (isDOCX) label = "Word";
  else if (isTXT) label = "Text file";
  else if (isIMG) label = "Image";

  pendingFile = file;
  pendingLabel = label;
  renderChips();
}
function clearFile() { pendingFile=null; pendingLabel=null; renderChips(); }
function renderChips(){
  piChips.innerHTML = "";
  if(!pendingFile){ piChips.style.display="none"; return; }
  piChips.style.display="flex";
  const chip=document.createElement("div");
  chip.className="pi-chip";
  chip.innerHTML = `<span>${esc(pendingFile.name)}</span> <span style="opacity:.6">· ${(pendingFile.size/1024).toFixed(0)} KB · ${esc(pendingLabel)}</span> <button type="button" class="pi-chip-remove">&times;</button>`;
  chip.querySelector(".pi-chip-remove").addEventListener("click", clearFile);
  piChips.appendChild(chip);
}

async function extractText(file) {
  const name = file.name.toLowerCase();
  console.log("extractText called with:", file.name, file.type);
  const isImage = file.type.startsWith("image/") || 
    name.endsWith(".jpg") || name.endsWith(".jpeg") || 
    name.endsWith(".png") || name.endsWith(".gif") || 
    name.endsWith(".webp") || name.endsWith(".bmp");

  if (file.type === "application/pdf" || name.endsWith(".pdf")) return extractPDF(file);
  if (name.endsWith(".pptx")) return extractPPTX(file);
  if (name.endsWith(".docx")) return extractDOCX(file);
  if (name.endsWith(".txt") || file.type === "text/plain") return extractTXT(file);
  if (isImage) return extractImage(file);
  if (file.type.startsWith("text/")) return extractTXT(file);
  throw new Error("This file type cannot be read. Try PDF, PPTX, DOCX, TXT or an image.");
}

async function extractPDF(file) {
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  let out="";
  const max=Math.min(pdf.numPages,40);
  for(let i=1;i<=max;i++){
    const page=await pdf.getPage(i);
    const content=await page.getTextContent();
    out+=content.items.map(x=>x.str).join(" ")+"\n";
  }
  if(!out.trim()) throw new Error("No readable text found. This File may be scanned or image-based.");
  if(out.length>15000) out=out.slice(0,15000)+"\n\n[Document truncated.]";
  return out;
}

async function extractPPTX(file) {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/^ppt\/slides\/slide[0-9]+\.xml$/))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1]);
      const nb = parseInt(b.match(/slide(\d+)/)[1]);
      return na - nb;
    });
  if (!slideFiles.length) throw new Error("No slides found in this PowerPoint file.");
  let out = "";
  for (const slideName of slideFiles.slice(0, 40)) {
    const xml = await zip.files[slideName].async("string");
    const texts = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g) || [];
    const slideText = texts.map(t => t.replace(/<[^>]+>/g, "")).join(" ");
    if (slideText.trim()) out += slideText + "\n";
  }
  if (!out.trim()) throw new Error("No readable text found in this PowerPoint file.");
  if (out.length > 15000) out = out.slice(0, 15000) + "\n\n[Document truncated.]";
  return out;
}

async function extractDOCX(file) {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const xmlFile = zip.files["word/document.xml"];
  if (!xmlFile) throw new Error("Could not read this Word document.");
  const xml = await xmlFile.async("string");
  const texts = xml.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
  let out = texts.map(t => t.replace(/<[^>]+>/g, "")).join(" ");
  if (!out.trim()) throw new Error("No readable text found in this Word document.");
  if (out.length > 15000) out = out.slice(0, 15000) + "\n\n[Document truncated.]";
  return out;
}

async function extractTXT(file) {
  let out = await file.text();
  if (!out.trim()) throw new Error("This text file appears to be empty.");
  if (out.length > 15000) out = out.slice(0, 15000) + "\n\n[Document truncated.]";
  return out;
}

async function extractImage(file) {
  toast("Reading image... this may take a moment.");
  const { data: { text } } = await Tesseract.recognize(file, "eng", {
    logger: () => {}
  });
  if (!text.trim()) throw new Error("No readable text found in this image.");
  let out = text;
  if (out.length > 15000) out = out.slice(0, 15000) + "\n\n[Document truncated.]";
  return out;
}
async function handleSend() {
  if(isStreaming) return;
  const text=getComposedMessage();
  if(!text&&!pendingFile) return;
  msgField.innerHTML=""; updateFieldEmptyState();
  if(!chats[activeId]) createChat();

  if(pendingFile){
    const fname=pendingFile.name;
    const isImage = pendingFile.type.startsWith("image/");
    chats[activeId].title=fname.slice(0,32);
    chatTitleEl.textContent=chats[activeId].title;
    renderSidebar();

    if(isImage){
      isStreaming=true;
      sendBtn.disabled=true; stopBtn.style.display="inline-block"; retryBtn.style.display="none";
      const imgFile=pendingFile;
      clearFile();
      await sendImageDirect(imgFile);
      return;
    }

    addBubble("user",`<strong>Uploaded:</strong> ${esc(fname)}`);
    let fileText;
    try { fileText=await extractText(pendingFile); }
    catch(err){ toast(err.message); clearFile(); return; }
    chats[activeId].msgs.push({
      role:"user",
      content:`The user has uploaded a file called "${fname}". Here is the extracted content:\n\n${fileText}\n\nDo NOT explain it yet. Ask the user what they would like from this document. Give them clear friendly options: a full simple explanation, a short summary, just the key points, or specific questions answered. Be warm and concise.`,
      _hidden:true
    });
    clearFile(); scheduleSave(activeId);
    await getResponse();
    return;
  }

  if(pendingImageContext && pendingImageContext.chatId===activeId){
    const imgFile = pendingImageContext.file;
    pendingImageContext = null;
    isStreaming=true;
    sendBtn.disabled=true; stopBtn.style.display="inline-block"; retryBtn.style.display="none";
    addBubble("user", esc(text));
    await sendImageDirect(imgFile, text, true);
    return;
  }

  addBubble("user", esc(text));
  chats[activeId].msgs.push({role:"user", content:text});
  const userVisible=chats[activeId].msgs.filter(m=>m.role==="user"&&!m._hidden).length;
  if(userVisible===1){
    chats[activeId].title=text.slice(0,32);
    chatTitleEl.textContent=chats[activeId].title;
    renderSidebar();
  }
  scheduleSave(activeId);
  await getResponse();
}

async function sendImageDirect(file, question, skipUploadBubble=false) {
  if(!skipUploadBubble) addBubble("user", `<strong>Uploaded:</strong> ${esc(file.name)}`);
  showTyping();
  const formData = new FormData();
  formData.append("file", file);
  if(question) formData.append("question", question);
  formData.append("prefs", buildPrefsInstruction());
  try {
    const res = await fetch(`${API_BASE}/read-image`, { method: "POST", mode: "cors", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
    finalizeThinking();
    const reply = data?.reply || "Sorry, I could not read this image.";
    addBubble("ai", safe(marked.parse(reply)), "", reply);
    chats[activeId].msgs.push({role:"user", content: question ? question : `[Uploaded image: ${file.name}]`, _hidden:true});
    chats[activeId].msgs.push({role:"assistant", content:reply});
    scheduleSave(activeId);
    pendingImageContext = { file, chatId: activeId };
  } catch (err) {
    removeTyping();
    addBubble("ai", `Something went wrong reading the image: ${esc(err.message)}`);
  } finally {
    isStreaming=false; sendBtn.disabled=false; stopBtn.style.display="none"; retryBtn.style.display="inline-block";
  }
}

async function getResponse() {
  isStreaming=true;
  const responseStart = Date.now();
  sendBtn.disabled=true; stopBtn.style.display="inline-block"; retryBtn.style.display="none";
  showTyping();
  const messages = chats[activeId].msgs
    .filter(m => !m._hidden)
    .map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    }));
  try {
    const lastMsg = chats[activeId].msgs.at(-1);
const formData = new FormData();
formData.append("message", lastMsg.content);
formData.append("history", JSON.stringify(
  chats[activeId].msgs
    .slice(0, -1)
    .map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))
));
formData.append("prefs", buildPrefsInstruction());

const res = await fetch(API_URL, {
  method: "POST",
  mode: "cors",
  body: formData
});
const data=await res.json();
if(!res.ok) throw new Error(data?.detail||`HTTP ${res.status}`);
finalizeThinking();
const reply=data?.reply||"Sorry, I could not generate a response.";
    const responseTime = ((Date.now() - responseStart) / 1000).toFixed(1);
addBubble("ai", safe(marked.parse(reply)), responseTime, reply);
    if (document.hidden) {
  sendNotification("PDF sPutta", "Your explanation is ready!");
}
    chats[activeId].msgs.push({role:"assistant", content:reply});
    scheduleSave(activeId);
  } catch(err){
    removeTyping();
    addBubble("ai",`Something went wrong: ${esc(err.message)}`);
  } finally {
    isStreaming=false; sendBtn.disabled=false;
    stopBtn.style.display="none"; retryBtn.style.display="inline-block";
    removeTyping();
  }
}

async function regenerate() {
  const msgs=chats[activeId]?.msgs;
  if(!msgs?.length||msgs.at(-1).role!=="assistant") return;
  msgs.pop(); messagesEl.lastElementChild?.remove(); scheduleSave(activeId); await getResponse();
}

function createChat() {
  const id="c"+Date.now();
  chats[id]={title:"New Chat", msgs:[], ts:Date.now()};
  activeId=id; chatTitleEl.textContent="New Chat";
  pendingImageContext = null;
  renderIntro(); renderSidebar(); scheduleSave(id);
}

function loadChat(id) {
  if(!chats[id]) return;
  activeId=id; chatTitleEl.textContent=chats[id].title;
  pendingImageContext = null;
  messagesEl.innerHTML="";
  chats[id].msgs.forEach(m=>{
    if(m._hidden) return;
    if(m.role==="user") addBubble("user", esc(m.content));
    else addBubble("ai", safe(marked.parse(m.content)));
  });
  if(!chats[id].msgs.filter(m=>!m._hidden).length) renderIntro();
  renderSidebar();
}

function formatLastSeen(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return "Just now";
  if (mins < 60)   return `${mins} min ago`;
  if (hours < 24)  return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (days < 7)    return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
}

function renderSidebar() {
  historyList.innerHTML = "";

  const allIds = Object.keys(chats).sort((a, b) => chats[b].ts - chats[a].ts);
  const pinned   = allIds.filter(id => chats[id].pinned);
  const unpinned = allIds.filter(id => !chats[id].pinned);

 if (pinned.length) {
    const pinnedLabel = document.createElement("div");
    pinnedLabel.className = "pinned-label";
    pinnedLabel.innerHTML = `<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg> Pinned`;
    historyList.appendChild(pinnedLabel);
    pinned.forEach(id => historyList.appendChild(makeChatItem(id)));
    const divider = document.createElement("div");
    divider.className = "pin-divider";
    historyList.appendChild(divider);
  }

  unpinned.forEach(id => historyList.appendChild(makeChatItem(id)));
}

function makeChatItem(id) {
  const el = document.createElement("div");
  el.className = "history-item" + (id === activeId ? " active" : "");

  const inner = document.createElement("div");
  inner.className = "history-item-inner";

  const title = document.createElement("span");
  title.className = "history-item-title";
  title.textContent = chats[id].title;

  const time = document.createElement("div");
  time.className = "history-item-time";
  time.textContent = formatLastSeen(chats[id].ts);

  inner.appendChild(title);
  inner.appendChild(time);

  const pin = document.createElement("button");
  pin.className = "pin-btn" + (chats[id].pinned ? " pinned" : "");
  pin.title = chats[id].pinned ? "Unpin" : "Pin chat";
  pin.innerHTML = `<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;
  pin.addEventListener("click", async e => {
    e.stopPropagation();
    chats[id].pinned = !chats[id].pinned;
    pin.title = chats[id].pinned ? "Unpin" : "Pin chat";
    scheduleSave(id);
    renderSidebar();
  });

  const del = document.createElement("button");
  del.className = "history-delete";
  del.textContent = "✕";
  del.title = "Delete chat";
  del.addEventListener("click", async e => {
    e.stopPropagation();
    await deleteChat(id);
    if (id === activeId) {
      const remaining = Object.keys(chats).sort((a, b) => chats[b].ts - chats[a].ts);
      if (remaining.length) loadChat(remaining[0]); else createChat();
    } else renderSidebar();
  });

  el.appendChild(inner);
  el.appendChild(pin);
  el.appendChild(del);
  el.addEventListener("click", () => { loadChat(id); closeSidebar(); });
  return el;
}
function renderIntro() {
  messagesEl.innerHTML="";
  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <div class="intro-wrap">
      <h1 class="intro-heading">What's on your mind?</h1>
      <p class="intro-sub">Ask a question or drop a file, image or PDF to get a simple explanation.</p>
      <div class="chips-row">
        <button class="chip">How does a leveraged buyout affect shareholders?</button>
        <button class="chip">What is the role of blockchain in digital identity verification?</button>
        <button class="chip">What is the greenhouse effect and how does it impact climate change?</button>
        <button class="chip">What is the impact of social media on democracy?</button>
      </div>
    </div>`;
  messagesEl.appendChild(wrap);
  wrap.querySelectorAll(".chip").forEach(c=>{
    c.addEventListener("click",()=>{msgField.textContent=c.textContent;updateFieldEmptyState();msgField.focus();placeCaretAtEnd(msgField);});
  });
}

function addBubble(role, html, responseTime="", explanationForQuiz=null) {
  messagesEl.querySelector(".intro-wrap")?.remove();
  const wrap=document.createElement("div");
  if(role==="user"){ wrap.className="msg-wrap user"; wrap.innerHTML=`<div class="bubble-user">${html}</div>`; }
  else {
    wrap.className="msg-wrap ai";
    wrap.innerHTML=`<div class="ai-header"><div class="ai-badge">Simple</div><div class="ai-line"></div></div><div class="bubble-ai">${html}</div>${responseTime ? `<div class="response-timer">⏱ ${responseTime}s</div>` : ""}${explanationForQuiz ? `<button type="button" class="check-understanding-btn">Check Understanding</button>` : ""}`;
  }
  messagesEl.appendChild(wrap);
  if(explanationForQuiz){
    wrap.querySelector(".check-understanding-btn").addEventListener("click", (e) => {
      e.target.remove();
      startQuiz(explanationForQuiz, wrap);
    });
  }
  messagesEl.scrollTop=messagesEl.scrollHeight;
}
async function startQuiz(explanationText, afterEl) {
  const loadingWrap = document.createElement("div");
  loadingWrap.className = "quiz-loading";
  loadingWrap.textContent = "Building a couple of questions to check this landed...";
  afterEl.insertAdjacentElement("afterend", loadingWrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const formData = new FormData();
    formData.append("explanation", explanationText);
    formData.append("prefs", buildPrefsInstruction());
    const res = await fetch(`${API_BASE}/quiz`, { method: "POST", mode: "cors", body: formData });
    const data = await res.json();
    if (!res.ok || data.error || !data.questions || !data.questions.length) {
      throw new Error(data?.error || "Could not build questions for this.");
    }
    activeQuizState = {
      explanation: explanationText,
      questions: data.questions,
      index: 0,
      misunderstood: []
    };
    loadingWrap.remove();
    renderQuizQuestion();
  } catch (err) {
    loadingWrap.remove();
    toast("Could not start check: " + err.message);
  }
}

function renderQuizQuestion() {
  const state = activeQuizState;
  if (!state) return;
  const q = state.questions[state.index];
  const total = state.questions.length;

  const wrap = document.createElement("div");
  wrap.className = "msg-wrap ai";

  let bodyHtml = "";
  if (q.type === "mcq") {
    bodyHtml = `<div class="quiz-options">${q.options.map((opt, i) => `<button type="button" class="quiz-option-btn" data-index="${i}">${esc(opt)}</button>`).join("")}</div>`;
  } else {
    bodyHtml = `<div class="quiz-open-row"><input type="text" class="quiz-input" placeholder="Type your answer..." /><button type="button" class="quiz-submit-btn">Submit</button></div>`;
  }

  wrap.innerHTML = `<div class="quiz-card">
    <div class="quiz-label">Check ${state.index + 1} of ${total}</div>
    <div class="quiz-question">${esc(q.question)}</div>
    ${bodyHtml}
    <div class="quiz-feedback" style="display:none"></div>
    <button type="button" class="quiz-continue-btn" style="display:none">Continue</button>
  </div>`;

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  if (q.type === "mcq") {
    wrap.querySelectorAll(".quiz-option-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        wrap.querySelectorAll(".quiz-option-btn").forEach(b => b.disabled = true);
        btn.classList.add("quiz-picked");
        submitQuizAnswer(wrap, q.options[btn.dataset.index]);
      });
    });
  } else {
    const input = wrap.querySelector(".quiz-input");
    const submitBtn = wrap.querySelector(".quiz-submit-btn");
    const submit = () => {
      const val = input.value.trim();
      if (!val) return;
      input.disabled = true;
      submitBtn.disabled = true;
      submitQuizAnswer(wrap, val);
    };
    submitBtn.addEventListener("click", submit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") submit(); });
  }
}

async function submitQuizAnswer(wrap, userAnswer) {
  const state = activeQuizState;
  const q = state.questions[state.index];
  const feedbackEl = wrap.querySelector(".quiz-feedback");
  feedbackEl.style.display = "block";
  feedbackEl.className = "quiz-feedback quiz-feedback-loading";
  feedbackEl.textContent = "Checking...";

  const correctAnswer = q.type === "mcq" ? q.options[q.correct_index] : q.expected_answer;

  try {
    const formData = new FormData();
    formData.append("question", q.question);
    formData.append("question_type", q.type);
    formData.append("correct_answer", correctAnswer);
    formData.append("user_answer", userAnswer);
    formData.append("prefs", buildPrefsInstruction());
    const res = await fetch(`${API_BASE}/check-answer`, { method: "POST", mode: "cors", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data?.error || "Could not check this answer.");

    if (q.type === "mcq") {
      wrap.querySelectorAll(".quiz-option-btn").forEach(b => {
        if (parseInt(b.dataset.index) === q.correct_index) b.classList.add("quiz-correct");
        else if (b.classList.contains("quiz-picked") && !data.correct) b.classList.add("quiz-wrong");
      });
    }

    feedbackEl.className = "quiz-feedback " + (data.correct ? "quiz-feedback-correct" : "quiz-feedback-wrong");
    feedbackEl.textContent = data.feedback || (data.correct ? "That's right." : "Not quite.");

    if (!data.correct && data.misunderstood) {
      state.misunderstood.push(data.misunderstood);
    }
  } catch (err) {
    feedbackEl.className = "quiz-feedback quiz-feedback-wrong";
    feedbackEl.textContent = "Could not check that: " + err.message;
  }

  const continueBtn = wrap.querySelector(".quiz-continue-btn");
  continueBtn.style.display = "inline-block";
  continueBtn.addEventListener("click", () => continueQuiz(wrap), { once: true });
}

async function continueQuiz(wrap) {
  wrap.remove();
  const state = activeQuizState;
  if (!state) return;
  state.index++;
  if (state.index < state.questions.length) {
    renderQuizQuestion();
    return;
  }
  if (state.misunderstood.length) {
    await reexplainMisunderstood(state.explanation, state.misunderstood);
  } else {
    addBubble("ai", "Nice, you've got this one down.");
  }
  activeQuizState = null;
}

async function reexplainMisunderstood(explanation, misunderstoodPoints) {
  showTyping();
  try {
    const formData = new FormData();
    formData.append("original_explanation", explanation);
    formData.append("misunderstood_points", misunderstoodPoints.map(p => "- " + p).join("\n"));
    formData.append("prefs", buildPrefsInstruction());
    const res = await fetch(`${API_BASE}/reexplain`, { method: "POST", mode: "cors", body: formData });
    const data = await res.json();
    finalizeThinking();
    if (!res.ok || data.error) throw new Error(data?.error || "Could not re-explain.");
    const reply = data?.reply || "";
    addBubble("ai", safe(marked.parse(reply)), "", reply);
    if (chats[activeId]) {
      chats[activeId].msgs.push({ role: "assistant", content: reply });
      scheduleSave(activeId);
    }
  } catch (err) {
    removeTyping();
    addBubble("ai", `Could not re-explain: ${esc(err.message)}`);
  }
}

let thinkingTimer=null, thinkingCycle=null, thinkingStart=0;
const THINKING_PHRASES=[
  "Reading your message...",
  "Thinking it through...",
  "Looking for the simplest way to say this...",
  "Choosing easy, everyday words...",
  "Putting the explanation together..."
];

function showTyping() {
  removeTyping();
  thinkingStart = Date.now();
  const el=document.createElement("div");
  el.id="typing-el"; el.className="tr";
  el.innerHTML=`
    <button class="trHeader" id="thinking-header" aria-expanded="true">
      <span class="trLabel trShimmer" id="thinking-label">Thinking</span>
      <svg class="trChevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>
    <div class="trCollapsible" id="thinking-collapsible">
      <div class="trInner">
        <div class="trViewport">
          <div class="trStream" id="thinking-stream">
            <p class="trSentence trShimmer" id="thinking-sentence">${THINKING_PHRASES[0]}</p>
          </div>
        </div>
      </div>
    </div>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop=messagesEl.scrollHeight;

  let i=0;
  thinkingCycle=setInterval(()=>{
    i=(i+1)%THINKING_PHRASES.length;
    const sentenceEl=$("thinking-sentence");
    if(sentenceEl){
      sentenceEl.style.animation="none";
      sentenceEl.offsetHeight;
      sentenceEl.style.animation="";
      sentenceEl.textContent=THINKING_PHRASES[i];
    }
  }, 1600);
}

function finalizeThinking() {
  clearInterval(thinkingCycle); thinkingCycle=null;
  const el=$("typing-el");
  if(!el) return;
  const seconds=Math.max(1, Math.round((Date.now()-thinkingStart)/1000));
  const label=$("thinking-label");
  const header=$("thinking-header");
  const collapsible=$("thinking-collapsible");
  if(label){ label.classList.remove("trShimmer"); label.textContent=`Thought for ${seconds}s`; }
  if(collapsible) collapsible.classList.add("isCollapsed");
  if(header){
    header.classList.add("isClickable");
    header.setAttribute("aria-expanded","false");
    header.addEventListener("click", ()=>{
      const isOpen=header.getAttribute("aria-expanded")==="true";
      header.setAttribute("aria-expanded", isOpen ? "false" : "true");
      collapsible.classList.toggle("isCollapsed", isOpen);
    });
  }
  el.id="";
}

function removeTyping() {
  clearInterval(thinkingCycle); thinkingCycle=null;
  $("typing-el")?.remove();
}
function safe(html) { return window.DOMPurify?DOMPurify.sanitize(html):html.replace(/<script[\s\S]*?<\/script>/gi,""); }
function esc(s) { const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
const TOAST_DURATION = 5000;

function toast(title, message, variant) {
  if (message === undefined || message === true || message === false) {
    variant = message === true ? "success" : "info";
    message = title;
    title = variant === "success" ? "Success" : "Notice";
  }
  variant = variant || "info";

  const node = toastTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`toast-${variant}`);
  node.querySelector(".toast-title").textContent = title;
  node.querySelector(".toast-desc").textContent = message;
  const bar = node.querySelector(".toast-timer-bar");
  const closeBtn = node.querySelector(".toast-close");

  toastStack.appendChild(node);
  requestAnimationFrame(() => node.classList.add("show"));

  let remaining = TOAST_DURATION;
  let startedAt = Date.now();
  let removeTimer = null;

  function runBar(duration) {
    bar.style.transition = "none";
    bar.style.width = "100%";
    void bar.offsetWidth;
    bar.style.transition = `width ${duration}ms linear`;
    bar.style.width = "0%";
  }
  function scheduleRemoval(duration) {
    clearTimeout(removeTimer);
    startedAt = Date.now();
    removeTimer = setTimeout(dismiss, duration);
  }
  function pause() {
    clearTimeout(removeTimer);
    const currentWidth = getComputedStyle(bar).width;
    remaining -= (Date.now() - startedAt);
    if (remaining < 0) remaining = 0;
    bar.style.transition = "none";
    bar.style.width = currentWidth;
  }
  function resume() {
    if (remaining <= 0) { dismiss(); return; }
    runBar(remaining);
    scheduleRemoval(remaining);
  }
  function dismiss() {
    clearTimeout(removeTimer);
    node.classList.remove("show");
    node.classList.add("hide");
    node.addEventListener("transitionend", () => node.remove(), { once: true });
  }

  node.addEventListener("mouseenter", pause);
  node.addEventListener("mouseleave", resume);
  closeBtn.addEventListener("click", dismiss);

  runBar(TOAST_DURATION);
  scheduleRemoval(TOAST_DURATION);
}
function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body: body,
        icon: "icon-512.png",
        badge: "icon-192.png",
        vibrate: [200, 100, 200]
      });
    });
  } else {
    const n = new Notification(title, { body, icon: "icon-512.png" });
    setTimeout(() => n.close(), 5000);
  }
}
function exportChat() {
  const chat=chats[activeId]; if(!chat) return;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(chat,null,2)],{type:"application/json"}));
  a.download=`sputta-${Date.now()}.json`; a.click();
}
function toggleTheme() {
  lightMode=!lightMode;
  const r=document.documentElement.style;
  if(lightMode){
    r.setProperty("--bg","#f4f1ea"); r.setProperty("--surface","#fffef9"); r.setProperty("--surface2","#ede9df");
    r.setProperty("--border","#ddd8cc"); r.setProperty("--border2","#ccc8be"); r.setProperty("--text","#1a1a18");
    r.setProperty("--muted","#7a7568"); r.setProperty("--faint","#b0ab9f");
    r.setProperty("--green","#4a7c10"); r.setProperty("--green-dim","#e4edcc");
  } else {
    ["--bg","--surface","--surface2","--border","--border2","--text","--muted","--faint","--green","--green-dim"].forEach(v=>r.removeProperty(v));
  }
}

const searchBtn   = document.getElementById("search-btn");
const searchBox   = document.getElementById("search-box");
const searchInput = document.getElementById("search-input");

searchBtn.addEventListener("click", () => {
  searchBox.classList.toggle("show");
  if (searchBox.classList.contains("show")) {
    searchInput.focus();
  } else {
    searchInput.value = "";
    renderSidebar();
  }
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim().toLowerCase();
  historyList.innerHTML = "";
  Object.keys(chats)
    .sort((a, b) => chats[b].ts - chats[a].ts)
    .filter(id => chats[id].title.toLowerCase().includes(query))
    .forEach(id => {
      const el = document.createElement("div");
      el.className = "history-item" + (id === activeId ? " active" : "");
      const title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = chats[id].title;
      el.appendChild(title);
      el.addEventListener("click", () => { loadChat(id); closeSidebar(); });
      historyList.appendChild(el);
    });
});


function formatChatTime(ts) {
  const date = new Date(ts);
  const now  = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday)     return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return date.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + time;
}

const micBtn = document.getElementById("mic-btn");
let recognition = null;
let isRecording = false;

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-NG";

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add("recording");
    msgField.dataset.placeholder = "Listening...";
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript)
      .join("");
    msgField.textContent = transcript;
    updateFieldEmptyState();
    placeCaretAtEnd(msgField);
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove("recording");
    msgField.dataset.placeholder = "Ask anything, or type / for a skill, or attach a file...";
    if (msgField.textContent.trim()) handleSend();
  };

  recognition.onerror = (e) => {
    isRecording = false;
    micBtn.classList.remove("recording");
    msgField.dataset.placeholder = "Ask anything, or type / for a skill, or attach a file...";
    if (e.error === "not-allowed") {
      toast("Microphone permission denied. Please allow it in your browser settings.");
    }
  };

  micBtn.addEventListener("click", () => {
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

} else {
  micBtn.addEventListener("click", () => {
    toast("Voice input is not supported on this browser. Try Chrome.");
  });
}