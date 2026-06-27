# 안녕나비야 - Chrome Extension 접근 채널 기획

> **문서 목적**: 안녕나비야를 당장 Chrome Extension으로 개발 전환하지 않고, 웹/PWA 본체를 유지하면서도 사용자의 일상 브라우징 맥락에 자연스럽게 접근할 수 있는 확장 채널 전략을 구체화한다.  
> **핵심 결론**: Chrome Extension은 메인 제품이 아니라 **접근 빈도를 높이는 보조 채널**로 설계한다. 대화, 기억, 권한, 결제, 분석 로직은 웹/API 본체에 두고, 확장은 가벼운 체크인과 재방문 유도에 집중한다.

---

## 1. 왜 Chrome Extension을 고려하는가

### 1.1 접근성 문제

웹앱은 사용자가 직접 주소를 입력하거나 북마크/홈 화면을 눌러야 한다. 안녕나비야처럼 매일 짧게 만나야 하는 서비스는 사용자의 자발적 재방문에만 의존하면 초반 리텐션이 약해질 수 있다.

Chrome Extension은 다음 접점을 만들 수 있다.

- 브라우저를 켤 때 가까운 위치에 존재
- 업무/학습 중 짧은 상태 체크인 가능
- 새 탭 또는 팝업에서 빠른 대화 진입 가능
- 웹앱 재방문을 자연스럽게 유도
- 알림, 배지, 퀵 액션으로 매일 접촉 빈도 증가

### 1.2 제품 컨셉과의 궁합

안녕나비야는 "기록 앱"보다 "곁에 있는 온라인 반려묘"에 가깝다. 확장프로그램은 사용자의 브라우저 환경 한쪽에 작게 머무는 형태라, 반려묘 컨셉과 맞는다.

단, 이 장점은 확장이 가벼울 때만 살아난다. 확장 안에서 모든 기능을 구현하려 하면 설치 장벽, 권한 불안, 인증 복잡도, 유지보수 부담이 커진다.

---

## 2. 전략 결정

### 2.1 하지 않을 것

초기에는 아래를 하지 않는다.

- 웹앱 전체를 Chrome Extension으로 이식
- 모든 대화 UI를 popup 안에 구현
- 방문 중인 웹페이지 본문을 자동 분석
- 광범위한 host permission 요청
- 확장 안에 LLM API key, Supabase service key, 결제 secret 저장
- 사용자가 명시하지 않은 브라우징 데이터를 수집
- 결제/구독 관리 기능을 확장 안에서 직접 처리

### 2.2 할 것

초기 Chrome Extension은 아래 역할로 제한한다.

- 하루 상태를 한 줄로 남기는 빠른 체크인
- 최근 나비 상태와 유대감 요약 표시
- 오늘의 작은 루틴 제안
- 웹앱의 대화 화면으로 이어가기
- 로그인 상태 확인 및 웹앱 로그인 유도
- 사용자가 명시적으로 누른 경우에만 현재 컨텍스트를 대화 소재로 전달

### 2.3 제품 구조

```text
Chrome Extension
  - popup UI
  - optional new tab surface
  - chrome.storage adapter
  - web app deep link
        ↓
Shared API Contract
        ↓
Web/PWA 본체
        ↓
Application Services
        ↓
Supabase / LLM / Entitlements / Footprints
```

확장프로그램은 사용자 접점이고, 제품의 진짜 기억과 판단은 공통 서비스 계층에서 처리한다.

---

## 3. Extension MVP 범위

### 3.1 Extension MVP 목표

확장프로그램의 첫 목표는 "웹앱을 대체"가 아니라 "하루 한 번 나비를 다시 만나게 만드는 것"이다.

성공 기준:

- 설치 후 첫 체크인까지 30초 이내
- 팝업에서 상태 입력 후 웹앱 대화로 자연스럽게 연결
- 사용자가 권한 요청에 불안감을 느끼지 않음
- 확장 사용 데이터가 웹앱의 발자국/유대감 시스템과 충돌하지 않음

### 3.2 핵심 기능

