const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const yaml = require('yaml');

// Import TrueForge Agent Harness Engine
let TrueForgeHarness = null;
try {
  TrueForgeHarness = require('@truefoundry/trueforge');
  console.log('✅ TrueForge Harness Library (@truefoundry/trueforge) loaded successfully.');
} catch (e) {
  console.log('ℹ️ Running in TrueForge Standalone Agent Runtime mode.');
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load TrueForge Agent Configuration
let agentConfig = {};
const configPath = path.join(__dirname, 'agent.yaml');

function loadConfig() {
  try {
    const yamlContent = fs.readFileSync(configPath, 'utf8');
    agentConfig = yaml.parse(yamlContent);
    console.log('✅ TrueForge Agent Config Loaded:', agentConfig.agent.name);
  } catch (e) {
    console.error('⚠️ Could not load agent.yaml:', e.message);
  }
}
loadConfig();

// Session State
let sessionState = {
  sessionId: 'tf-session-' + Date.now(),
  status: 'IDLE', // IDLE, RUNNING, WAITING_FOR_HUMAN, COMPLETED, CANCELLED
  currentStep: 0,
  totalTokens: 14250,
  compactedTokens: 8100,
  tokenSavingsPercent: 43,
  pendingApproval: null,
  activePrompt: 'Scan repository for security vulnerabilities and prepare patch.',
  subagents: {
    scanner: { id: 'Subagent-Scanner', status: 'IDLE', logs: ['[INIT] Scanner subagent initialized.'] },
    sandbox: { id: 'Daytona-Sandbox', status: 'READY', logs: ['[INIT] Daytona container warmed up & ready.'] }
  },
  logs: []
};

// WebSocket Broadcast Helper
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// REST APIs
app.get('/api/agent', (req, res) => {
  res.json({ config: agentConfig, state: sessionState });
});

app.get('/api/config', (req, res) => {
  res.json({ config: agentConfig });
});

app.post('/api/config', (req, res) => {
  const { provider, modelName, temperature } = req.body;
  if (provider && agentConfig.agent) {
    agentConfig.agent.model.provider = provider;
    if (modelName) agentConfig.agent.model.name = modelName;
    if (temperature) agentConfig.agent.model.temperature = parseFloat(temperature);
    
    broadcast({ type: 'CONFIG_UPDATED', config: agentConfig });
    return res.json({ success: true, config: agentConfig });
  }
  res.status(400).json({ error: 'Invalid config payload' });
});

app.post('/api/reset', (req, res) => {
  sessionState.status = 'IDLE';
  sessionState.currentStep = 0;
  sessionState.pendingApproval = null;
  sessionState.subagents.scanner.status = 'IDLE';
  sessionState.subagents.sandbox.status = 'READY';
  sessionState.logs = [];

  broadcast({ type: 'INIT', config: agentConfig, state: sessionState });
  res.json({ success: true, state: sessionState });
});

app.post('/api/approval', (req, res) => {
  const { decision } = req.body;

  if (sessionState.status !== 'WAITING_FOR_HUMAN') {
    return res.status(400).json({ error: 'No approval pending' });
  }

  if (decision === 'APPROVED') {
    sessionState.status = 'RUNNING';
    const actionName = sessionState.pendingApproval ? sessionState.pendingApproval.action : 'Action';
    sessionState.pendingApproval = null;

    broadcast({
      type: 'HUMAN_DECISION',
      decision: 'APPROVED',
      message: `✅ Human APPROVED ${actionName}. Executing payload on GitHub production branch...`
    });

    setTimeout(() => runStep5_Finalize(), 1500);
  } else {
    sessionState.status = 'CANCELLED';
    const actionName = sessionState.pendingApproval ? sessionState.pendingApproval.action : 'Action';
    sessionState.pendingApproval = null;

    broadcast({
      type: 'HUMAN_DECISION',
      decision: 'REJECTED',
      message: `❌ Human REJECTED ${actionName}. Operation cancelled safely.`
    });
  }

  res.json({ success: true, state: sessionState });
});

app.post('/api/run', (req, res) => {
  const { prompt } = req.body;
  const userPrompt = prompt || sessionState.activePrompt;

  sessionState.activePrompt = userPrompt;
  sessionState.status = 'RUNNING';
  sessionState.currentStep = 1;
  sessionState.pendingApproval = null;

  res.json({ success: true, message: 'Execution loop started' });

  runAgentLoop(userPrompt);
});

// Dynamic Execution Engine tailored to prompt content
function runAgentLoop(prompt) {
  const isTestTask = prompt.toLowerCase().includes('test');
  const isMergeTask = prompt.toLowerCase().includes('merge');

  // Step 1: Perception
  broadcast({
    type: 'STEP_UPDATE',
    step: 1,
    title: '🧠 Agent Perception & Planning',
    description: `Task Objective: "${prompt}"\nEvaluating TrueForge MCP servers and initializing context window...`,
    status: 'IN_PROGRESS',
    tokens: 1450
  });

  // Step 2: Scanner / Analysis
  setTimeout(() => {
    sessionState.currentStep = 2;
    sessionState.subagents.scanner.status = 'ACTIVE';
    sessionState.subagents.scanner.logs.push(`[SCAN] Analyzed repository for "${prompt}"`);

    broadcast({
      type: 'STEP_UPDATE',
      step: 2,
      title: '🛡️ MCP Tool Call: mcp-security-scanner',
      description: isTestTask 
        ? 'Scanning test coverage & package dependencies... Found 0 blocking errors.' 
        : 'Audited package.json dependencies... Identified 1 High Severity Vulnerability (CVE-2026-3104 in lodash@4.17.15).',
      tool: 'mcp-security-scanner',
      codeSnippet: isTestTask 
        ? `// jest.config.js\nmodule.exports = { coverageThreshold: { global: { branches: 85 } } };`
        : `--- package.json\n+++ package.json\n- "lodash": "4.17.15"\n+ "lodash": "4.17.21"`,
      status: 'SUCCESS',
      tokens: 3800
    });
  }, 2000);

  // Step 3: Sandbox Code Execution
  setTimeout(() => {
    sessionState.currentStep = 3;
    sessionState.subagents.sandbox.status = 'RUNNING';
    sessionState.subagents.sandbox.logs.push('[EXEC] Executed container build & unit test suite.');

    broadcast({
      type: 'STEP_UPDATE',
      step: 3,
      title: '🧪 Subagent Worker: Daytona Sandbox Execution',
      description: isTestTask 
        ? 'Running full integration test suite inside Daytona container sandbox...'
        : 'Upgraded lodash in sandbox container. Running unit tests (142 tests passed, 0 failures).',
      tool: 'mcp-sandbox',
      codeSnippet: `> npm test\n  PASS  test/security.spec.js (1.4s)\n  PASS  test/auth.spec.js (0.8s)\nTest Suites: 12 passed, 12 total\nTests:       142 passed, 142 total`,
      status: 'SUCCESS',
      tokens: 9200
    });
  }, 4500);

  // Step 4: Safety Gate (HITL)
  setTimeout(() => {
    sessionState.currentStep = 4;
    sessionState.status = 'WAITING_FOR_HUMAN';
    sessionState.pendingApproval = {
      action: isMergeTask ? 'trigger_production_deploy' : 'github_merge_pr',
      prTitle: isMergeTask ? 'Release v1.0 to Production' : 'PR #42: Security Fix for CVE-2026-3104',
      prUrl: 'https://github.com/org/repo/pull/42',
      risk: 'HIGH',
      summary: `Requesting human authorization to execute "${prompt}" on production branch.`
    };

    broadcast({
      type: 'STEP_UPDATE',
      step: 4,
      title: '⏸️ TrueForge Safety Gate: HUMAN APPROVAL REQUIRED',
      description: 'Pull Request #42 generated and audited by Qodo AI. Execution paused before production merge.',
      tool: 'mcp-github',
      status: 'WAITING_FOR_HUMAN',
      approval: sessionState.pendingApproval,
      tokens: 12400
    });
  }, 7000);
}

function runStep5_Finalize() {
  sessionState.currentStep = 5;
  sessionState.status = 'COMPLETED';
  sessionState.totalTokens = 14250;

  broadcast({
    type: 'STEP_UPDATE',
    step: 5,
    title: '🚀 PR Merged & Incident Resolved',
    description: 'Pull Request successfully merged into main branch. Qodo review audit trail logged. Deployment completed.',
    status: 'COMPLETED',
    tokens: 14250
  });
}

// WebSocket Ping / Heartbeat
setInterval(() => {
  wss.clients.forEach(ws => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.send(JSON.stringify({
    type: 'INIT',
    config: agentConfig,
    state: sessionState
  }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 GuardForge running on http://localhost:${PORT}`);
});
