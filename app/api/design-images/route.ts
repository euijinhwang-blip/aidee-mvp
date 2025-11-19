// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";

const TOGETHER_URL = "https://api.together.xyz/v1/images/generations";
const MODEL_NAME = "black-forest-labs/FLUX.1-schnell-Free";

import { supabase } from "@/lib/supabase";

async function logMetric(event_type: string, meta: any = null) {
  try {
    const { error } = await supabase
      .from("metrics")
      .insert([{ event_type, meta }]);
    if (error) {
      console.error("[Supabase] metrics insert error:", error);
    }
  } catch (e) {
    console.error("[Supabase] metrics unexpected error:", e);
  }
}

/**
 * RFP + 아이디어를 기반으로 이미지용 프롬프트 만들기
 */
function buildDesignPrompt(idea: string, rfp: any): string {
  const projectTitle = rfp?.visual_rfp?.project_title || "";
  const targetUsers = rfp?.visual_rfp?.target_users || "";
  const concept = rfp?.concept_and_references?.concept_summary || "";
  const designDir = rfp?.visual_rfp?.design_direction || "";
  const coreReq = (rfp?.visual_rfp?.core_requirements || []).join(", ");
  const keyFeatures = (rfp?.key_features || [])
    .map((f: any) => f?.name)
    .filter(Boolean)
    .join(", ");

  const lines = [
    "industrial product design, high-quality studio render, 3d product shot, realistic lighting",
    projectTitle && `product name: ${projectTitle}`,
    `product idea: ${idea}`,
    targetUsers && `target users: ${targetUsers}`,
    concept && `concept: ${concept}`,
    keyFeatures && `key features: ${keyFeatures}`,
    coreReq && `requirements: ${coreReq}`,
    designDir && `design direction: ${designDir}`,
    "plain background, no text, no logo, centered product only, high detail, cinematic lighting",
  ].filter(Boolean);

  return lines.join(". ");
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
    const idea: string = body?.idea;
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
        steps: 4,
        n: 2, // 1~2장만 생성
        response_format: "b64_json", // base64 포맷
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

    // Together 측 응답 포맷은 두 가지 가능성 처리
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
    await logMetric("design_generated", {
      count: images.length,
      model: "flux-1-krea", // 실제 사용중인 모델 이름
    });

    return NextResponse.json({ images: images });
    // 프론트에서는 data.images 배열을 그대로 <img src=...> 로 사용
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
