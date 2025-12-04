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
//  - 목표 설정 & 문제 정의(summary + details)
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
// 최종 이미지 프롬프트 생성
//  - 사람/배경보다 '제품'에 포커스
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
// DALL·E (OpenAI) - 브랜딩 / Key visual 용
//  - provider: "dalle"
//  - env: OPENAI_API_KEY
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
// Stable Diffusion (Stability AI) - 컨셉 스케치 / 일러스트
//  - provider: "stability"
//  - env: STABILITY_API_KEY
// ─────────────────────────────────────────────
async function generateWithStability(
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
// Meshi AI Text-to-3D Preview - 제품처럼 보이는 3D 렌더 썸네일
//  - provider: "meshy"
//  - env: MESHY_API_KEY
//  - 내부적으로 3D 모델 생성 후 thumbnail_url을 이미지로 사용
// ─────────────────────────────────────────────
async function generateWithMeshy(prompt: string): Promise<string[]> {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    throw new Error("MESHY_API_KEY 환경변수가 없습니다.");
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
    throw new Error(
      createJson?.error ||
        createJson?.message ||
        `Meshy preview task 생성 실패 (status ${createRes.status})`
    );
  }

  const taskId: string | undefined = createJson?.result;
  if (!taskId) {
    throw new Error("Meshy preview task id를 받지 못했습니다.");
  }

  // 2) task 완료까지 폴링 (최대 ~60초)
  const start = Date.now();
  const TIMEOUT_MS = 60_000;
  const INTERVAL_MS = 3_000;

  while (true) {
    if (Date.now() - start > TIMEOUT_MS) {
      throw new Error("Meshy 작업이 제한 시간 내에 완료되지 않았습니다.");
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
      throw new Error(
        statusJson?.error ||
          statusJson?.message ||
          `Meshy status 조회 실패 (status ${statusRes.status})`
      );
    }

    const status = statusJson?.status;
    if (status === "SUCCEEDED") {
      const thumb: string | undefined = statusJson?.thumbnail_url;
      if (!thumb) {
        throw new Error("Meshy 응답에 thumbnail_url이 없습니다.");
      }
      // 썸네일 URL 하나를 이미지로 반환
      return [thumb];
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        `Meshy 작업 실패 (status=${status}, message=${
          statusJson?.task_error?.message ?? ""
        })`
      );
    }

    // 아직 PENDING / RUNNING → 잠깐 대기 후 재시도
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

// ─────────────────────────────────────────────
// POST /api/design-images
//  - body:
//    {
//      idea: string,
//      rfp: any,
//      provider?: "meshy" | "stability" | "dalle"   // 선택
//    }
//  - response: { images: string[] }
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;

    type Provider = "meshy" | "stability" | "dalle";

    const provider: Provider =
      (body?.provider as Provider | undefined) ?? "meshy"; // 기본은 Meshi(제품 렌더)

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

    // 메트릭용: 공급자(dalle/stability/meshy) + 실제 모델명
    let providerName: Provider = provider;
    let modelName = "";

    if (provider === "dalle") {
      images = await generateWithDalle(prompt, 2);
      providerName = "dalle";
      modelName = "gpt-image-1";
    } else if (provider === "stability") {
      images = await generateWithStability(prompt, 2);
      providerName = "stability";
      modelName = "stable-diffusion-xl-1024-v1-0";
    } else {
      // 기본: Meshi 3D 프리뷰 썸네일
      images = await generateWithMeshy(prompt);
      providerName = "meshy";
      modelName = "text-to-3d-preview";
    }

    // 메트릭 기록
    await logMetric(
      "design",
      {
        provider: providerName,
        model: modelName,
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