| 기능 ID | 기능명 | 설명 | 처리 위치 |
|---------|--------|------|-----------|
| CE-01 | 팝업 체크인 | "지금 상태 한 줄" 입력 후 나비에게 전달 | Extension UI + API |
| CE-02 | 오늘 요약 보기 | 오늘 저장된 수면/기분/활동/루틴 요약 표시 | API 조회 |
| CE-03 | 빠른 루틴 완료 | 물 마시기, 3분 호흡, 10분 걷기 등 완료 체크 | API 저장 |
| CE-04 | 웹앱 이어가기 | 현재 입력/상태를 들고 웹앱 대화 화면 열기 | Deep Link |
| CE-05 | 로그인 상태 안내 | 미로그인 사용자는 웹앱 로그인으로 이동 | Web Auth 연동 |
| CE-06 | 로컬 임시 저장 | 네트워크/로그인 전 체크인을 임시 보관 | chrome.storage |

### 3.3 후순위 기능

| 기능 ID | 기능명 | 이유 |
|---------|--------|------|
| CE-LATER-01 | 새 탭 나비 화면 | 초기에는 개발 범위가 커짐 |
| CE-LATER-02 | 브라우징 문맥 기반 제안 | 개인정보/권한 리스크 큼 |
| CE-LATER-03 | 페이지 본문 요약 후 대화 | 서비스 정체성과 법적 고지 정비 후 검토 |
| CE-LATER-04 | 알림 자동 스케줄 | 사용성 검증 후 도입 |
| CE-LATER-05 | 오프라인 대화 | LLM/API 구조와 맞지 않아 후순위 |

---

## 4. 사용자 플로우

### Flow CE-A. 설치 직후 첫 사용

1. 사용자가 Chrome Extension 설치
2. 툴바의 나비 아이콘 클릭
3. 팝업에서 짧은 인사와 체크인 입력창 표시
4. 사용자가 "오늘 좀 피곤해" 입력
5. 확장은 로컬 임시 상태를 저장
6. 웹앱 로그인 상태가 없으면 "대화를 보관하려면 로그인" 안내
7. 사용자가 웹앱으로 이동
8. 웹앱에서 로그인 또는 게스트 모드로 대화 계속

### Flow CE-B. 로그인 사용자 빠른 체크인

1. 사용자가 업무 중 확장 팝업 클릭
2. 팝업에서 오늘 요약과 나비 상태 표시
3. 사용자가 "3분 호흡 완료" 클릭
4. API가 루틴 완료와 발자국 초안을 저장
5. 팝업은 "나비가 기억했어" 수준의 짧은 피드백 표시
6. 자세한 대화는 웹앱으로 연결

### Flow CE-C. 웹앱으로 이어가기

1. 사용자가 팝업에 상태 한 줄 입력
2. "나비와 이어서 대화" 버튼 클릭
3. 웹앱 `/chat?source=extension&draft=...` 형태로 이동
4. 웹앱 입력창 또는 첫 메시지로 draft 반영
5. 이후 대화/분석/저장은 기존 웹앱 흐름을 사용

### Flow CE-D. 미로그인 사용자 재방문 유도

1. 사용자가 확장 팝업에서 여러 번 체크인
2. 로컬에 임시 체크인이 쌓임
3. 일정 횟수 이후 "나비가 이 기억을 잃지 않게 보관할까요?" 안내
4. 웹앱 로그인으로 이동
5. 로그인 후 로컬 체크인 기록을 서버 발자국으로 마이그레이션

---

## 5. 화면 기획

### 5.1 Popup 기본 구조

```text
┌─────────────────────────┐
│ 나비 상태 / 짧은 인사     │
│ 오늘은 조금 천천히 가도 돼 │
├─────────────────────────┤
│ 지금 상태 한 줄 입력      │
│ [____________________]  │
│ [나비에게 말하기]         │
├─────────────────────────┤
│ 빠른 루틴                │
│ [물] [호흡] [걷기]        │
├─────────────────────────┤
│ [웹앱에서 이어서 대화]     │
└─────────────────────────┘
```

### 5.2 팝업 UI 원칙

- 1차 행동은 하나만 둔다: "나비에게 말하기"
- 팝업 안에서 긴 대화를 시도하지 않는다
- 건강 조언보다 상태 확인과 웹앱 연결을 우선한다
- 텍스트는 짧게 유지한다
- 권한/로그인 안내는 불안감을 주지 않는 문장으로 제공한다
- "사용자가 누른 것만 저장한다"는 원칙을 명확히 한다

