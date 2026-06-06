# Supabase 설정 가이드

프로젝트 URL:

```text
https://nackdrgjlmglvcyqmsxg.supabase.co
```

---

## 1. 테이블과 RLS 생성

Supabase Dashboard → **SQL Editor** → `supabase/schema.sql` 내용 전체 실행.

생성되는 테이블:
- `profiles` — 사용자 목표, 대화 톤, 관심 항목
- `daily_footprints` — 날짜별 감정·수면·활동·나비의 한마디·루틴
- `user_sessions` — 화면 오픈 시간, 상호작용 점수, 유대감 보너스 요약

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

```
http://localhost:5173/Navi/
```

배포 후에는 실제 도메인도 추가.

---

## 4. LLM 연동 — Gemini Flash (무료)

### 4-1. Gemini API 키 발급

1. [aistudio.google.com](https://aistudio.google.com) → **Get API key**
2. 무료 티어: **1,500 req/day, 1M TPM** — MVP 충분.

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

### 4-4. Gemini API 키를 Supabase Secret으로 등록

```bash
npx supabase secrets set GEMINI_API_KEY=여기에_발급받은_키
```

키가 서버에만 저장되고 프론트에는 노출되지 않습니다.

### 4-5. Edge Function 배포

```bash
npx supabase functions deploy navi-chat --no-verify-jwt
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

브라우저에서 `http://localhost:5173/Navi/` 열기.

---

## 6. 설정 체크리스트

- [ ] `supabase-config.js`에 anon key 입력
- [ ] Supabase SQL Editor에서 schema.sql 실행
- [ ] Supabase에서 Google OAuth 활성화 (Client ID / Secret 입력)
- [ ] Redirect URL 등록 (localhost + 배포 URL)
- [ ] Gemini API 키 발급
- [ ] `supabase secrets set GEMINI_API_KEY=...`
- [ ] `supabase functions deploy navi-chat --no-verify-jwt`
- [ ] curl로 Edge Function 동작 확인

---

## 7. 데이터 정책 메모

건강·감정·수면 관련 민감 데이터를 다룹니다.
MVP 단계에서는 진단·치료 표현을 피하고, 웰니스·루틴 보조 서비스로 안내하세요.
MVP 저장 범위는 `daily_footprints` 요약만으로 제한합니다.
