import { getSupabase, isSupabaseConfigured } from "./supabase-client.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const STORAGE_KEY = "hello-naviya-state-v4";
const LEGACY_STORAGE_KEYS = ["hello-nabiya-state-v3"];

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

const labels = {
  mood: { calm: "안정", tired: "피곤", anxious: "불안", sad: "가라앉음", happy: "좋음", mixed: "복합적", unknown: "미입력" },
  sleep: { unknown: "미입력", poor: "부족", okay: "보통", good: "충분" },
  activity: { unknown: "미입력", low: "낮음", okay: "보통", good: "좋음" },
  routine: { breathing: "3분 호흡", walk: "10분 걷기", water: "물 마시기", stretch: "가벼운 스트레칭", journal: "한 문장 적기", rest: "쉬기" },
};

const DAILY_BOND_LIMIT = 12;
const NAVI_LEVELS = [
  { level: 1, minBond: 0, name: "새끼 나비", copy: "처음 만난 나비가 조심스럽게 곁에 앉아 있어요." },
  { level: 2, minBond: 30, name: "어린 나비", copy: "나비가 조금 더 편하게 먼저 다가오고 있어요." },
  { level: 3, minBond: 65, name: "청년 나비", copy: "나비가 오늘의 패턴을 더 또렷하게 기억하려고 해요." },
];

const initialState = {
  profile: { name: "", goal: "정서적 안정", tone: "다정하고 차분하게", focus: [] },
  day: { sleepHours: null, activityMinutes: null, mood: null, energy: "보통", bond: 42, routines: [] },
  navi: { dailyBondDate: null, dailyBondGain: 0, lastVisitDate: null, streak: 0, lastStreakBonusDate: null, lastLevelMessage: 1, birthday: null, name: null },
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

const MOOD_RESPONSES = {
  good: "너도 기분이 좋다니 다행이야!<br>그럼 우리 산책하러 가자 🐾",
  meh: "그렇구나.<br>기분이 안 좋을 땐 좀 걷는 게<br>도움이 된대. 같이 걸어볼까?",
  free: "들려줘서 고마워.<br>잠깐 같이 바람 쐬러 갈까? 🐾",
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
  accountCard: document.querySelector("#accountCard"),
  meLoginSection: document.querySelector("#meLoginSection"),
  googleLogin: document.querySelector("#googleLogin"),
  meLogoutButton: document.querySelector("#meLogoutButton"),
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
  naviLevelLabel: document.querySelector("#naviLevelLabel"),
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
};

if (shouldRestoreOnLoad()) {
  prepareRestoredAppShell();
}

let naviPosition = { x: 170, y: 230 };
let naviWalkTimer = null;
let naviBubbleTimer = null;
let naviStopTimer = null;
let naviFrameTimer = null;
let naviFrameIndex = 0;
const NAVI_FRAME_MS = 80;
const NAVI_WALK_FRAMES = Array.from(
  { length: 22 },
  (_, index) => `./assets/navi-frames/navi-${String(index + 1).padStart(2, "0")}.png`,
);
// 산책을 멈추고 쉴 때 보여줄 누운 포즈. 곁에 오면 눈맞춤(front), 멀리서 쉴 땐 옆모습(aspect).
const NAVI_REST_POSES = {
  front: "./assets/navi-lying-face-front.png",
  aspect: "./assets/navi-lying-face-aspect.png",
};
let naviRestPose = "front";

// 채팅 셋업 상태 — 최상위 render() 호출보다 먼저 선언해야 TDZ(초기화 전 접근) 오류가 없다.
let setupActive = false;
let setupStep = "userName";
let currentView = "chat";
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
    if (els.appSub) els.appSub.textContent = "로그인에 문제가 있어요";
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
    els.greetLine.innerHTML = name ? `안녕 ${escapeHtml(name)},<br>오늘 하루는 어땠어?` : "안녕,<br>오늘 하루는 어땠어?";
  }
}

