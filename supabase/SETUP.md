# Supabase 설정 가이드

프로젝트 URL:

```text
https://nackdrgjlmglvcyqmsxg.supabase.co
```

---

## 1. 테이블과 RLS 생성

Supabase Dashboard → **SQL Editor** → `supabase/schema.sql` 내용 전체 실행.

생성되는 테이블:
- `profiles` — 사용자 닉네임(`display_name`), 목표, 대화 톤, 관심 항목
- `daily_footprints` — 날짜별 감정·수면·활동·나비의 한마디·루틴
- `user_sessions` — 화면 오픈 시간, 상호작용 점수, 유대감 보너스 요약

`schema.sql` 마지막의 `handle_new_user` 트리거는 **신규 가입 시 `profiles` 행을 자동 생성**합니다.  
이미 운영 중인 프로젝트는 `supabase/migrations/20250614120000_profile_on_signup.sql` 도 SQL Editor에서 한 번 실행하세요.

닉네임은 로그인·온보딩·마이페이지 저장 시 `profiles.display_name` 과 Auth `user_metadata.display_name` 에 동기화됩니다.

모든 테이블에 RLS가 켜져 있고 `auth.uid() = user_id` 조건으로 본인 데이터만 읽고 씁니다.
대화 원문은 저장하지 않고, 사용자가 확인한 `오늘의 발자국` 요약과 세션 보너스 계산용 요약만 저장합니다.

---

## 2. Supabase anon key 연결

Supabase Dashboard → **Project Settings > API** → `anon public` key 복사.

`supabase-config.js` 수정:

```js
export const SUPABASE_URL = "https://nackdrgjlmglvcyqmsxg.supabase.co";
export const SUPABASE_ANON_KEY = "여기에 anon public key 붙여넣기";
```

---

## 3. Google 로그인 켜기

### 3-1. Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com) → 프로젝트 선택 (또는 새 프로젝트 생성)
2. **APIs & Services > Credentials > Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs에 Supabase가 알려주는 callback URL 추가:
   ```
   https://nackdrgjlmglvcyqmsxg.supabase.co/auth/v1/callback
   ```
5. **Client ID**와 **Client Secret** 복사.

### 3-2. Supabase Dashboard

**Authentication > Providers > Google** → Enable 켜고 Client ID / Secret 입력 → Save.

### 3-3. Redirect URL 등록

**Authentication > URL Configuration > Redirect URLs** 에 추가:

```text
http://localhost:5173/
```

> 상위 폴더에서 서버를 띄웠다면 현재 로컬 폴더명 기준으로 `http://localhost:5173/hellopurrfly/`를 사용하세요.

배포 후에는 실제 도메인도 추가.

---

## 4. LLM 연동 — Gemini Flash(무료) 기본 + OpenAI(유료) 폴백

`navi-chat` Edge Function은 기본적으로 **Gemini 2.5 Flash-Lite(무료 티어)**로 응답하고,
Gemini 호출이 실패하거나(키 미설정, 429/5xx 등) 응답이 비어 있을 때만
**OpenAI GPT-4o-mini(유료)**로 자동 전환합니다.

사업자 등록 전(매출 없음) 구간에는 `GEMINI_API_KEY`만 등록해 비용을 0에 가깝게 유지하고,
`OPENAI_API_KEY`는 안전망으로만 켜 두면 됩니다. 두 키를 모두 등록하면 Gemini가 항상 우선합니다.

### 4-1. Gemini API 키 발급 (기본, 무료)

1. [aistudio.google.com](https://aistudio.google.com) → **Get API key**
2. 무료 티어: **1,500 req/day, 1M TPM** — MVP 충분.

### 4-1b. OpenAI API 키 (폴백, 유료)

1. [platform.openai.com](https://platform.openai.com/api-keys) → API 키 발급.
2. Gemini가 막혔을 때만 호출되므로, 결제 한도(usage limit)를 낮게 설정해두면 안전합니다.

### 4-2. Supabase CLI 설치

```bash
# macOS
brew install supabase/tap/supabase

# Windows (Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# npm
npx supabase --version
```

### 4-3. 프로젝트 로그인 & 연결

```bash
npx supabase login
npx supabase link --project-ref nackdrgjlmglvcyqmsxg
```

### 4-4. API 키를 Supabase Secret으로 등록

```bash
npx supabase secrets set GEMINI_API_KEY=여기에_발급받은_Gemini_키
npx supabase secrets set OPENAI_API_KEY=여기에_발급받은_OpenAI_키
```

`OPENAI_API_KEY`는 폴백용이라 생략 가능합니다(생략 시 Gemini만 사용).
키는 서버에만 저장되고 프론트에는 노출되지 않습니다.

### 4-5. Edge Function 배포

```bash
npx supabase functions deploy navi-chat --no-verify-jwt
npx supabase functions deploy delete-account --no-verify-jwt
```

> `--no-verify-jwt` 옵션은 익명 사용자도 Edge Function을 호출할 수 있게 합니다.
> 어뷰징 방지는 Supabase 무료 티어의 rate limit(500K req/month)으로 1차 차단됩니다.

### 4-6. 동작 확인

```bash
curl -X POST \
  https://qfzisbufklmtqlmzzgcb.supabase.co/functions/v1/navi-chat \
  -H "Content-Type: application/json" \
  -H "apikey: 여기에_anon_key" \
  -d '{"messages":[{"role":"user","text":"오늘 많이 피곤해"}]}'
```

`{"text":"...나비 응답..."}` 이 오면 성공.

---

## 5. 로컬에서 실행

```bash
python -m http.server 5173
```

브라우저에서 `http://localhost:5173/` 열기.  
상위 폴더에서 실행 중이면 `http://localhost:5173/hellopurrfly/`를 열면 됩니다.

---

## 6. 설정 체크리스트

- [ ] `supabase-config.js`에 anon key 입력
- [ ] Supabase SQL Editor에서 schema.sql 실행
- [ ] Supabase에서 Google OAuth 활성화 (Client ID / Secret 입력)
- [ ] Redirect URL 등록 (localhost + 배포 URL)
- [ ] Gemini API 키 발급 (기본/무료)
- [ ] OpenAI API 키 발급 (폴백/유료, 선택)
- [ ] `supabase secrets set GEMINI_API_KEY=...`
- [ ] `supabase secrets set OPENAI_API_KEY=...` (선택)
- [ ] `supabase functions deploy navi-chat --no-verify-jwt`
- [ ] `supabase functions deploy delete-account --no-verify-jwt`
- [ ] curl로 Edge Function 동작 확인

---

## 7. 데이터 정책 메모

건강·감정·수면 관련 민감 데이터를 다룹니다.
MVP 단계에서는 진단·치료 표현을 피하고, 웰니스·루틴 보조 서비스로 안내하세요.
MVP 저장 범위는 `daily_footprints` 요약만으로 제한합니다.
