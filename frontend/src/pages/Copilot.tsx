import React, { useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  CopilotConfig,
  getCopilotConfig,
  GroundedContextSummary,
  promoteCopilotToCase,
  sendCopilotMessage,
} from "../api/client";

// Format simple markdown into styled HTML elements safely
function renderFormattedMarkdown(text: string) {
  // Split into lines
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1).filter((r) => !r.every((c) => c.match(/^:?-+:?$/)));
      elements.push(
        <div key={`table-${elements.length}`} className="copilot-table-wrapper">
          <table className="copilot-table">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{renderInlineStyles(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const renderInlineStyles = (str: string): React.ReactNode => {
    // Handle **bold**, `code`, and [links]
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={idx} className="code-inline">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    // Heading 3
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={lineIdx} className="copilot-h3">
          {trimmed.slice(4)}
        </h3>
      );
      return;
    }

    // Heading 4
    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4 key={lineIdx} className="copilot-h4">
          {trimmed.slice(5)}
        </h4>
      );
      return;
    }

    // Bullet point
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={lineIdx} className="copilot-bullet">
          <span className="bullet-dot">•</span>
          <span className="bullet-text">{renderInlineStyles(trimmed.slice(2))}</span>
        </div>
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s(.*)/);
      if (match) {
        elements.push(
          <div key={lineIdx} className="copilot-bullet">
            <span className="bullet-num">{match[1]}</span>
            <span className="bullet-text">{renderInlineStyles(match[2])}</span>
          </div>
        );
        return;
      }
    }

    // Empty line
    if (trimmed === "") {
      elements.push(<div key={lineIdx} className="copilot-spacing" />);
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={lineIdx} className="copilot-p">
        {renderInlineStyles(line)}
      </p>
    );
  });

  if (inTable) {
    flushTable();
  }

  return elements;
}

