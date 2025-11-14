// app/api/aidee/route.ts
import OpenAI from "openai";

// OPENAI_API_KEY가 있으면 실제 API 사용, 없거나 에러면 MOCK 사용
const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  try {
    const { idea, survey } = await req.json(); // survey는 나중에 확장용

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
당신은 실제 제품 디자인과 하드웨어 사업화 경험을 가진 시니어 컨설턴트입니다.
아래 JSON 스키마에 맞춰, 비전문가도 이해하기 쉬운 한국어로만 채워 주세요.

반드시 JSON 객체 하나만 반환하세요. 설명 문장, 마크다운, 코드블록 등은 절대 포함하지 마세요.

{
  "target_and_problem": {
    "summary": "한 줄 요약",
    "details": "왜 이 제품이 필요한지, 초보자도 이해할 수 있게 스토리텔링으로 설명"
  },
  "key_features": [
    { "name": "핵심 기능 이름", "description": "일상 언어로 쉽게 푸는 설명" }
  ],
  "differentiation": [
    { "point": "차별 포인트", "strategy": "다른 제품과 어떻게 다르게 보이게 할지 쉬운 설명" }
  ],
  "concept_and_references": {
    "concept_summary": "전체 컨셉을 한 문단으로 정리",
    "reference_keywords": ["이미지 검색용 키워드 3~7개"]
  },
  "visual_rfp": {
    "project_title": "프로젝트명",
    "background": "배경과 문제의식",
    "objective": "디자인/사업 목표",
    "target_users": "핵심 타겟",
    "core_requirements": ["핵심 요구사항 3~7개"],
    "design_direction": "형태, 재질, 색, 톤앤매너 등",
    "deliverables": ["필요 산출물 리스트"]
  },
  "double_diamond": {
    "discover": {
      "goals": ["이 단계에서 무엇을 이해해야 하는지"],
      "tasks": [
        { "title": "해야 할 대표 활동 1", "owner": "PM/디자이너/엔지니어 등" }
      ],
      "deliverables": ["이 단계의 대표 결과물"]
    },
    "define": {
      "goals": ["문제를 어떻게 정의할지"],
      "tasks": [
        { "title": "요구사항 정리 활동", "owner": "PM" }
      ],
      "deliverables": ["요구사항 문서, 핵심 지표 등"]
    },
    "develop": {
      "goals": ["어떤 시제품과 설계를 만드는지"],
      "tasks": [
        { "title": "시제품/3D 설계", "owner": "디자이너/엔지니어" }
      ],
      "deliverables": ["3D 파일, 목업 사진 등"]
    },
    "deliver": {
      "goals": ["양산과 판매를 위해 준비할 것들"],
      "tasks": [
        { "title": "양산업체 협의, 패키지/매뉴얼 제작", "owner": "PM/디자이너/MD" }
      ],
      "deliverables": ["생산 일정, 패키지 파일, 런칭 플랜 등"]
    }
  },
  "experts_to_meet": [
    { "role": "전문가 직군명", "why": "이 사람을 만나면 어떤 도움이 되는지" }
  ],
  "expert_reviews": {
    "pm": {
      "risks": ["시장·일정 관점에서 주의해야 할 점들"],
      "asks": ["지금 당장 PM이 확인해야 할 액션 아이템"],
      "checklist": ["PM 관점 체크리스트 항목"]
    },
    "designer": {
      "risks": ["사용성·브랜드 관점에서의 위험 요소"],
      "asks": ["디자이너가 먼저 해 보면 좋은 작업"],
      "checklist": ["디자인 관점 체크리스트"]
    },
    "engineer": {
      "risks": ["기술·구조·안전 관점 리스크"],
      "asks": ["엔지니어가 먼저 확인해야 할 것"],
      "checklist": ["엔지니어링 관점 체크리스트"]
    },
    "marketer": {
      "risks": ["시장/경쟁/가격 관점 리스크"],
      "asks": ["마케팅/채널 준비 관련 액션"],
      "checklist": ["마케팅 관점 체크리스트"]
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
              content: `제품 아이디어: "${idea}" 에 대해 위 JSON 형식에 맞춰 작성해 주세요.`,
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
        // 아래 MOCK 사용
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
        { name: "러닝 최적화 공기 정화 모듈", description: "운동 중 호흡을 방해하지 않는 수준으로 설계된 공기 정화 모듈" },
        { name: "착용감 중심의 웨어러블 폼팩터", description: "흔들림이 적고 무게 중심이 안정적인 착용 구조" },
        { name: "실시간 공기질 피드백", description: "LED 또는 앱으로 현재 공기질과 필터 교체 시점을 안내" },
        { name: "생활 방수 및 내구성", description: "땀·비·야간 러닝 환경을 견딜 수 있는 생활 방수" }
      ],
      differentiation: [
        { point: "러닝 특화", strategy: "일반 마스크/공기청정기와 달리 러닝 상황에 최적화된 제품으로 포지셔닝" },
        { point: "스타일과 퍼포먼스의 결합", strategy: "스포츠 브랜드와 협업 가능한 디자인 언어 제안" },
        { point: "심리적 안전감", strategy: "데이터 기반 피드백으로 보이지 않는 위험을 시각화" }
      ],
      concept_and_references: {
        concept_summary:
          "도시 러너를 위한 '개인용 클린에어 버블' 컨셉. 러닝 동작을 방해하지 않는 미니멀 디바이스로, " +
          "퍼포먼스와 라이프스타일 사이에 위치하는 새로운 카테고리를 제안한다.",
        reference_keywords: [
          "running wearable device",
          "neckband air purifier",
          "minimal sport tech",
          "urban night runner"
        ]
      },
      visual_rfp: {
        project_title: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스 디자인",
        background: "도시 환경에서 러닝 인구 증가와 공기 오염에 대한 우려가 함께 커지고 있다.",
        objective: "러닝 중 착용 부담을 최소화하면서 실질적인 공기 정화와 심리적 안심 효과를 제공하는 컨셉 도출",
        target_users: "도시권 야외 러닝을 즐기는 20–40대 러너",
        core_requirements: [
          "러닝 동작을 방해하지 않는 착용 구조",
          "미세먼지/오염물질 필터링 성능",
          "야간 러닝에서도 어울리는 심플한 형태",
          "교체 가능한 필터 및 충전 구조"
        ],
        design_direction:
          "슬림하고 유선형의 실루엣, 블랙/딥그레이 베이스에 포인트 컬러. 러닝 웨어와 자연스럽게 통합되는 형태 탐색.",
        deliverables: [
          "제품 컨셉 보드",
          "3D 제품 렌더링(착용 시나리오 포함)",
          "기본 치수 및 구조 다이어그램",
          "UI/LED 인디케이터 플로우",
          "브랜드/네이밍 제안"
        ]
      },
      double_diamond: {
        discover: {
          goals: ["문제 맥락 파악", "타겟 러너 세분화"],
          tasks: [
            { title: "러닝 크루 인터뷰 5명", owner: "PM/리서처" },
            { title: "경쟁/대체재 스캔", owner: "PM/디자이너" }
          ],
          deliverables: ["인사이트 메모", "경쟁 포지션 맵"]
        },
        define: {
          goals: ["제품 요구사항 정의", "성능·원가 가드레일 설정"],
          tasks: [
            { title: "요구사항 매트릭스 작성", owner: "PM" },
            { title: "핵심 성능 지표 합의", owner: "PM/엔지니어/디자이너" }
          ],
          deliverables: ["PRD v1", "요구사항 매트릭스"]
        },
        develop: {
          goals: ["시제품 설계·제작", "인증·양산 준비"],
          tasks: [
            { title: "구조 설계 및 부품 선정", owner: "엔지니어" },
            { title: "3D/CMF 목업 제작", owner: "디자이너" }
          ],
          deliverables: ["3D STEP", "BOM v1", "목업 사진"]
        },
        deliver: {
          goals: ["양산·런칭·판매"],
          tasks: [
            { title: "양산업체 RFQ 및 발주", owner: "PM/구매" },
            { title: "패키지/라벨/매뉴얼 제작", owner: "디자이너/MD" },
            { title: "런칭 플랜 수립", owner: "마케터" }
          ],
          deliverables: ["생산 일정", "패키지 파일", "런칭 캘린더"]
        }
      },
      experts_to_meet: [
        { role: "제품 디자이너",   why: "형태·사용성·착용감을 함께 설계하기 위해" },
        { role: "엔지니어(구조/전자)", why: "부품 선정·전원·열·소음 등 기술 검토를 위해" },
        { role: "양산업체/금형사",  why: "생산 가능성·원가·납기를 현실적으로 맞추기 위해" },
        { role: "마케터/MD",      why: "시장 포지셔닝과 가격·채널 전략을 정리하기 위해" }
      ],
      expert_reviews: {
        pm: {
          risks: [
            "실제 러너 대상 검증 없이 제품을 정의하면 수요가 약할 수 있습니다.",
            "부품 리드타임과 인증 기간을 고려하지 않으면 런칭 일정이 밀릴 수 있습니다."
          ],
          asks: [
            "초기에는 기능을 최소화한 MVP 범위를 먼저 정해 보세요.",
            "주요 리스크(시장, 기술, 일정)를 리스트로 정리하고 우선순위를 매겨 보세요."
          ],
          checklist: [
            "핵심 타겟과 사용 시나리오가 1페이지 안에 정리되어 있는가?",
            "런칭 목표 시점과 예산 상·하한이 대략이라도 정해져 있는가?"
          ]
        },
        designer: {
          risks: [
            "착용 부위와 무게 배분이 검증되지 않으면 실제 러닝 시 불편감이 클 수 있습니다.",
            "시각적인 스타일만 고민하고, 세탁·보관·충전 같은 생활 맥락을 놓칠 수 있습니다."
          ],
          asks: [
            "러닝 전·중·후의 사용 시나리오를 간단한 만화 형태로라도 그려 보세요.",
            "실제 러닝 웨어 사진 위에 디바이스를 대략 합성해서 어울림을 확인해 보세요."
          ],
          checklist: [
            "착용/탈착 동작이 3스텝 이내로 설명 가능한가?",
            "러닝 중 흔들림을 줄이기 위한 고정 방식이 정의되어 있는가?"
          ]
        },
        engineer: {
          risks: [
            "배터리 용량·무게·안전 규격을 동시에 만족시키기 어려울 수 있습니다.",
            "팬/모터 소음과 진동이 사용 경험을 해칠 수 있습니다."
          ],
          asks: [
            "목표 사용 시간과 허용 가능한 무게 범위를 먼저 숫자로 잡아 보세요.",
            "예상 사용 환경(비, 땀, 온도)을 정리하고 필요한 보호 등급을 추정해 보세요."
          ],
          checklist: [
            "전원, 팬, 센서 등 주요 부품 리스트(BOM 초안)가 있는가?",
            "국내 전기·전파 인증 필요 여부를 대략이라도 확인했는가?"
          ]
        },
        marketer: {
          risks: [
            "‘공기청정 웨어러블’이라는 개념이 처음인 고객에게 메시지가 어렵게 느껴질 수 있습니다.",
            "가격이 러닝 액세서리 평균대보다 높으면 설득 포인트가 더 필요합니다."
          ],
          asks: [
            "기존 러닝 기어(시계, 이어폰 등)와 어떻게 함께 쓰일지 한 줄로 설명해 보세요.",
            "경쟁/유사 제품 3~5개의 가격과 리뷰 포인트를 표로 정리해 보세요."
          ],
          checklist: [
            "이 제품이 없던 사람에게 ‘한 줄 설명’이 준비되어 있는가?",
            "첫 런칭 채널(예: 크라우드펀딩, 자사몰, 스마트스토어)이 정해져 있는가?"
          ]
        }
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
