# 안녕나비야 — Vanilla JS → Next.js 14 전환

> 이 스캐폴드는 "한 번에 다 갈아엎기(big-bang)"가 아니라 **위험을 쪼갠 단계적 전환**을 전제로 합니다.
> 기존 Supabase는 그대로 재사용하고, 프론트만 Next.js로 옮깁니다.

---

## 0. 왜 단계적 전환인가

혼자 개발하는 1인 프로젝트에서 가장 흔한 실패는 "동작하던 앱을 멈추고 몇 주간 전체를 다시 짜다가 지치는 것"입니다.
그래서 **기존 Vanilla 앱을 살려둔 채**, 새 Next.js 앱을 옆에서 키워 화면 단위로 옮겨 붙입니다.

| 단계 | 내용 | 기존 앱 |
|---|---|---|
| **Phase 0** | Next.js 프로젝트 초기화 + Supabase 연결 + 세션 추적 포팅 | 그대로 운영 |
| **Phase 1** | 대화 화면 1개만 Next.js로 포팅 (핵심 경험) | 그대로 운영 |
| **Phase 2** | 유대감/성장/발자국 로직을 API Route로 이전 | 점진 종료 |
| **Phase 3** | 꾸미기·다묘 등 신규 기능은 처음부터 Next.js에서 | 폐기 |

핵심 원칙: **DB(Supabase) 스키마는 건드리지 않는다.** 프론트만 바뀌므로 데이터는 안전합니다.

---

## 1. 초기화

```bash
# 1) 프로젝트 생성 (이 스캐폴드를 빈 폴더에 풀거나, 아래로 새로 생성 후 파일 복사)
npx create-next-app@latest navi --typescript --tailwind --app --eslint

cd navi

# 2) Supabase 클라이언트 (App Router용 최신 패키지)
npm install @supabase/supabase-js @supabase/ssr

# 3) (선택) PWA
npm install next-pwa
```

그 다음 이 스캐폴드의 `app/`, `lib/`, `components/`, `middleware.ts` 를 덮어쓰면 됩니다.

---

## 2. 환경 변수 (`.env.local`)

기존 Vanilla 앱에서 쓰던 Supabase 값을 그대로 넣으세요.

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

> ⚠️ service_role 키는 절대 `NEXT_PUBLIC_`에 넣지 마세요. 서버 전용입니다.

---

## 3. Vanilla → Next.js 매핑 (무엇이 어디로 가나)

| 기존 (Vanilla) | Next.js에서 | 이 스캐폴드 파일 |
|---|---|---|
| `index.html` | App Router 레이아웃 + 페이지 | `app/layout.tsx`, `app/page.tsx` |
| `app.js`의 화면 렌더링 | React 컴포넌트 | `app/page.tsx` |
| `supabase.createClient(...)` (브라우저) | `@supabase/ssr` 브라우저 클라이언트 | `lib/supabase/client.ts` |
| 서버에서 user 조회 | 서버 클라이언트 (쿠키 기반) | `lib/supabase/server.ts` |
| `visibilitychange` 세션 추적 | 클라이언트 컴포넌트 | `components/SessionTracker.tsx` |
| `updateBondSimple()` 유대감 로직 | API Route (서버에서 안전하게) | `lib/bond.ts`, `app/api/bond/route.ts` |
| 로그인 세션 유지 | 미들웨어로 자동 갱신 | `middleware.ts` |

### 가장 큰 변화 하나
기존엔 브라우저에서 `supabase-js`로 직접 DB를 읽고 썼지만, Next.js에선 **유대감·발자국 계산 같은 "신뢰가 필요한 로직"을 API Route(서버)로 옮기는 걸** 강력 권장합니다.
이유: 브라우저 코드는 사용자가 조작할 수 있어서, 클라이언트에서 "유대감 +100" 같은 어뷰징이 가능합니다. 서버에서 계산하면 막힙니다.

---

## 4. 다음 작업 (이 스캐폴드 이후)

1. 기존 `app.js`의 **대화 UI 로직**을 `app/page.tsx`로 이식
2. LLM 호출(Gemini/Claude)을 `app/api/chat/route.ts`로 신설 (스트리밍 SSE)
3. 발자국(소프트 화폐) 적립 로직을 `lib/bond.ts` 옆에 `lib/currency.ts`로 추가
4. 꾸미기 인벤토리 테이블을 Supabase에 추가 (`inventory`, `items`)

---

## 5. 배포

기존 결정(지난 논의)대로 **Vercel** 권장. `git push` → 자동 배포.
Supabase는 그대로 두므로 데이터 마이그레이션 불필요.
