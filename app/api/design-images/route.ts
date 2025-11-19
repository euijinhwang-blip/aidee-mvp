import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { idea, rfp } = await req.json();

    if (!idea || !rfp) {
      return NextResponse.json(
        { error: "idea와 rfp가 모두 필요합니다." },
        { status: 400 }
      );
    }

    const prompt = [
      "high quality industrial design render, studio lighting, soft shadows, 3d product visualization, no people.",
      `Product idea: ${idea}`,
      `Project: ${rfp.visual_rfp?.project_title}`,
      `Concept: ${rfp.concept_and_references?.concept_summary}`,
      `Key features: ${rfp.key_features?.map(f => `${f.name}: ${f.description}`).join(", ")}`,
      `Core requirements: ${rfp.visual_rfp?.core_requirements?.join(", ")}`,
      `Design direction: ${rfp.visual_rfp?.design_direction}`,
      "",
      "Focus on realistic product modeling, materials, proportions, and functional parts.",
    ]
      .filter(Boolean)
      .join("\n");

    const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY;

    if (!TOGETHER_API_KEY) {
      return NextResponse.json(
        { error: "TOGETHER_API_KEY 환경변수가 없습니다." },
        { status: 500 }
      );
    }

    const response = await fetch(
      "https://api.together.xyz/v1/images/generate",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${TOGETHER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-dev",
          prompt,
          steps: 30,
          width: 1024,
          height: 1024,
          n: 2,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "이미지 생성 실패" },
        { status: response.status }
      );
    }

    const images = data?.output?.map((img: any) => img.image_url) || [];

    return NextResponse.json({ images });
  } catch (e: any) {
    console.error("design-images error:", e);
    return NextResponse.json(
      { error: e?.message || "이미지 생성 중 오류" },
      { status: 500 }
    );
  }
}
