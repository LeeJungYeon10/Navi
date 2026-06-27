import { getSupabase, isSupabaseConfigured } from "./supabase-client.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const STORAGE_KEY = "hello-naviya-state-v4";
const LEGACY_STORAGE_KEYS = ["hello-nabiya-state-v3"];
const FOOTPRINT_DRAFT_ENABLED = false; // 오늘의 발자국 팝업 — 추후 개발 후 true로 전환

// Supabase CDN 로드가 느리거나 실패해도 온보딩·로그인 버튼은 바로 동작하게 비동기 초기화
let supabase = null;
const supabaseReady = isSupabaseConfigured()
  ? getSupabase()
      .then((client) => {
        supabase = client;
        return client;
      })
      .catch((error) => {
        console.error("Supabase init failed:", error);
        return null;
      })
  : Promise.resolve(null);

// ── 세션 시간 추적 (화면 오픈 시간 보너스용) ──────────────────────────
// Notion 설계: 패널티 없는 순수 보너스 방식
// 5분 이상 + 상호작용 4점 이상 → 유대감 +1
// 10분 이상 + 상호작용 6점 이상 → 유대감 +2
// 그 외(5분 미만 or 상호작용 부족) → 0 (패널티 없음)
let _sessionStart = null;
let _totalSessionSec = 0;
let _interactionScore = 0; // 메시지: +1, 루틴 완료: +2, 발자국 저장: +2

function _startSession() {
  if (_sessionStart === null) _sessionStart = Date.now();
}

function _endSession() {
  if (_sessionStart !== null) {
    _totalSessionSec += Math.floor((Date.now() - _sessionStart) / 1000);
    _sessionStart = null;
  }
}

function _getSessionBonus() {
  _endSession();
  const minutes = _totalSessionSec / 60;
  if (minutes >= 10 && _interactionScore >= 6) return 2;
  if (minutes >= 5 && _interactionScore >= 4) return 1;
  return 0; // 패널티 없음
}

async function _applySessionBonusAndSave() {
  const bonus = _getSessionBonus();
  if (bonus > 0) {
    addBond(bonus);
    persist();
  }
  if (authSession && supabase) {
    try {
      const userId = authSession.user.id;
      await supabase.from("user_sessions").insert({
        user_id: userId,
        session_date: getToday(),
        duration_seconds: _totalSessionSec,
        interaction_score: _interactionScore,
        bond_bonus: bonus,
      });
    } catch {
      // 저장 실패해도 앱 동작에는 영향을 주지 않는다.
    }
  }
  // 세션 리셋
  _totalSessionSec = 0;
  _interactionScore = 0;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    _startSession();
  } else {
    _applySessionBonusAndSave();
  }
});
window.addEventListener("beforeunload", () => _applySessionBonusAndSave());
_startSession(); // 앱 로드 시 세션 시작

const DEFAULT_LANGUAGE = "ko";
const SUPPORTED_LANGUAGES = ["ko", "en"];

const TRANSLATIONS = {
  ko: {
    appTitle: "안녕 나비야",
    appDescription: "안녕 나비야는 매일 대화하는 온라인 반려묘가 신체와 마음을 함께 돌봐주는 PWA 건강 동반자입니다.",
    ogDescription: "여기를 눌러 링크를 확인하세요.",
    welcomeAria: "나비의 첫 인사",
    naviAlt: "나비",
    welcomeText: "안녕, 나는 오늘<br />널 만나서 기분이 좋아",
    welcomeTypingText: "안녕, 나는 오늘\n널 만나서 기분이 좋아.",
    moodQuestion: "네 기분은 어때?",
    moodGood: "오늘은<br />컨디션이 좋네",
    moodMeh: "오늘<br />그저 그래",
    freePromptLabel: "또는 직접 들려줘",
    welcomeInputLabel: "오늘의 기분",
    welcomeInputPlaceholder: "네 기분을 입력해봐",
    sendAria: "보내기",
    googleContinue: "Google로 계속하기",
    guestContinue: "로그인 없이 둘러보기",
    responseAria: "나비의 응답",
    responseContinue: "나비와 계속하기",
    profileAria: "프로필 설정",
    profileTitle: "조금만 알려줄래?",
    profileUserLabel: "나를 뭐라고 부르면 좋을까? <span class=\"hint\">(닉네임)</span>",
    profileUserPlaceholder: "예: 정연",
    profileCatLabel: "이 아이의 이름도 지어줄래? <span class=\"hint\">(기본: 나비)</span>",
    profileCatPlaceholder: "나비",
    profileStart: "나비와 시작하기",
    menuAria: "메뉴",
    appSubNew: "새로운 대화",
    naviProfileAria: "반려묘 프로필",
    meAria: "마이페이지",
    greetLine: "안녕,<br />오늘 하루는 어땠어?",
    greetLineWithName: "안녕 {name},<br>오늘 하루는 어땠어?",
    greetSub: "아래에 편하게 적어줘 🐾",
    chatAria: "나비와 대화",
    setupAria: "로그인 후 이름 설정",
    setupFirstStep: "첫 인사",
    setupUserStep: "내 이름 설정",
    setupCatStep: "고양이 이름 설정",
    setupUserTitle: "내가 너를 뭐라고 부르면 될까?",
    setupCatTitle: "{who}내 이름도 지어줄래?",
    setupDefaultDescription: "이름은 나비가 대화할 때만 다정하게 불러줄게요.",
    setupUserDescription: "편한 이름을 적어줘도 되고, 지금은 건너뛰어도 괜찮아.",
    setupCatDescription: "고양이 이름을 정하면 대화창에서 그 이름으로 불러줄게.",
    setupInputLabel: "이름 입력",
    setupUserPlaceholder: "편한 이름을 적어볼래?",
    setupCatPlaceholder: "예: 나비",
    next: "다음",
    start: "시작하기",
    skip: "건너뛰기",
    quickActionsAria: "빠른 입력",
    quickSleepPrompt: "어제 6시간 잤고 오늘은 조금 피곤해.",
    quickSleep: "수면 체크",
    quickActivityPrompt: "오늘 20분 걸었고 기분은 괜찮아.",
    quickActivity: "활동 체크",
    quickMindPrompt: "요즘 집중이 잘 안 되고 마음이 불안해.",
    quickMind: "마음 체크",
    footprintDraftAria: "오늘의 발자국 저장",
    footprintToday: "오늘의 발자국",
    footprintTitle: "나비가 이렇게 남겨볼까?",
    mood: "감정",
    sleep: "수면",
    activity: "활동",
    routine: "추천 루틴",
    todayNote: "오늘 한 줄",
    todayNotePlaceholder: "예: 오늘은 조금 느린 하루였다.",
    saveFootprint: "발자국 남기기",
    skipFootprint: "오늘은 넘기기",
    naviProfile: "반려묘 프로필",
    edit: "수정",
    catNameLabel: "고양이 이름",
    catNamePlaceholder: "고양이 이름",
    save: "저장",
    cancel: "취소",
    birthday: "생일",
    birthdayEmpty: "아직 기록 없음",
    birthdayHint: "첫 만남한 날이에요",
    recentFootprintsAria: "최근 발자국",
    recent7Days: "최근 7일",
    naviMemory: "나비의 기억",
    mePanelAria: "내 정보",
    me: "나",
    myPage: "마이페이지",
    nickname: "닉네임",
    googleAccount: "Google 계정",
    accountNote: "발자국 요약이 이 계정에 동기화돼요.",
    cloudStorage: "클라우드 저장",
    localStorage: "로컬 저장",
    googleLogin: "Google 로그인",
    localMode: "로컬 모드",
    name: "이름",
    goal: "현재 목표",
    tone: "선호 대화 톤",
    saveProfile: "저장하기",
    logout: "로그아웃",
    deleteAccount: "회원탈퇴",
    messagePlaceholder: "무엇이든 편하게 적어줘",
    drawerAria: "이전 대화",
    drawerToday: "🐾 오늘의 나비",
    newChat: "새 채팅",
    searchHistoryPlaceholder: "지난 대화 검색하기...",
    recentChats: "최근 대화",
    naviWalking: "나비가 산책 중이에요.",
    languageLabel: "언어",
    languageHint: "지금은 UI 골격과 나비 응답 언어만 먼저 바꿔요.",
    languageKo: "한국어",
    languageEn: "English",
    loginProblem: "로그인에 문제가 있어요",
    profileUnset: "아직 설정 안 함",
    chattingWithCat: "{catName}와 대화 중",
    catProfileSub: "{catName} 프로필",
    bondLabel: "유대감 {bond}%",
    noFootprintsTitle: "아직 남긴 발자국이 없어요",
    noFootprintsBody: "나비와 오늘을 이야기한 뒤 발자국을 남겨보세요.",
    nowChat: "지금 대화",
    inProgress: "진행 중",
    emptySearch: "검색 결과가 없어요.",
    emptyHistory: "아직 저장된 대화가 없어요.<br>새 대화를 시작하면 여기에 쌓여요.",
    newChatTitle: "새 대화",
  },
  en: {
    appTitle: "Hello Naviya",
    appDescription: "Hello Naviya is a PWA health companion where an online companion cat helps you care for body and mind through daily conversation.",
    ogDescription: "Tap to open the link.",
    welcomeAria: "Navi's first hello",
    naviAlt: "Navi",
    welcomeText: "Hi, meeting you today<br />makes me happy",
    welcomeTypingText: "Hi, meeting you today\nmakes me happy.",
    moodQuestion: "How are you feeling?",
    moodGood: "I'm feeling<br />pretty good",
    moodMeh: "Today feels<br />just okay",
    freePromptLabel: "Or tell me in your own words",
    welcomeInputLabel: "Today's mood",
    welcomeInputPlaceholder: "Type how you feel",
    sendAria: "Send",
    googleContinue: "Continue with Google",
    guestContinue: "Browse without login",
    responseAria: "Navi's reply",
    responseContinue: "Continue with Navi",
    profileAria: "Profile setup",
    profileTitle: "Can you tell me a little?",
    profileUserLabel: "What should I call you? <span class=\"hint\">(nickname)</span>",
    profileUserPlaceholder: "Ex: Jamie",
    profileCatLabel: "Will you name this cat too? <span class=\"hint\">(default: Navi)</span>",
    profileCatPlaceholder: "Navi",
    profileStart: "Start with Navi",
    menuAria: "Menu",
    appSubNew: "New conversation",
    naviProfileAria: "Cat profile",
    meAria: "My page",
    greetLine: "Hi,<br />how was your day?",
    greetLineWithName: "Hi {name},<br>how was your day?",
    greetSub: "Write anything below 🐾",
    chatAria: "Chat with Navi",
    setupAria: "Name setup after login",
    setupFirstStep: "First hello",
    setupUserStep: "Your name",
    setupCatStep: "Cat name",
    setupUserTitle: "What should I call you?",
    setupCatTitle: "{who}will you name me too?",
    setupDefaultDescription: "Navi will use your name only to make the chat feel warmer.",
    setupUserDescription: "You can add a comfortable name, or skip it for now.",
    setupCatDescription: "If you name the cat, that name will appear in chat.",
    setupInputLabel: "Name input",
    setupUserPlaceholder: "Type a name you like",
    setupCatPlaceholder: "Ex: Navi",
    next: "Next",
    start: "Start",
    skip: "Skip",
    quickActionsAria: "Quick input",
    quickSleepPrompt: "I slept 6 hours yesterday and feel a bit tired today.",
    quickSleep: "Sleep check",
    quickActivityPrompt: "I walked for 20 minutes today and feel okay.",
    quickActivity: "Activity check",
    quickMindPrompt: "I have trouble focusing lately and feel anxious.",
    quickMind: "Mood check",
    footprintDraftAria: "Save today's footprint",
    footprintToday: "Today's footprint",
    footprintTitle: "Should Navi save it like this?",
    mood: "Mood",
    sleep: "Sleep",
    activity: "Activity",
    routine: "Suggested routine",
    todayNote: "One line for today",
    todayNotePlaceholder: "Ex: Today was a slower day.",
    saveFootprint: "Save footprint",
    skipFootprint: "Skip today",
    naviProfile: "Cat profile",
    edit: "Edit",
    catNameLabel: "Cat name",
    catNamePlaceholder: "Cat name",
    save: "Save",
    cancel: "Cancel",
    birthday: "Birthday",
    birthdayEmpty: "No record yet",
    birthdayHint: "The day you first met",
    recentFootprintsAria: "Recent footprints",
    recent7Days: "Last 7 days",
    naviMemory: "Navi's memory",
    mePanelAria: "My info",
    me: "Me",
    myPage: "My page",
    nickname: "Nickname",
    googleAccount: "Google account",
    accountNote: "Footprint summaries sync to this account.",
    cloudStorage: "Cloud storage",
    localStorage: "Local storage",
    googleLogin: "Google login",
    localMode: "Local mode",
    name: "Name",
    goal: "Current goal",
    tone: "Preferred tone",
    saveProfile: "Save",
    logout: "Log out",
    deleteAccount: "Delete account",
    messagePlaceholder: "Write anything comfortably",
    drawerAria: "Previous conversations",
    drawerToday: "🐾 Today's Navi",
    newChat: "New chat",
    searchHistoryPlaceholder: "Search past conversations...",
    recentChats: "Recent conversations",
    naviWalking: "Navi is walking around.",
    languageLabel: "Language",
    languageHint: "For now, this only changes the UI scaffold and Navi reply language.",
    languageKo: "한국어",
    languageEn: "English",
    loginProblem: "There is a login problem",
    profileUnset: "Not set yet",
    chattingWithCat: "Chatting with {catName}",
    catProfileSub: "{catName} profile",
    bondLabel: "Bond {bond}%",
    noFootprintsTitle: "No footprints yet",
    noFootprintsBody: "Talk with Navi about today, then leave a footprint.",
    nowChat: "Current chat",
    inProgress: "In progress",
    emptySearch: "No search results.",
    emptyHistory: "No saved conversations yet.<br>New chats will appear here.",
    newChatTitle: "New chat",
  },
};

