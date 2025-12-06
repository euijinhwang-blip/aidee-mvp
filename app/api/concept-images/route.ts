// app/api/concept-images/route.ts
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────
// Stable Diffusion 호출 (컨셉 / 비주얼 방향)
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

  const body = {
    steps: 30,
    width: 1024,
    height: 1024,
    cfg_scale: 7,
    samples: n,
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
// OpenAI로 한-영 변환 + SDXL용 프롬프트 생성
// ─────────────────────────────────────────────
async function buildEnglishConceptPrompt(contextKorean: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 없습니다.");
  }

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
            "You write prompts in English for Stable Diffusion XL (SDXL) product concept images. " +
            "Translate and adapt the user's description into ONE concise English prompt (max 120 tokens). " +
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
    console.error("[OpenAI] concept prompt error:", json);
    throw new Error(
      json?.error?.message || "컨셉 프롬프트(영어) 생성에 실패했습니다."
    );
  }

  const text: string | undefined =
    json.choices?.[0]?.message?.content?.trim() || undefined;
  if (!text) {
    throw new Error("컨셉 프롬프트(영어)가 비어 있습니다.");
  }

  return text;
}

// ─────────────────────────────────────────────
// POST /api/concept-images
// body: { rfp, userNotesText?, visualCategories? }
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

    const projectTitle: string = rfp?.visual_rfp?.project_title ?? "";
    const conceptSummary: string =
      rfp?.concept_and_references?.concept_summary ?? "";
    const keywords: string = (rfp?.concept_and_references?.reference_keywords ?? [])
      .join(", ");

    const categoriesText =
      visualCategories && Array.isArray(visualCategories) && visualCategories.length
        ? visualCategories.join(", ")
        : "color/tone, form/style, space/environment, similar products";

    // 한글 컨텍스트를 모아서 → OpenAI에게 영어 SDXL 프롬프트 생성 요청
    const contextKorean = [
      projectTitle && `프로젝트명: ${projectTitle}`,
      conceptSummary && `컨셉 요약: ${conceptSummary}`,
      keywords && `키워드: ${keywords}`,
      `비주얼 카테고리: ${categoriesText}`,
      userNotesText && `추가 메모: ${userNotesText}`,
      "",
      "위 정보를 바탕으로 제품 컨셉 이미지를 위한 Stable Diffusion XL 프롬프트를 만들어 주세요.",
      "결과는 영어 한 문단만 출력해 주세요.",
    ]
      .filter(Boolean)
      .join("\n");

    const englishPrompt = await buildEnglishConceptPrompt(contextKorean);

    // Stable Diffusion으로 실제 이미지 생성 (최대 18장)
    const images = await generateWithStabilityConcept(englishPrompt, 18);

    return NextResponse.json(
      {
        images,
        conceptPrompt: englishPrompt, // 프론트에서 DALL·E 프롬프트에 보조 정보로 사용
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
