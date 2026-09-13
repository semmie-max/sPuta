import { initializeApp }                        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, sendPasswordResetEmail }
                                                from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDocs,
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
const userPill  = $("user-pill");
const userAvatar= $("user-avatar");
const userEmailT= $("user-email-text");
const signoutBtn= $("signout-btn");
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
const toastEl   = $("toast");
const newChatBtn= $("new-chat");
const clearAllBtn=$("clear-all");
const exportBtn = $("export-btn");
const themeBtn  = $("theme-btn");
const menuBtn   = $("menu-btn");
const sidebar   = $("sidebar");
const overlay   = $("overlay");

let currentUser = null;
let chats       = {};   
let activeId    = null;
let pendingFile = null;
let isStreaming = false;
let lightMode   = false;
let saveTimer   = null;
let toastTimer  = null;

onAuthStateChanged(auth, async user => {
  loadingEl.style.display = "none";
  if (user) {
    currentUser = user;
    showUserUI(user);
    requestNotificationPermission();
    await loadChatsFromFirestore();
    const ids = Object.keys(chats).sort((a,b) => chats[b].ts - chats[a].ts);
    if (ids.length) loadChat(ids[0]); else createChat();
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

signoutBtn.addEventListener("click", async () => {
  if (!confirm("Sign out?")) return;
  await signOut(auth);
  chats = {}; activeId = null;
  messagesEl.innerHTML = ""; historyList.innerHTML = "";
  chatTitleEl.textContent = "New Chat";
});

function showUserUI(user) {
  userAvatar.textContent = (user.email || "?")[0].toUpperCase();
  userEmailT.textContent = user.email || "";
  userPill.classList.add("show");
  signoutBtn.classList.add("show");
  authEl.classList.remove("visible");
}
function hideUserUI() {
  userPill.classList.remove("show");
  signoutBtn.classList.remove("show");
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
    if (!confirm("Delete all chat history?")) return;
    const ids = Object.keys(chats);
    for (const id of ids) await deleteChat(id);
    createChat(); closeSidebar();
  });
  exportBtn.addEventListener("click", exportChat);
  themeBtn.addEventListener("click", toggleTheme);
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

async function sendImageDirect(file) {
  addBubble("user", `<strong>Uploaded:</strong> ${esc(file.name)}`);
  showTyping();
  const API_BASE = API_URL.replace(/\/chat$/, "");
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch(`${API_BASE}/read-image`, { method: "POST", mode: "cors", body: formData });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data?.error || data?.detail || `HTTP ${res.status}`);
    finalizeThinking();
    const reply = data?.reply || "Sorry, I could not read this image.";
    addBubble("ai", safe(marked.parse(reply)));
    chats[activeId].msgs.push({role:"user", content:`[Uploaded image: ${file.name}]`, _hidden:true});
    chats[activeId].msgs.push({role:"assistant", content:reply});
    scheduleSave(activeId);
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
addBubble("ai", safe(marked.parse(reply)), responseTime);
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
  renderIntro(); renderSidebar(); scheduleSave(id);
}

function loadChat(id) {
  if(!chats[id]) return;
  activeId=id; chatTitleEl.textContent=chats[id].title;
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

function addBubble(role, html, responseTime="") {
  messagesEl.querySelector(".intro-wrap")?.remove();
  const wrap=document.createElement("div");
  if(role==="user"){ wrap.className="msg-wrap user"; wrap.innerHTML=`<div class="bubble-user">${html}</div>`; }
  else { wrap.className="msg-wrap ai"; wrap.innerHTML=`<div class="ai-header"><div class="ai-badge">Simple</div><div class="ai-line"></div></div><div class="bubble-ai">${html}</div>${responseTime ? `<div class="response-timer">⏱ ${responseTime}s</div>` : ""}`; }
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop=messagesEl.scrollHeight;
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
function toast(msg, ok=false) {
  toastEl.textContent=msg; toastEl.classList.toggle("ok",ok); toastEl.classList.add("show");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>toastEl.classList.remove("show"),3200);
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
networkPill.classList.remove("offline");
networkText.textContent = "Online";

function updateNetwork() {
  if (navigator.onLine) {
    networkPill.classList.remove("Disconnected");
    networkText.textContent = "Connected";
  } else {
    networkPill.classList.add("offline");
networkText.textContent = "No internet";
  }
}

updateNetwork();
window.addEventListener("online",  updateNetwork);
window.addEventListener("offline", updateNetwork);
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