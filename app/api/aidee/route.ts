// app/api/aidee/route.ts
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────
// Supabase 로깅용 클라이언트 (환경변수 없으면 null)
// ─────────────────────────────────────────────
function getSupabaseForLogging(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[Supabase] URL 또는 KEY가 없어 rfp_logs 기록을 생략합니다."
    );
    return null;
  }

  return createClient(url, key);
}

// Supabase에 로그 남기는 헬퍼
async function logRfpToSupabase(params: {
  idea: string;
  survey: any;
  rfp: any;
  user_notes?: any;
}) {
  try {
    const supabase = getSupabaseForLogging();
    if (!supabase) return null;

    const summary = {
      project_title: params.rfp?.visual_rfp?.project_title ?? null,
      target_summary: params.rfp?.target_and_problem?.summary ?? null,
    };

    const { data, error } = await supabase
      .from("rfp_logs")
      .insert([
        {
          idea: params.idea,
          rfp_summary: summary, // jsonb
          experts: params.rfp?.experts_to_meet ?? null, // jsonb
          survey: params.survey ?? null, // jsonb
          user_notes: params.user_notes ?? null, // jsonb (있으면)
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.error("[Supabase] rfp_logs insert error:", error);
      return null;
    }

    console.log("[Supabase] rfp_logs insert OK, id =", data?.id);
    return data?.id ?? null;
  } catch (err: any) {
    console.error("[Supabase] unexpected insert error:", err?.message || err);
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idea: string = body?.idea;
    const survey: any = body?.survey || null;
    const userNotes: any = body?.user_notes || null;

    if (!idea || typeof idea !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디어가 비어 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let rfpResult: any = null;

    // 1) OpenAI 사용 가능하면 API 호출
    if (client) {
      try {
        const systemPrompt = `
당신은 실제 제품 디자인·개발·양산 경험이 있는 시니어 컨설턴트입니다.
사용자가 제시한 "제품 아이디어", 선택적으로 제공되는 "설문 정보(survey)", 
그리고 이후에 추가로 제공되는 "사용자 메모(user_notes)"를 모두 반영하여
다음 JSON 구조에 맞게만 응답하세요. 설명 문장, 마크다운, 코드블록은 절대 포함하지 마세요.

특히 user_notes가 주어지는 경우,
- 기존 RFP의 문제 정의, 타겟, 기능, 차별 포인트, 컨셉 등을 비판적으로 재검토하고
- user_notes에 포함된 수정·추가 의견을 최대한 반영하여
- "현재 버전 RFP를 기반으로 한 개선판"이 되도록 다시 작성하세요.
즉, 이전 버전을 그대로 복사하지 말고, 메모를 반영해 한 단계 발전된 RFP를 생성합니다.

설문 정보는 다음과 같은 값일 수 있습니다(없을 수도 있음):
- survey.budget: 전체 예산 (예: "5천만 미만", "1~3억", "3억 이상")
- survey.timeline: 희망 일정 (예: "3개월 이내", "6개월 이내", "1년 이상")
- survey.target_market: 타겟 시장/지역 (예: "국내 B2C", "북미 아마존", "국내 B2B")
- survey.priority: 우선순위 (예: "원가", "품질", "리드타임", "디자인 임팩트")
- survey.risk_tolerance: 리스크 허용도 (예: "보수적", "중간", "공격적")
- survey.regulation_focus: 규제/인증 관련 이슈 (예: "전기용품", "생활제품 위생", "의료기기 가능성" 등)

이 설문 값이 있을 경우,
- 더블 다이아몬드 단계별 Tasks/Deliverables,
- 전문가 관점 리뷰(expert_reviews)의 "주의할 점/지금 당장 할 일/체크리스트"
에 반드시 반영해서 작성하세요. (비전문가도 이해할 수 있도록 쉽게 설명)

반드시 아래 JSON 형식만 반환하세요.

{
  "target_and_problem": {
    "summary": "한 줄 요약",
    "details": "맥락과 인사이트를 포함한 상세 설명"
  },
  "key_features": [
    { "name": "기능 이름", "description": "설명" }
  ],
  "differentiation": [
    { "point": "차별 포인트", "strategy": "구체 전략" }
  ],
  "concept_and_references": {
    "concept_summary": "전체 컨셉 정리 (비전문가도 이해할 수 있게)",
    "reference_keywords": ["이미지/레퍼런스 검색용 키워드들"]
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
    "discover": {
      "goals": ["이 단계에서 달성할 목표들"],
      "tasks": [
        { "title": "해야 할 일(리서치/인터뷰 등)", "owner": "담당(예: PM, 디자이너 등)" }
      ],
      "deliverables": ["이 단계의 산출물들"]
    },
    "define": {
      "goals": ["요구사항/성공지표를 정리하는 목표"],
      "tasks": [
        { "title": "요구사항/성능/원가 정리", "owner": "PM" }
      ],
      "deliverables": ["PRD, 요구사항 정리 문서 등"]
    },
    "develop": {
      "goals": ["설계/시작품/검증 준비"],
      "tasks": [
        { "title": "구조설계 및 부품 선정", "owner": "엔지니어" },
        { "title": "3D/CMF 목업 작업", "owner": "디자이너" }
      ],
      "deliverables": ["3D 데이터, BOM 초안, 목업 사진 등"]
    },
    "deliver": {
      "goals": ["양산/런칭/판매"],
      "tasks": [
        { "title": "양산 업체 선정 및 발주", "owner": "PM/구매" },
        { "title": "런칭/마케팅 플랜 정리", "owner": "마케터" }
      ],
      "deliverables": ["생산 일정, 패키지 파일, 런칭 플랜 등"]
    }
  },
  "experts_to_meet": [
    { "role": "제품 디자이너", "why": "형태, 사용성, 색/재질을 함께 결정하기 위해" },
    { "role": "엔지니어(구조/전자)", "why": "부품 선정, 안전성, 내구성 검토를 위해" },
    { "role": "양산업체/금형사", "why": "양산 가능성, 원가, 공정 제약을 확인하기 위해" },
    { "role": "마케터/MD", "why": "가격, 채널, 포지셔닝을 구체화하기 위해" }
  ],
  "expert_reviews": {
    "pm": {
      "risks": ["PM/기획 관점에서의 위험 요소 (일정, 예산, 리스크 등)"],
      "asks": ["지금 당장 PM이 해야 할 일 (우선순위 정리 등)"],
      "checklist": ["PM이 점검해야 할 체크리스트 항목들"],
      "summary_line": "PM 관점에서 한 줄 요약 코멘트"
    },
    "designer": {
      "risks": ["디자인/사용성 관점에서 주의해야 할 점"],
      "asks": ["지금 당장 디자이너가 해두면 좋은 일"],
      "checklist": ["디자인 관점 체크리스트 (타겟, 사용 시나리오 등)"],
      "summary_line": "디자이너가 말해주는 한 줄 요약 코멘트"
    },
    "engineer": {
      "risks": ["기술/안전/성능 측면 주요 리스크"],
      "asks": ["엔지니어가 먼저 검토해야 할 것들"],
      "checklist": ["기술/안전/규격 관련 체크리스트"],
      "summary_line": "엔지니어 입장에서의 한 줄 요약 코멘트"
    },
    "marketer": {
      "risks": ["시장/경쟁/가격/브랜딩 관련 리스크"],
      "asks": ["마케터가 먼저 확인해야 할 것들"],
      "checklist": ["런칭 메시지, 채널, 가격 관련 체크리스트"],
      "summary_line": "마케터가 말하는 한 줄 요약 코멘트"
    }
  }
}
        `.trim();

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              '제품 아이디어: "' +
              idea +
              '"에 대해 위 JSON 형식에 맞추어 작성해 주세요. ' +
              (survey
                ? "또한 다음 설문 정보(survey)를 함께 반영해 주세요: " +
                  JSON.stringify(survey)
                : "설문 정보는 따로 제공되지 않았습니다. 일반적인 가정을 사용해 주세요.") +
              (userNotes
                ? " 그리고 다음 사용자 메모(user_notes)를 강하게 반영해 기존 내용을 보완/수정해 주세요: " +
                  JSON.stringify(userNotes)
                : ""),
          },
        ];

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("모델 응답이 비어 있습니다.");
        rfpResult = JSON.parse(content);
      } catch (err: any) {
        console.error("OpenAI 호출 실패, MOCK 데이터로 대체합니다:", err?.message || err);
        // 아래에서 MOCK 사용
      }
    }

    // 2) OpenAI 실패/키 없음이면 매우 간단한 MOCK 사용
    if (!rfpResult) {
      rfpResult = {
        target_and_problem: {
          summary: "임시 RFP 요약",
          details: "OpenAI 호출에 실패하여 임시로 생성된 RFP입니다.",
        },
        key_features: [],
        differentiation: [],
        concept_and_references: {
          concept_summary: "",
          reference_keywords: [],
        },
        visual_rfp: {
          project_title: idea,
          background: "",
          objective: "",
          target_users: "",
          core_requirements: [],
          design_direction: "",
          deliverables: [],
        },
        double_diamond: {
          discover: { goals: [], tasks: [], deliverables: [] },
          define: { goals: [], tasks: [], deliverables: [] },
          develop: { goals: [], tasks: [], deliverables: [] },
          deliver: { goals: [], tasks: [], deliverables: [] },
        },
        experts_to_meet: [],
        expert_reviews: {
          pm: { risks: [], asks: [], checklist: [], summary_line: "" },
          designer: { risks: [], asks: [], checklist: [], summary_line: "" },
          engineer: { risks: [], asks: [], checklist: [], summary_line: "" },
          marketer: { risks: [], asks: [], checklist: [], summary_line: "" },
        },
      };
    }

    // 3) Supabase에 로그 저장 (실패해도 사용자 응답은 계속 반환)
    const logId = await logRfpToSupabase({
      idea,
      survey,
      rfp: rfpResult,
      user_notes: userNotes,
    });

    const responseBody = {
      ...rfpResult,
      log_id: logId,
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("최종 서버 오류:", err);
    return new Response(
      JSON.stringify({
        error: "서버 에러가 발생했습니다.",
        detail: err?.message || String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