const LANGUAGE_LABELS = {
  ko: {
    mood: { calm: "안정", tired: "피곤", anxious: "불안", sad: "가라앉음", happy: "좋음", mixed: "복합적", unknown: "미입력" },
    sleep: { unknown: "미입력", poor: "부족", okay: "보통", good: "충분" },
    activity: { unknown: "미입력", low: "낮음", okay: "보통", good: "좋음" },
    routine: { breathing: "3분 호흡", walk: "10분 걷기", water: "물 마시기", stretch: "가벼운 스트레칭", journal: "한 문장 적기", rest: "쉬기" },
  },
  en: {
    mood: { calm: "calm", tired: "tired", anxious: "anxious", sad: "low", happy: "good", mixed: "mixed", unknown: "not entered" },
    sleep: { unknown: "not entered", poor: "short", okay: "okay", good: "enough" },
    activity: { unknown: "not entered", low: "low", okay: "okay", good: "good" },
    routine: { breathing: "3-min breathing", walk: "10-min walk", water: "drink water", stretch: "light stretch", journal: "one-line journal", rest: "rest" },
  },
};

const DAILY_BOND_LIMIT = 10;
const DEFAULT_CAT_ID = "cat-navi";
const DEFAULT_NAVI_STATE = {
  dailyBondDate: null,
  dailyBondGain: 0,
  lastVisitDate: null,
  streak: 0,
  lastStreakBonusDate: null,
  birthday: null,
  name: null,
};
const DEFAULT_CAT_SLOT = {
  id: DEFAULT_CAT_ID,
  ...DEFAULT_NAVI_STATE,
  avatar: "navi",
};
const initialState = {
  language: DEFAULT_LANGUAGE,
  profile: { name: "", goal: "정서적 안정", tone: "다정하고 차분하게", focus: [] },
  day: { sleepHours: null, activityMinutes: null, mood: null, energy: "보통", bond: 42, routines: [] },
  navi: { ...DEFAULT_NAVI_STATE },
  cats: [{ ...DEFAULT_CAT_SLOT }],
  activeCatId: DEFAULT_CAT_ID,
  messages: [{ role: "cat", text: "안녕, 나는 나비야. 오늘 잠은 어땠고 몸은 어느 정도 움직였는지 편하게 말해줘." }],
  chatHistory: [],
  activeChatId: null,
  footprintDraft: null,
  footprints: [],
  flags: { setupDone: false, loginSetupDone: false, loginSetupUserId: null, appEntered: false },
};

const state = loadState();
markDailyVisit();

let authSession = null;
let authHydrated = false;
let authBootstrapped = false;
let syncTimer = null;
let dismissWelcome = () => {};
let pendingWelcomeMessage = null;

function getLanguage() {
  return SUPPORTED_LANGUAGES.includes(state?.language) ? state.language : DEFAULT_LANGUAGE;
}

function getLabels() {
  return LANGUAGE_LABELS[getLanguage()] || LANGUAGE_LABELS[DEFAULT_LANGUAGE];
}

function t(key, params = {}) {
  const dictionary = TRANSLATIONS[getLanguage()] || TRANSLATIONS[DEFAULT_LANGUAGE];
  const fallback = TRANSLATIONS[DEFAULT_LANGUAGE][key] || key;
  const template = dictionary[key] || fallback;
  return Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value ?? "")), template);
}

function applyStaticTranslations() {
  const language = getLanguage();
  document.documentElement.lang = language;
  document.title = t("appTitle");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("appDescription"));
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", t("appTitle"));
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", t("ogDescription"));
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", t("appTitle"));
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", t("ogDescription"));

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.innerHTML = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((node) => {
    node.setAttribute("alt", t(node.dataset.i18nAlt));
  });
  document.querySelectorAll("[data-i18n-value]").forEach((node) => {
    node.setAttribute("value", t(node.dataset.i18nValue));
  });
  document.querySelectorAll("[data-prompt-key]").forEach((node) => {
    node.dataset.prompt = t(node.dataset.promptKey);
  });

  if (els.languageSelect) els.languageSelect.value = language;
}

function setLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language) || state.language === language) return;
  state.language = language;
  persist();
  render();
}

const MOOD_RESPONSES = {
  ko: {
    good: "너도 기분이 좋다니 다행이야!<br>그럼 우리 산책하러 가자 🐾",
    meh: "그렇구나.<br>기분이 안 좋을 땐 좀 걷는 게<br>도움이 된대. 같이 걸어볼까?",
    free: "들려줘서 고마워.<br>잠깐 같이 바람 쐬러 갈까? 🐾",
  },
  en: {
    good: "I'm glad you're feeling good too!<br>Then let's go for a little walk 🐾",
    meh: "I hear you.<br>When the day feels off, a short walk can help.<br>Want to walk together?",
    free: "Thank you for telling me.<br>Should we get a little fresh air together? 🐾",
  },
};

const els = {
  appShell: document.querySelector("#appShell"),
  appEmpty: document.querySelector("#appEmpty"),
  appSub: document.querySelector("#appSub"),
  greetLine: document.querySelector("#greetLine"),
  profileUserName: document.querySelector("#profileUserName"),
  profileCatName: document.querySelector("#profileCatName"),
  drawer: document.querySelector("#drawer"),
  scrim: document.querySelector("#scrim"),
  openNavi: document.querySelector("#openNavi"),
  openMe: document.querySelector("#openMe"),
  views: {
    chat: document.querySelector("#chatView"),
    navi: document.querySelector("#naviView"),
    footprints: document.querySelector("#footprintsView"),
    me: document.querySelector("#meView"),
  },
  authTitle: document.querySelector("#authTitle"),
  authEmail: document.querySelector("#authEmail"),
  authDisplayName: document.querySelector("#authDisplayName"),
  accountCard: document.querySelector("#accountCard"),
  meLoginSection: document.querySelector("#meLoginSection"),
  accountBottomActions: document.querySelector("#accountBottomActions"),
  googleLogin: document.querySelector("#googleLogin"),
  meLogoutButton: document.querySelector("#meLogoutButton"),
  deleteAccountButton: document.querySelector("#deleteAccountButton"),
  storageMode: document.querySelector("#storageMode"),
  chatLog: document.querySelector("#chatLog"),
  chatForm: document.querySelector("#chatForm"),
  messageInput: document.querySelector("#messageInput"),
  quickActions: document.querySelector(".quick-actions"),
  sleepMetric: document.querySelector("#sleepMetric"),
  activityMetric: document.querySelector("#activityMetric"),
  moodMetric: document.querySelector("#moodMetric"),
  energyMetric: document.querySelector("#energyMetric"),
  insightList: document.querySelector("#insightList"),
  chatHistoryList: document.querySelector("#chatHistoryList"),
  chatHistorySearch: document.querySelector("#chatHistorySearch"),
  bondLabel: document.querySelector("#bondLabel"),
  chatSetup: document.querySelector("#chatSetup"),
  chatSetupStep: document.querySelector("#chatSetupStep"),
  chatSetupTitle: document.querySelector("#chatSetupTitle"),
  chatSetupDescription: document.querySelector("#chatSetupDescription"),
  chatSetupForm: document.querySelector("#chatSetupForm"),
  chatSetupInput: document.querySelector("#chatSetupInput"),
  chatSetupSubmit: document.querySelector("#chatSetupSubmit"),
  chatSetupSkip: document.querySelector("#chatSetupSkip"),
  profileForm: document.querySelector("#profileForm"),
  footprintDraft: document.querySelector("#footprintDraft"),
  draftMood: document.querySelector("#draftMood"),
  draftSleep: document.querySelector("#draftSleep"),
  draftActivity: document.querySelector("#draftActivity"),
  draftRoutine: document.querySelector("#draftRoutine"),
  draftNaviNote: document.querySelector("#draftNaviNote"),
  draftUserNote: document.querySelector("#draftUserNote"),
  saveFootprint: document.querySelector("#saveFootprint"),
  skipFootprint: document.querySelector("#skipFootprint"),
  footprintList: document.querySelector("#footprintList"),
  naviProfileNameRow: document.querySelector("#naviProfileNameRow"),
  naviProfileName: document.querySelector("#naviProfileName"),
  naviNameEditBtn: document.querySelector("#naviNameEditBtn"),
  naviNameEditForm: document.querySelector("#naviNameEditForm"),
  naviNameInput: document.querySelector("#naviNameInput"),
  naviNameEditCancel: document.querySelector("#naviNameEditCancel"),
  naviProfileBirthday: document.querySelector("#naviProfileBirthday"),
  naviWalker: document.querySelector("#naviWalker"),
  naviWalkerImage: document.querySelector("#naviWalkerImage"),
  naviBubble: document.querySelector("#naviBubble"),
  composer: document.querySelector(".composer"),
  languageSelect: document.querySelector("#languageSelect"),
};

