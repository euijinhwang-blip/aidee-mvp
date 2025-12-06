// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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
// 최종 제품 디자인용 프롬프트
//  - 사람/배경보다 '제품'에 포커스
//  - userNotes / conceptPrompt 반영
// ─────────────────────────────────────────────
function buildDesignPrompt(
  idea: string,
  rfp: any,
  options?: { conceptPrompt?: string; userNotesText?: string }
): string {
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

  const lines: string[] = [
    `High-quality industrial ${category} design, 3D product visualization, studio lighting, clean neutral background.`,
    idea && `Product idea: ${idea}`,
    problem && `The product is designed to solve: ${problem}`,
  ];

  if (options?.conceptPrompt) {
    lines.push(
      `Visual direction: reflect the mood, color palette, and composition of the selected reference images. ${options.conceptPrompt}`
    );
  }

  if (options?.userNotesText) {
    lines.push(
      `Additional design notes from the creator (must be respected): ${options.userNotesText}`
    );
  }

  lines.push(
    "Focus only on the product itself, isolated object shot.",
    "No people, no human body, no faces, no hands.",
    "No text, no UI screenshot, no logo, no watermark."
  );

  return lines.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────
// DALL·E (OpenAI) - 3D 렌더 이미지
//  - response_format 제거 (Unknown parameter 에러 방지)
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
      // ⚠️ response_format 제거 → 기본 url 반환
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
      if (d?.url) {
        images.push(d.url);
      } else if (d?.b64_json) {
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
// Stable Diffusion (Stability AI) - 컨셉 스케치 / 비주얼 방향
//  - 허용 사이즈 중 1024x1024 사용 (에러 해결)
// ─────────────────────────────────────────────
async function generateWithStability(prompt: string, n: number): Promise<string[]> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error("STABILITY_API_KEY 환경변수가 없습니다.");
  }

  const url =
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image";

  const body = {
    steps: 30,
    width: 1024,
    height: 1024, // ✅ 768x768 → 1024x1024 로 변경
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
// POST /api/design-images
//  - body:
//    {
//      idea: string,
//      rfp: any,
//      provider: "dalle" | "stability",
//      conceptPrompt?: string,       // 선택된 컨셉 이미지 기반 문장
//      userNotesText?: string        // 카드에 사용자가 적은 메모 통합
//    }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;
    const provider: "dalle" | "stability" =
      (body?.provider as "dalle" | "stability") ?? "dalle";
    const conceptPrompt: string | undefined = body?.conceptPrompt;
    const userNotesText: string | undefined = body?.userNotesText;

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

    const prompt = buildDesignPrompt(idea, rfp, {
      conceptPrompt,
      userNotesText,
    });

    let images: string[] = [];
    let providerName: string = provider;

    if (provider === "dalle") {
      images = await generateWithDalle(prompt, 3); // 3D 렌더 3장
      providerName = "dalle_gpt-image-1";
    } else {
      images = await generateWithStability(prompt, 6); // 컨셉용
      providerName = "stability_sdxl_concept";
    }

    await logMetric(
      "design",
      {
        provider: providerName,
        rfpId: rfp?.id ?? null,
        idea,
        promptSource:
          provider === "stability"
            ? "rfp_concept_keywords"
            : "rfp_target_problem_product_prompt",
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
