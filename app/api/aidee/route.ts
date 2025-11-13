// app/api/aidee/route.ts
import OpenAI from "openai";

/** ─────────────────────────────────────────────────────────
 *  OpenAI 클라이언트 (키 없으면 null → MOCK 사용)
 *  ───────────────────────────────────────────────────────── */
const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/** ─────────────────────────────────────────────────────────
 *  스키마 정의 (모델이 반드시 이 구조로 반환하도록 강제)
 *  ───────────────────────────────────────────────────────── */
function phaseSchema() {
  return {
    type: "object",
    properties: {
      purpose: { type: "string" }, // 단계 설명(1줄)
      goals: { type: "array", items: { type: "string" } },
      tasks: {
        // eta_days 제거, (title, owner)만 허용
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            owner: { type: "string" }
          },
          required: ["title", "owner"]
        }
      },
      deliverables: { type: "array", items: { type: "string" } }
    },
    required: ["purpose", "goals", "tasks", "deliverables"]
  };
}

function expertPackSchema() {
  return {
    type: "object",
    properties: {
      risks: { type: "array", items: { type: "string" } },
      asks: { type: "array", items: { type: "string" } },
      checklist: { type: "array", items: { type: "string" } }
    },
    required: ["risks", "asks", "checklist"]
  };
}

const AIDEE_RFP_SCHEMA = {
  type: "object",
  properties: {
    target_and_problem: {
      type: "object",
      properties: {
        summary: { type: "string" },
        details: { type: "string" }
      },
      required: ["summary", "details"]
    },
    key_features: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" }
        },
        required: ["name", "description"]
      }
    },
    differentiation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          point: { type: "string" },
          strategy: { type: "string" }
        },
        required: ["point", "strategy"]
      }
    },
    concept_and_references: {
      type: "object",
      properties: {
        concept_summary: { type: "string" },
        reference_keywords: { type: "array", items: { type: "string" } }
      },
      required: ["concept_summary", "reference_keywords"]
    },

    // ✅ 프로세스 메타(예산/기간/비율/가정)
    process_meta: {
      type: "object",
      properties: {
        total_budget: { type: "string" },
        total_timeline: { type: "string" },
        phase_ratios: {
          type: "object",
          properties: {
            discover: { type: "string" },
            define: { type: "string" },
            develop: { type: "string" },
            deliver: { type: "string" }
          },
          required: ["discover", "define", "develop", "deliver"]
        },
        assumptions: { type: "array", items: { type: "string" } }
      },
      required: ["total_budget", "total_timeline", "phase_ratios"]
    },

    // ✅ 디자인 및 사업화 프로세스(안)
    double_diamond: {
      type: "object",
      properties: {
        discover: phaseSchema(),
        define: phaseSchema(),
        develop: phaseSchema(),
        deliver: phaseSchema()
      },
      required: ["discover", "define", "develop", "deliver"]
    },

    // ✅ 누구를 만나야 할까
    experts_to_meet: {
      type: "array",
      items: {
        type: "object",
        properties: { role: { type: "string" }, why: { type: "string" } },
        required: ["role", "why"]
      }
    },

    // ✅ 전문가 관점 리뷰
    expert_reviews: {
      type: "object",
      properties: {
        pm: expertPackSchema(),
        designer: expertPackSchema(),
        engineer: expertPackSchema(),
        marketer: expertPackSchema()
      },
      required: ["pm", "designer", "engineer", "marketer"]
    },

    // ✅ 항상 마지막: 비주얼 RFP(요약 카드)
    visual_rfp: {
      type: "object",
      properties: {
        project_title: { type: "string" },
        background: { type: "string" },
        objective: { type: "string" },
        target_users: { type: "string" },
        core_requirements: { type: "array", items: { type: "string" } },
        design_direction: { type: "string" },
        deliverables: { type: "array", items: { type: "string" } }
      },
      required: [
        "project_title",
        "background",
        "objective",
        "target_users",
        "core_requirements",
        "design_direction",
        "deliverables"
      ]
    }
  },
  required: [
    "target_and_problem",
    "key_features",
    "differentiation",
    "concept_and_references",
    "process_meta",
    "double_diamond",
    "experts_to_meet",
    "expert_reviews",
    "visual_rfp"
  ]
} as const;

