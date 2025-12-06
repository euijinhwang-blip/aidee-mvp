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
  if (combined.length > MAX_LEN) combined = combined.slice(0, MAX_LEN) + "...";
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
// DALL·E (브랜딩 / Key visual)
// ─────────────────────────────────────────────
async function generateWithDalle(prompt: string, n: number): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[DALL·E] Missing OPENAI_API_KEY");
    throw new Error("브랜딩용 이미지 엔진 설정이 아직 완료되지 않았습니다.");
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
      // 일부 환경에서 response_format 지원이 안 될 수 있어서 제거해도 됨
      response_format: "b64_json",
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("[DALL·E] error:", json);
    throw new Error(
      json?.error?.message ||
        json?.error ||
        "브랜딩용 이미지를 생성하는 중 문제가 발생했습니다."
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
    throw new Error("브랜딩용 이미지 데이터를 받지 못했습니다.");
  }

  return images;
}

// ─────────────────────────────────────────────
// Stable Diffusion (컨셉 스케치 / 일러스트)
// ─────────────────────────────────────────────
async function generateWithStability(
  prompt: string,
  n: number
): Promise<string[]> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    console.error("[Stability] Missing STABILITY_API_KEY");
    throw new Error("컨셉 스케치용 이미지 엔진 설정이 아직 완료되지 않았습니다.");
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
        "컨셉 스케치 이미지를 생성하는 중 문제가 발생했습니다."
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
    throw new Error("컨셉 스케치 이미지 데이터를 받지 못했습니다.");
  }

  return images;
}

// ─────────────────────────────────────────────
// Meshy 3D Preview (3D/실사 느낌 썸네일)
// ─────────────────────────────────────────────
async function generateWithMeshy(prompt: string): Promise<string[]> {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    console.error("[Meshy] Missing MESHY_API_KEY");
    throw new Error("3D/실사용 이미지 엔진 설정이 아직 완료되지 않았습니다.");
  }

  // 1) preview task 생성
  const createRes = await fetch(
    "https://api.meshy.ai/openapi/v2/text-to-3d",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "preview",
        prompt,
        art_style: "realistic",
        should_remesh: true,
      }),
    }
  );

  const createJson = await createRes.json();
  if (!createRes.ok) {
    console.error("[Meshy] create error:", createJson);
    throw new Error("3D/실사용 이미지를 준비하는 중 문제가 발생했습니다.");
  }

  const taskId: string | undefined = createJson?.result;
  if (!taskId) {
    throw new Error("3D/실사용 작업 id를 받지 못했습니다.");
  }

  // 2) status 폴링
  const start = Date.now();
  const TIMEOUT_MS = 60_000;
  const INTERVAL_MS = 3_000;

  while (true) {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error("3D/실사 작업이 제한 시간 내에 완료되지 않았습니다.");
    }

    const statusRes = await fetch(
      `https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const statusJson = await statusRes.json();
    if (!statusRes.ok) {
      console.error("[Meshy] status error:", statusJson);
      throw new Error("3D/실사 작업 상태를 불러오는 중 문제가 발생했습니다.");
    }

    const status = statusJson?.status;
    if (status === "SUCCEEDED") {
      const thumb: string | undefined = statusJson?.thumbnail_url;
      if (!thumb) {
        throw new Error("3D/실사 응답에 썸네일 이미지가 없습니다.");
      }
      return [thumb];
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        `3D/실사 작업이 실패했습니다. (status=${status})`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

// ─────────────────────────────────────────────
// POST /api/design-images
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;
    const provider =
      (body?.provider as "meshy" | "stability" | "dalle" | undefined) ??
      "meshy";

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

    // 🔧 타입을 넓게: string 으로 명시해서 어떤 문자열이든 들어갈 수 있게
    let providerName: string = provider;

    if (provider === "dalle") {
      images = await generateWithDalle(prompt, 2);
      providerName = "dalle_gpt-image-1";
    } else if (provider === "stability") {
      images = await generateWithStability(prompt, 2);
      providerName = "stability_sdxl";
    } else {
      // 기본: Meshi 3D 프리뷰 썸네일
      images = await generateWithMeshy(prompt);
      providerName = "meshy_text_to_3d_preview";
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
