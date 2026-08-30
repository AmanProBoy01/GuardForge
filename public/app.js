// GuardForge - Frontend Application Logic (v1.0)

let ws = null;
let currentConfig = null;
let wsDestroyed = false; // guard against infinite reconnect on intentional close

document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchConfig();
});

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    logTerminal('[INFO] Connected to TrueForge Agent Harness runtime stream.');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleServerEvent(data);
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  };

  ws.onclose = () => {
    if (wsDestroyed) return; // don't reconnect if intentionally closed
    logTerminal('[WARN] WebSocket disconnected. Reconnecting in 2s...');
    setTimeout(initWebSocket, 2000);
  };
}

function handleServerEvent(data) {
  if (data.type === 'INIT') {
    currentConfig = data.config;
    updateState(data.state);
    renderConfigDisplay(data.config);
  }
  else if (data.type === 'CONFIG_UPDATED') {
    currentConfig = data.config;
    renderConfigDisplay(data.config);
    logTerminal(`[CONFIG] Provider changed to: ${data.config.agent.model.provider} (${data.config.agent.model.name})`);
  }
  else if (data.type === 'STEP_UPDATE') {
    renderStepCard(data);
    updateMetrics(data);
    logTerminal(`[STEP ${data.step}] ${data.title} | Tokens: ${data.tokens}`);

    if (data.status === 'WAITING_FOR_HUMAN' && data.approval) {
      showApprovalModal(data.approval);
      setStatus('PAUSED (HITL)', 'waiting');
    } else if (data.status === 'COMPLETED') {
      setStatus('COMPLETED', 'success');
      resetRunButton();
    } else {
      setStatus('RUNNING', 'running');
    }
  }
  else if (data.type === 'HUMAN_DECISION') {
    hideApprovalModal();
    renderDecisionCard(data);
    logTerminal(`[HUMAN GATEKEEPER] Decision: ${data.decision} - ${data.message}`);
    if (data.decision === 'REJECTED') {
      setStatus('ABORTED', 'idle');
    }
    resetRunButton();
  }
}

// Start Agent Run
async function startAgentRun() {
  const input = document.getElementById('promptInput');
  const runBtn = document.getElementById('runBtn');
  const promptText = input.value.trim();
  if (!promptText) return;

  runBtn.disabled = true;
  runBtn.innerHTML = '⏳ Running...';

  setStatus('RUNNING', 'running');
  logTerminal(`\n[USER COMMAND] Task initiated: "${promptText}"`);

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    await res.json();
  } catch (err) {
    console.error('Failed to start run:', err);
    logTerminal(`[ERROR] Execution failed: ${err.message}`);
    resetRunButton();
  }
}

function resetRunButton() {
  const runBtn = document.getElementById('runBtn');
  runBtn.disabled = false;
  runBtn.innerHTML = '▶ Run Agent';
}

// Send Approval / Rejection
async function sendApproval(decision) {
  try {
    logTerminal(`[USER ACTION] Decision submitted: ${decision}`);
    const res = await fetch('/api/approval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision })
    });
    await res.json();
  } catch (err) {
    console.error('Failed to send approval:', err);
  }
}

// Reset Session
async function resetSession() {
  try {
    await fetch('/api/reset', { method: 'POST' });
    clearLogs();
    resetRunButton();
    setStatus('IDLE', 'idle');
    // Reset subagent pills back to initial state
    document.getElementById('sub1Desc').innerText = 'Ready';
    document.getElementById('sub1Pill').innerText = 'IDLE';
    document.getElementById('sub1Pill').style.color = 'var(--text-muted)';
    document.getElementById('sub2Desc').innerText = 'Container warm';
    document.getElementById('sub2Pill').innerText = 'READY';
    document.getElementById('sub2Pill').style.color = 'var(--accent-green)';
    logTerminal('[SYSTEM] Session reset to clean state.');
  } catch (e) {
    console.error('Failed to reset session:', e);
  }
}

// Clear Feed Logs
function clearLogs() {
  const feed = document.getElementById('feedView');
  feed.innerHTML = `
    <div class="feed-card">
      <div class="card-icon-wrapper">🚀</div>
      <div class="card-body">
        <div class="card-title"><span>GuardForge Agent Ready</span></div>
        <div class="card-text">Feed cleared. Select a preset or type a prompt to run a new agent task.</div>
      </div>
    </div>`;
  document.getElementById('terminalView').innerText = '[00:00:00] [SYSTEM] Feed cleared.\n';
}

// Preset selection
function setPreset(text) {
  document.getElementById('promptInput').value = text;
}

// Tab Switching
function switchTab(tabName) {
  const feedBtn = document.getElementById('tabFeed');
  const termBtn = document.getElementById('tabTerminal');
  const analBtn = document.getElementById('tabAnalytics');
  const feedView = document.getElementById('feedView');
  const termView = document.getElementById('terminalView');
  const analView = document.getElementById('analyticsView');

  feedBtn.classList.remove('active');
  termBtn.classList.remove('active');
  analBtn.classList.remove('active');

  feedView.classList.add('hidden');
  termView.classList.add('hidden');
  analView.classList.add('hidden');

  if (tabName === 'feed') {
    feedBtn.classList.add('active');
    feedView.classList.remove('hidden');
  } else if (tabName === 'terminal') {
    termBtn.classList.add('active');
    termView.classList.remove('hidden');
  } else if (tabName === 'analytics') {
    analBtn.classList.add('active');
    analView.classList.remove('hidden');
  }
}