/** ─────────────────────────────────────────────────────────
 *  시스템 프롬프트
 *  ───────────────────────────────────────────────────────── */
const systemPrompt = `
당신은 제품 디자인·사업화 컨설턴트입니다.
반드시 제공된 "JSON 스키마"를 엄격히 준수해서만 응답하세요.
설명문·마크다운·코드블록 없이 JSON만 반환하세요.
- "디자인 및 사업화 프로세스(안)"은 네 단계(Discover/Define/Develop/Deliver)로 구성
- 각 단계에는 purpose(1줄 설명) 포함
- tasks에는 "eta_days"를 절대 넣지 말고 {title, owner}만 사용
- "visual_rfp"는 전체 요약 카드이므로 항상 포함하고 마지막에 위치
`.trim();

/** ─────────────────────────────────────────────────────────
 *  후처리 보정: 누락/빈 배열 채우기 (초보자 친화 언어)
 *  ───────────────────────────────────────────────────────── */
function fillDefaults(d: any, idea: string) {
  const safeArr = (x: any) => (Array.isArray(x) ? x : []);
  const ensure = (v: any, fb: any) => (v === undefined || v === null ? fb : v);

  d.process_meta = ensure(d.process_meta, {
    total_budget: "예: 4,000만~8,000만원",
    total_timeline: "예: 6~9개월",
    phase_ratios: { discover: "15%", define: "20%", develop: "45%", deliver: "20%" },
    assumptions: [
      "국내 소량 양산(금형 포함)을 기준으로 산정",
      "외주 디자인·설계·브랜딩 포함",
      "인증 필요 여부에 따라 변동 가능"
    ]
  });

  const phaseDefault = (purpose: string) => ({
    purpose,
    goals: [] as string[],
    tasks: [] as { title: string; owner: string }[],
    deliverables: [] as string[]
  });

  d.double_diamond ||= {};
  d.double_diamond.discover ||= phaseDefault("문제를 넓게 탐색하고 사용자·상황을 이해합니다.");
  d.double_diamond.define ||= phaseDefault("배운 내용을 압축해 요구사항과 가드레일을 확정합니다.");
  d.double_diamond.develop ||= phaseDefault("해결안을 만들고 빠르게 만들어 보며 검증합니다.");
  d.double_diamond.deliver ||= phaseDefault("양산·출시·판매까지 실행하고 성과를 모니터링합니다.");

  ["discover", "define", "develop", "deliver"].forEach((p) => {
    const phase = d.double_diamond[p];
    phase.tasks = safeArr(phase.tasks).map((t: any) => ({
      title: t?.title || "작업 항목",
      owner: t?.owner || "담당자"
    }));
    phase.goals = safeArr(phase.goals);
    phase.deliverables = safeArr(phase.deliverables);
  });

  d.experts_to_meet = safeArr(d.experts_to_meet).length
    ? d.experts_to_meet
    : [
        { role: "제품 디자이너", why: "모양·사용 편의·재질(색/표면)을 함께 결정합니다." },
        { role: "엔지니어(구조/전자)", why: "부품 선정과 내부 구조를 안전하게 설계합니다." },
        { role: "양산업체/금형사", why: "만들 수 있는 방법과 비용을 현실적으로 맞춥니다." },
        { role: "마케터/MD", why: "누가 왜 사는지, 가격·채널·메시지를 정리합니다." },
        { role: "인증 대행", why: "필요한 인증 절차와 위험을 미리 확인합니다." }
      ];

  const easyPack = (pack?: any) => ({
    risks:
      safeArr(pack?.risks).length > 0
        ? pack.risks
        : [
            "수요 검증 부족 시 판매에 어려움이 생길 수 있습니다.",
            "부품 납기/가격 변동은 일정과 원가를 흔듭니다."
          ],
    asks:
      safeArr(pack?.asks).length > 0
        ? pack.asks
        : [
            "초기 버전 범위를 작게 정해 빠르게 검증하세요.",
            "핵심 위험 목록을 작성해 주간 단위로 점검하세요."
          ],
    checklist:
      safeArr(pack?.checklist).length > 0
        ? pack.checklist
        : ["PRD(요구사항 문서) 1.0", "리스크 레지스터(위험 목록)"]
  });

  d.expert_reviews = d.expert_reviews || {};
  d.expert_reviews.pm = easyPack(d.expert_reviews.pm);
  d.expert_reviews.designer = easyPack(d.expert_reviews.designer);
  d.expert_reviews.engineer = easyPack(d.expert_reviews.engineer);
  d.expert_reviews.marketer = easyPack(d.expert_reviews.marketer);

  d.visual_rfp ||= {
    project_title: idea.slice(0, 30),
    background: "왜 이 제품이 필요한지 간단히 설명합니다.",
    objective: "무엇을 달성하려는지 한 줄 목표",
    target_users: "누가 주 고객인지",
    core_requirements: ["핵심 요구 1", "핵심 요구 2"],
    design_direction: "형태/재질/톤앤매너 요약",
    deliverables: ["컨셉 보드", "3D 렌더", "생산 문서"]
  };

  return d;
}

