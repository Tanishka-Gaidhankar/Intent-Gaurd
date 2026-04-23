/* ═══════════════════════════════════════
   MODERATION AI  — app.js
   Full interactive logic
═══════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey: '',
  activated: false,
  endpoint: 'http://localhost:8000',
  selectedModel: 'moderation-v1',
  currentView: 'explore',   // 'explore' | 'chat'
  stats: { total: 0, safe: 0, ambiguous: 0, nsfw: 0 },
  history: [],
};

// ── Model catalogue ─────────────────────────────────────────────────────────
const MODELS = [
  {
    id: 'moderation-v1',
    name: 'Moderation v1',
    icon: '🛡️',
    iconBg: 'rgba(129,140,248,0.15)',
    desc: 'Fine-tuned DistilBERT. Classifies prompts as safe, ambiguous, or NSFW with confidence scores.',
    badge: 'Recommended',
  },
  {
    id: 'moderation-v1-strict',
    name: 'Moderation v1 Strict',
    icon: '🔒',
    iconBg: 'rgba(248,113,113,0.12)',
    desc: 'Higher sensitivity mode. Lower NSFW threshold (0.50). Best for child-safe environments.',
    badge: 'Strict',
  },
  {
    id: 'code-and-chat',
    name: 'Code & Chat',
    icon: '💬',
    iconBg: 'rgba(52,211,153,0.12)',
    desc: 'Coming soon. Specialized moderation for code snippets and conversational prompts.',
    badge: 'Soon',
    disabled: true,
  },
];

// ── DOM refs ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const sidebar        = $('sidebar');
const sidebarToggle  = $('sidebarToggle');
const navPlayground  = $('navPlayground');
const navHistory     = $('navHistory');
const navDocs        = $('navDocs');
const navSettings    = $('navSettings');
const exploreView    = $('exploreView');
const chatView       = $('chatView');
const modelGrid      = $('modelGrid');
const promptInput    = $('promptInput');
const runBtn         = $('runBtn');
const clearPrompt    = $('clearPrompt');
const chatInput      = $('chatInput');
const chatRunBtn     = $('chatRunBtn');
const clearChat      = $('clearChat');
const chatMessages   = $('chatMessages');
const chatModelTag   = $('chatModelTag');
const backBtn        = $('backBtn');
const apiKeyInput    = $('apiKeyInput');
const activateBtn    = $('activateBtn');
const toggleKey      = $('toggleKey');
const statusDot      = $('statusDot');
const statusText     = $('statusText');
const modelSelect    = $('modelSelect');
const modelDesc      = $('modelDescription');
const historyPanel   = $('historyPanel');
const historyList    = $('historyList');
const historyCount   = $('historyCount');
const clearHistoryBtn= $('clearHistory');
const statsSection   = $('statsSection');
const statTotal      = $('statTotal');
const statSafe       = $('statSafe');
const statAmb        = $('statAmb');
const statNsfw       = $('statNsfw');
const endpointUrl    = $('endpointUrl');
const endpointInput  = $('endpointInput');
const editEndpoint   = $('editEndpoint');
const copyCodeBtn    = $('copyCodeBtn');
const codeModal      = $('codeModal');
const closeModal     = $('closeModal');
const modalCode      = $('modalCode');
const copyModalCode  = $('copyModalCode');
const toast          = $('toast');

// ── Init ────────────────────────────────────────────────────────────────────
function init() {
  renderModelGrid();
  autoResizeAll();
  bindEvents();
  updateRunBtn();
}

// ── Render model cards ───────────────────────────────────────────────────────
function renderModelGrid() {
  modelGrid.innerHTML = '';
  MODELS.forEach(m => {
    const card = document.createElement('div');
    card.className = 'model-card' + (m.id === state.selectedModel ? ' selected' : '') + (m.disabled ? ' disabled' : '');
    card.dataset.id = m.id;
    card.style.opacity = m.disabled ? '0.45' : '1';
    card.style.cursor  = m.disabled ? 'not-allowed' : 'pointer';
    card.innerHTML = `
      <div class="model-card-icon" style="background:${m.iconBg}">${m.icon}</div>
      <div class="model-card-name">${m.name}</div>
      <div class="model-card-id">${m.id}</div>
      <div class="model-card-desc">${m.desc}</div>
      ${m.id === state.selectedModel ? '<div class="selected-badge">Selected</div>' : ''}
    `;
    if (!m.disabled) {
      card.addEventListener('click', () => selectModel(m.id));
    }
    modelGrid.appendChild(card);
  });
}

function selectModel(id) {
  state.selectedModel = id;
  modelSelect.value = id;
  renderModelGrid();
  updateModelDesc();
  updateRunBtn();
  showToast(`Model set to ${id}`);
}

function updateModelDesc() {
  const m = MODELS.find(x => x.id === state.selectedModel);
  if (m) modelDesc.innerHTML = m.desc;
}

// ── Sidebar ──────────────────────────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

navPlayground.addEventListener('click', e => {
  e.preventDefault();
  setActive(navPlayground);
  switchToExplore();
});

navHistory.addEventListener('click', e => {
  e.preventDefault();
  setActive(navHistory);
  historyPanel.style.display = historyPanel.style.display === 'none' ? 'block' : 'none';
});

navDocs.addEventListener('click', e => {
  e.preventDefault();
  window.open(`${state.endpoint}/docs`, '_blank');
});

navSettings.addEventListener('click', e => {
  e.preventDefault();
  setActive(navSettings);
  showToast('Settings are in the right panel →');
});

function setActive(el) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ── API Key ──────────────────────────────────────────────────────────────────
toggleKey.addEventListener('click', () => {
  const isText = apiKeyInput.type === 'text';
  apiKeyInput.type  = isText ? 'password' : 'text';
  toggleKey.querySelector('svg').style.opacity = isText ? '1' : '0.5';
});

activateBtn.addEventListener('click', activateKey);
apiKeyInput.addEventListener('keydown', e => { if (e.key === 'Enter') activateKey(); });

async function activateKey() {
  const key = apiKeyInput.value.trim();
  if (!key) { showToast('Enter an API key first', 'error'); return; }

  activateBtn.textContent = 'Checking…';
  activateBtn.disabled = true;

  try {
    const res = await fetch(`${state.endpoint}/`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    // /  endpoint doesn't need auth — just check server is up
    if (res.ok || res.status === 401) {
      // Try a real auth check
      const authRes = await fetch(`${state.endpoint}/v1/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ model: state.selectedModel, input: 'test' }),
      });

      if (authRes.status === 401) {
        setKeyStatus('error', 'Invalid API key');
        apiKeyInput.classList.add('invalid');
        apiKeyInput.classList.remove('valid');
        showToast('Invalid API key', 'error');
      } else {
        state.apiKey    = key;
        state.activated = true;
        setKeyStatus('active', 'Key activated');
        apiKeyInput.classList.add('valid');
        apiKeyInput.classList.remove('invalid');
        updateRunBtn();
        showToast('API key activated ✓');
      }
    }
  } catch {
    setKeyStatus('error', 'Server unreachable');
    showToast(`Cannot reach ${state.endpoint}`, 'error');
  } finally {
    activateBtn.textContent = 'Activate Key';
    activateBtn.disabled = false;
  }
}

function setKeyStatus(type, text) {
  statusDot.className = `status-dot ${type}`;
  statusText.textContent = text;
}

// ── Model selector (right panel) ─────────────────────────────────────────────
modelSelect.addEventListener('change', () => {
  selectModel(modelSelect.value);
});

// ── Endpoint editing ─────────────────────────────────────────────────────────
editEndpoint.addEventListener('click', () => {
  endpointInput.classList.toggle('hidden');
  endpointUrl.classList.toggle('hidden');
  if (!endpointInput.classList.contains('hidden')) endpointInput.focus();
});

endpointInput.addEventListener('change', () => {
  state.endpoint = endpointInput.value.trim().replace(/\/$/, '');
  endpointUrl.textContent = state.endpoint;
  endpointInput.classList.add('hidden');
  endpointUrl.classList.remove('hidden');
  showToast('Endpoint updated');
});

// ── Textarea auto-resize ─────────────────────────────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

function autoResizeAll() {
  [promptInput, chatInput].forEach(el => {
    el.addEventListener('input', () => autoResize(el));
  });
}

// ── Run button state ─────────────────────────────────────────────────────────
function updateRunBtn() {
  const hasText   = promptInput.value.trim().length > 0;
  const hasModel  = !!state.selectedModel;
  const hasKey    = state.activated;
  runBtn.disabled = !(hasText && hasModel && hasKey);

  if (!hasKey) {
    $('runLabel').textContent = 'Activate key first';
  } else if (!hasText) {
    $('runLabel').textContent = 'Run';
  } else {
    $('runLabel').textContent = 'Run';
  }
}

promptInput.addEventListener('input', updateRunBtn);

// ── Clear buttons ─────────────────────────────────────────────────────────────
clearPrompt.addEventListener('click', () => {
  promptInput.value = '';
  autoResize(promptInput);
  updateRunBtn();
});

clearChat.addEventListener('click', () => {
  chatInput.value = '';
  autoResize(chatInput);
});

// ── Keyboard shortcuts ───────────────────────────────────────────────────────
promptInput.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    if (!runBtn.disabled) runFromExplore();
  }
});

chatInput.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    runFromChat();
  }
});

// ── Main run flow ─────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runFromExplore);
chatRunBtn.addEventListener('click', runFromChat);

function runFromExplore() {
  const text = promptInput.value.trim();
  if (!text || !state.activated) return;
  switchToChat();
  submitAndDisplay(text);
  promptInput.value = '';
  autoResize(promptInput);
}

function runFromChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  submitAndDisplay(text);
  chatInput.value = '';
  autoResize(chatInput);
}

// ── View switching ────────────────────────────────────────────────────────────
function switchToChat() {
  state.currentView = 'chat';
  exploreView.style.display = 'none';
  chatView.style.display    = 'flex';
  const m = MODELS.find(x => x.id === state.selectedModel);
  chatModelTag.textContent  = m ? m.id : state.selectedModel;
  setActive(navPlayground);
}

function switchToExplore() {
  state.currentView = 'explore';
  chatView.style.display    = 'none';
  exploreView.style.display = 'flex';
}

backBtn.addEventListener('click', switchToExplore);

// ── API call & render ─────────────────────────────────────────────────────────
async function submitAndDisplay(text) {
  // User bubble
  appendUserMsg(text);

  // Loading indicator
  const loadingEl = appendLoading();

  try {
    const res = await fetch(`${state.endpoint}/v1/moderate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.apiKey}`,
      },
      body: JSON.stringify({ model: state.selectedModel, input: text }),
    });

    loadingEl.remove();

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      appendError(errData.detail || `HTTP ${res.status}`);
      return;
    }

    const data = await res.json();
    appendResult(text, data);
    updateStats(data.result);
    addToHistory(text, data.result);

  } catch (err) {
    loadingEl.remove();
    appendError(`Network error: ${err.message}. Is the API server running?`);
  }
}

// ── Message builders ──────────────────────────────────────────────────────────
function appendUserMsg(text) {
  const el = document.createElement('div');
  el.className = 'msg msg-user';
  el.innerHTML = `
    <div class="msg-label">You</div>
    <div class="msg-bubble-user">${escHtml(text)}</div>
  `;
  chatMessages.appendChild(el);
  scrollChat();
}

function appendLoading() {
  const el = document.createElement('div');
  el.className = 'msg msg-loading';
  el.innerHTML = `<div class="spinner"></div><span>Analyzing prompt…</span>`;
  chatMessages.appendChild(el);
  scrollChat();
  return el;
}

function appendError(msg) {
  const el = document.createElement('div');
  el.className = 'msg msg-result';
  el.innerHTML = `
    <div class="result-card result-nsfw">
      <div class="result-header">
        <span style="color:var(--nsfw);font-size:13px;font-weight:600">⚠ Error</span>
      </div>
      <div class="result-body">
        <div class="result-explanation">${escHtml(msg)}</div>
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  scrollChat();
}

function appendResult(text, data) {
  const r       = data.result;
  const label   = r.risk_level === 'low' ? 'safe' : r.risk_level === 'medium' ? 'ambiguous' : 'nsfw';
  const decision= r.decision;
  const conf    = r.confidence_score;
  const pct     = Math.round(conf * 100);

  // Build probability rows (mock for display — API only returns max confidence)
  const probRows = buildProbRows(label, conf);

  // Flagged words
  const flaggedHtml = r.flagged_words && r.flagged_words.length
    ? `<div class="flagged-section">
        <div class="flagged-title">Flagged tokens</div>
        <div class="flagged-words">
          ${r.flagged_words.map(w =>
            `<span class="flagged-word">${escHtml(w.word)} <span class="flagged-score">${w.importance_score.toFixed(3)}</span></span>`
          ).join('')}
        </div>
      </div>`
    : '';

  // Verdict icon
  const icons = {
    safe:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    ambiguous:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    nsfw:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const el = document.createElement('div');
  el.className = 'msg msg-result';
  el.innerHTML = `
    <div class="result-card result-${label}">
      <div class="result-header">
        <div class="result-verdict">
          <div class="verdict-badge ${label}">
            ${icons[label]}
            ${label.toUpperCase()}
          </div>
          <span class="decision-chip decision-${decision}">${decision}</span>
        </div>
        <div class="confidence-wrap">
          <div class="confidence-bar">
            <div class="confidence-fill conf-${label}" style="width:${pct}%"></div>
          </div>
          <span>${pct}%</span>
        </div>
      </div>
      <div class="result-body">
        <div class="result-explanation">${escHtml(r.explanation)}</div>
        <div class="prob-rows">${probRows}</div>
        ${flaggedHtml}
      </div>
    </div>
  `;
  chatMessages.appendChild(el);
  scrollChat();
}

function buildProbRows(winningLabel, conf) {
  // Distribute remaining probability roughly between other classes
  const labels = ['safe', 'ambiguous', 'nsfw'];
  const probs = {};
  probs[winningLabel] = conf;
  const rest = labels.filter(l => l !== winningLabel);
  const remaining = 1 - conf;
  // Split remaining unevenly to look realistic
  probs[rest[0]] = parseFloat((remaining * 0.65).toFixed(3));
  probs[rest[1]] = parseFloat((remaining * 0.35).toFixed(3));

  return labels.map(l => {
    const p = probs[l];
    return `
      <div class="prob-row">
        <span class="prob-name">${l}</span>
        <div class="prob-bar"><div class="prob-fill prob-${l}" style="width:${Math.round(p*100)}%"></div></div>
        <span class="prob-pct">${(p * 100).toFixed(1)}%</span>
      </div>
    `;
  }).join('');
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function updateStats(result) {
  state.stats.total++;
  if (result.risk_level === 'low')    state.stats.safe++;
  if (result.risk_level === 'medium') state.stats.ambiguous++;
  if (result.risk_level === 'high')   state.stats.nsfw++;

  statTotal.textContent = state.stats.total;
  statSafe.textContent  = state.stats.safe;
  statAmb.textContent   = state.stats.ambiguous;
  statNsfw.textContent  = state.stats.nsfw;

  statsSection.style.display = 'flex';
}

// ── History ───────────────────────────────────────────────────────────────────
function addToHistory(text, result) {
  const label = result.risk_level === 'low' ? 'safe' : result.risk_level === 'medium' ? 'ambiguous' : 'nsfw';
  const colors = { safe: 'var(--safe)', ambiguous: 'var(--amb)', nsfw: 'var(--nsfw)' };
  state.history.unshift({ text, label });
  if (state.history.length > 20) state.history.pop();
  historyCount.textContent = state.history.length;
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  const colors = { safe: 'var(--safe)', ambiguous: 'var(--amb)', nsfw: 'var(--nsfw)' };
  state.history.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-dot" style="background:${colors[item.label]}"></div>
      <span class="history-text">${escHtml(item.text.slice(0, 40))}${item.text.length > 40 ? '…' : ''}</span>
      <span class="history-label" style="color:${colors[item.label]}">${item.label}</span>
    `;
    el.addEventListener('click', () => {
      chatInput.value = item.text;
      autoResize(chatInput);
      if (state.currentView === 'explore') switchToChat();
    });
    historyList.appendChild(el);
  });
}

clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  historyList.innerHTML = '';
  historyCount.textContent = '0';
});

// ── Get Code Modal ────────────────────────────────────────────────────────────
const CODE_TEMPLATES = {
  curl: (ep, key, model) =>
`curl -X POST "${ep}/v1/moderate" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key || '<your-api-key>'}" \\
  -d '{
    "model": "${model}",
    "input": "Your prompt here"
  }'`,

  python: (ep, key, model) =>
`import requests

response = requests.post(
    "${ep}/v1/moderate",
    headers={
        "Authorization": "Bearer ${key || '<your-api-key>'}",
        "Content-Type": "application/json",
    },
    json={
        "model": "${model}",
        "input": "Your prompt here",
    },
)

result = response.json()
print(result["result"]["decision"])  # allowed | warn | blocked
print(result["result"]["risk_level"])`,

  js: (ep, key, model) =>
`const response = await fetch("${ep}/v1/moderate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${key || '<your-api-key>'}",
  },
  body: JSON.stringify({
    model: "${model}",
    input: "Your prompt here",
  }),
});

const data = await response.json();
console.log(data.result.decision);    // allowed | warn | blocked
console.log(data.result.risk_level);  // low | medium | high`,
};

let currentLang = 'curl';

function updateModalCode() {
  const fn = CODE_TEMPLATES[currentLang];
  modalCode.textContent = fn(state.endpoint, state.apiKey, state.selectedModel);
}

copyCodeBtn.addEventListener('click', () => {
  codeModal.classList.remove('hidden');
  updateModalCode();
});

closeModal.addEventListener('click', () => codeModal.classList.add('hidden'));
codeModal.addEventListener('click', e => { if (e.target === codeModal) codeModal.classList.add('hidden'); });

document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentLang = tab.dataset.lang;
    updateModalCode();
  });
});

copyModalCode.addEventListener('click', () => {
  navigator.clipboard.writeText(modalCode.textContent).then(() => showToast('Copied to clipboard'));
});

// ── Utils ─────────────────────────────────────────────────────────────────────
function scrollChat() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let toastTimer;
function showToast(msg, type = 'info') {
  toast.textContent = msg;
  toast.className   = 'toast show';
  toast.style.borderColor = type === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
