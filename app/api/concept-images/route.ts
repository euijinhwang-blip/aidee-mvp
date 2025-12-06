// app/api/concept-images/route.ts
import { NextRequest, NextResponse } from "next/server";

// 간단 번역: OpenAI로 한국어 컨셉 요약/키워드를 영어 문장으로 바꿈
async function translateConceptToEnglish(
  summary: string,
  keywords: string[]
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // 번역 못 하면 그냥 한글 그대로 사용
    return `${summary} / keywords: ${keywords.join(", ")}`;
  }

  const prompt = `
다음 제품/서비스의 컨셉 요약과 키워드를 보고,
Stable Diffusion용 프롬프트로 쓸 수 있는 간단한 영어 한 문장으로 바꿔 주세요.
제품 설명이 아니라 "visual style / mood / color / composition"에 초점을 맞춰 주세요.

컨셉 요약: ${summary}
키워드: ${keywords.join(", ")}
  `.trim();

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that writes short English prompts for Stable Diffusion based on product design concepts.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 120,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error("[OpenAI translate] error:", json);
    return `${summary} / keywords: ${keywords.join(", ")}`;
  }

  const content = json.choices?.[0]?.message?.content;
  return (content || `${summary} / keywords: ${keywords.join(", ")}`).trim();
}

async function generateConceptWithStability(prompt: string, n: number) {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY 환경변수가 없습니다.");
  }

  const url =
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

  const body = {
    steps: 30,
    width: 1024,
    height: 1024, // ✅ 허용된 사이즈
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
    console.error("[Stability concept] error:", json);
    throw new Error(
      json?.message ||
        json?.error ||
        `Stable Diffusion 컨셉 이미지 생성 실패 (status ${res.status})`
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
    throw new Error("Stable Diffusion에서 컨셉 이미지를 받지 못했습니다.");
  }

  return images;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rfp: any = body?.rfp;
    const userNotesText: string | undefined = body?.userNotesText;

    if (!rfp) {
      return NextResponse.json(
        { error: "RFP 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const summary = rfp?.concept_and_references?.concept_summary ?? "";
    const keywords =
      rfp?.concept_and_references?.reference_keywords ?? ([] as string[]);

    const baseText =
      (summary || "") +
      (keywords.length ? ` / keywords: ${keywords.join(", ")}` : "");

    const notes = userNotesText
      ? ` / Additional notes from creator: ${userNotesText}`
      : "";

    const englishPrompt = await translateConceptToEnglish(
      summary,
      keywords
    );

    const fullPrompt = `${englishPrompt}${notes}`;

    const images = await generateConceptWithStability(fullPrompt, 6);

    return NextResponse.json(
      {
        images,
        conceptPrompt: fullPrompt, // 이후 디자인 시안 프롬프트에 그대로 넘기기
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
