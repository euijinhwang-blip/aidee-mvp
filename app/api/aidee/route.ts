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
  },
  "double_diamond": {                        // 🔹 NEW
    "discover": {
      "goals": ["목표/맥락 파악"],
      "tasks": [
        {"title": "현장/데스크 리서치", "owner": "PM/리서처", "eta_days": 3}
      ],
      "deliverables": ["인사이트 메모"]
    },
    "define": {
      "goals": ["요구사항·성능·원가 가드레일 확정"],
      "tasks": [
        {"title": "PRD/요구사항 매트릭스", "owner": "PM", "eta_days": 2}
      ],
      "deliverables": ["PRD v1"]
    },
    "develop": {
      "goals": ["설계·시작품·인증 준비"],
      "tasks": [
        {"title": "구조설계/BOM v1", "owner": "엔지니어", "eta_days": 7},
        {"title": "3D/CMF 목업", "owner": "디자이너", "eta_days": 5}
      ],
      "deliverables": ["3D STEP", "BOM v1", "목업 사진"]
    },
    "deliver": {
      "goals": ["양산·런칭·판매"],
      "tasks": [
        {"title": "금형/양산업체 RFQ", "owner": "PM/구매", "eta_days": 5},
        {"title": "패키지/라벨/매뉴얼", "owner": "디자이너/MD", "eta_days": 4},
        {"title": "런칭 플랜", "owner": "마케터", "eta_days": 4}
      ],
      "deliverables": ["PO/생산일정", "패키지 파일", "런칭 캘린더"]
    }
  },
  "experts_to_meet": [                        // 🔹 NEW
    {"role": "제품 디자이너", "why": "형태/사용성·CMF 결정"},
    {"role": "엔지니어(구조/전자)", "why": "부품 선정·BOM·안전성"},
    {"role": "양산업체/금형사", "why": "DFM·원가·납기"},
    {"role": "마케터/MD", "why": "포지셔닝/채널/가격 전략"},
    {"role": "인증 대행", "why": "필요 인증 경로·리스크 안내"}
  ]
}
        `.trim();

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
       messages: [
  { role: "system", content: systemPrompt },
  {
    role: "user",
    content: '제품 아이디어: "' + idea + '"에 대해 위 JSON 형식을 따라 작성해 주세요.',
  },
]
,
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
        { name: "러닝 최적화 공기 정화 모듈", description: "…" },
        { name: "착용감 중심의 웨어러블 폼팩터", description: "…" },
        { name: "실시간 공기질 피드백", description: "…" },
        { name: "생활 방수 및 내구성", description: "…" }
      ],
      differentiation: [
        { point: "러닝 특화", strategy: "…" },
        { point: "스타일과 퍼포먼스의 결합", strategy: "…" },
        { point: "심리적 안전감", strategy: "…" }
      ],
      concept_and_references: {
        concept_summary: "도시 러너를 위한 '개인용 클린에어 버블' 컨셉…",
        reference_keywords: [
          "running wearable device","neckband air purifier","minimal sport tech","urban night runner","LED indicator sports gear"
        ]
      },
      visual_rfp: {
        project_title: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스 디자인",
        background: "…",
        objective: "…",
        target_users: "…",
        core_requirements: [
          "러닝 동작 방해 X","기본 필터링 성능","야간 시인성 요소","교체 가능한 필터/충전","러닝 웨어와 조합 가능"
        ],
        design_direction: "…",
        deliverables: ["컨셉 보드","3D 렌더","구조 다이어그램","UI/LED 플로우","네이밍 제안"]
      },
      // 🔹 NEW: 더블다이아몬드 & 전문가 안내 (MOCK)
      double_diamond: {
        discover: {
          goals: ["문제 맥락 파악", "타겟 세분화"],
          tasks: [
            { title: "러닝 크루 인터뷰 5명", owner: "PM/리서처", eta_days: 4 },
            { title: "경쟁/대체재 스캔", owner: "PM/디자이너", eta_days: 3 }
          ],
          deliverables: ["인사이트 메모", "경쟁 포지션 맵"]
        },
        define: {
          goals: ["제품 요구사항 고정", "성능/원가 가드레일"],
          tasks: [
            { title: "PRD/요구사항 매트릭스", owner: "PM", eta_days: 2 },
            { title: "성능 지표 합의(정화량/무게/소음)", owner: "엔지니어/디자이너", eta_days: 2 }
          ],
          deliverables: ["PRD v1", "요구사항 매트릭스"]
        },
        develop: {
          goals: ["설계/시작품", "인증·양산 준비"],
          tasks: [
            { title: "구조설계·부품 선정", owner: "엔지니어", eta_days: 10 },
            { title: "3D/CMF 목업", owner: "디자이너", eta_days: 7 },
            { title: "안전/전파 인증 사전검토", owner: "PM/엔지니어", eta_days: 3 }
          ],
          deliverables: ["3D STEP", "BOM v1", "목업 사진", "인증 체크리스트"]
        },
        deliver: {
          goals: ["양산·런칭·판매"],
          tasks: [
            { title: "금형/양산업체 RFQ & 발주", owner: "PM/구매", eta_days: 7 },
            { title: "패키지/라벨/매뉴얼", owner: "디자이너/MD", eta_days: 5 },
            { title: "런칭 플랜(채널/가격/프로모션)", owner: "마케터", eta_days: 5 }
          ],
          deliverables: ["PO·생산일정", "패키지 파일", "런칭 캘린더", "커머스 세팅"]
        }
      },
      experts_to_meet: [
        { role: "제품 디자이너",   why: "형태/사용성·CMF 결정" },
        { role: "엔지니어(구조/전자)", why: "부품·BOM·안전성" },
        { role: "양산업체/금형사",  why: "DFM/원가·납기" },
        { role: "마케터/MD",      why: "채널 전략/가격/콘텐츠" },
        { role: "인증 대행",      why: "필요 인증 경로 안내" }
      ]
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