if (shouldRestoreOnLoad()) {
  prepareRestoredAppShell();
}

let naviPosition = { x: 170, y: 230 };
let naviRestCycleTimer = null;
let naviBubbleTimer = null;
let naviStopTimer = null;
let naviFrameTimer = null;
let naviRestIdleTimer = null;
let naviFrameIndex = 0;
const NAVI_SIT_IMAGE = "./assets/navi.png";
const NAVI_TAIL_FRAME_MS = 150;
const NAVI_TAIL_IDLE_DELAY_MS = 7000;
const NAVI_TAIL_IDLE_FRAMES = Array.from(
  { length: 22 },
  (_, index) => `./assets/navi_tail_idle/navi-${String(index + 1).padStart(2, "0")}.png`,
);
const NAVI_REST_IMAGE = "./assets/navi_rest.png";
const NAVI_REST_IDLE_FRAMES = Array.from(
  { length: 7 },
  (_, index) => `./assets/navi_rest_idle/navi_rest_idle_${index + 1}.png`,
);
const NAVI_REST_FRAME_MS = 130;
const NAVI_REST_AFTER_MS = 24000;
const NAVI_REST_HOLD_MS = 7000;
const NAVI_PRELOADED_IMAGES = [NAVI_SIT_IMAGE, NAVI_REST_IMAGE, ...NAVI_TAIL_IDLE_FRAMES, ...NAVI_REST_IDLE_FRAMES].map(
  (src) => {
    const image = new Image();
    image.src = src;
    return image;
  },
);

// 채팅 셋업 상태 — 최상위 render() 호출보다 먼저 선언해야 TDZ(초기화 전 접근) 오류가 없다.
let setupActive = false;
let setupStep = "userName";
let currentView = "chat";
const OAUTH_PENDING_KEY = "navi-oauth-pending";
let authBootstrapComplete = false;
let finishingAuthSession = null;
let naviNameEditing = false;

bindEvents();
render();
registerServiceWorker();
initNaviWalker();
initWelcome();
bootstrapApp();

function hasOAuthReturn() {
  return /[?&#](code|access_token)=/.test(`${window.location.search}${window.location.hash}`);
}

function hasOAuthError() {
  return /[?&#]error=/.test(`${window.location.search}${window.location.hash}`);
}

function getOAuthParam(name) {
  const searchValue = new URLSearchParams(window.location.search).get(name);
  if (searchValue) return searchValue;
  const hash = window.location.hash.replace(/^#/, "");
  return new URLSearchParams(hash).get(name) || "";
}

function getOAuthErrorMessage() {
  if (!hasOAuthError()) return "";
  const description = getOAuthParam("error_description");
  const code = getOAuthParam("error_code");
  const error = getOAuthParam("error");
  const detail = description || code || error;
  return detail
    ? `Google 로그인에 실패했어요. Supabase Google Provider와 Redirect URL 설정을 확인해 주세요. (${detail})`
    : "Google 로그인에 실패했어요. Supabase Google Provider와 Redirect URL 설정을 확인해 주세요.";
}

function isOAuthAttemptInProgress() {
  return hasOAuthReturn() || hasOAuthError() || sessionStorage.getItem(OAUTH_PENDING_KEY) === "1";
}

function markOAuthPending() {
  try {
    sessionStorage.setItem(OAUTH_PENDING_KEY, "1");
  } catch {
    // sessionStorage unavailable
  }
}

function clearOAuthPending() {
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

function hasStoredAuthSession() {
  if (hasOAuthReturn()) return true;
  try {
    return Object.keys(localStorage).some((key) => {
      if (!localStorage.getItem(key)) return false;
      return key.includes("-auth-token") || /^sb-.*-auth-token/.test(key);
    });
  } catch {
    return false;
  }
}

function shouldRestoreOnLoad() {
  return hasStoredAuthSession() || Boolean(state.flags?.appEntered);
}

function prepareRestoredAppShell() {
  document.querySelectorAll(".flow-screen").forEach((screen) => screen.classList.remove("flow-screen--active"));
  els.appShell?.classList.remove("is-hidden");
  document.body.classList.add("is-auth-booting");
}

function showWelcomeFlow() {
  document.body.classList.remove("is-auth-booting");
  els.appShell?.classList.add("is-hidden");
  showFlowScreen("welcomeScreen");
}

function hasReturningAuth() {
  return hasStoredAuthSession();
}

function showWelcomeAuthError(message) {
  const appVisible = !els.appShell?.classList.contains("is-hidden");
  if (appVisible) {
    addCatMessage(message);
    if (els.appSub) els.appSub.textContent = t("loginProblem");
    render();
    return;
  }

  const google = document.querySelector("#welcomeGoogle");
  if (!google) {
    addCatMessage(message);
    render();
    return;
  }
  let err = document.querySelector("#welcomeAuthError");
  if (!err) {
    err = document.createElement("p");
    err.id = "welcomeAuthError";
    err.className = "welcome-auth-error";
    err.setAttribute("role", "alert");
    google.insertAdjacentElement("afterend", err);
  }
  err.textContent = message;
  setWelcomeGuestAvailable(true);
}

async function getSupabaseClient() {
  return supabase || (await supabaseReady);
}

function getAuthRedirectUrl() {
  // /index.html 과 / 차이로 PKCE·Redirect URL이 어긋나지 않게 통일
  const path = window.location.pathname.replace(/\/index\.html$/i, "/") || "/";
  return `${window.location.origin}${path}`;
}

function hasAuthSession(session) {
  return Boolean(session?.user?.id);
}

function getSessionEmail(session) {
  const user = session?.user;
  if (!user) return "";
  if (user.email) return user.email;
  const metaEmail = user.user_metadata?.email;
  if (metaEmail) return metaEmail;
  const identity = user.identities?.find((item) => item.identity_data?.email);
  return identity?.identity_data?.email || "";
}

function showFlowScreen(screenId) {
  document.querySelectorAll(".flow-screen").forEach((screen) => {
    screen.classList.toggle("flow-screen--active", screen.id === screenId);
  });
  els.appShell?.classList.add("is-hidden");
}

function enterApp() {
  state.flags = { ...(state.flags || {}), appEntered: true };
  document.body.classList.remove("is-auth-booting");
  document.querySelectorAll(".flow-screen").forEach((screen) => screen.classList.remove("flow-screen--active"));
  els.appShell?.classList.remove("is-hidden");
  closeDrawer();
  switchView("chat");
  updateGreetingLine();
  persist();
  render();
}

function dismissWelcomeScreen() {
  enterApp();
}

function updateGreetingLine() {
  const name = (state.profile.name || "").trim();
  if (els.greetLine) {
    els.greetLine.innerHTML = name ? t("greetLineWithName", { name: escapeHtml(name) }) : t("greetLine");
  }
}

function setChatEmpty(isEmpty) {
  els.appEmpty?.classList.toggle("is-hidden", !isEmpty);
  if (els.appSub) els.appSub.textContent = isEmpty ? t("appSubNew") : t("chattingWithCat", { catName: catName() });
}

function hasUserMessages() {
  return state.messages.some((message) => message.role === "user");
}

function showMoodResponse(mood, pendingText = "") {
  const resp = document.querySelector("#respText");
  const responses = MOOD_RESPONSES[getLanguage()] || MOOD_RESPONSES[DEFAULT_LANGUAGE];
  if (resp) resp.innerHTML = responses[mood] || responses.free;
  pendingWelcomeMessage = pendingText || null;
  showFlowScreen("responseScreen");
}

function showProfileScreen() {
  showFlowScreen("profileScreen");
  if (els.profileUserName) els.profileUserName.value = state.profile.name || "";
  if (els.profileCatName) els.profileCatName.value = state.navi.name || (getLanguage() === "en" ? "Navi" : "나비");
}

async function finishProfileFlow() {
  try {
    const userName = els.profileUserName?.value.trim();
    const cat = els.profileCatName?.value.trim();
    if (!state.profile) state.profile = {};
    if (!state.navi) state.navi = {};
    if (userName) state.profile.name = userName;
    if (cat) state.navi.name = cat;
    syncActiveCatFromNavi(state);
    markLoginSetupComplete(authSession?.user?.id);
    setupActive = false;
    if (els.chatSetup) els.chatSetup.classList.add("is-hidden");
    persist();
    await syncProfileToCloud();
  } catch (err) {
    console.error("finishProfileFlow error:", err);
  } finally {
    enterApp();
  }
}

function continueAfterResponse() {
  if (authSession && !hasCompletedLoginSetup()) {
    showProfileScreen();
  } else {
    enterApp();
  }
  if (pendingWelcomeMessage) {
    const message = pendingWelcomeMessage;
    pendingWelcomeMessage = null;
    window.setTimeout(() => receiveUserMessage(message), 350);
  }
}

function openDrawer() {
  els.drawer?.classList.add("open");
  els.scrim?.classList.add("open");
}

function closeDrawer() {
  els.drawer?.classList.remove("open");
  els.scrim?.classList.remove("open");
}

function cleanAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  ["code", "error", "error_code", "error_description"].forEach((param) => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });
  if (url.hash && /access_token|refresh_token|type=recovery|code=|error=/.test(url.hash)) {
    url.hash = "";
    changed = true;
  }
  if (changed) {
    history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
}

async function finishAuthSession(session, { hydrate = true } = {}) {
  if (!session?.user) return false;
  if (finishingAuthSession) return finishingAuthSession;
  if (authSession?.user?.id === session.user.id && authBootstrapped) {
    authSession = session;
    renderAuth(session);
    if (hasCompletedLoginSetup()) enterApp();
    else showProfileScreen();
    return true;
  }

  finishingAuthSession = (async () => {
    authSession = session;
    clearOAuthPending();
    renderAuth(authSession);
    cleanAuthParamsFromUrl();

    if (hydrate && !authHydrated) {
      authHydrated = true;
      try {
        await hydrateFromCloud();
      } catch (error) {
        console.error("Cloud hydrate failed:", error);
      }
    }

    if (hasCompletedLoginSetup()) enterApp();
    else showProfileScreen();

    persist();
    render();
    return true;
  })();

  try {
    return await finishingAuthSession;
  } finally {
    finishingAuthSession = null;
  }
}

async function resolveAuthSession(client) {
  if (hasOAuthReturn()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await client.auth.getSession();
      if (error) console.error("getSession failed:", error);
      if (data.session) {
        cleanAuthParamsFromUrl();
        return data.session;
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }

    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Auth callback exchange failed:", error);
        showWelcomeAuthError(`로그인 처리 중 문제가 생겼어요. ${error.message}`);
      } else if (data.session) {
        cleanAuthParamsFromUrl();
        return data.session;
      }
    }
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) console.error("getSession failed:", error);
  return data.session ?? null;
}

function handleAuthStateChange(event, session) {
  if (event === "TOKEN_REFRESHED" && session) {
    authSession = session;
    renderAuth(session);
    return;
  }

  if (event === "SIGNED_OUT") {
    authSession = null;
    authHydrated = false;
    authBootstrapped = false;
    clearOAuthPending();
    stopSetup();
    renderAuth(null);
    if (state.flags?.appEntered) enterApp();
    else showWelcomeFlow();
    return;
  }

  if (!session) return;

  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    void finishAuthSession(session, { hydrate: !authHydrated }).then((ok) => {
      if (ok) authBootstrapped = true;
    });
  }
}

