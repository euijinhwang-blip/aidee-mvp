import OpenAI from "openai";

export const runtime = "nodejs";

// === Providers & Flags ===
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const client = hasOpenAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// === Types ===
type Survey = {
  budget_krw?: string;
  launch_plan?: string;
  market?: string;
  priority?: string;
  risk_tolerance?: string;
  compliance?: string;
};

type EmailPayload = {
  to: string;
  subject?: string;
  html: string;
};

// === Helpers ===
async function sendEmailWithResend(payload: EmailPayload) {
  if (!RESEND_API_KEY) {
    return {
      ok: false,
      message: "RESEND_API_KEY가 없습니다. Vercel 환경변수에 추가해 주세요.",
    };
  }
  // Resend REST API 호출
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Aidee MVP <onboarding@resend.dev>",
      to: [payload.to],
      subject: payload.subject || "Aidee 결과물",
      html: payload.html
    })
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, message: `메일 발송 실패: ${text}` };
  }
  return { ok: true, message: "메일 발송 성공" };
}

// === Route ===
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ---- A) 이메일 전송 (옵션) ----
    if (action === "send-email") {
      const body = (await req.json()) as EmailPayload;
      if (!body?.to || !body?.html) {
        return new Response(
          JSON.stringify({ error: "to, html은 필수입니다." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      const result = await sendEmailWithResend(body);
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ---- B) RFP 생성 ----
    const { idea, survey } = (await req.json()) as { idea: string; survey?: Survey };
    if (!idea || typeof idea !== "string") {
      return new Response(JSON.stringify({ error: "아이디어가 비어 있습니다." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    const surveyText = `
[Survey Constraints]
- Budget: ${survey?.budget_krw || "N/A"}
- Launch Plan: ${survey?.launch_plan || "N/A"}
- Target Market: ${survey?.market || "N/A"}
- Priority: ${survey?.priority || "N/A"}
- Risk Tolerance: ${survey?.risk_tolerance || "N/A"}
- Compliance/Certification: ${survey?.compliance || "N/A"}

지시사항:
- 위 설문 제약을 강하게 반영하여 기획·로드맵·리뷰의 난이도/범위를 현실화할 것.
- 예산 낮음/일정 촉박 → 공정·부품 단순화, 스펙 축소, 단계 병행 등 구체 대안.
- 더블다이아몬드 4단계 비율은 기본 20/20/40/20, 조정 사유가 있으면 notes로 명시.
- "전문가 관점 리뷰"는 비전문가도 이해되도록 **친절한 설명 글**(plain_summary) + **Top 3 리스크** + **바로 다음 행동** + **체크리스트(짧게)** + **잘 알려진 사례(간단 설명)**로 작성.
`.trim();

    if (client) {
      try {
        const systemPrompt = `
당신은 제품 디자인과 사업화 경험이 있는 시니어 컨설턴트입니다.
사용자의 아이디어를 기반으로 아래 JSON만 정확히 반환하세요. (설명문/코드블록 금지)

${surveyText}

{
  "target_and_problem": {
    "summary": "한 줄 요약",
    "details": "맥락과 인사이트를 포함한 상세 설명"
  },
  "key_features": [{ "name": "기능 이름", "description": "설명" }],
  "differentiation": [{ "point": "차별 포인트", "strategy": "구체 전략" }],
  "concept_and_references": {
    "concept_summary": "전체 컨셉 정리",
    "reference_keywords": ["이미지 검색용 영문 키워드 위주"]
  },
  "visual_rfp": {
    "project_title": "프로젝트명",
    "background": "배경 및 문제의식",
    "objective": "디자인/사업 목표",
    "target_users": "핵심 타겟",
    "core_requirements": ["핵심 요구사항 3~7개"],
    "design_direction": "형태, 재질, 톤앤매너 등",
    "deliverables": ["필요 산출물 리스트"]
  },
  "double_diamond": {
    "overall_budget_time": {
      "total_budget_krw": "예: 약 3천만~5천만원 (설문 반영)",
      "total_time_weeks": "예: 약 10~16주 (설문 반영)",
      "ratio": { "discover": "20%", "define": "20%", "develop": "40%", "deliver": "20%" },
      "notes": "예산/기간/우선순위/인증 우려 등 설문 기반 조정 메모"
    },
    "purpose_notes": {
      "discover": "문제와 사용자를 넓게 탐색해 기회와 위험을 파악하는 단계",
      "define":   "가설을 좁혀 요구사항/성능/원가 경계를 확정하는 단계",
      "develop":  "설계·시작품·인증·양산 준비 등 실현 가능성을 검증하는 단계",
      "deliver":  "양산, 패키지/라벨, 마케팅/판매까지 실제 출시를 완성하는 단계"
    },
    "discover": {
      "goals": ["문제/사용자 맥락 파악", "경쟁/대체재 파악"],
      "tasks": [
        { "title": "현장/데스크 리서치", "owner": "PM/리서처" },
        { "title": "타깃 인터뷰/설문", "owner": "PM/디자이너" }
      ],
      "deliverables": ["인사이트 메모", "경쟁 포지션 맵"]
    },
    "define": {
      "goals": ["요구사항·성능·원가 가드레일 확정"],
      "tasks": [
        { "title": "PRD/요구사항 매트릭스", "owner": "PM" },
        { "title": "핵심 성능 지표 합의", "owner": "엔지니어/디자이너" }
      ],
      "deliverables": ["PRD v1", "요구사항 매트릭스"]
    },
    "develop": {
      "goals": ["설계/시작품", "인증·양산 준비"],
      "tasks": [
        { "title": "구조설계·부품 선정(BOM v1)", "owner": "엔지니어" },
        { "title": "3D/CMF 목업", "owner": "디자이너" },
        { "title": "인증 사전 검토", "owner": "PM/엔지니어" }
      ],
      "deliverables": ["3D STEP", "BOM v1", "목업 사진", "인증 체크리스트"]
    },
    "deliver": {
      "goals": ["양산·런칭·판매"],
      "tasks": [
        { "title": "금형/양산업체 RFQ·발주", "owner": "PM/구매" },
        { "title": "패키지/라벨/매뉴얼", "owner": "디자이너/MD" },
        { "title": "런칭 플랜(채널/가격/프로모션)", "owner": "마케터" }
      ],
      "deliverables": ["PO·생산일정", "패키지 파일", "런칭 캘린더", "커머스 세팅"]
    }
  },
  "experts_to_meet": [
    { "role": "제품 디자이너", "why": "형태/사용성·CMF 결정" },
    { "role": "엔지니어(구조/전자)", "why": "부품·BOM·안전성" },
    { "role": "양산업체/금형사", "why": "DFM/원가·납기" },
    { "role": "마케터/MD", "why": "채널 전략/가격/콘텐츠" },
    { "role": "인증 대행", "why": "필요 인증 경로 안내" }
  ],
  "expert_reviews": {
    "pm": {
      "plain_summary": "비전문가도 이해할 쉬운 설명",
      "top_risks": ["리스크1","리스크2","리스크3"],
      "next_actions": ["바로 할 일1","바로 할 일2","바로 할 일3"],
      "checklist": ["체크1","체크2","체크3"],
      "famous_examples": ["유명사례 1줄", "유명사례 1줄"]
    },
    "designer": {
      "plain_summary": "", "top_risks": [], "next_actions": [], "checklist": [], "famous_examples": []
    },
    "engineer": {
      "plain_summary": "", "top_risks": [], "next_actions": [], "checklist": [], "famous_examples": []
    },
    "marketer": {
      "plain_summary": "", "top_risks": [], "next_actions": [], "checklist": [], "famous_examples": []
    }
  }
}
        `.trim();

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `제품 아이디어: "${idea}"에 대해 위 JSON 형식을 따라 작성해 주세요.`,
            },
          ],
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("모델 응답이 비어 있습니다.");
        const parsed = JSON.parse(content);
        return new Response(JSON.stringify(parsed), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("OpenAI 호출 실패, MOCK으로 대체:", err?.message || err);
      }
    }
// app/api/images/route.ts
import { NextRequest } from "next/server";

type Img = {
  id: string;
  thumb: string;
  full: string;
  alt: string;
  author?: string;
  link?: string;
  source: "pexels" | "unsplash";
};

const PEXELS = process.env.PEXELS_API_KEY!;
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY!; // server-side key

async function fromPexels(q: string, per = 4): Promise<Img[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS }, cache: "no-store" });
  if (!res.ok) throw new Error("Pexels error");
  const json = await res.json();
  return (json.photos || []).map((p: any) => ({
    id: String(p.id),
    thumb: p.src.medium,
    full: p.src.large2x || p.src.large,
    alt: p.alt || q,
    author: p.photographer,
    link: p.url,
    source: "pexels" as const,
  }));
}

async function fromUnsplash(q: string, per = 4): Promise<Img[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per}&client_id=${UNSPLASH}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Unsplash error");
  const json = await res.json();
  return (json.results || []).map((r: any) => ({
    id: r.id,
    thumb: r.urls.small,
    full: r.urls.full || r.urls.regular,
    alt: r.alt_description || q,
    author: r.user?.name,
    link: r.links?.html,
    source: "unsplash" as const,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const provider = (searchParams.get("provider") || "pexels") as "pexels" | "unsplash";

    if (!q.trim()) return Response.json({ images: [] });

    let list: Img[] = [];
    const per = 4;

    try {
      list = provider === "pexels" ? await fromPexels(q, per) : await fromUnsplash(q, per);
    } catch {
      // fallback: 반대 공급자로 한 번 더 시도
      try {
        list = provider === "pexels" ? await fromUnsplash(q, per) : await fromPexels(q, per);
      } catch {
        list = [];
      }
    }

    return Response.json({ images: list.slice(0, 4) }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message || "image error" }, { status: 500 });
  }
}

    // ---- MOCK (키 없거나 에러 시) ----
    const mock = {
      target_and_problem: {
        summary: "야외 러너의 호흡 건강과 쾌적한 러닝 환경 확보",
        details: "도시 러너는 미세먼지/배기가스/꽃가루 등에 노출된다. 경량·착용성 미니 공기청정 웨어러블은 실질적/심리적 안전감을 제공."
      },
      key_features: [
        { name: "러닝 최적화 공기 정화 모듈", description: "호흡 방해 최소화, 경량 설계" },
        { name: "착용감 중심 폼팩터", description: "흔들림/압박 최소 구조" },
        { name: "실시간 공기질 피드백", description: "LED/앱 연동" },
        { name: "생활 방수/내구성", description: "땀/비/야간 환경 대응" }
      ],
      differentiation: [
        { point: "러닝 특화", strategy: "운동 중 호흡/무게/움직임 기준 최적화" },
        { point: "스타일+퍼포먼스", strategy: "스포츠웨어와 어울리는 디자인" },
        { point: "심리적 안전감", strategy: "공기질 시각화로 통제감 제공" }
      ],
      concept_and_references: {
        concept_summary: "도시 러너를 위한 개인용 클린에어 버블.",
        reference_keywords: [
          "running wearable device",
          "neckband air purifier",
          "minimal sport tech",
          "urban night runner",
          "LED indicator sports gear"
        ]
      },
      visual_rfp: {
        project_title: "야외 러너용 미니 공기청정 웨어러블",
        background: "도시 러닝 증가와 공기 오염 이슈 동시 증가",
        objective: "착용 부담 최소+실질 정화+심리적 안심 제공",
        target_users: "도시권 20–40대 러너",
        core_requirements: ["경량/안정 착용","필터링","야간 시인성","필터 교체/충전","웨어와 매칭"],
        design_direction: "슬림/유선형, 블랙·그레이 기반 포인트 컬러",
        deliverables: ["컨셉보드","3D 렌더","치수/구조 다이어그램","LED/UI 플로우","네이밍안"]
      },
      double_diamond: {
        overall_budget_time: {
          total_budget_krw: "약 3천만~5천만원",
          total_time_weeks: "약 10~16주",
          ratio: { discover: "20%", define: "20%", develop: "40%", deliver: "20%" },
          notes: "난이도/인증/양산 수량 따라 변동"
        },
        purpose_notes: {
          discover: "문제/사용자 탐색",
          define: "요구사항/성능/원가 확정",
          develop: "설계/시작품/인증/양산 준비",
          deliver: "양산/런칭/판매"
        },
        discover: {
          goals: ["문제/사용자 맥락 파악","경쟁/대체재 파악"],
          tasks: [
            { title: "러닝 크루 인터뷰 5명", owner: "PM/리서처" },
            { title: "경쟁 제품 스캔", owner: "PM/디자이너" }
          ],
          deliverables: ["인사이트 메모","경쟁 포지션 맵"]
        },
        define: {
          goals: ["요구사항 고정","성능/원가 가드레일"],
          tasks: [
            { title: "PRD/요구사항 매트릭스", owner: "PM" },
            { title: "핵심 성능 지표 합의", owner: "엔지니어/디자이너" }
          ],
          deliverables: ["PRD v1","요구사항 매트릭스"]
        },
        develop: {
          goals: ["설계/시작품","인증·양산 준비"],
          tasks: [
            { title: "구조설계·부품 선정(BOM v1)", owner: "엔지니어" },
            { title: "3D/CMF 목업", owner: "디자이너" },
            { title: "인증 사전 검토", owner: "PM/엔지니어" }
          ],
          deliverables: ["3D STEP","BOM v1","목업 사진","인증 체크리스트"]
        },
        deliver: {
          goals: ["양산·런칭·판매"],
          tasks: [
            { title: "금형/양산업체 RFQ·발주", owner: "PM/구매" },
            { title: "패키지/라벨/매뉴얼", owner: "디자이너/MD" },
            { title: "런칭 플랜(채널/가격/프로모션)", owner: "마케터" }
          ],
          deliverables: ["PO·생산일정","패키지 파일","런칭 캘린더","커머스 세팅"]
        }
      },
      experts_to_meet: [
        { role: "제품 디자이너", why: "형태/사용성·CMF 결정" },
        { role: "엔지니어(구조/전자)", why: "부품·BOM·안전성" },
        { role: "양산업체/금형사", why: "DFM/원가·납기" },
        { role: "마케터/MD", why: "채널 전략/가격/콘텐츠" },
        { role: "인증 대행", why: "필요 인증 경로 안내" }
      ],
      expert_reviews: {
        pm: {
          plain_summary: "전체 프로젝트의 일정·예산·리스크를 조율해 성공 확률을 높이는 역할입니다. 지금 아이디어는 시장 검증과 ‘최소 기능’의 범위를 잡는 게 핵심이에요.",
          top_risks: ["수요 검증 부족","부품 리드타임 변동","범위 확대(스코프 크립)"],
          next_actions: ["MVP 범위 한 줄로 정의","필수/선택 기능 구분","리스크 레지스터 작성"],
          checklist: ["PRD v1","리스크 레지스터","주간 진행 표준(스탠드업)"],
          famous_examples: ["GoPro: 최소 기능으로 시장 진입 후 확장","Slack: 내부툴에서 전환, 코어 가치 검증"]
        },
        designer: {
          plain_summary: "사용자 경험을 쉬운 형태로 풀어 ‘누구나 편하게’ 쓰게 만드는 역할입니다.",
          top_risks: ["착용감/무게로 인한 피로","페르소나 미스매치","야간 시인성 미흡"],
          next_actions: ["핵심 시나리오(착용-러닝-휴식) 빠른 목업 검증","CMF 샘플 수집","야간 테스트 체크"],
          checklist: ["핵심 사용자 플로우","인체 기준치 반영","간단한 사용성 테스트"],
          famous_examples: ["Dyson: 인체공학·공기 흐름을 디자인 요소로","Apple Watch: 착용 감각과 UI의 통합"]
        },
        engineer: {
          plain_summary: "안전·내구·배터리·소음 등 ‘성능과 안전’을 수치로 보장합니다.",
          top_risks: ["열/소음/배터리","부품 단종(EOL)","인증 리스크"],
          next_actions: ["예비 인증 문의","BOM v1 작성","DFM 체크로 원가/납기 확보"],
          checklist: ["안전 규격 매핑","BOM v1","DFM 체크"],
          famous_examples: ["Anker: 안정성·원가의 균형으로 신뢰 형성"]
        },
        marketer: {
          plain_summary: "‘왜 이 제품이 필요한지’를 한 문장으로 설명하고, 알맞은 채널/가격을 찾습니다.",
          top_risks: ["차별성 메시지 약함","가격 저항","채널 과소/과다"],
          next_actions: ["포지셔닝 문장 A/B","초기 채널 1~2개 집중","리뷰·UGC 계획"],
          checklist: ["런칭 메시지","채널별 수수료/마진","간단한 GA 이벤트"],
          famous_examples: ["Oura Ring: 착용성·데이터 인사이트 강조","WHOOP: 특정 타깃(운동) 집중 후 확장"]
        }
      }
    };

    return new Response(JSON.stringify(mock), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("최종 서버 오류:", err);
    return new Response(
      JSON.stringify({ error: "서버 에러가 발생했습니다.", detail: err?.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
