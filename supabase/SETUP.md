# Supabase 설정 가이드

프로젝트 URL:

```text
https://nackdrgjlmglvcyqmsxg.supabase.co
```

## 1. 테이블과 RLS 생성

Supabase Dashboard에서 `SQL Editor`를 열고 `supabase/schema.sql` 내용을 실행합니다.

생성되는 테이블:

- `profiles`: 사용자 목표, 대화 톤, 관심 항목
- `daily_footprints`: 날짜별 감정, 수면, 활동, 나비의 한마디, 선택 루틴

모든 테이블은 RLS가 켜져 있고, `auth.uid() = user_id` 조건으로 본인 데이터만 읽고 쓸 수 있게 되어 있습니다.
대화 원문은 Supabase에 저장하지 않고, 사용자가 확인한 `오늘의 발자국` 요약만 저장합니다.

## 2. anon public key 연결

Supabase Dashboard에서 `Project Settings > API`로 이동합니다.

`Project API keys`의 `anon public` key를 복사해서 `supabase-config.js`에 붙여넣습니다.

```js
export const SUPABASE_URL = "https://nackdrgjlmglvcyqmsxg.supabase.co";
export const SUPABASE_ANON_KEY = "여기에 anon public key";
```

## 3. Google 로그인 켜기

Supabase Dashboard에서 `Authentication > Providers > Google`로 이동해 Google provider를 활성화합니다.

Google Cloud Console에서 OAuth Client ID와 Client Secret을 만든 뒤 Supabase에 입력합니다.

## 4. Redirect URL 등록

Supabase Dashboard의 `Authentication > URL Configuration`에서 아래 URL을 Redirect URL에 추가합니다.

로컬 개발:

```text
http://localhost:5173/Navi/
```

배포 후:

```text
https://배포한-도메인/
```

Google Cloud Console의 OAuth client에도 Supabase가 안내하는 callback URL을 Authorized redirect URI로 등록해야 합니다.

## 5. 데이터 정책 메모

이 앱은 건강, 감정, 수면과 관련된 민감한 생활 데이터를 다룰 수 있습니다. MVP 단계에서는 진단/치료 표현을 피하고, 웰니스와 루틴 보조 서비스로 안내하는 편이 안전합니다.

MVP 저장 범위는 `daily_footprints` 요약만으로 제한합니다.
