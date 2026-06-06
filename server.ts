import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버 컴포넌트 / API Route / Server Action 에서 쓰는 Supabase 클라이언트.
// 쿠키 기반으로 로그인 세션을 읽고, 신뢰가 필요한 DB 작업(유대감 계산 등)은 여기서 처리합니다.
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트에서 호출되면 set이 무시될 수 있음 — 미들웨어가 세션을 갱신하므로 안전.
          }
        },
      },
    }
  );
}