// Config Modal Helpers
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    currentConfig = data.config;
    renderConfigDisplay(data.config);
  } catch (e) {
    console.error('Could not fetch config:', e);
  }
}

function openConfigModal() {
  document.getElementById('configModal').classList.remove('hidden');
}

function closeConfigModal() {
  document.getElementById('configModal').classList.add('hidden');
}

async function updateProviderConfig() {
  const provider = document.getElementById('providerSelect').value;
  let modelName = 'gpt-4o';
  if (provider === 'anthropic') modelName = 'claude-3-5-sonnet';
  if (provider === 'google') modelName = 'gemini-1.5-pro';
  if (provider === 'ollama') modelName = 'llama3';

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, modelName })
    });
    const data = await res.json();
    currentConfig = data.config;
    renderConfigDisplay(data.config);
  } catch (e) {
    console.error('Failed to update config:', e);
  }
}

function renderConfigDisplay(config) {
  if (!config || !config.agent) return;
  const display = document.getElementById('configYamlDisplay');
  display.innerText = `version: "1.0"\nagent:\n  name: "${config.agent.name}"\n  provider: "${config.agent.model.provider}"\n  model: "${config.agent.model.name}"\n  temperature: ${config.agent.model.temperature}\n  context_window:\n    max_tokens: 128000\n    compaction_threshold: 40000\n  sandbox:\n    provider: "daytona"\n  human_in_the_loop:\n    enabled: true`;
}

// Subagent Logs Inspector Modal
function openSubagentLogs(name, logs) {
  document.getElementById('subagentModalTitle').innerText = `Inspector: ${name}`;
  document.getElementById('subagentModalLogs').innerText = logs;
  document.getElementById('subagentModal').classList.remove('hidden');
}

function closeSubagentModal() {
  document.getElementById('subagentModal').classList.add('hidden');
}

// Feed Card Renderer
function renderStepCard(data) {
  const feed = document.getElementById('feedView');

  const card = document.createElement('div');
  card.className = `feed-card ${data.status === 'WAITING_FOR_HUMAN' ? 'hitl-card' : ''}`;

  let codeSnippet = '';
  if (data.codeSnippet) {
    codeSnippet = `<div class="code-snippet">${escapeHtml(data.codeSnippet)}</div>`;
  }

  card.innerHTML = `
    <div class="card-icon-wrapper">${getIconForStep(data.step)}</div>
    <div class="card-body">
      <div class="card-title">
        <span>${data.title}</span>
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${data.tokens ? data.tokens + ' tokens' : ''}</span>
      </div>
      <div class="card-text">${data.description}</div>
      ${codeSnippet}
    </div>
  `;

  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;

  if (data.tool === 'mcp-security-scanner') {
    document.getElementById('sub1Desc').innerText = '1 CVE identified';
    document.getElementById('sub1Pill').innerText = 'COMPLETED';
    document.getElementById('sub1Pill').style.color = 'var(--accent-green)';
  } else if (data.tool === 'mcp-sandbox') {
    document.getElementById('sub2Desc').innerText = '142 tests passed';
    document.getElementById('sub2Pill').innerText = 'TESTS PASSED';
    document.getElementById('sub2Pill').style.color = 'var(--accent-green)';
  }
}

function renderDecisionCard(data) {
  const feed = document.getElementById('feedView');
  const card = document.createElement('div');
  card.className = 'feed-card';
  card.innerHTML = `
    <div class="card-icon-wrapper">${data.decision === 'APPROVED' ? '✅' : '❌'}</div>
    <div class="card-body">
      <div class="card-title">Human Gatekeeper Decision: ${data.decision}</div>
      <div class="card-text">${data.message}</div>
    </div>
  `;
  feed.appendChild(card);
  feed.scrollTop = feed.scrollHeight;
}

// Modal Helpers
function showApprovalModal(approval) {
  document.getElementById('modalAction').innerText = approval.action;
  document.getElementById('modalTarget').innerText = approval.prTitle || approval.target;
  document.getElementById('modalRisk').innerText = approval.risk || 'HIGH';
  document.getElementById('modalSummary').innerText = approval.summary;

  document.getElementById('approvalModal').classList.remove('hidden');
}

function hideApprovalModal() {
  document.getElementById('approvalModal').classList.add('hidden');
}

// Helpers
function setStatus(text, dotClass) {
  document.getElementById('statusText').innerText = text;
  document.getElementById('statusDot').className = `status-dot ${dotClass}`;
}

function updateMetrics(data) {
  if (data.tokens) {
    document.getElementById('usedTokens').innerText = data.tokens.toLocaleString();
  }
}

function updateState(state) {
  if (state) {
    document.getElementById('usedTokens').innerText = (state.totalTokens || 14250).toLocaleString();
    document.getElementById('compactedTokens').innerText = (state.compactedTokens || 8100).toLocaleString();
    document.getElementById('savingsPercent').innerText = (state.tokenSavingsPercent || 43) + '%';
  }
}

function logTerminal(msg) {
  const time = new Date().toLocaleTimeString();
  const term = document.getElementById('terminalView');
  term.innerText += `[${time}] ${msg}\n`;
  term.scrollTop = term.scrollHeight;
}

function getIconForStep(step) {
  switch(step) {
    case 1: return '🧠';
    case 2: return '🛡️';
    case 3: return '🧪';
    case 4: return '⏸️';
    case 5: return '🚀';
    default: return '⚡';
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
