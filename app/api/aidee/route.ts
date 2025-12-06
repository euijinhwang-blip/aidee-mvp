// app/api/aidee/route.ts
import OpenAI from "openai";
import { supabaseServer } from "@/lib/supabase-server";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Supabase에 로그 남기는 헬퍼
async function logRfpToSupabase(params: {
  idea: string;
  survey: any;
  user_notes: any;
  rfp: any;
}) {
  try {
    // ❗ supabaseServer() 가 아니라 그냥 사용
    const supabase = supabaseServer;

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
          user_notes: params.user_notes ?? null, // jsonb
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
    const user_notes: any = body?.user_notes || null; // 🔥 메모

    if (!idea || typeof idea !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디어가 비어 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let rfpResult: any = null;

    if (client) {
      try {
        const systemPrompt = `
당신은 실제 제품 디자인·개발·양산 경험이 있는 시니어 컨설턴트입니다.
사용자가 제시한 "제품 아이디어", 선택적으로 제공되는 "설문 정보(survey)", 그리고
무엇보다도 사용자가 직접 수정·보완을 위해 남긴 "메모(user_notes)"를 바탕으로
아래 JSON 형식에 **정확히 맞게만** 응답하십시오.

❗ 우선순위
1) user_notes: 사용자가 직접 적은 추가 의견, 수정 요청, 타겟/문제 정의 보완, 원하는 차별 포인트 등
   - 이전 버전 RFP에서 무엇이 아쉬웠는지, 무엇을 더 강조하고 싶은지가 담겨 있다고 가정합니다.
   - 가능한 한 user_notes를 "최신 요구사항"으로 간주하고, 기존 내용과 충돌하면 user_notes를 우선 반영하십시오.
2) survey: 예산, 일정, 우선순위, 리스크 허용도, 규제 이슈 등
   - 더블 다이아몬드 단계별 tasks/deliverables,
     expert_reviews의 "risks / asks / checklist"에 적극적으로 녹여서 작성하십시오.
3) idea: 초기 아이디어는 context로 사용하되, user_notes와 survey로 정제된 방향을 따라가도록 보정합니다.

설문 정보 예시:
- survey.budget: 전체 예산 (예: "5천만 미만", "1~3억", "3억 이상")
- survey.timeline: 희망 일정 (예: "3개월 이내", "6개월 이내", "1년 이상")
- survey.target_market: 타겟 시장/지역 (예: "국내 B2C", "북미 아마존", "국내 B2B")
- survey.priority: 우선순위 (예: "원가", "품질", "리드타임", "디자인 임팩트")
- survey.risk_tolerance: 리스크 허용도 (예: "보수적", "중간", "공격적")
- survey.regulation_focus: 규제/인증 관련 이슈 (예: "전기용품", "생활제품 위생", "의료기기 가능성" 등)

설문 값과 user_notes가 있을 경우:
- "target_and_problem"의 summary/details,
- "differentiation"의 포인트, 전략,
- "concept_and_references"의 키워드와 요약,
- "double_diamond"의 각 단계 goals/tasks/deliverables,
- "expert_reviews"의 risks/asks/checklist
에 **직접적인 문장**으로 반영하십시오.
예를 들어 timeline이 "6개월 이내"라면:
- PM/기획 리스크에 "6개월 내 런칭을 위해 어떤 단계는 병행 진행이 필요" 같은 내용을 포함하고,
- Develop/Deliver 단계의 tasks도 6개월 일정에 맞게 조정합니다.

반드시 아래 JSON 형식만 반환하세요. 설명 문장, 마크다운, 코드블록은 포함하지 마세요.

{
  "target_and_problem": {
    "summary": "한 줄 요약",
    "details": "맥락과 인사이트를 포함한 상세 설명 (user_notes를 반영하여 이전 버전 대비 어떻게 보완되었는지도 자연스럽게 녹여서 작성)"
  },
  "key_features": [
    { "name": "기능 이름", "description": "설명" }
  ],
  "differentiation": [
    { "point": "차별 포인트", "strategy": "구체 전략" }
  ],
  "concept_and_references": {
    "concept_summary": "전체 컨셉 정리 (비전문가도 이해할 수 있게, user_notes에서 강조한 분위기/이미지 방향을 포함)",
    "reference_keywords": ["이미지/레퍼런스 검색용 키워드들"]
  },
  "visual_rfp": {
    "project_title": "프로젝트명",
    "background": "배경 및 문제의식",
    "objective": "디자인/사업 목표",
    "target_users": "핵심 타겟",
    "core_requirements": ["핵심 요구사항 3~7개"],
    "design_direction": "형태, 재질, 톤앤매너 등 (user_notes가 있다면 그 내용을 최우선으로 반영)",
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
      "risks": ["PM/기획 관점에서의 위험 요소 (일정, 예산, 리스크 등 — survey.timeline과 budget을 꼭 반영)"],
      "asks": ["지금 당장 PM이 해야 할 일"],
      "checklist": ["PM이 점검해야 할 체크리스트 항목들"]
    },
    "designer": {
      "risks": ["디자인/사용성 관점에서 주의해야 할 점"],
      "asks": ["지금 당장 디자이너가 해두면 좋은 일"],
      "checklist": ["디자인 관점 체크리스트"]
    },
    "engineer": {
      "risks": ["기술/안전/성능 측면 주요 리스크"],
      "asks": ["엔지니어가 먼저 검토해야 할 것들"],
      "checklist": ["기술/안전/규격 관련 체크리스트"]
    },
    "marketer": {
      "risks": ["시장/경쟁/가격/브랜딩 관련 리스크 (survey.target_market, priority를 반영)"],
      "asks": ["마케터가 먼저 확인해야 할 것들"],
      "checklist": ["런칭 메시지, 채널, 가격 관련 체크리스트"]
    }
  }
}
        `.trim();

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              `제품 아이디어: "${idea}"\n` +
              `survey: ${survey ? JSON.stringify(survey) : "제공되지 않음"}\n` +
              `user_notes: ${user_notes ? JSON.stringify(user_notes) : "제공되지 않음"}\n` +
              "위 정보를 모두 반영하여 JSON 형식의 RFP를 생성해 주세요.",
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
      }
    }

    if (!rfpResult) {
      rfpResult = {
        // 필요하다면 기존 MOCK 구조를 여기에 넣어두기
      };
    }

    const logId = await logRfpToSupabase({ idea, survey, user_notes, rfp: rfpResult });

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