### 5.3 배지와 아이콘

초기 배지는 최소화한다.

- 체크인 전: 작은 점 또는 비활성 상태
- 오늘 체크인 완료: 차분한 색상 표시
- 알림 숫자 배지는 사용하지 않는다

이유: 건강/정서 서비스에서 강한 미해결 숫자 표시는 부담으로 작동할 수 있다.

---

## 6. 데이터와 저장 원칙

### 6.1 Extension 로컬 저장

`chrome.storage.local`에는 최소 데이터만 둔다.

```json
{
  "device_id": "local-device-id",
  "last_check_in_at": "2026-06-10T09:00:00.000Z",
  "pending_check_ins": [
    {
      "id": "local-checkin-id",
      "text": "오늘 좀 피곤해",
      "created_at": "2026-06-10T09:00:00.000Z",
      "source": "chrome_extension_popup"
    }
  ],
  "cached_user_summary": {
    "display_name": "사용자가 설정한 애칭",
    "navi_name": "사용자가 지정한 반려묘 이름",
    "bond": 42,
    "updated_at": "2026-06-10T09:00:00.000Z"
  }
}
```

> `display_name`: 사용자가 온보딩·마이페이지에서 직접 설정한 애칭 (`profiles.display_name`). 미설정 시 `null`, 설정 후에는 저장된 값을 그대로 캐시·표시.
> `navi_name`: 사용자가 반려묘 프로필에서 지정한 고양이 이름 (`user_metadata.cat_name`). 미설정 시 기본값 `"나비"`, 설정 후에는 저장된 값을 그대로 캐시·표시.

저장하지 않는 것:

- LLM provider secret key
- Supabase service role key
- 결제 secret
- 외부 API refresh token
- 웹페이지 본문 원문
- 사용자가 입력하지 않은 브라우징 히스토리

### 6.2 서버 저장

서버에는 기존 발자국/대화/세션 모델과 같은 규칙으로 저장한다.

권장 필드:

```text
source: web | pwa | chrome_extension_popup | chrome_extension_new_tab
client_event_id: 클라이언트 중복 방지용 ID
device_id: 비로그인 상태 식별용 임시 ID
```

확장에서 들어온 이벤트는 반드시 중복 처리를 고려한다. 팝업 닫힘, 네트워크 재시도, 로그인 전환 때문에 같은 체크인이 두 번 전송될 수 있다.

---

## 7. API 계약 초안

기존 API 설계를 유지하되, `source`와 `client_event_id`를 추가한다.

### 7.1 빠른 체크인

```text
POST /check-ins
```

Request:

```json
{
  "source": "chrome_extension_popup",
  "client_event_id": "local-checkin-id",
  "message": "오늘 좀 피곤해",
  "created_at": "2026-06-10T09:00:00.000Z"
}
```

Response:

```json
{
  "success": true,
  "reply_preview": "오늘은 조금 천천히 가도 괜찮아.",
  "created_footprint_draft": true,
  "open_web_url": "https://hi-navi.com/chat?source=extension"
}
```

### 7.2 오늘 요약

```text
GET /me/today-summary
```

Response:

```json
{
  "display_name": "사용자가 설정한 애칭",
  "navi_name": "사용자가 지정한 반려묘 이름",
  "bond": 42,
  "today": {
    "mood": "tired",
    "sleep": "unknown",
    "activity": "low",
    "routine_done": ["water"]
  }
}
```

> `display_name`: 사용자가 온보딩·마이페이지에서 직접 설정한 애칭 (`profiles.display_name`). 미설정 시 `null`, 설정 후에는 저장된 값을 그대로 반환.
> `navi_name`: 사용자가 반려묘 프로필에서 지정한 고양이 이름 (`user_metadata.cat_name`). 미설정 시 기본값 `"나비"`, 설정 후에는 저장된 값을 그대로 반환.

### 7.3 루틴 완료

```text
POST /routines/complete
```

Request:

```json
{
  "source": "chrome_extension_popup",
  "client_event_id": "routine-event-id",
  "routine_key": "breathing",
  "completed_at": "2026-06-10T09:10:00.000Z"
}
```

---

## 8. 인증 전략

### 8.1 초기 권장 방식

초기에는 확장 자체에서 복잡한 OAuth를 직접 처리하지 않는다.

