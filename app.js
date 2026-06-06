import { getSupabase, isSupabaseConfigured } from "./supabase-client.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const STORAGE_KEY = "hello-nabiya-state-v3";
const supabase = await getSupabase();

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
const NABI_LEVELS = [
  { level: 1, minBond: 0, name: "새끼 나비", copy: "처음 만난 나비가 조심스럽게 곁에 앉아 있어요." },
  { level: 2, minBond: 30, name: "어린 나비", copy: "나비가 조금 더 편하게 먼저 다가오고 있어요." },
  { level: 3, minBond: 65, name: "청년 나비", copy: "나비가 오늘의 패턴을 더 또렷하게 기억하려고 해요." },
];

const initialState = {
  profile: { name: "", goal: "정서적 안정", tone: "다정하고 차분하게", focus: [] },
  day: { sleepHours: null, activityMinutes: null, mood: null, energy: "보통", bond: 42, routines: [] },
  nabi: { dailyBondDate: null, dailyBondGain: 0, lastVisitDate: null, streak: 0, lastStreakBonusDate: null, lastLevelMessage: 1 },
  messages: [{ role: "cat", text: "안녕, 나는 나비야. 오늘 잠은 어땠고 몸은 어느 정도 움직였는지 편하게 말해줘." }],
  footprintDraft: null,
  footprints: [],
};

const state = loadState();
markDailyVisit();
let authSession = null;
let syncTimer = null;
let dismissWelcome = () => {};

const els = {
  tabs: document.querySelectorAll(".tab"),
  views: {
    chat: document.querySelector("#chatView"),
    footprints: document.querySelector("#footprintsView"),
    onboarding: document.querySelector("#onboardingView"),
    routine: document.querySelector("#routineView"),
  },
  authTitle: document.querySelector("#authTitle"),
  authDescription: document.querySelector("#authDescription"),
  googleLogin: document.querySelector("#googleLogin"),
  logoutButton: document.querySelector("#logoutButton"),
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
  catMood: document.querySelector("#catMood"),
  bondLabel: document.querySelector("#bondLabel"),
  nabiLevelLabel: document.querySelector("#nabiLevelLabel"),
  resetDay: document.querySelector("#resetDay"),
  profileForm: document.querySelector("#profileForm"),
  completeRoutine: document.querySelector("#completeRoutine"),
  footprintDraft: document.querySelector("#footprintDraft"),
  draftMood: document.querySelector("#draftMood"),
  draftSleep: document.querySelector("#draftSleep"),
  draftActivity: document.querySelector("#draftActivity"),
  draftRoutine: document.querySelector("#draftRoutine"),
  draftNabiNote: document.querySelector("#draftNabiNote"),
  draftUserNote: document.querySelector("#draftUserNote"),
  saveFootprint: document.querySelector("#saveFootprint"),
  skipFootprint: document.querySelector("#skipFootprint"),
  footprintList: document.querySelector("#footprintList"),
  nabiWalker: document.querySelector("#nabiWalker"),
  nabiWalkerImage: document.querySelector("#nabiWalkerImage"),
  nabiBubble: document.querySelector("#nabiBubble"),
};

let nabiPosition = { x: 170, y: 230 };
let nabiWalkTimer = null;
let nabiBubbleTimer = null;
let nabiStopTimer = null;
let nabiFrameTimer = null;
let nabiFrameIndex = 0;
const NABI_FRAME_MS = 80;
const NABI_WALK_FRAMES = Array.from(
  { length: 22 },
  (_, index) => `./assets/nabi-frames/nabi-${String(index + 1).padStart(2, "0")}.png`,
);

bindEvents();
render();
registerServiceWorker();
initNabiWalker();
initWelcome();
await initializeAuth();

