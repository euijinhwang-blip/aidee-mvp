// app/api/design-images/route.ts
import { NextResponse } from "next/server";

const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

// RFP 타입이 너무 길어서 여기서는 any로 받아요.
// (이미 app/page.tsx 안에서는 타입이 잘 잡혀 있으니 괜찮습니다.)
export async function POST(req: Request) {
  try {
    if (!TOGETHER_API_KEY) {
      return NextResponse.json(
        { error: "TOGETHER_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const rfp = body?.rfp;

    if (!rfp || !rfp.visual_rfp) {
      return NextResponse.json(
        { error: "유효한 RFP 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const v = rfp.visual_rfp;
    const conceptSummary = rfp.concept_and_references?.concept_summary ?? "";
    const featureNames = (rfp.key_features || [])
      .map((f: any) => f.name)
      .join(", ");

    // 제품 디자인에 맞춘 프롬프트 생성
    const prompt = [
      `Industrial product design render of "${v.project_title || "a new product"}".`,
      v.target_users ? `Target users: ${v.target_users}.` : "",
      featureNames ? `Key features: ${featureNames}.` : "",
      v.design_direction ? `Design direction: ${v.design_direction}.` : "",
      conceptSummary ? `Concept: ${conceptSummary}.` : "",
      // 스타일 가이드(원하면 여기 취향대로 계속 다듬어도 됨)
      "High-end studio lighting, soft shadows, 3D render, clean white or light grey background, minimalistic, realistic materials, product shot."
    ]
      .filter(Boolean)
      .join(" ");

    const togetherRes = await fetch(
      "https://api.together.xyz/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-krea-dev",
          prompt,
          width: 1024,
          height: 768,
          steps: 28,
          n: 2, // 1~2장만 생성
          response_format: "url",
        }),
      }
    );

    const data = await togetherRes.json();

    if (!togetherRes.ok) {
      console.error("Together 이미지 생성 실패:", data);
      return NextResponse.json(
        {
          error: "이미지 생성 실패",
          detail: data?.error || data,
        },
        { status: 500 }
      );
    }

    const urls = (data?.data || [])
      .map((d: any) => d.url)
      .filter((u: string) => !!u);

    return NextResponse.json({ images: urls });
  } catch (err: any) {
    console.error("design-images route error:", err);
    return NextResponse.json(
      {
        error: "서버 에러가 발생했습니다.",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
