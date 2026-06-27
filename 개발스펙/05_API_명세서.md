# 안녕나비야 - API 명세서 (MVP)

**Base URL**: `https://www.hellopurrfly.com/`  
**데이터 포맷**: JSON  
**인증**: Bearer Token (JWT) - 로그인 유저. 게스트는 Header에 `Device-ID` 사용

---

## 1. 인증 (Auth)

### 1.1 Google 로그인 연동
- **POST** `/auth/google`
- Request:
  ```json
  { "google_token": "ya29.a0AfH6S..." }
  ```
- Response:
  ```json
  {
    "user_id": "google_12345",
    "access_token": "jwt_access_token_string",
    "nickname": null,
    "is_new_user": true
  }
  ```
  > `nickname`: 사용자가 온보딩·마이페이지에서 직접 설정한 애칭 (`profiles.display_name`). 미설정 시 `null`, 설정 후에는 저장된 값을 그대로 반환.

### 1.2 게스트 데이터 마이그레이션 (매우 중요)
- **POST** `/auth/migrate`
- Request: 게스트 시절 대화 배열
- 로그인 직후 반드시 호출하여 로컬 데이터를 서버로 이관

---

## 2. 대화 (Chat)

### 2.1 메시지 전송 및 AI 응답
- **POST** `/chat/message`
- Request:
  ```json
  {
    "session_id": "session_999",
    "message": "하루 종일 모니터만 봤더니 눈이 아파."
  }
  ```
- Response:
  ```json
  {
    "reply_message": "눈이 많이 피로하겠다. 나랑 같이 1분만 창밖을 보면서 눈에 휴식을 줄까? 🌿",
    "suggested_actions": [
      { "action_id": "act_001", "type": "SPATIAL", "label": "응, 창문 열고 올게!" },
      { "action_id": "act_002", "type": "NONE", "label": "조금 이따가 할래" }
    ],
    "extracted_tags": ["피로", "눈의피로"]
  }
  ```
> `extracted_tags`는 화면에 노출하지 않고, 프론트엔드가 백엔드 상태 관리용으로 사용.

---

## 3. 행동 피드백 루프 (Action)

### 3.1 건강 증강 행동 완료 처리
- **POST** `/action/complete`
- Request:
  ```json
  {
    "action_id": "act_001",
    "status": "COMPLETED"
  }
  ```
- Response:
  ```json
  {
    "success": true,
    "reward_message": "수면시간이 늘었네요. 6.4~7.8시간 정도의 수면을 유지하는 게 건강한 일상에 도움이 돼요. 앞으로도 수면시간을 주기적으로 관리해봐요.",
    "garden_level_up": true
  }
  ```

---

## 4. 나비 정원 (Garden)

### 4.1 타임라인 조회
- **GET** `/garden/timeline?month=2026-06`
- Response:
  ```json
  {
    "summary": "이번 달 평균 수면 시간이 6.7시간으로 늘었어요. 6.5~7.5시간대를 유지하면 일상 컨디션이 더 안정적이에요. 앞으로도 계속 관리해봐요.",
    "daily_records": [
      {
        "date": "2026-06-01",
        "main_emotions": ["차분함", "가벼운피로"],
        "completed_actions": ["SPATIAL", "BIO_RHYTHM"]
      }
    ]
  }
  ```

---

## 5. 유저 설정

### 5.1 프로필 수정 (닉네임)
- **PATCH** `/user/profile`
- Request:
  ```json
  {
    "nickname": "사용자가 입력한 애칭"
  }
  ```
- Response:
  ```json
  {
    "nickname": "사용자가 입력한 애칭"
  }
  ```
  > `nickname`은 고정 예시값이 아니라, 요청 시 사용자가 입력한 값이 `profiles.display_name`에 저장되고 이후 모든 API 응답·AI 호칭에 반영됩니다.

### 5.2 회원 탈퇴
- **DELETE** `/user/account` → 회원 탈퇴 (Hard Delete)

---

**개발 팁**: 
- 게스트 → 로그인 전환 시 **F-09 데이터 마이그레이션**을 가장 먼저 구현하세요.
- AI 응답과 감정 태깅은 **한 번의 API 호출**로 처리하는 것이 성능상 유리합니다.