function initWelcome() {
  const screen = document.querySelector("#welcomeScreen");
  if (!screen) return;
  const textEl = document.querySelector("#welcomeText");
  const cursor = document.querySelector("#welcomeCursor");
  const form = document.querySelector("#welcomeForm");
  const input = document.querySelector("#welcomeInput");
  const skip = document.querySelector("#welcomeSkip");
  const google = document.querySelector("#welcomeGoogle");

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

  function dismiss() {
    typing = false;
    screen.classList.add("is-dismissed");
    window.setTimeout(() => screen.remove(), 700);
  }
  dismissWelcome = dismiss;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = input.value.trim();
    dismiss();
    switchView("chat");
    if (message) window.setTimeout(() => receiveUserMessage(message), 350);
  });

  if (google) {
    if (!isSupabaseConfigured()) {
      google.disabled = true;
      google.title = "Supabase 설정 후 사용할 수 있어요.";
    }
    google.addEventListener("click", () => signInWithGoogle());
  }

  skip.addEventListener("click", dismiss);
  if (cursor) input.addEventListener("focus", () => (cursor.style.display = "none"));
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchView(tab.dataset.view)));
  els.googleLogin.addEventListener("click", signInWithGoogle);
  els.logoutButton.addEventListener("click", signOut);
  els.saveFootprint.addEventListener("click", saveFootprint);
  els.skipFootprint.addEventListener("click", skipFootprint);

  els.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = els.messageInput.value.trim();
    if (!message) return;
    receiveUserMessage(message);
    els.messageInput.value = "";
  });

  els.quickActions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-prompt]");
    if (button) {
      moveNabiNear(button, "여기 앉아서 들어볼게.");
      receiveUserMessage(button.dataset.prompt);
    }
  });

  els.resetDay.addEventListener("click", () => {
    state.day = { ...initialState.day };
    state.messages = [...initialState.messages];
    state.footprintDraft = null;
    persist();
    render();
  });

  els.profileForm.addEventListener("submit", (event) => {
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

  els.completeRoutine.addEventListener("click", () => {
    const checked = [...document.querySelectorAll(".routine-list input:checked")].map((input) => input.value);
    state.day.routines = checked;
    addBond(checked.length * 4);
    if (checked.length > 0) _interactionScore += 2; // 루틴 완료 시 상호작용 점수 +2
    addCatMessage(makeRoutineReply(checked));
    state.footprintDraft = buildFootprintDraft();
    switchView("chat");
    persist();
    render();
  });
}

async function initializeAuth() {
  if (!isSupabaseConfigured() || !supabase) {
    renderAuth(null, "Supabase anon key를 넣으면 Google 로그인을 사용할 수 있어요.");
    return;
  }

  const { data } = await supabase.auth.getSession();
  authSession = data.session;
  renderAuth(authSession);
  if (authSession) {
    dismissWelcome();
    await hydrateFromCloud();
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    authSession = session;
    renderAuth(authSession);
    if (authSession) {
      dismissWelcome();
      await hydrateFromCloud();
    }
  });
}

async function signInWithGoogle() {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.href.split("#")[0] },
  });
  if (error) {
    addCatMessage(`로그인을 시작하지 못했어. ${error.message}`);
    render();
  }
}

async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  authSession = null;
  renderAuth(null);
}

async function receiveUserMessage(message) {
  _interactionScore += 1; // 메시지 전송 시 상호작용 점수 +1
  moveNabiNear(els.messageInput, "나비가 가까이 왔어요.");
  state.messages.push({ role: "user", text: message });
  const context = analyzeMessage(message);
  updateDayContext(context);

  // 로딩 말풍선
  const loadingMsg = { role: "cat", text: "···", loading: true };
  state.messages.push(loadingMsg);
  render();

  // LLM 호출 (실패 시 rule-based fallback)
  const reply = await callNabi(state.messages, context);

  // 로딩 메시지 교체
  const idx = state.messages.indexOf(loadingMsg);
  if (idx !== -1) state.messages[idx] = { role: "cat", text: reply };
  else state.messages.push({ role: "cat", text: reply });

  state.footprintDraft = buildFootprintDraft(context);
  persist();
  render();
}