function initWelcome() {
  const screen = document.querySelector("#welcomeScreen");
  if (!screen) return;

  dismissWelcome = dismissWelcomeScreen;

  const returningAuth = hasReturningAuth();
  const restoringApp = shouldRestoreOnLoad();
  if (returningAuth) {
    setWelcomeGuestAvailable(false);
  }

  const textEl = document.querySelector("#welcomeText");
  const cursor = document.querySelector("#welcomeCursor");
  const form = document.querySelector("#welcomeForm");
  const input = document.querySelector("#welcomeInput");
  const skip = document.querySelector("#welcomeSkip");
  const google = document.querySelector("#welcomeGoogle");

  if (!returningAuth && !restoringApp) {
    const fullText = t("welcomeTypingText");
    let index = 0;
    let typing = true;

    if (textEl) textEl.innerHTML = "";

    function type() {
      if (!typing || !textEl) return;
      if (index < fullText.length) {
        textEl.innerHTML += fullText[index] === "\n" ? "<br>" : escapeHtml(fullText[index]);
        index += 1;
        window.setTimeout(type, 90);
      }
    }
    window.setTimeout(type, 700);

  }

  if (skip && !skip.dataset.bound) {
    skip.dataset.bound = "true";
    skip.addEventListener("click", enterApp);
  }

  if (cursor && input && !input.dataset.welcomeFocusBound) {
    input.dataset.welcomeFocusBound = "true";
    input.addEventListener("focus", () => (cursor.style.display = "none"));
  }

  document.querySelectorAll(".mood[data-mood]").forEach((button) => {
    if (button.dataset.bound) return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => showMoodResponse(button.dataset.mood));
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input?.value.trim() || "";
    showMoodResponse("free", message);
  });

  document.querySelector("#responseContinue")?.addEventListener("click", continueAfterResponse);
  document.querySelector("#profileSubmit")?.addEventListener("click", finishProfileFlow);

  google?.addEventListener("click", () => signInWithGoogle(google));
}

function setWelcomeGuestAvailable(isAvailable) {
  const skip = document.querySelector("#welcomeSkip");
  if (!skip) return;
  skip.disabled = !isAvailable;
  skip.classList.toggle("is-hidden", !isAvailable);
}

function catName() {
  return (state.navi.name || "").trim() || "나비";
}

const CAT_LEVEL_PREFIXES = ["새끼 ", "어린 ", "청년 "];

function localizeCatSpeech(text) {
  const name = catName();
  if (!text || name === "나비") return text;
  return text
    .replace(/나비(가|는|와|의|야)/g, (match, particle, offset) => {
      const before = text.slice(Math.max(0, offset - 5), offset);
      if (CAT_LEVEL_PREFIXES.some((prefix) => before.endsWith(prefix))) return match;
      return `${name}${particle}`;
    })
    .replace(/나는 나비야/g, `나는 ${name}야`);
}

function getDefaultCatGreeting() {
  if (getLanguage() === "en") {
    return `Hi, I'm ${catName()}. Tell me comfortably how you slept and how much your body moved today.`;
  }
  return `안녕, 나는 ${catName()}야. 오늘 잠은 어땠고 몸은 어느 정도 움직였는지 편하게 말해줘.`;
}

function formatNaviBirthday(birthday) {
  if (!birthday) return t("birthdayEmpty");
  const [year, month, day] = birthday.split("-").map(Number);
  if (!year || !month || !day) return birthday;
  return getLanguage() === "ko" ? `${year}년 ${month}월 ${day}일` : new Date(`${birthday}T00:00:00`).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// 로그인 사용자에게만 채팅창 안에서 내 이름 → 고양이 이름 순서로 묻는다.
function maybeStartSetup() {
  if (setupActive || !authSession?.user?.id) return;
  if (hasCompletedLoginSetup()) return;
  showProfileScreen();
}

function markLoginSetupComplete(userId = authSession?.user?.id) {
  if (!userId) return;
  state.flags = {
    ...(state.flags || {}),
    setupDone: true,
    loginSetupDone: true,
    loginSetupUserId: userId,
    appEntered: true,
  };
}

function hasCompletedLoginSetup() {
  const userId = authSession?.user?.id;
  if (!userId) return false;
  if (state.flags?.loginSetupDone && state.flags?.loginSetupUserId === userId) return true;

  const meta = authSession.user.user_metadata || {};
  if (meta.onboarding_complete === true) return true;

  const nickname = (state.profile.name || meta.display_name || meta.name || meta.full_name || "").trim();
  const cat = (state.navi.name || meta.cat_name || "").trim();
  return Boolean(nickname || cat);
}

function startSetup() {
  if (!els.chatSetup || !els.chatSetupInput) return;
  setupActive = true;
  setupStep = "userName";
  switchView("chat");
  addCatMessage("반가워. 내가 너를 뭐라고 부르면 될까? 이름을 입력해줄래?");
  showSetupStep();
  persist();
  render();
}

function showSetupStep() {
  if (!els.chatSetup || !els.chatSetupInput) return;
  els.chatSetup.classList.remove("is-hidden");
  if (setupStep === "userName") {
    els.chatSetupStep.textContent = t("setupUserStep");
    els.chatSetupTitle.textContent = t("setupUserTitle");
    els.chatSetupDescription.textContent = t("setupUserDescription");
    els.chatSetupInput.value = state.profile.name || "";
    els.chatSetupInput.placeholder = t("setupUserPlaceholder");
    els.chatSetupSubmit.textContent = t("next");
  } else {
    const who = state.profile.name ? (getLanguage() === "ko" ? `${state.profile.name}야, ` : `${state.profile.name}, `) : "";
    els.chatSetupStep.textContent = t("setupCatStep");
    els.chatSetupTitle.textContent = t("setupCatTitle", { who });
    els.chatSetupDescription.textContent = t("setupCatDescription");
    els.chatSetupInput.value = state.navi.name || "";
    els.chatSetupInput.placeholder = t("setupCatPlaceholder");
    els.chatSetupSubmit.textContent = t("start");
  }
  window.setTimeout(() => els.chatSetupInput.focus(), 50);
}

function handleSetupSubmit(event) {
  event.preventDefault();
  if (!setupActive) return;
  const value = els.chatSetupInput.value.trim();
  if (setupStep === "userName") {
    if (value) {
      state.profile.name = value;
      persist();
      void syncProfileToCloud();
    }
    setupStep = "catName";
    addCatMessage(value ? `${value}라고 부르면 되는구나. 이번엔 내 이름도 지어줄래?` : "괜찮아. 이름은 나중에 알려줘도 돼. 이번엔 내 이름도 지어줄래?");
    persist();
    render();
    showSetupStep();
    return;
  }

  if (value) state.navi.name = value;
  addCatMessage(value ? `${value}라고 불러주면 되는구나. 좋아, 이제 같이 이야기해보자.` : "좋아, 지금은 나비라고 불러도 괜찮아. 이제 같이 이야기해보자.");
  void finishSetup();
}

function handleSetupSkip() {
  if (!setupActive) return;
  if (setupStep === "userName") {
    setupStep = "catName";
    addCatMessage("괜찮아. 이름은 나중에 알려줘도 돼. 그럼 내 이름도 지어줄래?");
    persist();
    render();
    showSetupStep();
    return;
  }
  addCatMessage("괜찮아. 지금은 나비라고 불러도 좋아. 이제 천천히 이야기해보자.");
  void finishSetup();
}

async function finishSetup() {
  setupActive = false;
  setupStep = "userName";
  markLoginSetupComplete(authSession?.user?.id);
  if (els.chatSetup) els.chatSetup.classList.add("is-hidden");
  persist();
  await syncProfileToCloud();
  switchView("chat");
  render();
}

function stopSetup() {
  setupActive = false;
  setupStep = "userName";
  if (els.chatSetup) els.chatSetup.classList.add("is-hidden");
}

function bindEvents() {
  els.openNavi?.addEventListener("click", () => switchView(currentView === "navi" ? "chat" : "navi"));
  els.openMe?.addEventListener("click", () => switchView(currentView === "me" ? "chat" : "me"));
  els.naviNameEditBtn?.addEventListener("click", openNaviNameEdit);
  els.naviNameEditForm?.addEventListener("submit", saveNaviName);
  els.naviNameEditCancel?.addEventListener("click", closeNaviNameEdit);
  els.googleLogin?.addEventListener("click", () => signInWithGoogle(els.googleLogin));
  els.meLogoutButton?.addEventListener("click", signOut);
  els.deleteAccountButton?.addEventListener("click", deleteAccount);
  els.chatSetupForm?.addEventListener("submit", handleSetupSubmit);
  els.chatSetupSkip?.addEventListener("click", handleSetupSkip);
  els.saveFootprint?.addEventListener("click", saveFootprint);
  els.skipFootprint?.addEventListener("click", skipFootprint);
  els.languageSelect?.addEventListener("change", (event) => setLanguage(event.target.value));

  document.querySelector("#openDrawer")?.addEventListener("click", openDrawer);
  els.scrim?.addEventListener("click", closeDrawer);
  document.querySelector("#newChatDrawer")?.addEventListener("click", startNewChat);

  els.chatHistoryList?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-chat-id]");
    if (!item) return;
    loadChatHistory(item.dataset.chatId);
  });

  els.chatHistorySearch?.addEventListener("input", () => renderChatHistory());

  els.chatForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = els.messageInput.value.trim();
    if (!message) return;
    receiveUserMessage(message);
    els.messageInput.value = "";
  });

  els.quickActions?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-prompt]");
    if (button) {
      moveNaviNear(button, "여기 앉아서 들어볼게.");
      receiveUserMessage(button.dataset.prompt);
    }
  });

  els.profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(els.profileForm);
    state.profile = {
      name: String(formData.get("name") || "").trim(),
      goal: String(formData.get("goal")),
      tone: String(formData.get("tone")),
      focus: formData.getAll("focus").map(String),
    };
    const name = state.profile.name || "너";
    addCatMessage(`${name}에게 맞춰 기억해둘게. 오늘 목표는 ${state.profile.goal}, 대화 톤은 ${state.profile.tone}.`);
    await syncProfileToCloud();
    switchView("chat");
    persist();
    render();
  });
}