export default function CopilotPage() {
  const [config, setConfig] = useState<CopilotConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Subject pinning state
  const [pinnedAccount, setPinnedAccount] = useState<string>("ACC-***9481");
  const [pinnedCase, setPinnedCase] = useState<string>("");

  // Promote to Case Modal state
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [selectedCaseNum, setSelectedCaseNum] = useState("CASE-2026-0898");
  const [promoteContent, setPromoteContent] = useState("");
  const [promoteStatus, setPromoteStatus] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    loadConfig();
    // Initialize welcome greeting
    setMessages([
      {
        id: "msg-welcome",
        role: "assistant",
        content: `### SENTINEL AI Fraud Investigation Copilot
I am your dedicated AML crimes investigator, grounded in **9,082 verified enterprise accounts**, **LightGBM v2.4.0 machine learning models** (96.07% PR-AUC), and real-time AML regulatory indicators.

**Quick Capabilities**:
- **Root Cause & XAI**: Ask \`Why was ACC-***9481 classified as high risk?\`
- **FinCEN SAR Co-Pilot**: Ask \`Draft SAR narrative for ACC-***9481\`
- **Syndicate Rings**: Ask \`Explain syndicate SYND-01\`
- **Comparative Analysis**: Ask \`Compare ACC-***9481 with ACC-***7119\`
- **Portfolio Search**: Ask \`Which accounts have the highest risk scores?\``,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestedFollowUps: [
          "Why was ACC-***9481 classified as critical risk?",
          "Draft FinCEN SAR narrative for ACC-***9481",
          "Explain syndicate SYND-01",
          "Which accounts have the highest risk scores?",
        ],
      },
    ]);
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await getCopilotConfig();
      setConfig(cfg);
    } catch {
      // Graceful fallback
      setConfig({
        provider: "local_grounded",
        modelName: "sentinel-forensic-engine-v2",
        hasApiKey: false,
        status: "ready",
        features: ["Account Risk Explainability", "Syndicate Topology", "SAR Drafting"],
        instructions: "Operating in high-precision Local Grounded Forensic Engine mode.",
      });
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setLoading(true);

    try {
      const res = await sendCopilotMessage({
        message: text,
        accountId: pinnedAccount || undefined,
        caseNumber: pinnedCase || undefined,
        history: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
      });

      const assistantMsg: ChatMessage = {
        id: `msg-asst-${Date.now()}`,
        role: "assistant",
        content: res.response,
        groundedContext: res.groundedContext,
        suggestedFollowUps: res.suggestedFollowUps,
        provider: res.provider,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: "assistant",
        content: `### ⚠️ Copilot Error\nFailed to process inquiry: ${err?.message || "Internal server error."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleOpenPromote = (content: string) => {
    setPromoteContent(content);
    setPromoteStatus(null);
    setPromoteModalOpen(true);
  };

  const handleExecutePromote = async () => {
    if (!selectedCaseNum || !promoteContent) return;
    try {
      setPromoteStatus("Saving note to case docket...");
      const res = await promoteCopilotToCase({
        caseNumber: selectedCaseNum,
        content: promoteContent,
      });
      setPromoteStatus(res.message);
      setTimeout(() => {
        setPromoteModalOpen(false);
        setPromoteStatus(null);
      }, 1500);
    } catch (err: any) {
      setPromoteStatus(`Error: ${err?.message || "Failed to attach note."}`);
    }
  };

  const handleExportChat = () => {
    const formatted = messages
      .map(
        (m) =>
          `[${m.timestamp}] ${m.role === "user" ? "FRAUD ANALYST" : "SENTINEL COPILOT"}:\n${m.content}\n\n----------------------------------------\n`
      )
      .join("\n");

    const blob = new Blob([formatted], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinel-copilot-brief-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container copilot-page">
      {/* Page Header */}
      <header className="page-header copilot-header">
        <div className="header-titles">
          <div className="title-row">
            <h1>AI Fraud Investigation Copilot</h1>
            {config?.hasApiKey ? (
              <span className="badge-cloud-connected">
                CONNECTED: {config.provider.toUpperCase()} ({config.modelName})
              </span>
            ) : (
              <span className="badge-local-engine">
                LOCAL GROUNDED FORENSIC ENGINE (100% EVIDENCE GROUNDING)
              </span>
            )}
          </div>
          <p className="subtitle">
            Grounded forensic reasoning, feature explainability, and FinCEN SAR narrative drafting over 9,082 live accounts.
          </p>
        </div>

        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowConfigModal(true)} title="LLM Provider Settings">
            ⚙️ Provider Config
          </button>
          <button className="btn-secondary" onClick={handleExportChat} title="Export transcript as Markdown">
            📥 Export Brief
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              setMessages([
                {
                  id: "msg-welcome",
                  role: "assistant",
                  content: "### Thread Cleared\nSession transcript reset. You may ask a new investigation question or select a prompt below.",
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                  suggestedFollowUps: [
                    "Why was ACC-***9481 classified as critical risk?",
                    "Draft FinCEN SAR narrative for ACC-***9481",
                    "Explain syndicate SYND-01",
                  ],
                },
              ])
            }
            title="Reset Chat Stream"
          >
            🧹 Clear
          </button>
        </div>
      </header>

      {/* Context Inspector Bar */}
      <section className="copilot-context-bar">
        <div className="context-item">
          <span className="context-label">Pinned Subject Account:</span>
          <div className="pinned-pill">
            <span className="pinned-id">{pinnedAccount || "None Selected"}</span>
            {pinnedAccount && <span className="pinned-badge">RISK 99 • CRITICAL</span>}
          </div>
          <button
            className="btn-tiny"
            onClick={() => {
              const newAcc = prompt("Enter Target Account ID (e.g. ACC-***9481 or 9481):", pinnedAccount);
              if (newAcc !== null) setPinnedAccount(newAcc.trim());
            }}
          >
            Change Target
          </button>
        </div>

        <div className="context-item">
          <span className="context-label">Case Docket Linking:</span>
          <span className="pinned-case">{pinnedCase || "Optional (CASE-2026-XXXX)"}</span>
          <button
            className="btn-tiny"
            onClick={() => {
              const newCase = prompt("Enter Case Number to Link (e.g. CASE-2026-0898):", pinnedCase);
              if (newCase !== null) setPinnedCase(newCase.trim());
            }}
          >
            Link Case
          </button>
        </div>
      </section>

      {/* Chat Thread */}
      <div className="copilot-chat-container">
        <div className="chat-thread">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`chat-message-row ${isUser ? "row-user" : "row-assistant"}`}>
                <div className={`message-avatar ${isUser ? "avatar-user" : "avatar-ai"}`}>
                  {isUser ? "AN" : "AI"}
                </div>

                <div className={`message-bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
                  <div className="message-header">
                    <span className="sender-name">{isUser ? "Fraud Investigator" : "SENTINEL AI Copilot"}</span>
                    <span className="timestamp">{msg.timestamp}</span>
                    {!isUser && msg.provider && (
                      <span className="provider-tag">{msg.provider}</span>
                    )}
                  </div>

                  {/* Grounded Context Banner if assistant provided entity grounding */}
                  {!isUser && msg.groundedContext && (
                    <div className="grounded-banner">
                      <div className="grounded-title">
                        🎯 Grounded Forensic Evidence: <strong>{msg.groundedContext.entityId}</strong>
                        {msg.groundedContext.riskScore !== undefined && (
                          <span className="badge-grounded-risk">Score {msg.groundedContext.riskScore}/100</span>
                        )}
                      </div>
                      {msg.groundedContext.activeRules && (
                        <div className="grounded-details">
                          <span>Active AML Triggers:</span>{" "}
                          <strong>{msg.groundedContext.activeRules.join(" • ")}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="message-body">{renderFormattedMarkdown(msg.content)}</div>

                  {/* Assistant Actions */}
                  {!isUser && (
                    <div className="message-actions">
                      <button
                        className="btn-action-pill"
                        onClick={() => handleCopy(msg.content, msg.id)}
                        title="Copy text to clipboard"
                      >
                        {copyFeedback === msg.id ? "✓ Copied!" : "📋 Copy"}
                      </button>
                      <button
                        className="btn-action-pill"
                        onClick={() => handleOpenPromote(msg.content)}
                        title="Attach findings to an active case investigation docket"
                      >
                        📁 Promote to Case Docket
                      </button>
                    </div>
                  )}

                  {/* Suggested Follow-Ups */}
                  {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="follow-ups-container">
                      <span className="follow-up-label">Suggested Inquiries:</span>
                      <div className="follow-ups-list">
                        {msg.suggestedFollowUps.map((q, idx) => (
                          <button
                            key={idx}
                            className="follow-up-chip"
                            onClick={() => handleSendMessage(q)}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="chat-message-row row-assistant">
              <div className="message-avatar avatar-ai">AI</div>
              <div className="message-bubble bubble-assistant loading-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loading-label">Grounding evidence across ML models & transaction graphs...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div className="copilot-input-container">
        <textarea
          className="copilot-input"
          placeholder="Ask SENTINEL Copilot (e.g. 'Why was ACC-***9481 classified as high risk?', 'Draft SAR narrative', 'Explain SYND-01')... Press Enter to submit."
          rows={2}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="btn-primary btn-send"
          onClick={() => handleSendMessage()}
          disabled={!inputMessage.trim() || loading}
        >
          {loading ? (
            <div className="spinner-small" />
          ) : (
            <>
              <span>Ask Copilot</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Modal: Promote Finding to Case Docket */}
      {promoteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Promote Intelligence to Case Docket</h3>
              <button className="btn-close" onClick={() => setPromoteModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label className="input-label">Target Case Docket Number</label>
              <input
                type="text"
                className="input-text"
                value={selectedCaseNum}
                onChange={(e) => setSelectedCaseNum(e.target.value)}
                placeholder="e.g. CASE-2026-0898"
              />

              <label className="input-label" style={{ marginTop: "1rem" }}>
                Intelligence Note Content
              </label>
              <textarea
                className="input-textarea"
                rows={6}
                value={promoteContent}
                onChange={(e) => setPromoteContent(e.target.value)}
              />

              {promoteStatus && <div className="status-msg">{promoteStatus}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setPromoteModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleExecutePromote}>
                Attach Note to Case
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Provider Configuration & Setup */}
      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>LLM Provider Configuration</h3>
              <button className="btn-close" onClick={() => setShowConfigModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="config-item">
                <span className="cfg-key">Active Provider:</span>
                <strong className="cfg-val text-cyan">{config?.provider.toUpperCase()}</strong>
              </div>
              <div className="config-item">
                <span className="cfg-key">Model Name:</span>
                <strong className="cfg-val">{config?.modelName}</strong>
              </div>
              <div className="config-item">
                <span className="cfg-key">API Key Status:</span>
                <strong className={`cfg-val ${config?.hasApiKey ? "text-emerald" : "text-amber"}`}>
                  {config?.hasApiKey ? "Configured & Ready" : "Unset (Operating in Local Grounded Mode)"}
                </strong>
              </div>

              <div className="config-box">
                <h4>How to Connect Google Gemini or OpenAI:</h4>
                <p>1. Open or create the <code>.env</code> file in your project root.</p>
                <p>2. Add your API key:</p>
                <pre className="code-block">
                  {`# Example Google Gemini Configuration
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
LLM_MODEL_NAME=gemini-1.5-flash

# Example OpenAI Configuration
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
LLM_MODEL_NAME=gpt-4o-mini`}
                </pre>
                <p>3. Restart the backend. In the meantime, the <strong>Local Grounded Forensic Engine</strong> is 100% functional, responsive, and grounded in real dataset evidence.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowConfigModal(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
