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
 * RFP의 "목표 설정 및 문제 정의" 텍스트만 추출
 * (summary + details 를 단순 결합)
 */
function extractTargetProblemText(rfp: any): string {
  const summary = rfp?.target_and_problem?.summary ?? "";
  const details = rfp?.target_and_problem?.details ?? "";

  const combined = [summary, details].filter(Boolean).join("\n");

  // 완전히 비어있으면 fallback
  return combined || "Product design concept";
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

    // 프론트에서 이미 idea와 rfp를 보낸다고 가정하지만,
    // 여기서는 rfp가 핵심이므로 rfp만은 반드시 필요
    if (!rfp) {
      return NextResponse.json(
        { error: "RFP 데이터가 없습니다. 먼저 RFP를 생성해 주세요." },
        { status: 400 }
      );
    }

    // ✅ RFP의 '목표 설정 및 문제 정의' 부분만 프롬프트로 사용
    const prompt = extractTargetProblemText(rfp);

    // Together 이미지 생성 요청
    const response = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,          // 여기서 오직 target_and_problem 텍스트만 사용
        width: 1024,
        height: 1024,
        steps: 4,
        n: 2,            // 1~2장만 생성
        response_format: "b64_json",
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

    // Together 응답 포맷 처리
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
        promptSource: "target_and_problem_only",
      },
      images.length
    );

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
