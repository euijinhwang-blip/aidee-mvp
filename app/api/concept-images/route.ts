// app/api/concept-images/route.ts
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// Stable Diffusion XL 호출 (컨셉 / 비주얼 방향)
//  - samples 최대 10장으로 제한
// ─────────────────────────────────────────────
async function generateWithStabilityConcept(
  prompt: string,
  n: number
): Promise<string[]> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY 환경변수가 없습니다.");
  }

  const url =
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

  // ✅ Stability 쪽 제약: samples <= 10
  const samples = Math.min(Math.max(n || 1, 1), 10);

  const body = {
    steps: 30,
    width: 1024,
    height: 1024, // 정사각형
    cfg_scale: 7,
    samples, // ← 여기서 항상 1~10 사이 값만 사용
    text_prompts: [
      { text: prompt, weight: 1 },
      {
        text: "blurry, bad quality, low resolution, text, logo, watermark, human, people, body, face, hands",
        weight: -1,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("[Stability] error:", json);
    throw new Error(
      json?.message ||
        json?.error ||
        `Stable Diffusion 생성 실패 (status ${res.status})`
    );
  }

  const images: string[] = [];
  if (Array.isArray(json.artifacts)) {
    for (const art of json.artifacts) {
      if (art?.base64) {
        images.push(`data:image/png;base64,${art.base64}`);
      }
    }
  }

  if (!images.length) {
    throw new Error("Stable Diffusion에서 이미지 데이터를 받지 못했습니다.");
  }

  return images;
}

// ─────────────────────────────────────────────
// RFP(한글) → Stable Diffusion용 영어 프롬프트 생성
// ─────────────────────────────────────────────
async function buildEnglishConceptPrompt(options: {
  rfp: any;
  userNotesText?: string;
  visualCategories?: string[];
}): Promise<string> {
  const { rfp, userNotesText, visualCategories } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 없습니다.");
  }

  const title: string = rfp?.visual_rfp?.project_title ?? "";
  const background: string = rfp?.visual_rfp?.background ?? "";
  const objective: string = rfp?.visual_rfp?.objective ?? "";
  const targetUsers: string = rfp?.visual_rfp?.target_users ?? "";
  const conceptSummary: string =
    rfp?.concept_and_references?.concept_summary ?? "";
  const keywords: string = (rfp?.concept_and_references?.reference_keywords ?? [])
    .join(", ");

  const categoriesText =
    visualCategories && visualCategories.length > 0
      ? visualCategories.join(", ")
      : "color/tone, form/style, space/environment, similar products";

  const contextKorean = [
    title && `프로젝트명: ${title}`,
    background && `배경: ${background}`,
    objective && `목표: ${objective}`,
    targetUsers && `타겟 사용자: ${targetUsers}`,
    conceptSummary && `컨셉 요약: ${conceptSummary}`,
    keywords && `레퍼런스 키워드: ${keywords}`,
    `비주얼 카테고리: ${categoriesText}`,
    userNotesText && `추가 메모: ${userNotesText}`,
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You write rich but concise English prompts for Stable Diffusion XL to create product concept reference images. " +
            "Summarize and translate the given Korean description into ONE English paragraph (around 60–120 tokens). " +
            "Describe product type, overall concept, color & tone, form/style, and space/environment if mentioned. " +
            "Do NOT include any Korean in the output.",
        },
        {
          role: "user",
          content: contextKorean,
        },
      ],
      temperature: 0.7,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[OpenAI] buildEnglishConceptPrompt error:", json);
    throw new Error(
      json?.error?.message ||
        "컨셉용 영어 프롬프트 생성에 실패했습니다."
    );
  }

  const text: string | undefined =
    json.choices?.[0]?.message?.content?.trim() || undefined;

  if (!text) {
    throw new Error("컨셉용 영어 프롬프트가 비어 있습니다.");
  }

  return text;
}

// ─────────────────────────────────────────────
// POST /api/concept-images
// body: { rfp, userNotesText?, visualCategories? }
// 응답: { images: string[], conceptPrompt: string }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rfp = body?.rfp;
    const userNotesText: string | undefined = body?.userNotesText;
    const visualCategories: string[] | undefined = body?.visualCategories;

    if (!rfp) {
      return NextResponse.json(
        { error: "RFP 데이터가 없습니다. 먼저 RFP를 생성해 주세요." },
        { status: 400 }
      );
    }

    // 1) RFP를 기반으로 영어 프롬프트 생성
    const englishPrompt = await buildEnglishConceptPrompt({
      rfp,
      userNotesText,
      visualCategories,
    });

    // 2) Stable Diffusion XL로 컨셉 이미지 생성
    //    여기서 원하는 개수를 넘겨도 내부에서 최대 10장으로 제한됨
    const desiredCount = 18; // UI는 최대 18개까지 사용 (하지만 실제 생성은 최대 10장)
    const images = await generateWithStabilityConcept(englishPrompt, desiredCount);

    return NextResponse.json(
      {
        images,
        conceptPrompt: englishPrompt,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[concept-images] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          err?.error ||
          err?.detail ||
          "컨셉 이미지 생성 중 서버 에러가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
