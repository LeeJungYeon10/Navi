# 안녕 나비야 MVP PWA

Notion 기획서 기반 1차 웹앱 프로토타입입니다. Google 로그인과 Supabase 사용자별 저장을 붙일 수 있도록 준비되어 있습니다.

## 포함된 기능

- 나비와 대화하는 메인 화면
- 대화 문장에서 수면, 활동, 감정 키워드 추출
- 오늘 요약과 피드백 자동 갱신
- 기본 온보딩 프로필 저장
- 간단한 루틴 체크
- 로컬 저장 및 PWA manifest/service worker
- Supabase Auth Google 로그인 준비
- Supabase RLS 기반 사용자별 오늘의 발자국 요약 저장 준비

## 실행

정적 파일 앱이라 별도 빌드 없이 실행할 수 있습니다.

```powershell
python -m http.server 5173
```

그 다음 브라우저에서 `http://localhost:5173/Navi/`를 엽니다.

## Supabase 설정

1. Supabase SQL Editor에서 `supabase/schema.sql` 내용을 실행합니다.
2. Supabase Dashboard에서 `Project Settings > API`로 이동합니다.
3. `anon public` key를 복사합니다.
4. `supabase-config.js`의 `SUPABASE_ANON_KEY`에 붙여넣습니다.
5. `Authentication > Providers > Google`에서 Google provider를 켭니다.
6. `Authentication > URL Configuration`에 로컬/배포 URL을 Redirect URL로 추가합니다.

MVP에서는 대화 원문을 Supabase에 저장하지 않고, 사용자가 확인한 `오늘의 발자국` 요약만 저장합니다.

## 오늘의 발자국 데이터 모델

저장 단위는 하루 1개 요약입니다.

- `mood`: `calm`, `tired`, `anxious`, `sad`, `happy`, `mixed`, `unknown`
- `sleep`: `unknown`, `poor`, `okay`, `good`
- `activity`: `unknown`, `low`, `okay`, `good`
- `nabi_note`: 나비가 남기는 한 줄 요약
- `user_note`: 사용자가 선택적으로 남기는 짧은 한 줄
- `routine`: `breathing`, `walk`, `water`, `stretch`, `journal`, `rest`
- `routine_done`: 루틴 완료 여부
- `bond_delta`: 오늘 유대감 변화량

로컬 개발용 Redirect URL:

```text
http://localhost:5173/Navi/
```

배포 후에는 실제 배포 URL도 추가해야 합니다.