function setChatEmpty(isEmpty) {
  els.appEmpty?.classList.toggle("is-hidden", !isEmpty);
  if (els.appSub) els.appSub.textContent = isEmpty ? "새로운 대화" : `${catName()}와 대화 중`;
}

function hasUserMessages() {
  return state.messages.some((message) => message.role === "user");
}

function showMoodResponse(mood, pendingText = "") {
  const resp = document.querySelector("#respText");
  if (resp) resp.innerHTML = MOOD_RESPONSES[mood] || MOOD_RESPONSES.free;
  pendingWelcomeMessage = pendingText || null;
  showFlowScreen("responseScreen");
}

function showProfileScreen() {
  showFlowScreen("profileScreen");
  if (els.profileUserName) els.profileUserName.value = state.profile.name || "";
  if (els.profileCatName) els.profileCatName.value = state.navi.name || "나비";
}

function finishProfileFlow() {
  const userName = els.profileUserName?.value.trim();
  const cat = els.profileCatName?.value.trim();
  if (userName) state.profile.name = userName;
  if (cat) state.navi.name = cat;
  state.flags = {
    ...(state.flags || {}),
    setupDone: true,
    loginSetupDone: true,
    loginSetupUserId: authSession?.user?.id || null,
  };
  setupActive = false;
  if (els.chatSetup) els.chatSetup.classList.add("is-hidden");
  persist();
  syncToCloud();
  enterApp();
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
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code");
    changed = true;
  }
  if (url.hash && /access_token|refresh_token|type=recovery|code=/.test(url.hash)) {
    url.hash = "";
    changed = true;
  }
  if (changed) {
    history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }
}

async function finishAuthSession(session, { hydrate = true } = {}) {
  if (!session?.user) return false;
  authSession = session;
  renderAuth(authSession);
  cleanAuthParamsFromUrl();
  if (hydrate && !authHydrated) {
    authHydrated = true;
    await hydrateFromCloud();
  }
  if (!hasCompletedLoginSetup()) {
    showProfileScreen();
  } else {
    enterApp();
  }
  render();
  return true;
}

async function resolveAuthSession(client) {
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
    stopSetup();
    renderAuth(null);
    if (state.flags?.appEntered) enterApp();
    else showWelcomeFlow();
    return;
  }

  // INITIAL_SESSION null은 "아직 로그인 안 함"일 뿐 로그아웃이 아니다.
  if (!session) return;

  if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
    if (authBootstrapped && authSession?.user?.id === session.user.id) {
      authSession = session;
      renderAuth(session);
      return;
    }
    void finishAuthSession(session, { hydrate: !authHydrated }).then(() => {
      authBootstrapped = true;
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
    const name = (state.profile.name || "").trim();
    const fullText = `${name ? name + "야, " : ""}오늘 나는 널 만나서 기분이 좋아.\n너의 기분은 어때?`;
    let index = 0;
    let typing = true;

    function type() {
      if (!typing || !textEl) return;
      if (index < fullText.length) {
        textEl.innerHTML += fullText[index] === "\n" ? "<br>" : escapeHtml(fullText[index]);
        index += 1;
        window.setTimeout(type, 90);
      }
    }
    window.setTimeout(type, 700);

    skip?.addEventListener("click", enterApp);
    if (cursor && input) input.addEventListener("focus", () => (cursor.style.display = "none"));

    document.querySelectorAll(".mood[data-mood]").forEach((button) => {
      button.addEventListener("click", () => showMoodResponse(button.dataset.mood));
    });
  }

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

function formatNaviBirthday(birthday) {
  if (!birthday) return "아직 기록 없음";
  const [year, month, day] = birthday.split("-").map(Number);
  if (!year || !month || !day) return birthday;
  return `${year}년 ${month}월 ${day}일`;
}

// 로그인 사용자에게만 채팅창 안에서 내 이름 → 고양이 이름 순서로 묻는다.
function maybeStartSetup() {
  if (setupActive || !authSession?.user?.id) return;
  if (hasCompletedLoginSetup()) return;
  showProfileScreen();
}

function hasCompletedLoginSetup() {
  const userId = authSession?.user?.id;
  if (!userId) return false;
  return Boolean(state.flags?.loginSetupDone && state.flags?.loginSetupUserId === userId);
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
    els.chatSetupStep.textContent = "내 이름 설정";
    els.chatSetupTitle.textContent = "내가 너를 뭐라고 부르면 될까?";
    els.chatSetupDescription.textContent = "편한 이름을 적어줘도 되고, 지금은 건너뛰어도 괜찮아.";
    els.chatSetupInput.value = state.profile.name || "";
    els.chatSetupInput.placeholder = "편한 이름을 적어볼래?";
    els.chatSetupSubmit.textContent = "다음";
  } else {
    const who = state.profile.name ? `${state.profile.name}야, ` : "";
    els.chatSetupStep.textContent = "고양이 이름 설정";
    els.chatSetupTitle.textContent = `${who}내 이름도 지어줄래?`;
    els.chatSetupDescription.textContent = "고양이 이름을 정하면 대화창에서 그 이름으로 불러줄게.";
    els.chatSetupInput.value = state.navi.name || "";
    els.chatSetupInput.placeholder = "예: 나비";
    els.chatSetupSubmit.textContent = "시작하기";
  }
  window.setTimeout(() => els.chatSetupInput.focus(), 50);
}

