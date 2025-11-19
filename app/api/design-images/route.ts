// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const TOGETHER_URL = "https://api.together.xyz/v1/images/generations";
const MODEL_NAME = "black-forest-labs/FLUX.1-schnell-Free";

// metrics 테이블에 기록 (type / count / meta)
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
    console.error("[Supabase] metrics unexpected error:", e);
  }
}

/**
 * RFP의 "목표 설정 및 문제 정의"를 제품 설명용 텍스트로 추출
 * - 너무 길면 모델이 흐려지니 앞부분만 200자 정도 사용
 */
function extractProblemSnippet(rfp: any): string {
  const summary = (rfp?.target_and_problem?.summary ?? "").trim();
  const details = (rfp?.target_and_problem?.details ?? "").trim();

  let combined = [summary, details].filter(Boolean).join(" ");
  if (!combined) return "";

  // 너무 길면 앞부분만 사용
  if (combined.length > 200) {
    combined = combined.slice(0, 200) + "...";
  }
  return combined;
}

/**
 * 최종 제품 디자인용 프롬프트
 * - 영어로 "이건 물건이다, 사람은 나오지 마라"를 강하게 명시
 * - RFP 문제정의는 "어떤 문제를 해결하는 제품인지" 설명으로만 사용
 */
function buildProductPrompt(rfp: any): string {
  const problemSnippet = extractProblemSnippet(rfp);

  // 제품이 어떤 카테고리인지 대략 유추 (없으면 'device'로)
  // 필요하면 나중에 RFP 스키마에 category 추가해서 더 정확히 쓸 수 있음
  const roughCategory =
    rfp?.visual_rfp?.project_title?.toLowerCase().includes("wearable")
      ? "wearable device"
      : "physical product";

  const lines = [
    // 1. 이건 "제품 콘셉트 렌더"라는 걸 먼저 못 박기
    `High-quality industrial ${roughCategory} design render, 3D product visualization, studio lighting, clean background.`,
    // 2. 어떤 문제를 해결하는 제품인지 (RFP 목표/문제정의에서 온 내용)
    problemSnippet &&
      `Design a ${roughCategory} that solves the following problem: ${problemSnippet}`,
    // 3. 사람/장면을 막는 네거티브 가이드
    "Focus only on the product itself, isolated object shot.",
    "No people, no human body, no faces, no hands, no text, no logo, no UI screenshots.",
    "Plain neutral background, centered product, photorealistic materials, detailed industrial design concept.",
  ].filter(Boolean);

  return lines.join(" ");
}

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

    if (!rfp) {
      return NextResponse.json(
        { error: "RFP 데이터가 없습니다. 먼저 RFP를 생성해 주세요." },
        { status: 400 }
      );
    }

    // ✅ RFP의 '목표 설정 및 문제 정의'만 기반으로 제품 중심 프롬프트 생성
    const prompt = buildProductPrompt(rfp);

    // Together 이미지 생성 요청
    const response = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,        // 제품 디자인 전용 프롬프트
        width: 1024,
        height: 1024,
        steps: 6,
        n: 2,          // 2장 생성
        response_format: "b64_json",
        // ⚠️ Together/FLUX가 negative_prompt를 지원한다면 여기에 추가:
        // negative_prompt:
        //   "people, person, human, face, portrait, hands, crowd, text, logo, watermark",
      }),
    });

    const json = await response.json();
    if (!response.ok) {
      console.error("[design-images] Together error:", json);
      return NextResponse.json(
        { error: json?.error || "이미지 생성 API 호출 실패", raw: json },
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
          raw: json,
        },
        { status: 500 }
      );
    }

    // ✅ 디자인 생성 메트릭 기록
    await logMetric(
      "design",
      {
        model: "flux-1-krea",
        rfpId: rfp?.id ?? null,
        idea: idea ?? null,
        promptSource: "target_problem_product_prompt",
      },
      images.length
    );

    return NextResponse.json({ images }, { status: 200 });
  } catch (err: any) {
    console.error("[design-images] Unexpected error:", err);
    return NextResponse.json(
      {
        error: "디자인 시안 생성 중 서버 에러가 발생했습니다.",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
