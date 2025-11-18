// app/api/design-images/route.ts
import { NextRequest, NextResponse } from "next/server";

// ====== RFP 타입 (필요한 필드만 간단히) ======
type Phase = {
  goals: string[];
  tasks: { title: string; owner: string }[];
  deliverables: string[];
};

type RFP = {
  target_and_problem?: {
    summary?: string;
    details?: string;
  };
  key_features?: { name: string; description: string }[];
  differentiation?: { point: string; strategy: string }[];
  visual_rfp?: {
    project_title?: string;
    background?: string;
    objective?: string;
    target_users?: string;
    core_requirements?: string[];
    design_direction?: string;
    deliverables?: string[];
  };
  double_diamond?: {
    discover?: Phase;
    define?: Phase;
    develop?: Phase;
    deliver?: Phase;
  };
};

// ====== 프롬프트 빌더 ======
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

  const mainPrompt = `
Industrial design concept render of a "smart camping chair" product called "${title}".
For target users: ${targetUsers}.
Key features: ${keyFeatures || "portable, foldable, ergonomic, durable"}.
Detailed features: ${featureDetails || "integrated smart functions for outdoor comfort"}.
Core requirements: ${requirements || "lightweight, stable, comfortable for long sitting, easy to carry"}.
Differentiation: ${diffPoints || "smarter and more comfortable than typical camping chairs"}.
Design direction: ${designDirection || "modern, minimal, high-end outdoor gear feeling"}.
Usage context: ${context}.
Single chair on a neutral studio background, 3D product render, no people, no text, no logo, high detail, soft studio lighting.
(Original Korean brief: ${idea})
`.trim();

  const lifestylePrompt = `
Lifestyle render of people using the "${title}" smart camping chair around a camp site.
Chair design follows: ${keyFeatures || "portable, foldable, ergonomic, durable"}, ${requirements}.
Scene: cozy night camping, warm lights, tent and small table, focus on the chair design and how it is used.
Photorealistic outdoor lighting, cinematic, high detail, minimal distraction from the chair design.
(Original Korean brief: ${idea})
`.trim();

  return { mainPrompt, lifestylePrompt };
}

// ====== 메인 핸들러 ======
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ✅ 여기서 idea / rfp 를 꺼낸다
    const idea: string = body?.idea || "";
    const rfp: RFP | null = body?.rfp || null;

    // ✅ 프롬프트 생성
    const { mainPrompt, lifestylePrompt } = buildDesignPrompts(idea, rfp);

    // ---- 여기부터는 "이미지 API 호출" 부분: 너가 원래 쓰던 코드로 교체 ----
    // 예: Together / KREA / 기타 모델
    //
    // const apiKey = process.env.TOGETHER_API_KEY;
    // if (!apiKey) {
    //   return NextResponse.json(
    //     { error: "TOGETHER_API_KEY 환경변수가 없습니다." },
    //     { status: 500 }
    //   );
    // }
    //
    // const response = await fetch("https://your-image-api-endpoint", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${apiKey}`,
    //   },
    //   body: JSON.stringify({
    //     prompt: mainPrompt,
    //     n: 2,
    //     // ... 기타 옵션
    //   }),
    // });
    //
    // if (!response.ok) {
    //   const text = await response.text();
    //   console.error("[design-images] API error:", text);
    //   return NextResponse.json(
    //     { error: "이미지 생성 API 오류", detail: text },
    //     { status: 500 }
    //   );
    // }
    //
    // const json = await response.json();
    // const imageUrls: string[] = (json.data ?? [])
    //   .map((item: any) => item.url)
    //   .filter((u: any) => typeof u === "string");

    // 🔵 지금은 일단 프롬프트가 잘 만들어지는지만 확인할 수 있게 응답
    return NextResponse.json({
      prompt_main: mainPrompt,
      prompt_lifestyle: lifestylePrompt,
      // images: imageUrls,
    });
  } catch (err: any) {
    console.error("[design-images] route error:", err);
    return NextResponse.json(
      { error: err?.message || "서버 에러" },
      { status: 500 }
    );
  }
}