/** ─────────────────────────────────────────────────────────
 *  MOCK 데이터 (OpenAI 실패 또는 API KEY 미보유 시)
 *  ───────────────────────────────────────────────────────── */
function mockData(idea: string) {
  return {
    target_and_problem: {
      summary: "주요 타겟의 일상 문제를 안전하고 편리하게 해결",
      details:
        "사용자는 기존 제품에서 안전성·편의성·디자인 모두를 만족시키기 어렵다고 느낍니다. " +
        "핵심 상황과 제약을 분석해 가장 중요한 사용 순간을 개선하는 것이 목표입니다."
    },
    key_features: [
      { name: "안전한 소재/구조", description: "국제 안전 기준을 준수하고 내구성을 확보합니다." },
      { name: "모듈형 기능", description: "핵심 기능을 중심으로 선택·확장 가능한 구성." },
      { name: "직관적 사용성", description: "초보자도 설명서 없이 이해할 수 있는 인터랙션." }
    ],
    differentiation: [
      { point: "사용 맥락 최적화", strategy: "실사용 영상 관찰을 통해 동작·그립·조작성 최적화." },
      { point: "감성 품질", strategy: "만졌을 때의 온도/질감/무게감까지 설계(예: 다이슨의 촉감 완성도)." },
      { point: "운영 용이성", strategy: "부품 표준화·AS 용이성·교체 비용 절감 구조." }
    ],
    concept_and_references: {
      concept_summary:
        "‘안심·편의·심미’를 모두 갖춘 실사용 중심 제품. 집·외부 어디서든 어울리는 미니멀 톤.",
      reference_keywords: [
        "minimal product design",
        "safe materials",
        "modular accessory",
        "user test friendly",
        "everyday usability"
      ]
    },

    process_meta: {
      total_budget: "예: 4,000만~8,000만원",
      total_timeline: "예: 6~9개월",
      phase_ratios: { discover: "15%", define: "20%", develop: "45%", deliver: "20%" },
      assumptions: [
        "국내 소량 양산(금형 포함) 기준",
        "외주 디자인·설계·브랜딩 포함",
        "인증 필요 시 비용/기간 추가"
      ]
    },

    double_diamond: {
      discover: {
        purpose: "문제를 넓게 탐색하고 사용자·상황을 이해합니다.",
        goals: ["핵심 페르소나 도출", "사용 시나리오 정리"],
        tasks: [
          { title: "현장/원격 인터뷰 5~8명", owner: "PM/리서처" },
          { title: "경쟁·대체재 리뷰", owner: "PM/디자이너" }
        ],
        deliverables: ["인사이트 메모", "경쟁 포지션 맵"]
      },
      define: {
        purpose: "배운 내용을 압축해 요구사항과 가드레일을 확정합니다.",
        goals: ["성능/원가/제약 합의", "PRD 1.0"],
        tasks: [
          { title: "요구사항 매트릭스 작성", owner: "PM" },
          { title: "성능 목표치 합의", owner: "엔지니어/디자이너" }
        ],
        deliverables: ["PRD v1", "요구사항 매트릭스"]
      },
      develop: {
        purpose: "해결안을 만들고 빠르게 만들어 보며 검증합니다.",
        goals: ["시작품 제작·검증", "인증/양산 준비"],
        tasks: [
          { title: "구조 설계·부품 선정", owner: "엔지니어" },
          { title: "3D/CMF 목업", owner: "디자이너" },
          { title: "예비 인증 문의", owner: "PM/엔지니어" }
        ],
        deliverables: ["3D STEP", "BOM v1", "목업 사진", "인증 체크리스트"]
      },
      deliver: {
        purpose: "양산·출시·판매까지 실행하고 성과를 모니터링합니다.",
        goals: ["금형/양산", "런칭·판매"],
        tasks: [
          { title: "양산업체 RFQ & 발주", owner: "PM/구매" },
          { title: "패키지/라벨/매뉴얼", owner: "디자이너/MD" },
          { title: "런칭 플랜(채널/가격/프로모션)", owner: "마케터" }
        ],
        deliverables: ["PO·생산일정", "패키지 파일", "런칭 캘린더", "커머스 세팅"]
      }
    },

    experts_to_meet: [
      { role: "제품 디자이너", why: "모양·사용 편의·재질(색/표면)을 함께 결정합니다." },
      { role: "엔지니어(구조/전자)", why: "부품 선정과 내부 구조를 안전하게 설계합니다." },
      { role: "양산업체/금형사", why: "만들 수 있는 방법과 비용을 현실적으로 맞춥니다." },
      { role: "마케터/MD", why: "누가 왜 사는지, 가격·채널·메시지를 정리합니다." },
      { role: "인증 대행", why: "필요한 인증 절차와 위험을 미리 확인합니다." }
    ],

    expert_reviews: {
      pm: {
        risks: ["수요 검증 부족", "부품 리드타임 변동"],
        asks: ["MVP 범위 확정", "리스크 레지스터 운영"],
        checklist: ["PRD v1", "위험 목록/담당자/대응 계획"]
      },
      designer: {
        risks: ["착용/그립 불안정", "사용자 기대와 미스핏"],
        asks: ["핵심 시나리오 프로토타입 테스트", "CMF 샘플 피드백"],
        checklist: ["핵심 플로우 맵", "인체/안전 기준 반영"]
      },
      engineer: {
        risks: ["열/소음/배터리", "부품 EOL(단종)"],
        asks: ["예비 인증 문의", "BOM v1 작성/DFM 고려"],
        checklist: ["DFM 점검표", "규격 매핑표"]
      },
      marketer: {
        risks: ["차별성 커뮤니케이션 난이도", "가격 저항"],
        asks: ["포지셔닝 A/B 테스트", "채널 실험(광고 소액)"],
        checklist: ["런칭 메시지", "채널별 마진 구조"]
      }
    },

    // 마지막: 비주얼 RFP(요약 카드)
    visual_rfp: {
      project_title: idea.slice(0, 30) || "프로젝트",
      background: "왜 이 제품이 필요한지 배경을 설명합니다.",
      objective: "디자인/사업 목표를 한 줄로 요약합니다.",
      target_users: "핵심 타겟 정의",
      core_requirements: ["핵심 요구 1", "핵심 요구 2", "핵심 요구 3"],
      design_direction: "형태/재질/톤앤매너 요약",
      deliverables: ["컨셉 보드", "3D 렌더", "생산 문서"]
    }
  };
}

