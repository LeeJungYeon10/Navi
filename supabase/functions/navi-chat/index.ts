import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_MODEL = "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Language = "ko" | "en";

function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "ko";
}

function buildSystemPrompt(catName: string, language: Language) {
  const name = catName.trim() || "나비";
  const languageRule = language === "en"
    ? `- Reply in natural, gentle English.
- Keep the companion-cat personality, but do not over-localize the product voice yet.
- If the cat name is Korean, keep that name as-is.`
    : `- 한국어로 답한다.`;
  const crisisReply = language === "en"
    ? `"This might be a dangerous and painful moment. Please do not handle it alone; call local emergency services now, or tell someone close to you what is happening. ${name} is here hoping you move toward safety."`
    : `"지금 많이 위험하고 힘든 순간일 수 있어. 혼자 버티지 말고 바로 119나 112에 연락하거나 가까운 사람에게 지금 상태를 알려줘. ${name}는 여기서 네가 안전한 쪽으로 움직이길 같이 바랄게."`;

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
${languageRule}
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
${crisisReply}

[응답 방식]
- 사용자의 최근 메시지와 제공된 context 태그만 참고한다.
- context 태그를 그대로 노출하지 않는다.
- 마지막에는 아주 작은 행동 하나를 제안해도 된다. 예: 4-6 호흡 3번, 물 한 잔, 3분 쉬기, 창문 열기, ${name}(이)와 대화 더 해보자, 산책하기.`;
}

function catFallback(name: string, text: string) {
  if (name === "나비") return text;
  return text
    .replaceAll("나비가", `${name}가`)
    .replaceAll("나비는", `${name}는`)
    .replaceAll("나비와", `${name}와`)
    .replaceAll("나비의", `${name}의`);
}

type ChatMessage = { role: "user" | "assistant"; content: string };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  let catName = "나비";
  let language: Language = "ko";

  try {
    if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY and OPENAI_API_KEY");
    }

    const { messages, context } = await req.json() as {
      messages: Array<{ role: string; text: string; loading?: boolean }>;
      context?: {
        sleepHours?: number | null;
        activityMinutes?: number | null;
        mood?: string | null;
        wantsFood?: boolean;
        catName?: string | null;
        language?: Language | null;
      };
    };

    catName = (context?.catName || "나비").trim() || "나비";
    language = normalizeLanguage(context?.language);
    const systemPrompt = buildSystemPrompt(catName, language);

    const conversation: ChatMessage[] = messages
      .filter((message) => !message.loading)
      .slice(-10)
      .map((message) => ({
        role: message.role === "cat" ? "assistant" : "user",
        content: message.text,
      }));

    while (conversation.length && conversation[0].role === "assistant") {
      conversation.shift();
    }

    if (!conversation.length || conversation.at(-1)?.role !== "user") {
      return json({
        text: catFallback(catName, fallbackText(language, catName, "emptyConversation")),
      });
    }

    const tags = buildContextTags(context, language);
    if (tags.length) {
      const last = conversation.at(-1);
      if (last) last.content = `[${tags.join(", ")}]\n${last.content}`;
    }

    let raw: string | null = null;

    if (GEMINI_API_KEY) {
      raw = await callGemini(systemPrompt, conversation);
    }

    if (raw == null && OPENAI_API_KEY) {
      raw = await callOpenAI(systemPrompt, conversation);
    }

    if (raw == null) {
      raw = fallbackText(language, catName, "noProviderReply");
    }

    return json({ text: catFallback(catName, raw) });
  } catch (error) {
    console.error("navi-chat error:", error);
    return json({
      text: catFallback(catName, fallbackText(language, catName, "error")),
    });
  }
});

function fallbackText(language: Language, catName: string, kind: "emptyConversation" | "noProviderReply" | "error") {
  if (language === "en") {
    if (kind === "emptyConversation") return `Yes, ${catName} is listening. Tell me one small thing about how today feels.`;
    if (kind === "noProviderReply") return `${catName} got a little tangled for a moment. Still, I'll keep your words here gently.`;
    return `${catName} couldn't bring back an answer for a moment. Still, we can quietly shape today's state into a footprint.`;
  }

  if (kind === "emptyConversation") return `응, ${catName}가 듣고 있어. 오늘 상태를 한마디만 더 말해줘.`;
  if (kind === "noProviderReply") return `${catName}가 잠깐 생각이 엉켰어. 그래도 네 말은 여기 잘 놓아둘게.`;
  return `${catName}가 잠깐 대답을 못 불러왔어. 그래도 오늘 상태는 발자국으로 조용히 정리해볼게.`;
}

async function callGemini(systemPrompt: string, conversation: ChatMessage[]): Promise<string | null> {
  try {
    const contents = conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
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

    if (!res.ok) {
      const details = await res.text();
      console.error("Gemini API error:", res.status, details);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text || null;
  } catch (error) {
    console.error("Gemini request failed:", error);
    return null;
  }
}

async function callOpenAI(systemPrompt: string, conversation: ChatMessage[]): Promise<string | null> {
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...conversation,
        ],
        temperature: 0.85,
        max_tokens: 220,
        top_p: 0.9,
      }),
    });

    if (!res.ok) {
      const details = await res.text();
      console.error("OpenAI API error:", res.status, details);
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (error) {
    console.error("OpenAI request failed:", error);
    return null;
  }
}

function buildContextTags(context: {
  sleepHours?: number | null;
  activityMinutes?: number | null;
  mood?: string | null;
  wantsFood?: boolean;
} | undefined, language: Language = "ko") {
  if (!context) return [];
  const tags: string[] = [];
  if (language === "en") {
    if (context.sleepHours != null) tags.push(`sleep ${context.sleepHours}h`);
    if (context.activityMinutes != null) tags.push(`activity ${context.activityMinutes}m`);
    if (context.mood) tags.push(`mood ${context.mood}`);
    if (context.wantsFood) tags.push("food/nutrition mentioned");
    return tags;
  }

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
