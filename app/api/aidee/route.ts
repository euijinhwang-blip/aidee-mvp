import OpenAI from "openai";

export const runtime = "nodejs"; // or "edge" 가능. 필요 없으면 지워도 됨.

// OPENAI_API_KEY가 있으면 실제 API 사용, 없거나 에러면 MOCK 사용
const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export async function POST(req: Request) {
  try {
    const { idea } = await req.json();

    if (!idea || typeof idea !== "string") {
      return new Response(JSON.stringify({ error: "아이디어가 비어 있습니다." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1) OpenAI API 시도
    if (client) {
      try {
        const systemPrompt = `
당신은 제품 디자인과 사업화 경험이 있는 시니어 컨설턴트입니다.
사용자의 아이디어를 기반으로 아래 JSON만 정확히 반환하세요. (설명문/코드블록 금지)

{
  "target_and_problem": {
    "summary": "한 줄 요약",
    "details": "맥락과 인사이트를 포함한 상세 설명"
  },
  "key_features": [{ "name": "기능 이름", "description": "설명" }],
  "differentiation": [{ "point": "차별 포인트", "strategy": "구체 전략" }],
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
  "double_diamond": {
    "overall_budget_time": {
      "total_budget_krw": "예: 약 3천만~5천만원",
      "total_time_weeks": "예: 약 10~16주",
      "ratio": { "discover": "20%", "define": "20%", "develop": "40%", "deliver": "20%" },
      "notes": "예산/기간은 팀 규모, 난이도, 인증 여부에 따라 달라질 수 있음"
    },
    "purpose_notes": {
      "discover": "문제와 사용자를 넓게 탐색해 기회와 위험을 파악하는 단계",
      "define":   "가설을 좁혀 구체 요구사항/성능/원가 경계(가드레일)를 확정하는 단계",
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
      "risks": ["시장 검증 부족", "부품 리드타임 불확실성"],
      "asks": ["MVP 범위 확정", "주요 리스크 등록"],
      "checklist": ["PRD v1", "리스크 레지스터"]
    },
    "designer": {
      "risks": ["착용 흔들림", "페르소나 미스핏"],
      "asks": ["핵심 사용 시나리오 검증", "CMF 샘플링"],
      "checklist": ["핵심 사용자 플로우", "인체 기준치 반영"]
    },
    "engineer": {
      "risks": ["열/소음/배터리", "부품 EOL"],
      "asks": ["예비 인증 문의", "BOM v1 작성"],
      "checklist": ["DFM 점검", "안전 규격 매핑"]
    },
    "marketer": {
      "risks": ["차별성 커뮤니케이션 난이도", "가격 저항"],
      "asks": ["포지셔닝 A/B", "채널 테스트"],
      "checklist": ["런칭 메시지", "채널별 마진 구조"]
    }
  }
}
        `.trim();

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `제품 아이디어: "${idea}"에 대해 위 JSON 형식을 따라 작성해 주세요.` },
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
        console.error("OpenAI 호출 실패, MOCK 데이터로 대체:", err?.message || err);
        // 아래 MOCK으로 폴백
      }
    }

    // 2) MOCK 응답 (쿼터 초과/키 없음/에러 시)
    const mock = {
      target_and_problem: {
        summary: "야외 러너의 호흡 건강과 쾌적한 러닝 환경 확보",
        details:
          "도시 러너는 미세먼지/배기가스/꽃가루 등에 노출된다. 휴대성과 착용성을 갖춘 미니 공기청정 웨어러블은 " +
          "실질적·심리적 안전감을 제공한다.",
      },
      key_features: [
        { name: "러닝 최적화 공기 정화 모듈", description: "호흡 방해 최소화, 경량 설계" },
        { name: "착용감 중심 폼팩터", description: "흔들림/압박 최소 구조(넥밴드/체스트 등)" },
        { name: "실시간 공기질 피드백", description: "LED/앱 연동 상태 표시" },
        { name: "생활 방수/내구성", description: "땀/비/야간 환경 대응" },
      ],
      differentiation: [
        { point: "러닝 특화", strategy: "운동 중 호흡/무게/움직임 기준 최적화" },
        { point: "스타일+퍼포먼스", strategy: "스포츠웨어와 어울리는 디자인 언어" },
        { point: "심리적 안전감", strategy: "공기질 시각화로 통제감 제공" },
      ],
      concept_and_references: {
        concept_summary: "도시 러너를 위한 개인용 클린에어 버블.",
        reference_keywords: [
          "running wearable device",
          "neckband air purifier",
          "minimal sport tech",
          "urban night runner",
          "LED indicator sports gear",
        ],
      },
      visual_rfp: {
        project_title: "야외 러너용 미니 공기청정 웨어러블 디자인",
        background: "도시 러닝 증가와 공기 오염 이슈 동시 증가",
        objective: "착용 부담 최소+실질 정화+심리적 안심 제공",
        target_users: "도시권 20–40대 러너",
        core_requirements: ["경량/안정 착용", "필터링 성능", "야간 시인성", "필터 교체/충전", "웨어와 매칭"],
        design_direction: "슬림/유선형, 블랙·그레이 기반 포인트 컬러",
        deliverables: ["컨셉보드", "3D 렌더", "치수/구조 다이어그램", "LED/UI 플로우", "네이밍안"],
      },
      double_diamond: {
        overall_budget_time: {
          total_budget_krw: "약 3천만~5천만원",
          total_time_weeks: "약 10~16주",
          ratio: { discover: "20%", define: "20%", develop: "40%", deliver: "20%" },
          notes: "하드웨어 난이도/인증 유무/양산 수량에 따라 달라질 수 있음",
        },
        purpose_notes: {
          discover: "문제와 사용자를 넓게 탐색해 기회/위험 파악",
          define: "요구사항/성능/원가 경계를 확정",
          develop: "설계·시작품·인증·양산 준비로 실현 가능성 검증",
          deliver: "양산/패키지/마케팅/판매로 출시 완성",
        },
        discover: {
          goals: ["문제/사용자 맥락 파악", "경쟁/대체재 파악"],
          tasks: [
            { title: "러닝 크루 5명 인터뷰", owner: "PM/리서처" },
            { title: "경쟁 제품 스캔", owner: "PM/디자이너" },
          ],
          deliverables: ["인사이트 메모", "경쟁 포지션 맵"],
        },
        define: {
          goals: ["요구사항 고정", "성능/원가 가드레일"],
          tasks: [
            { title: "PRD/요구사항 매트릭스", owner: "PM" },
            { title: "핵심 성능 지표 합의", owner: "엔지니어/디자이너" },
          ],
          deliverables: ["PRD v1", "요구사항 매트릭스"],
        },
        develop: {
          goals: ["설계/시작품", "인증·양산 준비"],
          tasks: [
            { title: "구조설계·부품 선정(BOM v1)", owner: "엔지니어" },
            { title: "3D/CMF 목업", owner: "디자이너" },
            { title: "인증 사전 검토", owner: "PM/엔지니어" },
          ],
          deliverables: ["3D STEP", "BOM v1", "목업 사진", "인증 체크리스트"],
        },
        deliver: {
          goals: ["양산·런칭·판매"],
          tasks: [
            { title: "금형/양산업체 RFQ·발주", owner: "PM/구매" },
            { title: "패키지/라벨/매뉴얼", owner: "디자이너/MD" },
            { title: "런칭 플랜(채널/가격/프로모션)", owner: "마케터" },
          ],
          deliverables: ["PO·생산일정", "패키지 파일", "런칭 캘린더", "커머스 세팅"],
        },
      },
      experts_to_meet: [
        { role: "제품 디자이너", why: "형태/사용성·CMF 결정" },
        { role: "엔지니어(구조/전자)", why: "부품·BOM·안전성" },
        { role: "양산업체/금형사", why: "DFM/원가·납기" },
        { role: "마케터/MD", why: "채널 전략/가격/콘텐츠" },
        { role: "인증 대행", why: "필요 인증 경로 안내" },
      ],
      expert_reviews: {
        pm: {
          risks: ["시장/수요 검증 부족", "부품 리드타임 변수"],
          asks: ["MVP 범위 합의", "리스크 레지스터 작성"],
          checklist: ["PRD v1", "리스크 레지스터"],
        },
        designer: {
          risks: ["착용 흔들림", "페르소나 미스핏"],
          asks: ["핵심 시나리오 검증", "CMF 샘플 선정"],
          checklist: ["사용자 플로우", "인체 기준치 반영"],
        },
        engineer: {
          risks: ["열/소음/배터리", "부품 EOL"],
          asks: ["예비 인증 문의", "BOM v1 작성"],
          checklist: ["DFM 점검", "안전 규격 매핑"],
        },
        marketer: {
          risks: ["차별성 커뮤니케이션 난이도", "가격 저항"],
          asks: ["포지셔닝 A/B", "채널 테스트"],
          checklist: ["런칭 메시지", "채널별 마진 구조"],
        },
      },
    };

    return new Response(JSON.stringify(mock), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("최종 서버 오류:", err);
    return new Response(
      JSON.stringify({ error: "서버 에러가 발생했습니다.", detail: err?.message || String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