function handleSetupSubmit(event) {
  event.preventDefault();
  if (!setupActive) return;
  const value = els.chatSetupInput.value.trim();
  if (setupStep === "userName") {
    if (value) state.profile.name = value;
    setupStep = "catName";
    addCatMessage(value ? `${value}라고 부르면 되는구나. 이번엔 내 이름도 지어줄래?` : "괜찮아. 이름은 나중에 알려줘도 돼. 이번엔 내 이름도 지어줄래?");
    persist();
    render();
    showSetupStep();
    return;
  }

  if (value) state.navi.name = value;
  addCatMessage(value ? `${value}라고 불러주면 되는구나. 좋아, 이제 같이 이야기해보자.` : "좋아, 지금은 나비라고 불러도 괜찮아. 이제 같이 이야기해보자.");
  finishSetup();
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
  finishSetup();
}

function finishSetup() {
  setupActive = false;
  setupStep = "userName";
  state.flags = {
    ...(state.flags || {}),
    setupDone: true,
    loginSetupDone: true,
    loginSetupUserId: authSession?.user?.id || null,
  };
  if (els.chatSetup) els.chatSetup.classList.add("is-hidden");
  persist();
  syncToCloud();
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
  els.chatSetupForm?.addEventListener("submit", handleSetupSubmit);
  els.chatSetupSkip?.addEventListener("click", handleSetupSkip);
  els.saveFootprint?.addEventListener("click", saveFootprint);
  els.skipFootprint?.addEventListener("click", skipFootprint);

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

  els.profileForm?.addEventListener("submit", (event) => {
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

  const session = await resolveAuthSession(client);

  document.body.classList.remove("is-auth-booting");

  if (session) {
    if (!authSession) await finishAuthSession(session, { hydrate: !authHydrated });
    authBootstrapped = true;
  } else if (state.flags?.appEntered) {
    enterApp();
    renderAuth(null);
  } else {
    showWelcomeFlow();
    renderAuth(null);
  }
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
    showWelcomeAuthError(`로그인을 시작하지 못했어요. ${error.message}`);
    return;
  }

  if (data?.url) {
    window.location.assign(data.url);
    return;
  }

  restoreButtons();
  showWelcomeAuthError("Google 로그인 페이지로 이동하지 못했어요. 다시 시도해 주세요.");
}

async function signOut() {
  const client = await getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
  authSession = null;
  authHydrated = false;
  authBootstrapped = false;
  state.flags = { ...(state.flags || {}), appEntered: false };
  stopSetup();
  persist();
  renderAuth(null);
  showWelcomeFlow();
}

async function receiveUserMessage(message) {
  _interactionScore += 1; // 메시지 전송 시 상호작용 점수 +1
  moveNaviNear(els.messageInput, "나비가 가까이 왔어요.");
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
  if (idx !== -1) state.messages[idx] = { role: "cat", text: reply };
  else state.messages.push({ role: "cat", text: reply });

  state.footprintDraft = buildFootprintDraft(context);
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
      body: JSON.stringify({ messages, context }),
      signal: AbortSignal.timeout(12000), // 12초 타임아웃
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.text || makeCatReply(context);
  } catch {
    return makeCatReply(context); // 네트워크 오류 시 rule-based로 대체
  }
}