async function callNabi(messages, context) {
  if (!isSupabaseConfigured()) return makeCatReply(context);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/nabi-chat`, {
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
    nabi_note: makeNabiNote(mood, sleep, activity),
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

function makeNabiNote(mood, sleep, activity) {
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
  moveNabiNear(els.saveFootprint, "발자국 남겼다.");
  addCatMessage(authSession ? "오늘 발자국을 나비의 기억에 남겼어." : "오늘 발자국을 이 기기에 남겼어. 로그인하면 나비가 다른 기기에서도 기억할 수 있어.");
  persist();
  await syncToCloud();
  render();
}

function skipFootprint() {
  moveNabiToQuietSpot("괜찮아.");
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
  if (state.nabi.dailyBondDate !== today) {
    state.nabi.dailyBondDate = today;
    state.nabi.dailyBondGain = 0;
  }

  const beforeLevel = getNabiGrowth().level;
  const remaining = Math.max(0, DAILY_BOND_LIMIT - state.nabi.dailyBondGain);
  const applied = Math.min(points, remaining, 100 - state.day.bond);
  if (applied <= 0) return 0;

  state.day.bond = Math.min(100, state.day.bond + applied);
  state.nabi.dailyBondGain += applied;

  const growth = getNabiGrowth();
  if (growth.level > beforeLevel && state.nabi.lastLevelMessage !== growth.level) {
    state.nabi.lastLevelMessage = growth.level;
    addCatMessage(`${growth.name}가 되었어. 나비가 너랑 조금 더 가까워진 것 같아.`);
  }

  return applied;
}

function getNabiGrowth() {
  const bond = Number(state.day.bond) || 0;
  return [...NABI_LEVELS].reverse().find((level) => bond >= level.minBond) || NABI_LEVELS[0];
}

function markDailyVisit() {
  const today = getToday();
  if (state.nabi.lastVisitDate === today) return;

  const previousVisit = state.nabi.lastVisitDate;
  state.nabi.streak = isYesterday(previousVisit, today) ? state.nabi.streak + 1 : 1;
  state.nabi.lastVisitDate = today;

  if (state.nabi.streak >= 7 && state.nabi.lastStreakBonusDate !== today) {
    state.nabi.lastStreakBonusDate = today;
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
  renderProfile();
  renderFootprintDraft();
  renderFootprints();
}

function renderAuth(session, fallbackMessage) {
  const configured = isSupabaseConfigured();
  const email = session?.user?.email;
  els.googleLogin.disabled = !configured;
  els.googleLogin.classList.toggle("is-hidden", Boolean(email));
  els.logoutButton.classList.toggle("is-hidden", !email);
  els.storageMode.textContent = email ? "클라우드 저장" : "로컬 저장";
  els.authTitle.textContent = email ? "로그인됨" : configured ? "Google 로그인" : "로컬 모드";
  els.authDescription.textContent = email
    ? `${email} 계정에 발자국 요약만 동기화 중`
    : configured
      ? "로그인하면 오늘의 발자국 요약만 Supabase에 저장돼요."
      : fallbackMessage || "Supabase 설정 전에는 이 기기에만 저장돼요.";
}

function renderChat() {
  els.chatLog.innerHTML = state.messages
    .map((message) =>
      `<li class="message ${message.role}${message.loading ? " is-loading" : ""}">` +
      `<strong>${message.role === "cat" ? "나비" : "나"}</strong>` +
      `${escapeHtml(message.text)}</li>`
    )
    .join("");
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

function renderMetrics() {
  const growth = getNabiGrowth();
  els.sleepMetric.textContent = state.day.sleepHours === null ? "미입력" : `${state.day.sleepHours}시간`;
  els.activityMetric.textContent = state.day.activityMinutes === null ? "미입력" : `${state.day.activityMinutes}분`;
  els.moodMetric.textContent = state.day.mood || "미입력";
  els.energyMetric.textContent = state.day.energy;
  els.bondLabel.textContent = `유대감 ${state.day.bond}%`;
  if (els.nabiLevelLabel) els.nabiLevelLabel.textContent = `Lv.${growth.level} ${growth.name}`;
  const moodCopy = {
    낮음: "오늘은 나비가 옆에서 속도를 낮춰줄게요.",
    주의: "긴장 신호가 보여요. 잠깐 숨을 고르자요.",
    좋음: "오늘 리듬이 꽤 좋아요. 나비도 편안해요.",
    보통: "오늘은 천천히 마음을 확인해볼게요.",
  };
  els.catMood.textContent = `${growth.copy} ${moodCopy[state.day.energy] || moodCopy["보통"]}`;
}

function renderInsights() {
  const insights = [];
  insights.push(state.day.sleepHours === null ? "수면 시간을 말해주면 오늘 발자국의 수면 요약을 만들 수 있어요." : `수면 요약은 ${labels.sleep[mapSleep(state.day.sleepHours)]}입니다.`);
  insights.push(state.day.activityMinutes === null ? "활동량이 비어 있습니다. 10분 걷기처럼 낮은 마찰의 루틴부터 시작해요." : `활동 요약은 ${labels.activity[mapActivity(state.day.activityMinutes)]}입니다.`);
  if (state.day.mood === "긴장") insights.push("긴장 키워드가 감지되었습니다. 4-6 호흡법을 추천합니다.");
  els.insightList.innerHTML = insights.map((insight) => `<li>${escapeHtml(insight)}</li>`).join("");
}

function renderProfile() {
  els.profileForm.elements.name.value = state.profile.name;
  els.profileForm.elements.goal.value = state.profile.goal;
  els.profileForm.elements.tone.value = state.profile.tone;
  els.profileForm.querySelectorAll("input[name='focus']").forEach((input) => {
    input.checked = state.profile.focus.includes(input.value);
  });
}

function renderFootprintDraft() {
  const draft = state.footprintDraft;
  els.footprintDraft.classList.toggle("is-hidden", !draft);
  if (!draft) return;
  els.draftMood.textContent = labels.mood[draft.mood];
  els.draftSleep.textContent = labels.sleep[draft.sleep];
  els.draftActivity.textContent = labels.activity[draft.activity];
  els.draftRoutine.textContent = labels.routine[draft.routine];
  els.draftNabiNote.textContent = draft.nabi_note;
  els.draftUserNote.value = draft.user_note || "";
}

function renderFootprints() {
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
              <p class="nabi-note">${escapeHtml(item.nabi_note)}</p>
              ${item.user_note ? `<p>${escapeHtml(item.user_note)}</p>` : ""}
            </article>
          `,
        )
        .join("")
    : `<article class="footprint-item"><h3>아직 남긴 발자국이 없어요</h3><p class="nabi-note">나비와 오늘을 이야기한 뒤 발자국을 남겨보세요.</p></article>`;
}

