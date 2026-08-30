# 🤖 GuardForge - TrueForge Agent Harness

> **Autonomous DevOps & Code Security Agent built on TrueForge Agent Harness for The Agent Harness Hackathon (WeMakeDevs x TrueFoundry x Qodo).**

![GuardForge AI Dashboard](./public/preview-screenshot.png)

---

## 🌟 Overview

**GuardForge AI** is an autonomous DevOps and Code Security agent built on **TrueForge** (TrueFoundry's open-source agent harness). 

It continuously monitors software repositories for security vulnerabilities (CVEs), generates dependency patches, runs test suites inside isolated sandboxes, and manages Pull Request workflows. Above all, GuardForge AI enforces a strict **Human-in-the-Loop (HITL)** safety gate to ensure no high-stakes code merges or production deployments happen without explicit human approval.

---


| Utilizes TrueForge `agent.yaml` presets, Model Context Protocol (MCP) tool routing, automatic context token compaction (saving 43% tokens), dynamic Daytona code sandboxing, and Human-in-the-Loop safety pauses. |
| 🎨 **Savile Row Track** *(Best UI)* | **Apple iPad** *(for each team member)* | Features a state-of-the-art dark-mode dashboard (HTML/CSS/JS) with live tool execution cards, subagent status indicators, context efficiency metrics, and an interactive **Human Approval Modal**. |
| 🛡️ **Q Branch Track** *(Best Code Quality)* | **Apple Mac Mini** | Developed following strict open-source practices using GitHub Pull Requests reviewed and audited by **Qodo Merge**. |
| 💼 **Universal Exports** | **TrueFoundry Job Interviews** | End-to-end production architecture ready for deployment on TrueFoundry compute planes. |

---

## 🏗️ Architecture & Harness Workflow

```
               +----------------------------------+
               |        User Intent Prompt        |
               +----------------------------------+
                                |
                                v
               +----------------------------------+
               |  TrueForge Agent Execution Loop  |
               |   (Context Window Compaction)    |
               +----------------------------------+
                                |
        +-----------------------+-----------------------+
        |                                               |
        v                                               v
+------------------------+             +----------------------------------+
|  MCP Security Scanner  |             |  Subagent: Daytona Sandbox Exec  |
|  (Audits package.json) |             |  (Runs test suites in container) |
+------------------------+             +----------------------------------+
        |                                               |
        +-----------------------+-----------------------+
                                |
                                v
               +----------------------------------+
               | ⚠️ HUMAN-IN-THE-LOOP SAFETY GATE  |
               | (Pauses execution before merge)  |
               +----------------------------------+
                                |
                     [ Human Decision: APPROVE ]
                                |
                                v
               +----------------------------------+
               |      GitHub MCP: Merge PR        |
               |     (Qodo Code Audit Trail)      |
               +----------------------------------+
```

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended)
- npm / npx

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AmanProBoy01/guardforge-ai.git
   cd guardforge-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the TrueForge Agent Harness Studio:**
   ```bash
   npm start
   ```

4. **Open in Browser:**
   Navigate to `http://localhost:3000` to interact with the GuardForge AI Studio dashboard!

---

## ⚙️ TrueForge Agent Configuration (`agent.yaml`)

GuardForge AI is declaratively configured via `agent.yaml`:

```yaml
version: "1.0"
agent:
  name: "GuardForge AI"
  id: "guardforge-devops-security"

  model:
    provider: "openai"
    name: "gpt-4o"

  context_window:
    max_tokens: 128000
    compaction_threshold: 40000
    offload_large_payloads: true

  mcp_servers:
    - name: "mcp-github"
    - name: "mcp-security-scanner"
    - name: "mcp-sandbox"

  sandbox:
    provider: "daytona"

  human_in_the_loop:
    require_approval_for:
      - "github_merge_pr"
      - "execute_destructive_command"
```

---

## 📄 License
Distributed under the MIT License.