권장 흐름:

```text
Extension popup
  → 웹앱 로그인 페이지 열기
  → Supabase/Google OAuth는 웹앱에서 처리
  → 웹앱이 로그인 완료 후 extension 연결 상태를 갱신
```

브라우저 확장 전용 OAuth는 나중에 필요성이 확인되면 도입한다.

### 8.2 게스트 처리

미로그인 사용자는 extension local state에 체크인을 임시 저장한다.

로그인 이후:

1. 웹앱이 extension pending check-in을 읽을 수 있는 연결 방식을 제공
2. 또는 extension이 로그인 완료 후 API로 pending check-in 업로드
3. 서버는 `client_event_id` 기준으로 중복 제거

---

## 9. 권한 정책

### 9.1 초기 manifest 권한

초기 권한은 아래 수준으로 제한한다.

```text
storage
identity 또는 tabs는 필요성 확인 후
notifications는 후순위
activeTab은 후순위
host_permissions는 API 도메인만
```

### 9.2 권한 요청 원칙

- 사용자가 기능을 누르기 전에는 민감 권한을 요청하지 않는다
- 페이지 본문 접근은 MVP에서 제외한다
- 권한 요청 문구는 "왜 필요한지"를 사용자의 행동과 연결해 설명한다
- 건강/감정 데이터는 사용자가 직접 입력하거나 명시적으로 저장한 것만 사용한다

---

## 10. 로직 분리 요구사항

Chrome Extension을 개발하기 전, 웹앱 내부 로직은 아래처럼 분리되어 있어야 한다.

| 분리 대상 | 목적 | Extension과의 관계 |
|----------|------|--------------------|
| `domain/nabi-growth` | 유대감 계산 | popup 요약 표시와 서버 계산 기준 공유 |
| `domain/assessment` | 메시지에서 상태 단서 추출 | 빠른 체크인 분석에 재사용 |
| `services/footprint-service` | 발자국 초안/저장 규칙 | extension check-in을 발자국으로 연결 |
| `services/chat-service` | 대화 요청/응답 처리 | 팝업은 preview만 받고 본대화는 웹앱으로 위임 |
| `services/entitlement-service` | 기능 권한 판단 | premium 기능 노출 여부 일관화 |
| `adapters/storage` | localStorage/chrome.storage 차이 흡수 | 웹/PWA/Extension 저장소 차이 제거 |
| `adapters/api-client` | API 호출 방식 통일 | extension과 웹이 같은 계약 사용 |

이 분리 작업은 "확장 개발"이 아니라 "확장을 가능하게 하는 본체 정리"로 본다.

---

## 11. 단계별 로드맵

### Phase 0. 기획 구체화

- Chrome Extension 역할 정의
- MVP/후순위 기능 구분
- 권한 원칙 정리
- 웹앱과 extension의 책임 경계 확정

### Phase 1. 본체 로직 분리

- 도메인 순수 함수 분리
- 저장소 adapter 분리
- API 계약에 `source`, `client_event_id` 추가
- 게스트 체크인 마이그레이션 정책 정의

### Phase 2. Extension Prototype 설계

- popup wireframe 확정
- manifest 권한 확정
- check-in API mock 설계
- 웹앱 deep link 규칙 확정

### Phase 3. Extension MVP 구현

- popup 체크인
- 오늘 요약
- 빠른 루틴 완료
- 웹앱 이어가기
- 로그인 유도

### Phase 4. 사용성 검증 후 확장

- 새 탭 화면
- 부드러운 리마인더
- 브라우징 문맥 사용 여부 검토
- 알림/배지 정책 조정



---

## 12. 의사결정 기준

Chrome Extension 개발을 실제로 시작할지는 아래 조건을 보고 결정한다.

| 기준 | 시작 조건 |
|------|-----------|
| 웹앱 MVP | 대화, 로그인, 기본 동기화가 안정적으로 동작 |
| 로직 분리 | 저장/API 로직이 최소 단위로 분리 |
| 접근성 문제 | 사용자가 "다시 들어오는 것"에서 실제 이탈이 확인됨 |
| 보안 구조 | secret/API/권한 판단이 서버로 정리됨 |
| UX 가설 | 빠른 체크인이 리텐션을 올릴 것이라는 명확한 가설 존재 |