function switchView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  Object.entries(els.views).forEach(([name, view]) => view.classList.toggle("is-active", name === viewName));
  const activeTab = [...els.tabs].find((tab) => tab.dataset.view === viewName);
  if (activeTab) moveNabiNear(activeTab, viewName === "footprints" ? "기억 보러 갈까?" : "여기 있을게.");
}

function initNabiWalker() {
  if (!els.nabiWalker) return;
  requestAnimationFrame(() => {
    moveNabiNear(document.querySelector(".cat-stage"), "나비가 산책 중이에요.", { instant: true });
    scheduleNabiWalk();
  });
  window.addEventListener("resize", () => moveNabiToQuietSpot());
}

function scheduleNabiWalk() {
  window.clearTimeout(nabiWalkTimer);
  nabiWalkTimer = window.setTimeout(() => {
    moveNabiToQuietSpot();
    scheduleNabiWalk();
  }, 7000 + Math.random() * 5000);
}

function moveNabiNear(target, bubbleText = "", options = {}) {
  if (!els.nabiWalker || !target) return;
  const rect = target.getBoundingClientRect();
  const walkerWidth = els.nabiWalker.getBoundingClientRect().width || 140;
  const x = clamp(rect.left + rect.width / 2 - walkerWidth / 2, 14, window.innerWidth - walkerWidth - 14);
  const y = clamp(rect.top - walkerWidth * 0.56, 86, window.innerHeight - walkerWidth - 18);
  setNabiPosition(x, y, bubbleText, options);
}