function analyzeMessage(message) {
  const lower = message.toLowerCase();
  const sleepMatch = message.match(/(\d+(?:\.\d+)?)\s*시간/);
  const minuteMatch = message.match(/(\d+)\s*분/);
  const negativeMood = ["불안", "우울", "피곤", "힘들", "지침", "스트레스", "집중이 잘 안", "잠을 못"];
  const positiveMood = ["괜찮", "좋", "편안", "상쾌", "기분이 나아", "차분"];
  const activityWords = ["걷", "운동", "산책", "헬스", "요가", "활동"];
  const foodWords = ["식사", "저녁", "아침", "점심", "먹", "영양"];

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

  const contextPoints = [context.sleepHours, context.activityMinutes, context.mood].filter(Boolean).length;
  addBond(Math.max(2, contextPoints * 3));
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
  if (mood === "anxious") return "오늘은 마음이 조금 웅크린 날이야. 나비가 옆에서 숨을 천천히 맞춰줄게.";
  if (sleep === "poor") return "오늘은 몸이 조금 느린 날이야. 무리하지 말고 회복을 먼저 챙기자.";
  if (activity === "good") return "오늘은 리듬이 꽤 살아있는 날이야. 이 작은 감각을 발자국으로 남겨두자.";
  return "오늘의 조각을 작게 남겨볼게. 나비가 조용히 기억해둘게.";
}

function makeCatReply(context) {
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
  return `좋아, 오늘은 ${checked.join(", ")}까지 챙겼어. 나비가 보기엔 충분히 좋은 시작이야.`;
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
  addCatMessage(authSession ? "오늘 발자국을 나비의 기억에 남겼어." : "오늘 발자국을 이 기기에 남겼어. 로그인하면 나비가 다른 기기에서도 기억할 수 있어.");
  persist();
  await syncToCloud();
  render();
}

function skipFootprint() {
  moveNaviToQuietSpot("괜찮아.");
  state.footprintDraft = null;
  addCatMessage("좋아, 오늘은 그냥 지나가도 괜찮아. 나비는 여기 있을게.");
  persist();
  render();
}

function addCatMessage(text) {
  state.messages.push({ role: "cat", text });
}

function addBond(points) {
  if (!points || points <= 0) return 0;
  const today = getToday();
  if (state.navi.dailyBondDate !== today) {
    state.navi.dailyBondDate = today;
    state.navi.dailyBondGain = 0;
  }

  const beforeLevel = getNaviGrowth().level;
  const remaining = Math.max(0, DAILY_BOND_LIMIT - state.navi.dailyBondGain);
  const applied = Math.min(points, remaining, 100 - state.day.bond);
  if (applied <= 0) return 0;

  state.day.bond = Math.min(100, state.day.bond + applied);
  state.navi.dailyBondGain += applied;

  const growth = getNaviGrowth();
  if (growth.level > beforeLevel && state.navi.lastLevelMessage !== growth.level) {
    state.navi.lastLevelMessage = growth.level;
    addCatMessage(`${growth.name}가 되었어. 나비가 너랑 조금 더 가까워진 것 같아.`);
  }

  return applied;
}

