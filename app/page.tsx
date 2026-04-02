'use client';

import { useCallback, useEffect, useState } from 'react';
import { useChat } from 'ai/react';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { PdfZone } from './components/PdfZone';
import { ChatMessages } from './components/ChatMessages';
import { ChatInput } from './components/ChatInput';
import { ArtifactPanel } from './components/ArtifactPanel';

// ─── i18n ───────────────────────────────────────────────────────

const translations = {
  en: {
    dragText: 'Drag a PDF here or browse',
    dragSubtext: 'Optimized for long-form research papers',
    change: 'Change',
    new: 'New',
    untitled: 'Untitled',
    settings: 'Settings',
    model: 'Model',
    outputLanguage: 'Language',
    ttsSpeed: 'TTS Speed',
    chatPlaceholder: 'Upload a PDF to get started',
    inputPlaceholder: 'Type a message…',
  },
  zh: {
    dragText: '拖拽 PDF 到此处或浏览',
    dragSubtext: '专为长篇研究论文优化',
    change: '更换',
    new: '新建',
    untitled: '未命名',
    settings: '设置',
    model: '模型',
    outputLanguage: '语言',
    ttsSpeed: '语音速度',
    chatPlaceholder: '上传 PDF 开始使用',
    inputPlaceholder: '输入消息…',
  },
};

// ─── Types ──────────────────────────────────────────────────────

type SessionSummary = {
  id: string;
  status: string;
  pdfName?: string;
  createdAt: string;
};

type ArtifactPreview = {
  type: string;
  path: string;
  label: string;
};

type AppConfig = {
  model: string;
  ttsSpeed: number;
  outputLanguage: 'zh' | 'en';
};

// ─── Page ───────────────────────────────────────────────────────

export default function Home() {
  // Config & language
  const [config, setConfig] = useState<AppConfig>({
    model: '',
    ttsSpeed: 1,
    outputLanguage: 'en',
  });
  const t = translations[config.outputLanguage];

  // Sessions
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Artifact preview
  const [artifact, setArtifact] = useState<ArtifactPreview | null>(null);

  // Chat via Vercel AI SDK
  const { messages, isLoading, append, setMessages } = useChat({
    api: '/api/chat',
    body: { sessionId: activeSessionId },
  });

  // ─── Session management ─────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const session = await res.json();
        setActiveSessionId(session.id);
        setMessages([]);
        setPdfFile(null);
        setArtifact(null);
        fetchSessions();
        return session.id as string;
      }
    } catch { /* ignore */ }
    return null;
  }, [config, fetchSessions, setMessages]);

  const handleSelectSession = useCallback(async (id: string) => {
    setActiveSessionId(id);
    setArtifact(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const session = await res.json();
        // Restore messages from session
        if (session.messages?.length) {
          setMessages(
            session.messages.map((m: { role: string; content: string }, i: number) => ({
              id: `msg-${i}`,
              role: m.role,
              content: m.content,
            }))
          );
        } else {
          setMessages([]);
        }
      }
    } catch {
      setMessages([]);
    }
  }, [setMessages]);

  // ─── PDF upload ─────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    setPdfFile(file);

    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = await createSession();
    }
    if (!sessionId) return;

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('sessionId', sessionId);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        // Auto-send first message to trigger agent
        append({
          role: 'user',
          content: `I've uploaded a PDF: ${data.pdfName}. Please parse it and create a video presentation.`,
        });
      }
    } catch { /* ignore */ }
  }, [activeSessionId, createSession, append]);

  // ─── Config changes ─────────────────────────────────────────

  const handleConfigChange = useCallback((key: string, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ─── Chat send ──────────────────────────────────────────────

  const handleSend = useCallback(async (text: string) => {
    if (!activeSessionId) {
      const id = await createSession();
      if (!id) return;
    }
    append({ role: 'user', content: text });
  }, [activeSessionId, createSession, append]);

  // ─── Render ─────────────────────────────────────────────────

  const showSplit = artifact !== null;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={createSession}
        config={config}
        onConfigChange={handleConfigChange}
        t={t}
      />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 h-full">
        {/* Content area */}
        <div
          className="flex flex-col h-full overflow-hidden transition-all duration-300"
          style={{ width: showSplit ? '50%' : '100%' }}
        >
          {/* PDF Zone */}
          <div className="flex-shrink-0 p-4 pb-0">
            <PdfZone
              file={pdfFile}
              onFileSelect={handleFileSelect}
              sessionId={activeSessionId}
              t={t}
            />
          </div>

          {/* Chat messages */}
          <ChatMessages
            messages={messages}
            onArtifactClick={setArtifact}
            t={t}
          />

          {/* Chat input */}
          <ChatInput
            onSend={handleSend}
            isLoading={isLoading}
            t={t}
          />
        </div>

        {/* Artifact preview panel */}
        <AnimatePresence>
          {showSplit && (
            <ArtifactPanel
              artifact={artifact}
              onClose={() => setArtifact(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
