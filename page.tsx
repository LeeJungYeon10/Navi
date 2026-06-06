"use client";

import { useState } from "react";

// 대화 화면 스켈레톤 (Phase 1 포팅 대상).
// 기존 app.js의 대화 렌더링·상태 로직을 이 컴포넌트 안으로 옮기면 됩니다.
// LLM 호출은 추후 app/api/chat/route.ts (SSE 스트리밍)로 연결하세요.

type Message = { role: "user" | "nabi"; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "nabi", text: "안녕! 오늘 하루는 어땠어? 🐈" },
  ]);
  const [input, setInput] = useState("");

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    // TODO: fetch("/api/chat") 로 나비 응답(스트리밍) 받기
    // TODO: 하루 첫 대화 시 fetch("/api/bond", {method:"POST", body:{sentMessageToday:true}})
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="border-b px-5 py-4" style={{ borderColor: "var(--nabi-border)" }}>
        <h1 className="m-0 text-lg font-bold">나비</h1>
        <p className="m-0 text-sm" style={{ color: "var(--nabi-sub)" }}>
          유대감 ●●●○○ · 오늘도 곁에 있어
        </p>
      </header>

      <section className="flex-1 space-y-3 overflow-y-auto px-5 py-6">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed"
              style={{
                background: m.role === "user" ? "var(--nabi-orange)" : "var(--nabi-paper)",
                color: m.role === "user" ? "#fff" : "var(--nabi-ink)",
                border: m.role === "user" ? "none" : "1px solid var(--nabi-border)",
                borderBottomRightRadius: m.role === "user" ? 6 : undefined,
                borderBottomLeftRadius: m.role === "nabi" ? 6 : undefined,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </section>

      <footer
        className="flex gap-2 border-t px-4 py-3"
        style={{ borderColor: "var(--nabi-border)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="나비에게 말 걸기…"
          className="flex-1 rounded-full px-4 py-2.5 text-[15px] outline-none"
          style={{ background: "var(--nabi-paper)", border: "1px solid var(--nabi-border)" }}
        />
        <button
          onClick={send}
          className="rounded-full px-5 py-2.5 text-[15px] font-semibold text-white"
          style={{ background: "var(--nabi-orange-deep)" }}
        >
          보내기
        </button>
      </footer>
    </main>
  );
}