function getNaviGrowth() {
  const bond = Number(state.day.bond) || 0;
  return [...NAVI_LEVELS].reverse().find((level) => bond >= level.minBond) || NAVI_LEVELS[0];
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
  if (age >= 1) return `나비 ${age}살`;
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
    addCatMessage("7일째 들러줬네. 나비가 이 리듬을 조용히 기억해둘게.");
  }

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
  els.meLogoutButton?.classList.toggle("is-hidden", !loggedIn);

  if (els.googleLogin) {
    els.googleLogin.disabled = !configured || loggedIn;
    els.googleLogin.classList.toggle("is-hidden", loggedIn);
  }

  setWelcomeGuestAvailable(!loggedIn);
  if (els.storageMode) els.storageMode.textContent = loggedIn ? "클라우드 저장" : "로컬 저장";
  if (els.authEmail) els.authEmail.textContent = email;
  if (els.authTitle) {
    els.authTitle.textContent = configured ? "Google 로그인" : "로컬 모드";
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
          `${avatar}<div class="msg nabi">${escapeHtml(message.text)}</div></div>`
        );
      }
      return `<div class="row-me"><div class="msg me">${escapeHtml(message.text)}</div></div>`;
    })
    .join("");
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  setChatEmpty(!hasUserMessages());
}

function renderMetrics() {
  const growth = getNaviGrowth();
  if (els.sleepMetric) els.sleepMetric.textContent = state.day.sleepHours === null ? "미입력" : `${state.day.sleepHours}시간`;
  if (els.activityMetric) els.activityMetric.textContent = state.day.activityMinutes === null ? "미입력" : `${state.day.activityMinutes}분`;
  if (els.moodMetric) els.moodMetric.textContent = state.day.mood || "미입력";
  if (els.energyMetric) els.energyMetric.textContent = state.day.energy;
  if (els.bondLabel) els.bondLabel.textContent = `유대감 ${state.day.bond}%`;
  if (els.naviLevelLabel) els.naviLevelLabel.textContent = `Lv.${growth.level} ${growth.name}`;
}

function renderInsights() {
  if (!els.insightList) return;
  const insights = [];
  insights.push(state.day.sleepHours === null ? "수면 시간을 말해주면 오늘 발자국의 수면 요약을 만들 수 있어요." : `수면 요약은 ${labels.sleep[mapSleep(state.day.sleepHours)]}입니다.`);
  insights.push(state.day.activityMinutes === null ? "활동량이 비어 있습니다. 10분 걷기처럼 낮은 마찰의 루틴부터 시작해요." : `활동 요약은 ${labels.activity[mapActivity(state.day.activityMinutes)]}입니다.`);
  if (state.day.mood === "긴장") insights.push("긴장 키워드가 감지되었습니다. 4-6 호흡법을 추천합니다.");
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
  closeNaviNameEdit();
  persist();
  render();
  if (currentView === "navi" && els.appSub) {
    els.appSub.textContent = `${catName()} 프로필`;
  }
}

function renderFootprintDraft() {
  if (!els.footprintDraft) return;
  const draft = state.footprintDraft;
  els.footprintDraft.classList.toggle("is-hidden", !draft);
  if (!draft) return;
  els.draftMood.textContent = labels.mood[draft.mood];
  els.draftSleep.textContent = labels.sleep[draft.sleep];
  els.draftActivity.textContent = labels.activity[draft.activity];
  els.draftRoutine.textContent = labels.routine[draft.routine];
  els.draftNaviNote.textContent = draft.navi_note || draft.nabi_note || "";
  els.draftUserNote.value = draft.user_note || "";
}

