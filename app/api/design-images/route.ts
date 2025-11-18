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

    // RFP 타입은 지금 page.tsx 에서 쓰던 걸 그대로 가져왔다고 가정
type Phase = { goals: string[]; tasks: { title: string; owner: string }[]; deliverables: string[] };
type ExpertPack = { risks: string[]; asks: string[]; checklist: string[] };
type RFP = {
  target_and_problem?: { summary: string; details: string };
  key_features?: { name: string; description: string }[];
  differentiation?: { point: string; strategy: string }[];
  concept_and_references?: { concept_summary: string; reference_keywords: string[] };
  visual_rfp?: {
    project_title?: string;
    background?: string;
    objective?: string;
    target_users?: string;
    core_requirements?: string[];
    design_direction?: string;
    deliverables?: string[];
  };
};

function buildDesignPrompts(idea: string, rfp: RFP | null) {
  const title =
    rfp?.visual_rfp?.project_title?.trim() ||
    rfp?.target_and_problem?.summary?.trim() ||
    idea;

  const targetUsers =
    rfp?.visual_rfp?.target_users ||
    "campers and outdoor enthusiasts";

  const keyFeatures = (rfp?.key_features || [])
    .map((f) => f.name)
    .filter(Boolean)
    .join(", ");

  const featureDetails = (rfp?.key_features || [])
    .map((f) => `${f.name}: ${f.description}`)
    .join("; ");

  const requirements = (rfp?.visual_rfp?.core_requirements || []).join(", ");
  const diffPoints = (rfp?.differentiation || [])
    .map((d) => d.point)
    .join(", ");

  const designDirection = rfp?.visual_rfp?.design_direction || "";
  const context = rfp?.target_and_problem?.details || "";

  // ① 메인 스튜디오 렌더
  const mainPrompt = `
Industrial design concept render of a "smart camping chair" product called "${title}".
For target users: ${targetUsers}.
Key features: ${keyFeatures || "portable, foldable, ergonomic, durable"}.
Detailed features: ${featureDetails || "integrated smart functions for outdoor comfort"}.
Core requirements: ${requirements || "lightweight, stable, comfortable for long sitting, easy to carry"}.
Differentiation: ${diffPoints || "smarter and more comfortable than typical camping chairs"}.
Design direction: ${designDirection || "modern, minimal, high-end outdoor gear feeling"}.
Usage context: ${context}.
Single product on a neutral studio background, 3D render, product shot, no people, no text, no logo, no branding, high detail, soft studio lighting.
(Original Korean brief: ${idea})
`.trim();

  // ② 캠핑 상황에 놓인 라이프스타일 컷
  const lifestylePrompt = `
Lifestyle render of people using the "${title}" smart camping chair around a camp site.
Chair design still follows: ${keyFeatures || "portable, foldable, ergonomic, durable"}, ${requirements}.
Scene: cozy night camping, warm lights, tent and small table, focus on the chair design and how it is used.
Photorealistic outdoor lighting, cinematic, high detail, minimal distraction from the chair design.
(Original Korean brief: ${idea})
`.trim();

  return { mainPrompt, lifestylePrompt };
}

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

   const { mainPrompt } = buildDesignPrompts(idea, rfp);

const response = await fetch("https://your-image-api-endpoint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.KREA_API_KEY}`,
  },
  body: JSON.stringify({
    prompt: mainPrompt,
    n: 2, // 2장
    // other options...
  }),
});


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
