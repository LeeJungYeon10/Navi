"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 기존 Vanilla의 visibilitychange 세션 추적 로직을 React 클라이언트 컴포넌트로 포팅.
// app/layout.tsx 에 한 번 넣어두면 앱 전체에서 동작합니다.
export default function SessionTracker() {
  useEffect(() => {
    const supabase = createClient();
    let sessionStart: number | null = Date.now();

    const startSession = () => {
      if (!sessionStart) sessionStart = Date.now();
    };

    const endSession = async () => {
      if (!sessionStart) return;
      const duration = Math.floor((Date.now() - sessionStart) / 1000);
      sessionStart = null;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // foreground 시간만 누적 저장 (백그라운드 제외)
      await supabase.from("user_sessions").insert({
        user_id: user.id,
        date: new Date().toISOString().split("T")[0],
        duration_seconds: duration,
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") startSession();
      else endSession();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", endSession);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", endSession);
      endSession();
    };
  }, []);

  return null;
}
