import OpenAI from "openai";

// OPENAI_API_KEY가 있으면 실제 API 사용, 없거나 에러면 MOCK 사용
const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    if (!idea || typeof idea !== "string") {
      return new Response(
        JSON.stringify({ error: "아이디어가 비어 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 1) OpenAI API 시도 (키도 있고, 쿼터도 남아 있을 경우)
    if (client) {
      try {
        const systemPrompt = `
당신은 실제 제품 디자인 및 사업화 경험을 가진 시니어 컨설턴트입니다.
사용자가 제시한 제품 아이디어를 기반으로 아래 JSON 구조를 정확히 채워서 반환하세요.

반드시 이 JSON 형식만 반환하세요. 설명 문장, 마크다운, 코드블록 등은 절대 포함하지 마세요.

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
    "concept_summary": "전체 컨셉 정리",
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
  }
}
        `.trim();

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini", // 나중에 계정에 맞는 모델로 조정
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
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: any) {
        console.error("OpenAI 호출 실패, MOCK 데이터로 대체합니다:", err?.message || err);
        // → 아래에서 MOCK 사용
      }
    }

    // 2) MOCK 응답 (쿼터 초과/키 없음/에러 시)
    const mock = {
      target_and_problem: {
        summary: "야외 러너의 호흡 건강과 쾌적한 러닝 환경 확보",
        details:
          "도시 러너들은 미세먼지, 배기가스, 꽃가루 등 공기 오염에 지속적으로 노출된다. " +
          "특히 새벽·야간 러닝 시 차량 통행량과 특정 구간의 공기질 문제로 불편과 불안감을 겪는다. " +
          "휴대성과 착용성을 갖춘 미니 공기청정 웨어러블은 이러한 환경적 리스크를 줄이고, " +
          "퍼포먼스 러너와 라이프스타일 러너 모두에게 심리적·실질적 안전감을 제공할 수 있다."
      },
      key_features: [
        {
          name: "러닝 최적화 공기 정화 모듈",
          description:
            "미세먼지 및 유해가스를 필터링하는 소형 모듈을 턱선/가슴/어깨 라인 등에 배치하여, 운동 중 호흡을 방해하지 않는 수준으로 설계."
        },
        {
          name: "착용감 중심의 웨어러블 폼팩터",
          description:
            "러닝 시 흔들림이 적고, 무게 중심이 안정적인 구조(넥밴드, 체스트 스트랩, 캡/바이저 일체형 등)를 제안."
        },
        {
          name: "실시간 공기질 피드백",
          description:
            "LED 인디케이터 또는 앱 연동을 통해 현재 공기질 상태와 필터 교체 시점 안내."
        },
        {
          name: "생활 방수 및 내구성",
          description:
            "땀, 비, 야간 러닝 환경을 견딜 수 있는 생활 방수 및 러닝용 소재 사용."
        }
      ],
      differentiation: [
        {
          point: "러닝 특화",
          strategy:
            "일반 마스크/공기청정기와 달리 '달리는 상황'의 호흡 패턴, 무게, 움직임을 기준으로 한 전문 러닝 기어 포지셔닝."
        },
        {
          point: "스타일과 퍼포먼스의 결합",
          strategy:
            "스포츠 브랜드와 협업 가능한 디자인 언어(러닝 웨어와 자연스럽게 어울리는 컬러/라인) 제안."
        },
        {
          point: "심리적 안전감",
          strategy:
            "데이터 기반 공기질 피드백으로 '보이지 않는 위험'을 시각화하고, 사용자에게 통제감을 제공."
        }
      ],
      concept_and_references: {
        concept_summary:
          "도시 러너를 위한 '개인용 클린에어 버블' 컨셉. 러닝 동작을 방해하지 않는 미니멀한 디바이스로, " +
          "퍼포먼스와 라이프스타일 사이에 위치하는 새로운 카테고리 제안.",
        reference_keywords: [
          "running wearable device",
          "neckband air purifier",
          "minimal sport tech",
          "urban night runner",
          "LED indicator sports gear"
        ]
      },
      visual_rfp: {
        project_title:
          "야외 러너를 위한 미니 공기청정 웨어러블 디바이스 디자인",
        background:
          "도시 환경에서 러닝 인구가 증가함에 따라, 공기 오염과 호흡 건강에 대한 우려가 커지고 있다. " +
          "기존 마스크형 제품들은 착용감, 호흡, 스타일 측면의 불편으로 러닝 상황에서의 지속 사용이 어렵다.",
        objective:
          "러닝 중 착용 부담을 최소화하면서도 실질적인 공기 정화와 심리적 안심 효과를 제공하는 웨어러블 디바이스 컨셉을 도출한다.",
        target_users:
          "도시권 야외 러닝을 즐기는 20-40대 러너 (출퇴근 러너, 마라톤 준비생, 러닝 크루 등)",
        core_requirements: [
          "러닝 동작을 방해하지 않는 착용 구조 및 무게",
          "기본적인 미세먼지/오염물질 필터링 성능",
          "야간 러닝에서도 어울리는 심플한 형태와 조명 요소",
          "교체 가능한 필터 및 충전 구조",
          "기존 러닝 웨어/액세서리와 조합 가능한 디자인"
        ],
        design_direction:
          "슬림하고 유선형의 실루엣, 블랙/딥그레이 기반에 포인트 컬러를 일부 적용. " +
          "러닝 웨어와 자연스럽게 통합되는 형태(넥밴드, 캡, 스트랩, 체형 밀착 구조 등)를 탐색.",
        deliverables: [
          "제품 컨셉 보드",
          "3D 제품 렌더링(착용 시나리오 포함)",
          "기본 치수 및 구조 다이어그램",
          "UI/LED 인디케이터 동작 플로우",
          "간단한 브랜드/네이밍 제안"
        ]
      }
    };

    return new Response(JSON.stringify(mock), {
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