function renderFootprints() {
  if (!els.footprintList) return;
  const items = state.footprints.slice(0, 7);
  els.footprintList.innerHTML = items.length
    ? items
        .map(
          (item) => `
            <article class="footprint-item">
              <h3>${escapeHtml(item.footprint_date)}</h3>
              <div class="footprint-tags">
                <span>감정 ${labels.mood[item.mood]}</span>
                <span>수면 ${labels.sleep[item.sleep]}</span>
                <span>활동 ${labels.activity[item.activity]}</span>
                <span>${labels.routine[item.routine]}</span>
              </div>
              <p class="navi-note">${escapeHtml(item.navi_note || item.nabi_note || "")}</p>
              ${item.user_note ? `<p>${escapeHtml(item.user_note)}</p>` : ""}
            </article>
          `,
        )
        .join("")
    : `<article class="footprint-item"><h3>아직 남긴 발자국이 없어요</h3><p class="navi-note">나비와 오늘을 이야기한 뒤 발자국을 남겨보세요.</p></article>`;
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
    if (viewName === "me") els.appSub.textContent = "마이페이지";
    else if (viewName === "navi") els.appSub.textContent = `${catName()} 프로필`;
    else if (viewName === "footprints") els.appSub.textContent = "나비의 기억";
    else els.appSub.textContent = hasUserMessages() ? `${catName()}와 대화 중` : "새로운 대화";
  }
  closeDrawer();
}

function initNaviWalker() {
  if (!els.naviWalker) return;
  requestAnimationFrame(() => {
    moveNaviNear(document.querySelector(".cat-stage"), "나비가 산책 중이에요.", { instant: true });
    scheduleNaviWalk();
  });
  window.addEventListener("resize", () => moveNaviToQuietSpot());
}

function scheduleNaviWalk() {
  window.clearTimeout(naviWalkTimer);
  naviWalkTimer = window.setTimeout(() => {
    moveNaviToQuietSpot();
    scheduleNaviWalk();
  }, 7000 + Math.random() * 5000);
}

function moveNaviNear(target, bubbleText = "", options = {}) {
  if (!els.naviWalker || !target) return;
  naviRestPose = "front";
  const rect = target.getBoundingClientRect();
  const walkerWidth = els.naviWalker.getBoundingClientRect().width || 140;
  const x = clamp(rect.left + rect.width / 2 - walkerWidth / 2, 14, window.innerWidth - walkerWidth - 14);
  const y = clamp(rect.top - walkerWidth * 0.56, 86, window.innerHeight - walkerWidth - 18);
  setNaviPosition(x, y, bubbleText, options);
}

function moveNaviToQuietSpot(bubbleText = "") {
  if (!els.naviWalker) return;
  naviRestPose = "aspect";
  const walkerWidth = els.naviWalker.getBoundingClientRect().width || 140;
  const x = clamp(28 + Math.random() * (window.innerWidth - walkerWidth - 56), 14, window.innerWidth - walkerWidth - 14);
  const y = clamp(130 + Math.random() * (window.innerHeight - walkerWidth - 180), 86, window.innerHeight - walkerWidth - 18);
  setNaviPosition(x, y, bubbleText || randomNaviBubble());
}

function setNaviPosition(x, y, bubbleText = "", options = {}) {
  naviPosition = { x, y };
  els.naviWalker.style.setProperty("--navi-x", `${x}px`);
  els.naviWalker.style.setProperty("--navi-y", `${y}px`);
  els.naviWalker.classList.toggle("is-walking", !options.instant);
  setNaviSprite(!options.instant);
  window.clearTimeout(naviStopTimer);
  naviStopTimer = window.setTimeout(() => {
    els.naviWalker.classList.remove("is-walking");
    setNaviSprite(false);
  }, options.instant ? 0 : 1800);
  showNaviBubble(bubbleText);
}

function setNaviSprite(isWalking) {
  if (!els.naviWalkerImage) return;
  if (isWalking) {
    startNaviFrameAnimation();
    return;
  }
  stopNaviFrameAnimation();
}

