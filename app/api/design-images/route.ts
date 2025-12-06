// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import OpenAI from "openai";

// ─────────────────────────────────────────────
// OpenAI 클라이언트 (번역용)
// ─────────────────────────────────────────────
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ─────────────────────────────────────────────
// 공통: metrics 기록
// ─────────────────────────────────────────────
async function logMetric(
  type: string,
  meta: Record<string, any> = {},
  count: number = 1
) {
  try {
    const { error } = await supabase.from("metrics").insert({
      type,
      count,
      meta,
    });
    if (error) {
      console.error("[Supabase] metrics insert error:", error);
    }
  } catch (e) {
    console.error("[Supabase] unexpected insert error:", e);
  }
}

// ─────────────────────────────────────────────
// 간단 번역 헬퍼: 한글 → 영어
//  - Stable Diffusion 프롬프트용
// ─────────────────────────────────────────────
async function translateToEnglish(text: string): Promise<string> {
  if (!openai) return text;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator from Korean to natural, concise English.",
        },
        {
          role: "user",
          content: `다음 문장을 자연스럽고 간결한 영어로 번역해 주세요:\n\n${text}`,
        },
      ],
    });
    const out = completion.choices[0].message.content;
    return out || text;
  } catch (err) {
    console.error("[translateToEnglish] error:", err);
    return text;
  }
}

// ─────────────────────────────────────────────
// RFP 텍스트에서 제품 설명 스니펫 추출
// ─────────────────────────────────────────────
function extractProblemSnippet(rfp: any): string {
  const summary = (rfp?.target_and_problem?.summary ?? "").trim();
  const details = (rfp?.target_and_problem?.details ?? "").trim();
  let combined = [summary, details].filter(Boolean).join(" ");

  if (!combined) return "";

  const MAX_LEN = 220;
  if (combined.length > MAX_LEN) {
    combined = combined.slice(0, MAX_LEN) + "...";
  }
  return combined;
}

// ─────────────────────────────────────────────
// 최종 이미지 프롬프트 생성 (제품 중심)
// ─────────────────────────────────────────────
function buildDesignPrompt(idea: string, rfp: any): string {
  const problem = extractProblemSnippet(rfp);

  const title: string = rfp?.visual_rfp?.project_title ?? "";
  const lowerTitle = title.toLowerCase();

  let category = "physical product";
  if (lowerTitle.includes("wearable") || lowerTitle.includes("band")) {
    category = "wearable device";
  } else if (lowerTitle.includes("chair") || lowerTitle.includes("의자")) {
    category = "chair";
  } else if (lowerTitle.includes("lamp") || lowerTitle.includes("조명")) {
    category = "lighting product";
  }

  const lines = [
    `High-quality industrial ${category} design, 3D product visualization, studio lighting, clean background.`,
    idea && `Product idea: ${idea}`,
    problem && `The product is designed to solve: ${problem}`,
    "Focus only on the product itself, isolated object shot.",
    "No people, no human body, no faces, no hands.",
    "No text, no UI screenshot, no logo, no watermark.",
    "Plain neutral background, centered product, photorealistic materials, detailed industrial design concept.",
  ].filter(Boolean);

  return lines.join(" ");
}

// ─────────────────────────────────────────────
// DALL·E (브랜딩 / 3D 렌더 느낌)
//  - provider: 'dalle'
// ─────────────────────────────────────────────
async function generateWithDalle(prompt: string, n: number): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 없습니다.");
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[DALL·E] error:", json);
    throw new Error(
      json?.error?.message ||
        json?.error ||
        `DALL·E 생성 실패 (status ${res.status})`
    );
  }

  const images: string[] = [];
  if (Array.isArray(json.data)) {
    for (const d of json.data) {
      if (d?.b64_json) {
        images.push(`data:image/png;base64,${d.b64_json}`);
      }
    }
  }

  if (!images.length) {
    throw new Error("DALL·E에서 이미지 데이터를 받지 못했습니다.");
  }

  return images;
}

// ─────────────────────────────────────────────
// Stable Diffusion (컨셉 스케치 / 일러스트)
//  - provider: 'stability'
// ─────────────────────────────────────────────
async function generateWithStability(
  prompt: string,
  n: number
): Promise<string[]> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY 환경변수가 없습니다.");
  }

  const englishPrompt = await translateToEnglish(prompt);

  const url =
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

  const body = {
    steps: 30,
    width: 1024,
    height: 1024,
    cfg_scale: 7,
    samples: n,
    text_prompts: [
      { text: englishPrompt, weight: 1 },
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

// 사용할 수 있는 provider 타입
type Provider = "dalle" | "stability";

// ─────────────────────────────────────────────
// POST /api/design-images
//  - body: { idea, rfp, provider?: "dalle" | "stability" }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;
    const provider: Provider =
      (body?.provider as Provider | undefined) ?? "dalle";

    if (!idea || typeof idea !== "string") {
      return NextResponse.json(
        { error: "아이디어가 비어 있습니다." },
        { status: 400 }
      );
    }

    if (!rfp) {
      return NextResponse.json(
        { error: "RFP 데이터가 없습니다. 먼저 RFP를 생성해 주세요." },
        { status: 400 }
      );
    }

    const prompt = buildDesignPrompt(idea, rfp);

    let images: string[] = [];
    let providerName: string = provider;

    if (provider === "dalle") {
      images = await generateWithDalle(prompt, 2);
      providerName = "dalle_gpt-image-1";
    } else {
      images = await generateWithStability(prompt, 2);
      providerName = "stability_sdxl";
    }

    await logMetric(
      "design",
      {
        provider: providerName,
        rfpId: rfp?.id ?? null,
        idea,
        promptSource: "rfp_target_problem_product_prompt",
      },
      images.length
    );

    return NextResponse.json({ images }, { status: 200 });
  } catch (err: any) {
    console.error("[design-images] Unexpected error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          err?.error ||
          err?.detail ||
          "디자인 시안 생성 중 서버 에러가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
