// app/api/aidee/route.ts
import OpenAI from "openai";
import { supabaseAnon } from "@/lib/supabase"; // 🔹 Supabase 클라이언트

// OPENAI_API_KEY가 있으면 실제 API 사용, 없거나 에러면 MOCK 사용
const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idea: string = body?.idea;
    const survey: any = body?.survey || null;

    if (!idea || typeof idea !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디어가 비어 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // -------------------------------
    // 1) OpenAI 사용 (가능하면)
    // -------------------------------
    let parsed: any = null;
    let usedMock = false;

    if (client) {
      try {
        const systemPrompt = `
당신은 실제 제품 디자인·개발·양산 경험이 있는 시니어 컨설턴트입니다.
사용자가 제시한 "제품 아이디어"와 선택적으로 제공되는 "설문 정보(survey)"를 참고하여
다음 JSON 구조에 맞게만 응답하세요. 설명 문장, 마크다운, 코드블록은 절대 포함하지 마세요.

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
에 반영해서 작성하세요. (비전문가도 이해할 수 있도록 쉽게 설명)

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
      "checklist": ["PM이 점검해야 할 체크리스트 항목들"]
    },
    "designer": {
      "risks": ["디자인/사용성 관점에서 주의해야 할 점"],
      "asks": ["지금 당장 디자이너가 해두면 좋은 일"],
      "checklist": ["디자인 관점 체크리스트 (타겟, 사용 시나리오 등)"]
    },
    "engineer": {
      "risks": ["기술/안전/성능 측면 주요 리스크"],
      "asks": ["엔지니어가 먼저 검토해야 할 것들"],
      "checklist": ["기술/안전/규격 관련 체크리스트"]
    },
    "marketer": {
      "risks": ["시장/경쟁/가격/브랜딩 관련 리스크"],
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
              '제품 아이디어: "' +
              idea +
              '"에 대해 위 JSON 형식에 맞추어 작성해 주세요. ' +
              (survey
                ? "또한 다음 설문 정보(survey)를 함께 반영해 주세요: " +
                  JSON.stringify(survey)
                : "설문 정보는 따로 제공되지 않았습니다. 일반적인 가정을 사용해 주세요."),
          },
        ];

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages,
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("모델 응답이 비어 있습니다.");

        parsed = JSON.parse(content);
      } catch (err: any) {
        console.error("OpenAI 호출 실패, MOCK 데이터로 대체합니다:", err?.message || err);
        usedMock = true;
      }
    }

    // -------------------------------
    // 2) OpenAI 실패 시 MOCK 사용
    // -------------------------------
    if (!parsed) {
      usedMock = true;
      parsed = {
        target_and_problem: {
          summary: "캠핑족을 위한 맞춤형 조명 디자인",
          details:
            "캠핑을 즐기는 사람들은 감성적인 분위기와 실제 조도 확보를 동시에 원하지만, " +
            "기존 제품은 실용성 또는 분위기 한쪽에만 치우친 경우가 많다. " +
            "야외에서 안전하고 간편하게 사용할 수 있으면서도, 사용자의 취향에 맞게 조합 가능한 조명 솔루션이 필요하다.",
        },
        key_features: [
          { name: "모듈형 조명 구조", description: "랜턴, 무드등, 헤드램프 등 상황에 맞게 조합 가능한 구조" },
          { name: "방수/방진 설계", description: "야외 사용을 위한 IPX 등급 방수·방진 구조" },
          {
            name: "따뜻한 색온도와 색상 변경",
            description: "따뜻한 색온도 중심에 상황에 맞는 색상 변경(야간 시안성, 파티 모드 등)",
          },
        ],
        differentiation: [
          {
            point: "캠핑 상황 특화",
            strategy: "텐트 내부/외부, 식사/휴식/취침 등 상황별 사용 시나리오를 기준으로 설계",
          },
          {
            point: "감성 + 실용성 결합",
            strategy: "인스타그램/리뷰 사진에서 좋게 보이는 연출과 실제 조도의 균형을 맞춤",
          },
        ],
        concept_and_references: {
          concept_summary:
            "‘캠핑 공간 전체를 유연하게 연출할 수 있는 모듈형 조명 키트’ 컨셉. " +
            "한 개의 시스템으로 랜턴·무드등·줄조명 등 여러 연출이 가능하도록 설계한다.",
          reference_keywords: [
            "camping lantern modular",
            "outdoor string light",
            "warm tone camping light",
            "minimal outdoor gear",
          ],
        },
        visual_rfp: {
          project_title: "캠핑족을 위한 모듈형 무드 조명 키트 디자인",
          background: "캠핑 인구 증가와 함께 감성 조명 수요가 늘어나지만, 실용성과 감성의 균형 잡힌 제품은 부족하다.",
          objective: "캠핑 사이트 전체를 유연하게 연출할 수 있는 모듈형 조명 키트를 제안한다.",
          target_users: "20~40대 캠핑/차박을 즐기는 사용자 및 가족 단위 캠핑족",
          core_requirements: [
            "텐트 내부/외부 모두 설치 가능",
            "손쉬운 분리/결합 구조",
            "야외 환경에서의 안전성(발열/방수)",
            "배터리 교체 혹은 충전 방식의 편의성",
          ],
          design_direction:
            "군더더기 없는 미니멀한 형태와 따뜻한 톤의 색조, 야간에도 과하게 눈부시지 않은 빛 연출. " +
            "캠핑 장비와 잘 어울리는 재질(예: 무광 플라스틱 + 패브릭 케이블 등).",
          deliverables: ["컨셉 보드", "사용 시나리오 스토리보드", "3D 렌더 이미지", "구조 다이어그램"],
        },
        double_diamond: {
          discover: {
            goals: ["캠핑 시 조명 사용 맥락 이해", "주요 불편/니즈 파악"],
            tasks: [
              { title: "캠핑 경험자 5~7명 심층 인터뷰", owner: "PM/리서처" },
              { title: "온라인 리뷰/커뮤니티 리서치", owner: "PM" },
            ],
            deliverables: ["인터뷰 요약 노트", "니즈/페인포인트 정리 문서"],
          },
          define: {
            goals: ["제품 컨셉과 요구사항 정리", "예산/일정에 맞는 범위 정의"],
            tasks: [
              { title: "핵심 사용 시나리오 선정", owner: "PM/디자이너" },
              { title: "성능/원가/스펙 가드레일 설정", owner: "PM/엔지니어" },
            ],
            deliverables: ["제품 요구사항 문서(PRD)", "핵심 시나리오 플로우"],
          },
          develop: {
            goals: ["형태/구조/광원 설계", "시작품 제작 및 테스트"],
            tasks: [
              { title: "3D 스케치/목업 제작", owner: "디자이너" },
              { title: "광원/배터리/회로 구성 검토", owner: "엔지니어" },
            ],
            deliverables: ["3D 데이터", "BOM 초안", "간이 시작품 사진/테스트 결과"],
          },
          deliver: {
            goals: ["양산 준비 및 런칭 계획"],
            tasks: [
              { title: "양산 업체/공정 검토", owner: "PM/구매" },
              { title: "가격/채널/런칭 일정 계획", owner: "마케터" },
            ],
            deliverables: ["생산 일정 초안", "가격 전략 및 채널 계획"],
          },
        },
        experts_to_meet: [
          { role: "제품 디자이너", why: "형태, 사용성, 분위기를 동시에 고려한 디자인 정리를 위해" },
          { role: "엔지니어(구조/전자)", why: "방수/발열/배터리 등 기술적 안정성을 확보하기 위해" },
          { role: "양산업체/금형사", why: "생산 가능성과 금형/원가 구조를 현실적으로 맞추기 위해" },
          { role: "마케터/MD", why: "매장/온라인 판매 채널에 맞는 포지셔닝과 가격 설정을 위해" },
        ],
        expert_reviews: {
          pm: {
            risks: [
              "기능 범위가 넓어지며 일정과 예산이 늘어날 수 있음",
              "감성 요소에 치우쳐 기본 성능(밝기/사용 시간) 요구를 놓칠 수 있음",
            ],
            asks: [
              "이번 버전에서 꼭 해결해야 할 문제와 나중에 해도 되는 일을 구분해보세요.",
              "예산/일정 가정을 세우고, 이를 기준으로 기능 우선순위를 정리해보세요.",
            ],
            checklist: [
              "핵심 타겟과 사용 시나리오가 명확하게 정의되어 있는가?",
              "예산/일정/리스크에 대한 가정을 팀과 공유했는가?",
            ],
          },
          designer: {
            risks: ["장식적인 요소가 많아져 실제 사용성이 떨어질 수 있음"],
            asks: [
              "캠핑 현장 사진을 모아 대표적인 세 가지 상황(식사/휴식/취침)에 대한 조명 사용 플로우를 그려보세요.",
            ],
            checklist: ["한 손으로 들고 다니기 쉬운지", "어두운 환경에서도 조작이 직관적인지"],
          },
          engineer: {
            risks: ["배터리 용량과 밝기 요구 사이에서 트레이드오프 필요", "방수/방진 설계 난이도"],
            asks: [
              "목표 사용 시간과 밝기를 먼저 정하고, 이에 맞는 배터리/광원 조합을 제안해보세요.",
            ],
            checklist: ["야외 사용 온도 범위 정의", "충전/배터리 교체 방식 결정"],
          },
          marketer: {
            risks: ["기존 캠핑 조명 제품과의 차별점이 명확하지 않을 수 있음"],
            asks: [
              "캠핑 조명 베스트셀러 3~5개를 비교하여, 우리 제품만의 한 줄 메시지를 정리해보세요.",
            ],
            checklist: ["메인 타겟(초보 캠퍼 vs 헤비유저) 정의", "온라인/오프라인 중 핵심 채널 선택"],
          },
        },
      };
    }

    // -------------------------------
    // 3) Supabase rfp_logs 에 저장
    // -------------------------------
    let logId: string | null = null;
    let logError: string | null = null;

    try {
      const supabase = supabaseAnon();

      const { data, error } = await supabase
        .from("rfp_logs")
        .insert([
          {
            idea,
            survey,
            rfp_summary: parsed, // 전체 RFP JSON 저장
          },
        ])
        .select("id")
        .single();

      if (error) {
        console.error("Supabase rfp_logs 저장 실패:", error);
        logError = error.message ?? String(error);
      } else {
        logId = data?.id ?? null;
      }
    } catch (e: any) {
      console.error("Supabase rfp_logs 예외 발생:", e);
      logError = e?.message || String(e);
    }

    // -------------------------------
    // 4) 클라이언트로 응답
    //    (디버깅용 메타정보도 같이 보냄)
    // -------------------------------
    const responseBody = {
      ...parsed,
      _meta: {
        usedMock,
        logId,
        logError,
      },
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