/** ─────────────────────────────────────────────────────────
 *  API Route
 *  ───────────────────────────────────────────────────────── */
export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    if (!idea || typeof idea !== "string") {
      return new Response(JSON.stringify({ error: "아이디어가 비어 있습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1) OpenAI 경로 (키가 있고 쿼터가 남아있다면)
    if (client) {
      try {
        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "AideeRfp",
              schema: AIDEE_RFP_SCHEMA,
              strict: true
            }
          },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                `제품 아이디어: "${idea}"에 대해 위 JSON 스키마를 엄격히 준수하여 반환하세요. ` +
                `추가 텍스트 없이 JSON만 응답하세요.`
            }
          ]
        });

        const content = completion.choices[0].message.content;
        if (!content) throw new Error("모델 응답이 비어 있습니다.");

        let parsed = JSON.parse(content);
        parsed = fillDefaults(parsed, idea);

        return new Response(JSON.stringify(parsed), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("OpenAI 호출 실패 → MOCK 대체:", (err as any)?.message || err);
        // 아래 MOCK으로 폴백
      }
    }

    // 2) MOCK 경로
    const mock = mockData(idea);
    return new Response(JSON.stringify(mock), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("최종 서버 오류:", err);
    return new Response(
      JSON.stringify({
        error: "서버 에러가 발생했습니다.",
        detail: err?.message || String(err)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