function moveNabiToQuietSpot(bubbleText = "") {
  if (!els.nabiWalker) return;
  const walkerWidth = els.nabiWalker.getBoundingClientRect().width || 140;
  const x = clamp(28 + Math.random() * (window.innerWidth - walkerWidth - 56), 14, window.innerWidth - walkerWidth - 14);
  const y = clamp(130 + Math.random() * (window.innerHeight - walkerWidth - 180), 86, window.innerHeight - walkerWidth - 18);
  setNabiPosition(x, y, bubbleText || randomNabiBubble());
}

function setNabiPosition(x, y, bubbleText = "", options = {}) {
  nabiPosition = { x, y };
  els.nabiWalker.style.setProperty("--nabi-x", `${x}px`);
  els.nabiWalker.style.setProperty("--nabi-y", `${y}px`);
  els.nabiWalker.classList.toggle("is-walking", !options.instant);
  setNabiSprite(!options.instant);
  window.clearTimeout(nabiStopTimer);
  nabiStopTimer = window.setTimeout(() => {
    els.nabiWalker.classList.remove("is-walking");
    setNabiSprite(false);
  }, options.instant ? 0 : 1800);
  showNabiBubble(bubbleText);
}

function setNabiSprite(isWalking) {
  if (!els.nabiWalkerImage) return;
  if (isWalking) {
    startNabiFrameAnimation();
    return;
  }
  stopNabiFrameAnimation();
}

function startNabiFrameAnimation() {
  if (!els.nabiWalkerImage || nabiFrameTimer) return;
  nabiFrameIndex = 0;
  els.nabiWalkerImage.src = NABI_WALK_FRAMES[nabiFrameIndex];
  nabiFrameTimer = window.setInterval(() => {
    nabiFrameIndex = (nabiFrameIndex + 1) % NABI_WALK_FRAMES.length;
    els.nabiWalkerImage.src = NABI_WALK_FRAMES[nabiFrameIndex];
  }, NABI_FRAME_MS);
}

function stopNabiFrameAnimation() {
  window.clearInterval(nabiFrameTimer);
  nabiFrameTimer = null;
  nabiFrameIndex = 0;
  els.nabiWalkerImage.src = els.nabiWalkerImage.dataset.still || NABI_WALK_FRAMES[0];
}

function showNabiBubble(text) {
  if (!text) return;
  els.nabiBubble.textContent = text;
  els.nabiWalker.classList.add("has-bubble");
  window.clearTimeout(nabiBubbleTimer);
  nabiBubbleTimer = window.setTimeout(() => els.nabiWalker.classList.remove("has-bubble"), 2300);
}

function randomNabiBubble() {
  const lines = ["여기서 잠깐 앉을게.", "나비가 둘러보는 중.", "오늘 리듬을 살피고 있어.", "천천히 해도 괜찮아."];
  return lines[Math.floor(Math.random() * lines.length)];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
  if (footprints?.length) state.footprints = footprints;
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
    nabi_note: item.nabi_note,
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
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? deepMerge(initialState, JSON.parse(stored)) : structuredClone(initialState);
  } catch {
    return structuredClone(initialState);
  }
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
