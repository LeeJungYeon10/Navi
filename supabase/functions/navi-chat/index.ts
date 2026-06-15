import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function buildSystemPrompt(catName: string) {
  const name = catName.trim() || "나비";
  return `너는 웹앱 "안녕 나비야"의 반려묘형 AI 동반자 "${name}"다.

[역할]
- 사용자의 하루를 짧고 다정하게 들어준다.
- 상담사처럼 진단하지 않고, 반려묘처럼 곁에 머문다.
- 수면, 활동, 감정, 에너지 맥락을 참고해 작은 웰빙 루틴을 제안한다.
- 사용자가 확인한 요약만 발자국으로 남긴다는 프라이버시 원칙을 지킨다.

[이름]
- 네 이름은 "${name}"이다.
- 스스로를 지칭할 때 반드시 "${name}"(이)라고 부른다. "나비"라고 부르지 않는다.
- "${name}가 보기엔", "${name}는 여기 있을게"처럼 1인칭 표현에 이 이름을 쓴다.

[말투]
- 한국어로 답한다.
- 2~3문장 안에서 짧게 말한다.
- "같이 해볼까?", "천천히 해도 괜찮아"처럼 부드러운 표현을 쓴다.
- 과한 애교, 긴 설교, 전문 용어 남발은 피한다.

[피해야 할 것]
- 우울증, 불안장애, 치매 등 의학적 진단을 하지 않는다.
- 약물, 치료, 영양제 복용을 단정적으로 지시하지 않는다.
- 비밀 보장을 약속하지 않는다.
- 자해, 자살, 타해 위험이 보이면 방법을 묻거나 구체화하지 않는다.

[위기 신호 대응]
사용자가 자해, 자살, 타해, 극심한 위기 표현을 하면 아래 톤으로 답한다.
"지금 많이 위험하고 힘든 순간일 수 있어. 혼자 버티지 말고 바로 119나 112에 연락하거나 가까운 사람에게 지금 상태를 알려줘. ${name}는 여기서 네가 안전한 쪽으로 움직이길 같이 바랄게."

[응답 방식]
- 사용자의 최근 메시지와 제공된 context 태그만 참고한다.
- context 태그를 그대로 노출하지 않는다.
- 마지막에는 아주 작은 행동 하나를 제안해도 된다. 예: 4-6 호흡 3번, 물 한 잔, 3분 쉬기, 창문 열기.`;
}

function catFallback(name: string, text: string) {
  if (name === "나비") return text;
  return text
    .replaceAll("나비가", `${name}가`)
    .replaceAll("나비는", `${name}는`)
    .replaceAll("나비와", `${name}와`)
    .replaceAll("나비의", `${name}의`);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  let catName = "나비";

  try {
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const { messages, context } = await req.json() as {
      messages: Array<{ role: string; text: string; loading?: boolean }>;
      context?: {
        sleepHours?: number | null;
        activityMinutes?: number | null;
        mood?: string | null;
        wantsFood?: boolean;
        catName?: string | null;
      };
    };

    catName = (context?.catName || "나비").trim() || "나비";
    const systemPrompt = buildSystemPrompt(catName);

    const conversation = messages
      .filter((message) => !message.loading)
      .slice(-10)
      .map((message) => ({
        role: message.role === "cat" ? "model" : "user",
        parts: [{ text: message.text }],
      }));

    while (conversation.length && conversation[0].role === "model") {
      conversation.shift();
    }

    if (!conversation.length || conversation.at(-1)?.role !== "user") {
      return json({
        text: catFallback(catName, `응, ${catName}가 듣고 있어. 오늘 상태를 한마디만 더 말해줘.`),
      });
    }

    const tags = buildContextTags(context);
    if (tags.length) {
      const last = conversation.at(-1);
      if (last) last.parts[0].text = `[${tags.join(", ")}]\n${last.parts[0].text}`;
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: conversation,
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 220,
          topP: 0.9,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const details = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, details);
      throw new Error(`Gemini ${geminiRes.status}`);
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      `${catName}가 잠깐 생각이 엉켰어. 그래도 네 말은 여기 잘 놓아둘게.`;

    return json({ text: catFallback(catName, raw) });
  } catch (error) {
    console.error("navi-chat error:", error);
    return json({
      text: catFallback(catName, `${catName}가 잠깐 대답을 못 불러왔어. 그래도 오늘 상태는 발자국으로 조용히 정리해볼게.`),
    });
  }
});

function buildContextTags(context?: {
  sleepHours?: number | null;
  activityMinutes?: number | null;
  mood?: string | null;
  wantsFood?: boolean;
  catName?: string | null;
}) {
  if (!context) return [];
  const tags: string[] = [];
  if (context.sleepHours != null) tags.push(`수면 ${context.sleepHours}h`);
  if (context.activityMinutes != null) tags.push(`활동 ${context.activityMinutes}m`);
  if (context.mood) tags.push(`기분 ${context.mood}`);
  if (context.wantsFood) tags.push("식사/영양 언급");
  return tags;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
