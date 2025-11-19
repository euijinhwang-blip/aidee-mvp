// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TOGETHER_URL = "https://api.together.xyz/v1/images/generations";
// ✅ -Free 제거: 현재 Together에서 권장하는 모델 이름
const MODEL_NAME = "black-forest-labs/FLUX.1-schnell";

// ─────────────────────────────────────────────
// metrics 테이블에 기록 (type / count / meta)
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
    // supabase 설정 문제로 실패하더라도 메인 기능은 막지 않기
    console.error("[Supabase] unexpected insert error:", e);
  }
}

// ─────────────────────────────────────────────
// RFP에서 제품 설명 텍스트 추출
//  - 목표설정/문제정의(summary + details) 기준
//  - 너무 길면 앞부분만 사용
// ─────────────────────────────────────────────
function extractProblemSnippet(rfp: any): string {
  const summary = (rfp?.target_and_problem?.summary ?? "").trim();
  const details = (rfp?.target_and_problem?.details ?? "").trim();
  let combined = [summary, details].filter(Boolean).join(" ");

  if (!combined) return "";

  // 너무 길면 앞부분만 사용 (모델이 핵심만 잡도록)
  const MAX_LEN = 220;
  if (combined.length > MAX_LEN) {
    combined = combined.slice(0, MAX_LEN) + "...";
  }
  return combined;
}

// ─────────────────────────────────────────────
// 최종 제품 디자인용 프롬프트 생성
//  - 사람/배경이 아니라 "제품 렌더" 쪽으로 강하게 유도
// ─────────────────────────────────────────────
function buildDesignPrompt(idea: string, rfp: any): string {
  const problem = extractProblemSnippet(rfp);

  // 프로젝트명에서 대략적인 카테고리 추정 (없으면 device)
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
    // 1) 이건 제품 렌더다
    `High-quality industrial ${category} design render, 3D product visualization, studio lighting, clean background.`,
    // 2) 아이디어 한 줄
    idea && `Product idea: ${idea}`,
    // 3) 어떤 문제를 해결하는지 (RFP 기반)
    problem && `The product is designed to solve the following problem: ${problem}`,
    // 4) 네거티브 가이드
    "Focus only on the product itself, isolated object shot.",
    "No people, no human body, no faces, no hands, no crowd, no environment scene.",
    "No text, no UI screenshot, no logo, no watermark.",
    "Plain neutral background, centered product, photorealistic materials, detailed industrial design concept.",
  ].filter(Boolean);

  return lines.join(" ");
}

// ─────────────────────────────────────────────
// POST /api/design-images
//  - body: { idea: string, rfp: any }
//  - response: { images: string[] } (data:image/png;base64,...)
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) {
      console.error("[design-images] TOGETHER_API_KEY is missing");
      return NextResponse.json(
        { error: "TOGETHER_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;

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

    // ✅ 제품 중심 프롬프트 생성
    const prompt = buildDesignPrompt(idea, rfp);

    // Together 이미지 생성 요청
    const response = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,
        width: 1024,
        height: 1024,
        steps: 6,
        n: 2, // 2장 정도만
        response_format: "b64_json",
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      // Together에서 내려준 에러를 최대한 짧은 메시지로 정리
      const message =
        json?.error?.message ||
        json?.error ||
        json?.detail ||
        `이미지 생성 API 호출 실패 (status ${response.status})`;

      console.error("[design-images] Together error:", json);

      return NextResponse.json(
        {
          error: message,
        },
        { status: 500 }
      );
    }

    const images: string[] = [];

    // 1) { output: ["data:image/png;base64,...", ...] } 형식
    if (Array.isArray(json.output)) {
      for (const item of json.output) {
        if (typeof item === "string") {
          if (item.startsWith("data:image")) {
            images.push(item);
          } else {
            images.push(`data:image/png;base64,${item}`);
          }
        } else if (item?.image_base64) {
          images.push(`data:image/png;base64,${item.image_base64}`);
        }
      }
    }

    // 2) { data: [{ b64_json: "..." }, ...] } 형식
    if (!images.length && Array.isArray(json.data)) {
      for (const d of json.data) {
        if (d?.b64_json) {
          images.push(`data:image/png;base64,${d.b64_json}`);
        }
      }
    }

    if (!images.length) {
      console.error("[design-images] Unexpected response format:", json);
      return NextResponse.json(
        {
          error: "이미지 URL을 받지 못했습니다.",
        },
        { status: 500 }
      );
    }

    // ✅ 메트릭 기록 (Supabase 실패해도 메인 응답에는 영향 없음)
    await logMetric(
      "design",
      {
        model: "flux-1-krea", // 이미 메트릭에서 사용 중인 이름 유지
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