async function bootstrapApp() {
  const client = await getSupabaseClient();
  if (!isSupabaseConfigured() || !client) {
    document.body.classList.remove("is-auth-booting");
    if (state.flags?.appEntered) {
      enterApp();
    } else {
      showWelcomeFlow();
    }
    renderAuth(null);
    return;
  }

  client.auth.onAuthStateChange((event, session) => handleAuthStateChange(event, session));

  const oauthErrorMessage = getOAuthErrorMessage();
  const session = oauthErrorMessage ? null : await resolveAuthSession(client);

  document.body.classList.remove("is-auth-booting");

  if (session) {
    if (!authSession) await finishAuthSession(session, { hydrate: !authHydrated });
    authBootstrapped = true;
  } else if (authSession) {
    authBootstrapped = true;
  } else if (oauthErrorMessage) {
    clearOAuthPending();
    cleanAuthParamsFromUrl();
    showWelcomeFlow();
    renderAuth(null);
    showWelcomeAuthError(oauthErrorMessage);
  } else if (isOAuthAttemptInProgress()) {
    enterApp();
    clearOAuthPending();
    showWelcomeAuthError("로그인 세션을 불러오지 못했어요. 다시 시도해 주세요.");
    renderAuth(null);
  } else if (state.flags?.appEntered) {
    enterApp();
    renderAuth(null);
  } else {
    showWelcomeFlow();
    renderAuth(null);
  }

  authBootstrapComplete = true;
}

async function signInWithGoogle(triggerButton = null) {
  const buttons = [triggerButton, document.querySelector("#welcomeGoogle"), els.googleLogin].filter(Boolean);
  const restoreButtons = () => {
    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
  };

  if (!isSupabaseConfigured()) {
    showWelcomeAuthError("Supabase 설정이 없어요. 배포 환경에서 supabase-config.js 생성 여부를 확인해 주세요.");
    return;
  }

  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });

  const client = await getSupabaseClient();
  if (!client) {
    restoreButtons();
    showWelcomeAuthError("로그인 준비가 아직 안 됐어요. 잠시 후 다시 눌러주세요.");
    return;
  }

  setWelcomeGuestAvailable(false);
  markOAuthPending();
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    restoreButtons();
    clearOAuthPending();
    showWelcomeAuthError(`로그인을 시작하지 못했어요. ${error.message}`);
    return;
  }

  if (data?.url) {
    window.location.assign(data.url);
    return;
  }

  clearOAuthPending();
  restoreButtons();
  showWelcomeAuthError("Google 로그인 페이지로 이동하지 못했어요. 다시 시도해 주세요.");
}

async function signOut() {
  const client = await getSupabaseClient();
  if (!client) return;

  const buttons = [els.meLogoutButton, els.deleteAccountButton].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });

  try {
    await client.auth.signOut();
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
    authSession = null;
    authHydrated = false;
    authBootstrapped = false;
    state.flags = { ...(state.flags || {}), appEntered: false };
    stopSetup();
    persist();
    renderAuth(null);
    showWelcomeFlow();
    render();
  }
}

async function deleteAccount() {
  const client = await getSupabaseClient();
  const session = authSession;
  if (!client || !session?.access_token || !session?.user?.id) {
    window.alert("로그인 상태를 확인할 수 없어요. 다시 로그인한 뒤 시도해 주세요.");
    return;
  }

  const firstConfirm = window.confirm("회원탈퇴하면 Google 계정 연결과 나비의 클라우드 기록이 삭제돼요. 계속할까요?");
  if (!firstConfirm) return;

  const typed = window.prompt("정말 탈퇴하려면 '회원탈퇴'를 입력해 주세요.");
  if (typed !== "회원탈퇴") return;

  const buttons = [els.deleteAccountButton, els.meLogoutButton].filter(Boolean);
  buttons.forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: session.user.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "회원탈퇴 처리에 실패했어요.");
    }

    await client.auth.signOut().catch(() => {});
    resetLocalAccountState();
    renderAuth(null);
    showWelcomeFlow();
    render();
    window.alert("회원탈퇴가 완료됐어요.");
  } catch (error) {
    console.error("delete account failed:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했어요.";
    window.alert(`회원탈퇴를 완료하지 못했어요. ${message}`);
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    });
  }
}

function resetLocalAccountState() {
  authSession = null;
  authHydrated = false;
  authBootstrapped = false;
  clearOAuthPending();
  stopSetup();

  const freshState = structuredClone(initialState);
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, freshState);

  localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

async function receiveUserMessage(message) {
  _interactionScore += 1; // 메시지 전송 시 상호작용 점수 +1
  moveNaviNear(els.messageInput, `${catName()}가 가까이 왔어요.`);
  state.messages.push({ role: "user", text: message });
  const context = analyzeMessage(message);
  updateDayContext(context);

  // 로딩 말풍선
  const loadingMsg = { role: "cat", text: "···", loading: true };
  state.messages.push(loadingMsg);
  render();

  // LLM 호출 (실패 시 rule-based fallback)
  const reply = await callNavi(state.messages, context);

  // 로딩 메시지 교체
  const idx = state.messages.indexOf(loadingMsg);
  const localizedReply = localizeCatSpeech(reply);
  if (idx !== -1) state.messages[idx] = { role: "cat", text: localizedReply };
  else state.messages.push({ role: "cat", text: localizedReply });

  if (FOOTPRINT_DRAFT_ENABLED) {
    state.footprintDraft = buildFootprintDraft(context);
  } else {
    state.footprintDraft = null;
  }
  syncActiveChatToHistory();
  persist();
  render();
}

async function callNavi(messages, context) {
  if (!isSupabaseConfigured()) return makeCatReply(context);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/navi-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ messages, context: { ...context, catName: catName(), language: getLanguage() } }),
      signal: AbortSignal.timeout(12000), // 12초 타임아웃
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return localizeCatSpeech(data.text || makeCatReply(context));
  } catch {
    return makeCatReply(context); // 네트워크 오류 시 rule-based로 대체
  }
}

function analyzeMessage(message) {
  const lower = message.toLowerCase();
  const sleepMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:시간|hours?\b|hrs?\b|h\b)/i);
  const minuteMatch = message.match(/(\d+)\s*(?:분|minutes?\b|mins?\b|m\b)/i);
  const negativeMood = ["불안", "우울", "피곤", "힘들", "지침", "스트레스", "집중이 잘 안", "잠을 못", "anxious", "sad", "tired", "stressed", "exhausted", "can't focus", "cannot focus", "couldn't sleep"];
  const positiveMood = ["괜찮", "좋", "편안", "상쾌", "기분이 나아", "차분", "okay", "good", "calm", "better", "fine"];
  const activityWords = ["걷", "운동", "산책", "헬스", "요가", "활동", "walk", "walked", "exercise", "workout", "yoga", "active"];
  const foodWords = ["식사", "저녁", "아침", "점심", "먹", "영양", "meal", "dinner", "breakfast", "lunch", "eat", "food", "nutrition"];

  return {
    sleepHours: sleepMatch ? Number(sleepMatch[1]) : null,
    activityMinutes: activityWords.some((word) => lower.includes(word)) && minuteMatch ? Number(minuteMatch[1]) : null,
    mood: negativeMood.some((word) => lower.includes(word)) ? "anxious" : positiveMood.some((word) => lower.includes(word)) ? "calm" : null,
    wantsFood: foodWords.some((word) => lower.includes(word)),
  };
}

function updateDayContext(context) {
  if (context.sleepHours !== null) state.day.sleepHours = context.sleepHours;
  if (context.activityMinutes !== null) state.day.activityMinutes = context.activityMinutes;
  if (context.mood) state.day.mood = context.mood === "anxious" ? "긴장" : "안정";

  if (state.day.sleepHours !== null && state.day.sleepHours < 6) state.day.energy = "낮음";
  else if (state.day.activityMinutes !== null && state.day.activityMinutes >= 20 && state.day.mood !== "긴장") state.day.energy = "좋음";
  else if (context.mood === "anxious") state.day.energy = "주의";

  addBond(2);
  if (context.sleepHours !== null) addBond(1);
  if (context.activityMinutes !== null) addBond(1);
}

function buildFootprintDraft(context = {}) {
  const mood = mapMood(context);
  const sleep = mapSleep(state.day.sleepHours);
  const activity = mapActivity(state.day.activityMinutes);
  const routine = chooseRoutine(mood, sleep, activity);

  return {
    footprint_date: getToday(),
    mood,
    sleep,
    activity,
    navi_note: makeNaviNote(mood, sleep, activity),
    user_note: "",
    routine,
    routine_done: false,
    bond_delta: routine === "rest" ? 1 : 2,
  };
}

function mapMood(context) {
  if (context.mood === "anxious" || state.day.mood === "긴장") return "anxious";
  if (state.day.energy === "낮음") return "tired";
  if (context.mood === "calm" || state.day.mood === "안정") return "calm";
  return "unknown";
}

function mapSleep(hours) {
  if (hours === null) return "unknown";
  if (hours < 6) return "poor";
  if (hours < 8) return "okay";
  return "good";
}

function mapActivity(minutes) {
  if (minutes === null) return "unknown";
  if (minutes < 10) return "low";
  if (minutes < 30) return "okay";
  return "good";
}

function chooseRoutine(mood, sleep, activity) {
  if (mood === "anxious") return "breathing";
  if (sleep === "poor" || mood === "tired") return "rest";
  if (activity === "low" || activity === "unknown") return "walk";
  return "journal";
}

function makeNaviNote(mood, sleep, activity) {
  if (mood === "anxious") return `오늘은 마음이 조금 웅크린 날이야. ${catName()}가 옆에서 숨을 천천히 맞춰줄게.`;
  if (sleep === "poor") return "오늘은 몸이 조금 느린 날이야. 무리하지 말고 회복을 먼저 챙기자.";
  if (activity === "good") return "오늘은 리듬이 꽤 살아있는 날이야. 이 작은 감각을 발자국으로 남겨두자.";
  return `오늘의 조각을 작게 남겨볼게. ${catName()}가 조용히 기억해둘게.`;
}

function makeCatReply(context) {
  if (getLanguage() === "en") {
    const replies = [];
    if (context.sleepHours !== null) {
      replies.push(context.sleepHours < 6 ? `With ${context.sleepHours} hours of sleep, let's keep recovery first today.` : `${context.sleepHours} hours of sleep is a helpful clue.`);
    }
    if (context.activityMinutes !== null) replies.push(`I noticed ${context.activityMinutes} minutes of movement.`);
    if (context.mood === "anxious") replies.push("When your mind feels tense, try three rounds of 4-second inhale and 6-second exhale.");
    if (context.wantsFood) replies.push("For food, starting lightly with today's condition is okay.");
    if (!replies.length) replies.push("If you tell me one more thing about sleep, activity, or mood, I can shape today's footprint better.");
    replies.push("I'll save only the summary you confirm, not the whole conversation.");
    return replies.join(" ");
  }

  const replies = [];
  if (context.sleepHours !== null) {
    replies.push(context.sleepHours < 6 ? `수면이 ${context.sleepHours}시간이면 오늘은 회복 우선으로 잡자.` : `${context.sleepHours}시간 잔 건 좋은 단서야.`);
  }
  if (context.activityMinutes !== null) replies.push(`${context.activityMinutes}분 움직인 기록을 확인했어.`);
  if (context.mood === "anxious") replies.push("마음이 긴장한 날에는 4초 들이마시고 6초 내쉬기를 세 번만 해보자.");
  if (context.wantsFood) replies.push("식사는 오늘 컨디션에 맞춰 가볍게 시작해도 좋아.");
  if (!replies.length) replies.push("수면, 활동, 기분 중 하나만 더 말해주면 오늘 발자국을 더 잘 만들 수 있어.");
  replies.push("대화 전체가 아니라 네가 확인한 요약만 발자국으로 남길게.");
  return replies.join(" ");
}

