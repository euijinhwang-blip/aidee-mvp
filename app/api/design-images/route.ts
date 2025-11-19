// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const hasApiKey = !!process.env.OPENAI_API_KEY;
const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// 아이디어 + RFP에서 이미지용 프롬프트 뽑아내는 헬퍼
function buildDesignPrompt(idea: string, rfp: any): string {
  const parts: string[] = [];

  // 1) 기본 아이디어
  parts.push(
    `Industrial product design concept render, studio lighting, high-quality visualization.`
  );
  parts.push(`Core idea: ${idea}.`);

  // 2) RFP 요약 정보들
  if (rfp?.visual_rfp?.project_title) {
    parts.push(`Project title: ${rfp.visual_rfp.project_title}.`);
  }

  if (rfp?.target_and_problem?.summary) {
    parts.push(`Target & problem summary: ${rfp.target_and_problem.summary}.`);
  }

  if (Array.isArray(rfp?.key_features) && rfp.key_features.length > 0) {
    const feat = rfp.key_features
      .map((f: any) => `${f.name}: ${f.description}`)
      .join("; ");
    parts.push(`Key features: ${feat}.`);
  }

  if (rfp?.visual_rfp?.design_direction) {
    parts.push(
      `Design direction (form, material, CMF, overall feel): ${rfp.visual_rfp.design_direction}.`
    );
  }

  if (Array.isArray(rfp?.visual_rfp?.core_requirements)) {
    parts.push(
      `Must-have requirements: ${rfp.visual_rfp.core_requirements.join(", ")}.`
    );
  }

  // 3) 이미지 스타일 가이드 (공통)
  parts.push(
    `Render style: clean minimal product shot, neutral background, slight perspective, soft shadows, 3D rendering, highly detailed, concept art for presentation.`
  );
  parts.push(
    `Do not show text or UI mockups. Focus on the physical product itself.`
  );

  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    if (!client) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY 환경변수가 설정되어 있지 않습니다." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;

    if (!idea || !rfp) {
      return NextResponse.json(
        { error: "idea와 rfp가 모두 필요합니다." },
        { status: 400 }
      );
    }

    // 1) 프롬프트 생성
    const mainPrompt = buildDesignPrompt(idea, rfp);

    // 2) OpenAI 이미지 생성 호출
    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: mainPrompt,
      n: 2, // 1~2장 정도만
      size: "1024x1024",
    });

    // result.data 안에 url 들이 들어 있음
    const urls =
      (result as any)?.data
        ?.map((img: any) => img.url)
        .filter((u: string | null | undefined) => !!u) ?? [];

    if (!urls.length) {
      return NextResponse.json(
        { error: "이미지 URL을 받지 못했습니다.", prompt: mainPrompt },
        { status: 500 }
      );
    }

    return NextResponse.json({
      images: urls,
      prompt: mainPrompt,
    });
  } catch (err: any) {
    console.error("design-images route error:", err);
    return NextResponse.json(
      {
        error: err?.message || "이미지 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