function startNaviFrameAnimation() {
  if (!els.naviWalkerImage || naviFrameTimer) return;
  naviFrameIndex = 0;
  els.naviWalkerImage.src = NAVI_WALK_FRAMES[naviFrameIndex];
  naviFrameTimer = window.setInterval(() => {
    naviFrameIndex = (naviFrameIndex + 1) % NAVI_WALK_FRAMES.length;
    els.naviWalkerImage.src = NAVI_WALK_FRAMES[naviFrameIndex];
  }, NAVI_FRAME_MS);
}

function stopNaviFrameAnimation() {
  window.clearInterval(naviFrameTimer);
  naviFrameTimer = null;
  naviFrameIndex = 0;
  els.naviWalkerImage.src = NAVI_REST_POSES[naviRestPose] || els.naviWalkerImage.dataset.still || NAVI_WALK_FRAMES[0];
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
  if (!first) return "새 대화";
  return first.length > 24 ? `${first.slice(0, 24)}…` : first;
}

function formatHistoryTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const today = getToday();
  const day = iso.slice(0, 10);
  if (day === today) {
    return date.toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((new Date(`${today}T00:00:00`) - new Date(`${day}T00:00:00`)) / 86400000);
  if (diffDays < 7) {
    return date.toLocaleDateString("ko-KR", { weekday: "short" });
  }
  return date.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
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
  state.messages = [...initialState.messages];
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
      `<p class="hist-empty">${query ? "검색 결과가 없어요." : "아직 저장된 대화가 없어요.<br>새 대화를 시작하면 여기에 쌓여요."}</p>`;
    return;
  }

  els.chatHistoryList.innerHTML = items
    .map((entry) => {
      const isActive = entry.id === state.activeChatId || (entry.isDraft && !state.activeChatId);
      return `
        <button class="hist${isActive ? " is-active" : ""}${entry.isDraft ? " is-draft" : ""}" type="button" data-chat-id="${escapeHtml(entry.id)}">
          <div class="top">
            <span class="htitle">${escapeHtml(entry.isDraft ? "지금 대화" : entry.title)}</span>
            <span class="htime">${escapeHtml(entry.isDraft ? "진행 중" : formatHistoryTime(entry.updatedAt || entry.createdAt))}</span>
          </div>
          <div class="hsnip">${escapeHtml(entry.snippet)}</div>
        </button>
      `;
    })
    .join("");
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueCloudSync();
}

function queueCloudSync() {
  if (!authSession || !supabase) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncToCloud, 450);
}

async function hydrateFromCloud() {
  if (!authSession || !supabase) return;
  const userId = authSession.user.id;
  const [{ data: profile }, { data: footprints }] = await Promise.all([
    supabase.from("profiles").select("display_name, goal, tone, focus").eq("user_id", userId).maybeSingle(),
    supabase.from("daily_footprints").select("*").eq("user_id", userId).order("footprint_date", { ascending: false }).limit(14),
  ]);
  if (profile) {
    state.profile = { name: profile.display_name || "", goal: profile.goal || initialState.profile.goal, tone: profile.tone || initialState.profile.tone, focus: profile.focus || [] };
  }
  if (footprints?.length) state.footprints = footprints.map(normalizeFootprintRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

async function syncToCloud() {
  if (!authSession || !supabase) return;
  const userId = authSession.user.id;
  await supabase.from("profiles").upsert(
    { user_id: userId, display_name: state.profile.name || null, goal: state.profile.goal, tone: state.profile.tone, focus: state.profile.focus, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
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
  await supabase.from("daily_footprints").upsert(payload, { onConflict: "user_id,footprint_date" });
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!stored) return structuredClone(initialState);
    const parsed = JSON.parse(stored);
    return deepMerge(initialState, normalizePersistedState(parsed));
  } catch {
    return structuredClone(initialState);
  }
}

function normalizePersistedState(value) {
  if (!value || typeof value !== "object") return {};
  const normalized = { ...value };

  if (!normalized.navi && normalized.nabi) {
    normalized.navi = normalized.nabi;
  }

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