function makeRoutineReply(checked) {
  if (!checked.length) return "괜찮아. 루틴은 부담이 되면 작게 시작하면 돼.";
  return `좋아, 오늘은 ${checked.join(", ")}까지 챙겼어. ${catName()}가 보기엔 충분히 좋은 시작이야.`;
}

async function saveFootprint() {
  if (!state.footprintDraft) return;
  _interactionScore += 2; // 발자국 저장 시 상호작용 점수 +2
  addBond(3);
  const footprint = {
    ...state.footprintDraft,
    id: state.footprintDraft.id || crypto.randomUUID(),
    user_note: els.draftUserNote.value.trim(),
    created_at: state.footprintDraft.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  state.footprints = [footprint, ...state.footprints.filter((item) => item.footprint_date !== footprint.footprint_date)].slice(0, 14);
  state.footprintDraft = null;
  moveNaviNear(els.saveFootprint, "발자국 남겼다.");
  addCatMessage(authSession ? `오늘 발자국을 ${catName()}의 기억에 남겼어.` : `오늘 발자국을 이 기기에 남겼어. 로그인하면 ${catName()}가 다른 기기에서도 기억할 수 있어.`);
  persist();
  await syncToCloud();
  render();
}

function skipFootprint() {
  moveNaviToQuietSpot("괜찮아.");
  state.footprintDraft = null;
  addCatMessage(`좋아, 오늘은 그냥 지나가도 괜찮아. ${catName()}는 여기 있을게.`);
  persist();
  render();
}

function addCatMessage(text) {
  state.messages.push({ role: "cat", text: localizeCatSpeech(text) });
}

function addBond(points) {
  if (!points || points <= 0) return 0;
  const today = getToday();
  if (state.navi.dailyBondDate !== today) {
    state.navi.dailyBondDate = today;
    state.navi.dailyBondGain = 0;
  }

  const remaining = Math.max(0, DAILY_BOND_LIMIT - state.navi.dailyBondGain);
  const applied = Math.min(points, remaining, 100 - state.day.bond);
  if (applied <= 0) return 0;

  state.day.bond = Math.min(100, state.day.bond + applied);
  state.navi.dailyBondGain += applied;

  return applied;
}

function getCharacterAge(birthday) {
  if (!birthday) return 0;
  const birthDate = new Date(birthday);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

function getDaysTogether(birthday) {
  if (!birthday) return 1;
  const birthDate = new Date(`${birthday}T00:00:00`);
  const today = new Date(`${getToday()}T00:00:00`);
  const diff = Math.floor((today - birthDate) / 86400000);
  return Math.max(1, diff + 1);
}

function getNaviAgeLabel() {
  const age = getCharacterAge(state.navi.birthday);
  if (age >= 1) return `${catName()} ${age}살`;
  return `함께 ${getDaysTogether(state.navi.birthday)}일`;
}

function markDailyVisit() {
  const today = getToday();
  if (!state.navi.birthday) state.navi.birthday = today;
  if (state.navi.lastVisitDate === today) return;

  const previousVisit = state.navi.lastVisitDate;
  state.navi.streak = isYesterday(previousVisit, today) ? state.navi.streak + 1 : 1;
  state.navi.lastVisitDate = today;

  if (state.navi.streak >= 7 && state.navi.lastStreakBonusDate !== today) {
    state.navi.lastStreakBonusDate = today;
    addBond(2);
    addCatMessage(`7일째 들러줬네. ${catName()}가 이 리듬을 조용히 기억해둘게.`);
  }

  syncActiveCatFromNavi(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isYesterday(dateValue, todayValue) {
  if (!dateValue) return false;
  const date = new Date(`${dateValue}T00:00:00`);
  const today = new Date(`${todayValue}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
}

function render() {
  applyStaticTranslations();
  updateGreetingLine();
  renderAuth(authSession);
  renderChat();
  renderMetrics();
  renderInsights();
  renderChatHistory();
  renderProfile();
  renderNaviProfile();
  renderSetup();
  renderFootprintDraft();
  renderFootprints();
}

function renderSetup() {
  if (!els.chatSetup) return;
  els.chatSetup.classList.toggle("is-hidden", !setupActive);
}

function renderAuth(session) {
  const configured = isSupabaseConfigured();
  const loggedIn = hasAuthSession(session);
  const email = getSessionEmail(session);

  els.accountCard?.classList.toggle("is-hidden", !loggedIn);
  els.meLoginSection?.classList.toggle("is-hidden", loggedIn);
  els.accountBottomActions?.classList.toggle("is-hidden", !loggedIn);
  els.meLogoutButton?.classList.toggle("is-hidden", !loggedIn);
  els.deleteAccountButton?.classList.toggle("is-hidden", !loggedIn);

  if (els.googleLogin) {
    els.googleLogin.disabled = !configured || loggedIn;
    els.googleLogin.classList.toggle("is-hidden", loggedIn);
  }

  const welcomeGoogle = document.querySelector("#welcomeGoogle");
  if (welcomeGoogle) {
    welcomeGoogle.disabled = !configured || loggedIn;
    welcomeGoogle.classList.toggle("is-hidden", loggedIn);
  }

  setWelcomeGuestAvailable(!loggedIn);
  if (els.storageMode) els.storageMode.textContent = loggedIn ? t("cloudStorage") : t("localStorage");
  if (els.authDisplayName) {
    const nickname = (state.profile.name || "").trim();
    els.authDisplayName.textContent = nickname || t("profileUnset");
  }
  if (els.authEmail) els.authEmail.textContent = email;
  if (els.authTitle) {
    els.authTitle.textContent = configured ? t("googleLogin") : t("localMode");
  }
}

function renderChat() {
  if (!els.chatLog) return;
  const avatar = `<img class="av" src="./assets/navi-face.png" alt="" />`;
  els.chatLog.innerHTML = state.messages
    .map((message) => {
      if (message.role === "cat") {
        return (
          `<div class="row-nabi${message.loading ? " is-loading" : ""}">` +
          `${avatar}<div class="msg nabi">${escapeHtml(localizeCatSpeech(message.text))}</div></div>`
        );
      }
      return `<div class="row-me"><div class="msg me">${escapeHtml(message.text)}</div></div>`;
    })
    .join("");
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  setChatEmpty(!hasUserMessages());
}

function renderMetrics() {
  const labels = getLabels();
  if (els.sleepMetric) els.sleepMetric.textContent = state.day.sleepHours === null ? labels.sleep.unknown : getLanguage() === "ko" ? `${state.day.sleepHours}시간` : `${state.day.sleepHours}h`;
  if (els.activityMetric) els.activityMetric.textContent = state.day.activityMinutes === null ? labels.activity.unknown : getLanguage() === "ko" ? `${state.day.activityMinutes}분` : `${state.day.activityMinutes}m`;
  if (els.moodMetric) els.moodMetric.textContent = state.day.mood || labels.mood.unknown;
  if (els.energyMetric) els.energyMetric.textContent = state.day.energy;
  if (els.bondLabel) els.bondLabel.textContent = t("bondLabel", { bond: state.day.bond });
}

function renderInsights() {
  if (!els.insightList) return;
  const labels = getLabels();
  const insights = [];
  if (getLanguage() === "ko") {
    insights.push(state.day.sleepHours === null ? "수면 시간을 말해주면 오늘 발자국의 수면 요약을 만들 수 있어요." : `수면 요약은 ${labels.sleep[mapSleep(state.day.sleepHours)]}입니다.`);
    insights.push(state.day.activityMinutes === null ? "활동량이 비어 있습니다. 10분 걷기처럼 낮은 마찰의 루틴부터 시작해요." : `활동 요약은 ${labels.activity[mapActivity(state.day.activityMinutes)]}입니다.`);
    if (state.day.mood === "긴장") insights.push("긴장 키워드가 감지되었습니다. 4-6 호흡법을 추천합니다.");
  } else {
    insights.push(state.day.sleepHours === null ? "Share your sleep time to make today's sleep summary." : `Sleep summary: ${labels.sleep[mapSleep(state.day.sleepHours)]}.`);
    insights.push(state.day.activityMinutes === null ? "Activity is empty. Start with a low-friction routine like a 10-minute walk." : `Activity summary: ${labels.activity[mapActivity(state.day.activityMinutes)]}.`);
    if (state.day.mood === "긴장") insights.push("Tension keywords were noticed. Try 4-6 breathing.");
  }
  els.insightList.innerHTML = insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("");
}

function renderProfile() {
  if (!els.profileForm) return;
  els.profileForm.elements.name.value = state.profile.name;
  els.profileForm.elements.goal.value = state.profile.goal;
  els.profileForm.elements.tone.value = state.profile.tone;
  els.profileForm.querySelectorAll("input[name='focus']").forEach((input) => {
    input.checked = state.profile.focus.includes(input.value);
  });
}

function renderNaviProfile() {
  const name = catName();
  if (els.naviProfileName) els.naviProfileName.textContent = name;
  if (els.naviProfileBirthday) els.naviProfileBirthday.textContent = formatNaviBirthday(state.navi.birthday);
  els.naviProfileNameRow?.classList.toggle("is-hidden", naviNameEditing);
  els.naviNameEditForm?.classList.toggle("is-hidden", !naviNameEditing);
}

function openNaviNameEdit() {
  naviNameEditing = true;
  if (els.naviNameInput) els.naviNameInput.value = state.navi.name || "";
  renderNaviProfile();
  window.setTimeout(() => els.naviNameInput?.focus(), 50);
}

function closeNaviNameEdit() {
  naviNameEditing = false;
  renderNaviProfile();
}

function saveNaviName(event) {
  event.preventDefault();
  const value = els.naviNameInput?.value.trim();
  state.navi.name = value || null;
  syncActiveCatFromNavi(state);
  closeNaviNameEdit();
  persist();
  void syncProfileToCloud();
  render();
  if (currentView === "navi" && els.appSub) {
    els.appSub.textContent = `${catName()} 프로필`;
  }
}

function renderFootprintDraft() {
  if (!els.footprintDraft) return;
  const draft = FOOTPRINT_DRAFT_ENABLED ? state.footprintDraft : null;
  els.footprintDraft.classList.toggle("is-hidden", !draft);
  if (!draft) return;
  const labels = getLabels();
  els.draftMood.textContent = labels.mood[draft.mood];
  els.draftSleep.textContent = labels.sleep[draft.sleep];
  els.draftActivity.textContent = labels.activity[draft.activity];
  els.draftRoutine.textContent = labels.routine[draft.routine];
  els.draftNaviNote.textContent = draft.navi_note || draft.nabi_note || "";
  els.draftUserNote.value = draft.user_note || "";
}

function renderFootprints() {
  if (!els.footprintList) return;
  const labels = getLabels();
  const items = state.footprints.slice(0, 7);
  els.footprintList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="footprint-item">
              <h3>${escapeHtml(item.footprint_date)}</h3>
              <div class="footprint-tags">
                <span>${t("mood")} ${labels.mood[item.mood]}</span>
                <span>${t("sleep")} ${labels.sleep[item.sleep]}</span>
                <span>${t("activity")} ${labels.activity[item.activity]}</span>
                <span>${labels.routine[item.routine]}</span>
              </div>
              <p class="navi-note">${escapeHtml(item.navi_note || item.nabi_note || "")}</p>
              ${item.user_note ? `<p>${escapeHtml(item.user_note)}</p>` : ""}
            </article>
          `,
        )
        .join("")
    : `<article class="footprint-item"><h3>${escapeHtml(t("noFootprintsTitle"))}</h3><p class="navi-note">${escapeHtml(t("noFootprintsBody"))}</p></article>`;
}

function switchView(viewName) {
  if (viewName !== "navi") closeNaviNameEdit();
  currentView = viewName;
  els.openNavi?.classList.toggle("is-active", viewName === "navi");
  els.openMe?.classList.toggle("is-active", viewName === "me");
  Object.entries(els.views).forEach(([name, view]) => {
    if (view) view.classList.toggle("is-active", name === viewName);
  });
  document.querySelector(".dock")?.classList.toggle("is-hidden", viewName !== "chat");
  if (els.appSub) {
    if (viewName === "me") els.appSub.textContent = t("myPage");
    else if (viewName === "navi") els.appSub.textContent = t("catProfileSub", { catName: catName() });
    else if (viewName === "footprints") els.appSub.textContent = t("naviMemory");
    else els.appSub.textContent = hasUserMessages() ? t("chattingWithCat", { catName: catName() }) : t("appSubNew");
  }
  if (viewName === "chat") window.setTimeout(() => moveNaviToComposer(""), 80);
  else hideNaviWalker();
  closeDrawer();
}

function initNaviWalker() {
  if (!els.naviWalker) return;
  requestAnimationFrame(() => {
    moveNaviToComposer("나비가 여기서 기다릴게.", { instant: true });
  });
  window.addEventListener("resize", () => {
    if (isChatComposerVisible()) moveNaviToComposer("");
    else hideNaviWalker();
  });
}

function isChatComposerVisible() {
  return (
    currentView === "chat" &&
    els.composer &&
    !els.appShell?.classList.contains("is-hidden") &&
    !els.composer.closest(".dock")?.classList.contains("is-hidden")
  );
}

function moveNaviToComposer(bubbleText = "", options = {}) {
  if (!isChatComposerVisible()) {
    hideNaviWalker();
    return;
  }
  moveNaviNear(els.composer, bubbleText, { ...options, anchor: "composer" });
}

function moveNaviNear(target, bubbleText = "", options = {}) {
  if (!els.naviWalker || !target) return;
  const anchor = isChatComposerVisible() ? els.composer : target;
  const rect = anchor.getBoundingClientRect();
  const walkerWidth = els.naviWalker.getBoundingClientRect().width || 140;
  const x = clamp(rect.left + rect.width / 2 - walkerWidth / 2, 14, window.innerWidth - walkerWidth - 14);
  const y = clamp(rect.top - walkerWidth + 10, 74, window.innerHeight - walkerWidth - 18);
  setNaviPosition(x, y, bubbleText, options);
}

function moveNaviToQuietSpot(bubbleText = "") {
  if (isChatComposerVisible()) moveNaviToComposer(bubbleText);
  else hideNaviWalker();
}

function setNaviPosition(x, y, bubbleText = "", options = {}) {
  naviPosition = { x, y };
  els.naviWalker.style.setProperty("--navi-x", `${x}px`);
  els.naviWalker.style.setProperty("--navi-y", `${y}px`);
  els.naviWalker.classList.remove("is-hidden");
  els.naviWalker.classList.add("is-docked");
  showNaviSittingIdle();
  window.clearTimeout(naviStopTimer);
  showNaviBubble(bubbleText);
}

function showNaviSittingIdle() {
  if (!els.naviWalkerImage) return;
  stopNaviFrameAnimation();
  stopNaviRestIdleAnimation();
  window.clearTimeout(naviRestCycleTimer);
  els.naviWalkerImage.src = NAVI_SIT_IMAGE;
  els.naviWalkerImage.dataset.still = NAVI_SIT_IMAGE;
  naviRestCycleTimer = window.setTimeout(() => startNaviTailIdleAnimation(), NAVI_TAIL_IDLE_DELAY_MS);
}

function startNaviTailIdleAnimation() {
  if (!els.naviWalkerImage || naviFrameTimer) return;
  stopNaviRestIdleAnimation();
  window.clearTimeout(naviRestCycleTimer);
  naviFrameIndex = 0;
  els.naviWalkerImage.src = NAVI_TAIL_IDLE_FRAMES[naviFrameIndex] || NAVI_SIT_IMAGE;
  naviFrameTimer = window.setInterval(() => {
    naviFrameIndex = (naviFrameIndex + 1) % NAVI_TAIL_IDLE_FRAMES.length;
    if (naviFrameIndex === 0) {
      stopNaviFrameAnimation();
      els.naviWalkerImage.src = NAVI_SIT_IMAGE;
      naviRestCycleTimer = window.setTimeout(() => startNaviRestIdleAnimation(), NAVI_REST_AFTER_MS);
      return;
    }
    els.naviWalkerImage.src = NAVI_TAIL_IDLE_FRAMES[naviFrameIndex] || NAVI_SIT_IMAGE;
  }, NAVI_TAIL_FRAME_MS);
}

function stopNaviFrameAnimation() {
  window.clearInterval(naviFrameTimer);
  naviFrameTimer = null;
  naviFrameIndex = 0;
}

function startNaviRestIdleAnimation() {
  if (!els.naviWalkerImage) return;
  stopNaviFrameAnimation();
  stopNaviRestIdleAnimation();
  window.clearTimeout(naviRestCycleTimer);
  if (!NAVI_REST_IDLE_FRAMES.length) {
    setNaviRestImage();
    return;
  }
  let restFrameIndex = 0;
  els.naviWalkerImage.src = NAVI_REST_IDLE_FRAMES[restFrameIndex];
  naviRestIdleTimer = window.setInterval(() => {
    restFrameIndex += 1;
    if (restFrameIndex >= NAVI_REST_IDLE_FRAMES.length) {
      setNaviRestImage();
      naviRestCycleTimer = window.setTimeout(() => {
        if (isChatComposerVisible()) showNaviSittingIdle();
      }, NAVI_REST_HOLD_MS);
      return;
    }
    els.naviWalkerImage.src = NAVI_REST_IDLE_FRAMES[restFrameIndex];
  }, NAVI_REST_FRAME_MS);
}

function stopNaviRestIdleAnimation() {
  window.clearInterval(naviRestIdleTimer);
  naviRestIdleTimer = null;
}

function setNaviRestImage() {
  stopNaviRestIdleAnimation();
  els.naviWalkerImage.src = NAVI_REST_IMAGE;
  els.naviWalkerImage.dataset.still = NAVI_REST_IMAGE;
}

function hideNaviWalker() {
  if (!els.naviWalker) return;
  stopNaviFrameAnimation();
  stopNaviRestIdleAnimation();
  window.clearTimeout(naviRestCycleTimer);
  window.clearTimeout(naviStopTimer);
  els.naviWalker.classList.add("is-hidden");
  els.naviWalker.classList.remove("is-docked", "has-bubble");
  if (els.naviWalkerImage) els.naviWalkerImage.src = NAVI_SIT_IMAGE;
}

function showNaviBubble(text) {
  if (!text) return;
  els.naviBubble.textContent = text;
  els.naviWalker.classList.add("has-bubble");
  window.clearTimeout(naviBubbleTimer);
  naviBubbleTimer = window.setTimeout(() => els.naviWalker.classList.remove("has-bubble"), 2300);
}

function randomNaviBubble() {
  const lines = ["여기서 잠깐 앉을게.", "나비가 둘러보는 중.", "오늘 리듬을 살피고 있어.", "천천히 해도 괜찮아."];
  return lines[Math.floor(Math.random() * lines.length)];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function createChatId() {
  return crypto.randomUUID();
}

function getFirstUserMessage(messages = state.messages) {
  return messages.find((message) => message.role === "user")?.text?.trim() || "";
}

function getChatPreview(messages = state.messages) {
  const last = [...messages].reverse().find((message) => message.role === "cat" && !message.loading);
  return (last?.text || "대화 기록").replace(/\s+/g, " ").slice(0, 72);
}

function deriveChatTitle(messages = state.messages) {
  const first = getFirstUserMessage(messages);
  if (!first) return t("newChatTitle");
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function formatHistoryTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const today = getToday();
  const day = iso.slice(0, 10);
  if (day === today) {
    return date.toLocaleTimeString(getLanguage() === "ko" ? "ko-KR" : "en-US", { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((new Date(`${today}T00:00:00`) - new Date(`${day}T00:00:00`)) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString(getLanguage() === "ko" ? "ko-KR" : "en-US", { weekday: "short" });
  }
  return date.toLocaleDateString(getLanguage() === "ko" ? "ko-KR" : "en-US", { month: "numeric", day: "numeric" });
}

function buildChatHistoryEntry(id, messages, createdAt) {
  const cleanMessages = messages.filter((message) => !message.loading).map((message) => ({ ...message }));
  const now = new Date().toISOString();
  return {
    id,
    title: deriveChatTitle(cleanMessages),
    snippet: getChatPreview(cleanMessages),
    messages: cleanMessages,
    createdAt: createdAt || now,
    updatedAt: now,
  };
}

function archiveCurrentChat() {
  if (!hasUserMessages()) return null;
  const id = state.activeChatId || createChatId();
  const existing = state.chatHistory.find((entry) => entry.id === id);
  const entry = buildChatHistoryEntry(id, state.messages, existing?.createdAt);
  state.chatHistory = [entry, ...state.chatHistory.filter((item) => item.id !== id)].slice(0, 30);
  state.activeChatId = id;
  return id;
}

function syncActiveChatToHistory() {
  if (!state.activeChatId || !hasUserMessages()) return;
  const index = state.chatHistory.findIndex((entry) => entry.id === state.activeChatId);
  if (index < 0) return;
  state.chatHistory[index] = buildChatHistoryEntry(state.activeChatId, state.messages, state.chatHistory[index].createdAt);
}

function startNewChat() {
  closeDrawer();
  archiveCurrentChat();
  state.messages = [{ role: "cat", text: getDefaultCatGreeting() }];
  state.footprintDraft = null;
  state.activeChatId = null;
  persist();
  switchView("chat");
  render();
}

function getVisibleChatHistory(query = "") {
  const items = [...(state.chatHistory || [])].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );

  const hasDraft = hasUserMessages() && !items.some((entry) => entry.id === state.activeChatId);
  if (hasDraft) {
    items.unshift({
      id: state.activeChatId || "__draft__",
      title: deriveChatTitle(),
      snippet: getChatPreview(),
      updatedAt: new Date().toISOString(),
      isDraft: true,
    });
  }

  if (!query) return items;
  return items.filter((entry) => `${entry.title} ${entry.snippet}`.toLowerCase().includes(query));
}

function loadChatHistory(chatId) {
  if (chatId === "__draft__") {
    closeDrawer();
    switchView("chat");
    return;
  }
  const entry = state.chatHistory.find((item) => item.id === chatId);
  if (!entry) return;
  if (state.activeChatId === chatId) {
    closeDrawer();
    switchView("chat");
    return;
  }
  archiveCurrentChat();
  state.messages = entry.messages.map((message) => ({ ...message }));
  state.activeChatId = chatId;
  state.footprintDraft = null;
  closeDrawer();
  switchView("chat");
  render();
}

function renderChatHistory() {
  if (!els.chatHistoryList) return;
  const query = (els.chatHistorySearch?.value || "").trim().toLowerCase();
  const items = getVisibleChatHistory(query);

  if (!items.length) {
    els.chatHistoryList.innerHTML =
      `<p class="hist-empty">${query ? escapeHtml(t("emptySearch")) : t("emptyHistory")}</p>`;
    return;
  }

  els.chatHistoryList.innerHTML = items
    .map((entry) => {
      const isActive = entry.id === state.activeChatId || (entry.isDraft && !state.activeChatId);
      return `
        <button class="hist${isActive ? " is-active" : ""}${entry.isDraft ? " is-draft" : ""}" type="button" data-chat-id="${escapeHtml(entry.id)}">
          <div class="top">
            <span class="htitle">${escapeHtml(entry.isDraft ? t("nowChat") : entry.title)}</span>
            <span class="htime">${escapeHtml(entry.isDraft ? t("inProgress") : formatHistoryTime(entry.updatedAt || entry.createdAt))}</span>
          </div>
          <div class="hsnip">${escapeHtml(entry.snippet)}</div>
        </button>
      `;
    })
    .join("");
}

function persist() {
  syncActiveCatFromNavi(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSync();
}

function queueCloudSync() {
  if (!authSession || !supabase) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncToCloud, 450);
}

async function hydrateFromCloud() {
  const client = await getSupabaseClient();
  if (!authSession || !client) return;
  const userId = authSession.user.id;
  const meta = authSession.user.user_metadata || {};
  const [{ data: profile, error: profileError }, { data: footprints, error: footprintsError }] = await Promise.all([
    client.from("profiles").select("display_name, goal, tone, focus").eq("user_id", userId).maybeSingle(),
    client.from("daily_footprints").select("*").eq("user_id", userId).order("footprint_date", { ascending: false }).limit(14),
  ]);

  if (profileError) console.error("Profile hydrate failed:", profileError);
  if (footprintsError) console.error("Footprints hydrate failed:", footprintsError);

  const nickname = (profile?.display_name || meta.display_name || meta.name || meta.full_name || "").trim();
  if (nickname) state.profile.name = nickname;

  if (profile) {
    state.profile = {
      name: nickname || state.profile.name || "",
      goal: profile.goal || initialState.profile.goal,
      tone: profile.tone || initialState.profile.tone,
      focus: profile.focus || [],
    };
  }

  const catName = (meta.cat_name || "").trim();
  if (catName) state.navi.name = catName;
  if (meta.navi_birthday && !state.navi.birthday) state.navi.birthday = meta.navi_birthday;
  syncActiveCatFromNavi(state);

  if (footprints?.length) state.footprints = footprints.map(normalizeFootprintRecord);

  if (hasCompletedLoginSetup()) markLoginSetupComplete(userId);

  await syncProfileToCloud(client);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

async function syncAuthProfileMetadata(clientIn) {
  const client = clientIn || (await getSupabaseClient());
  if (!authSession?.user || !client) return false;

  const metadata = authSession.user.user_metadata || {};
  const displayName = (state.profile?.name || "").trim();
  const catName = (state.navi?.name || "").trim();
  const birthday = state.navi?.birthday || "";
  const onboardingComplete = Boolean(
    state.flags?.loginSetupDone && state.flags?.loginSetupUserId === authSession.user.id,
  );

  const next = { ...metadata };
  if (displayName) {
    next.display_name = displayName;
    next.name = displayName;
    next.full_name = displayName;
  }
  if (catName) next.cat_name = catName;
  if (birthday) next.navi_birthday = birthday;
  if (onboardingComplete) next.onboarding_complete = true;

  const unchanged =
    metadata.display_name === next.display_name &&
    metadata.name === next.name &&
    metadata.full_name === next.full_name &&
    metadata.cat_name === next.cat_name &&
    metadata.navi_birthday === next.navi_birthday &&
    metadata.onboarding_complete === next.onboarding_complete;
  if (unchanged) return true;

  const { data, error } = await client.auth.updateUser({ data: next });

  if (error) {
    console.error("Auth profile metadata sync failed:", error);
    return false;
  }

  if (data.user) {
    authSession = { ...authSession, user: data.user };
    renderAuth(authSession);
  }
  return true;
}

async function syncProfileToCloud(clientIn) {
  const client = clientIn || (await getSupabaseClient());
  if (!authSession?.user || !client) return false;

  await syncAuthProfileMetadata(client);

  const userId = authSession.user.id;
  const displayName = (state.profile?.name || "").trim();
  const { error } = await client.from("profiles").upsert(
    {
      user_id: userId,
      display_name: displayName || null,
      goal: state.profile?.goal,
      tone: state.profile?.tone,
      focus: state.profile?.focus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Profile sync failed:", error);
    return false;
  }
  return true;
}

async function syncToCloud() {
  const client = await getSupabaseClient();
  if (!authSession?.user || !client) return;

  const userId = authSession.user.id;
  const synced = await syncProfileToCloud(client);
  if (!synced) return;
  if (!state.footprints.length) return;

  const payload = state.footprints.map((item) => ({
    user_id: userId,
    footprint_date: item.footprint_date,
    mood: item.mood,
    sleep: item.sleep,
    activity: item.activity,
    nabi_note: item.navi_note || item.nabi_note || "",
    user_note: item.user_note || null,
    routine: item.routine,
    routine_done: item.routine_done,
    bond_delta: item.bond_delta,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await client.from("daily_footprints").upsert(payload, { onConflict: "user_id,footprint_date" });
  if (error) console.error("Footprints sync failed:", error);
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!stored) return ensureCatState(structuredClone(initialState));
    const parsed = JSON.parse(stored);
    return ensureCatState(deepMerge(initialState, normalizePersistedState(parsed)));
  } catch {
    return ensureCatState(structuredClone(initialState));
  }
}

function normalizePersistedState(value) {
  if (!value || typeof value !== "object") return {};
  const normalized = { ...value };

  if (!SUPPORTED_LANGUAGES.includes(normalized.language)) {
    normalized.language = DEFAULT_LANGUAGE;
  }

  if (!normalized.navi && normalized.nabi) {
    normalized.navi = normalized.nabi;
  }

  normalizeCatCollection(normalized);

  if (normalized.footprintDraft && typeof normalized.footprintDraft === "object") {
    normalized.footprintDraft = normalizeFootprintRecord(normalized.footprintDraft);
  }

  if (Array.isArray(normalized.footprints)) {
    normalized.footprints = normalized.footprints.map(normalizeFootprintRecord);
  }

  if (!Array.isArray(normalized.chatHistory)) {
    normalized.chatHistory = [];
  } else {
    normalized.chatHistory = normalized.chatHistory
      .filter((entry) => entry && typeof entry === "object" && Array.isArray(entry.messages))
      .slice(0, 30);
  }

  if (normalized.activeChatId != null && typeof normalized.activeChatId !== "string") {
    normalized.activeChatId = null;
  }

  return normalized;
}

function normalizeCatCollection(target) {
  const legacyNavi = target.navi && typeof target.navi === "object" ? target.navi : {};
  const cats = Array.isArray(target.cats) ? target.cats : [];
  const normalizedCats = cats
    .filter((cat) => cat && typeof cat === "object")
    .map((cat, index) => normalizeCatSlot(cat, { id: index === 0 ? DEFAULT_CAT_ID : `cat-${index + 1}` }));

  if (!normalizedCats.length) {
    normalizedCats.push(normalizeCatSlot({ ...legacyNavi, id: DEFAULT_CAT_ID }));
  }

  target.cats = normalizedCats;
  if (!target.activeCatId || !normalizedCats.some((cat) => cat.id === target.activeCatId)) {
    target.activeCatId = normalizedCats[0].id;
  }

  const activeCat = normalizedCats.find((cat) => cat.id === target.activeCatId) || normalizedCats[0];
  target.navi = catToNaviState(activeCat);
}

function normalizeCatSlot(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : {};
  const id = typeof source.id === "string" && source.id.trim() ? source.id : fallback.id || DEFAULT_CAT_ID;
  return {
    ...DEFAULT_CAT_SLOT,
    ...fallback,
    ...source,
    id,
  };
}

function catToNaviState(cat) {
  const { id, avatar, ...navi } = normalizeCatSlot(cat);
  return {
    ...DEFAULT_NAVI_STATE,
    ...navi,
  };
}

function syncActiveCatFromNavi(target = state) {
  const navi = target.navi && typeof target.navi === "object" ? target.navi : {};
  const cats = Array.isArray(target.cats) ? target.cats : [];
  target.cats = cats
    .filter((cat) => cat && typeof cat === "object")
    .map((cat, index) => normalizeCatSlot(cat, { id: index === 0 ? DEFAULT_CAT_ID : `cat-${index + 1}` }));

  if (!target.cats.length) {
    target.cats.push(normalizeCatSlot({ ...navi, id: DEFAULT_CAT_ID }));
  }

  if (!target.activeCatId || !target.cats.some((cat) => cat.id === target.activeCatId)) {
    target.activeCatId = target.cats[0].id;
  }

  const activeIndex = target.cats.findIndex((cat) => cat.id === target.activeCatId);
  target.cats[activeIndex] = normalizeCatSlot({
    ...target.cats[activeIndex],
    ...navi,
    id: target.cats[activeIndex].id,
  });
}

function ensureCatState(target) {
  normalizeCatCollection(target);
  return target;
}
function normalizeFootprintRecord(item) {
  if (!item || typeof item !== "object") return item;
  if (item.navi_note !== undefined) return item;
  return {
    ...item,
    navi_note: item.nabi_note || "",
  };
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function deepMerge(base, value) {
  const merged = structuredClone(base);
  Object.entries(value || {}).forEach(([key, item]) => {
    if (item && typeof item === "object" && !Array.isArray(item)) merged[key] = deepMerge(merged[key] || {}, item);
    else merged[key] = item;
  });
  return merged;
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
