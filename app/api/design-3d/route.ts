// app/api/design-3d/route.ts
import { NextRequest, NextResponse } from "next/server";

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
      return [thumb]; // 썸네일 한 장만 반환
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        `Meshy 작업 실패 (status=${status}, message=${
          statusJson?.task_error?.message ?? ""
        })`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const idea: string | undefined = body?.idea;
    const rfp: any = body?.rfp;

    if (!idea || !rfp) {
      return NextResponse.json(
        { error: "idea와 rfp가 필요합니다." },
        { status: 400 }
      );
    }

    // 간단히: 제품용 프롬프트로만 사용 (나중에 필요하면 더 상세하게)
    const prompt = `${idea}. ${rfp?.visual_rfp?.design_direction ?? ""}`;

    const images = await generateWithMeshy(prompt);

    return NextResponse.json({ images }, { status: 200 });
  } catch (err: any) {
    console.error("[design-3d] error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          err?.error ||
          err?.detail ||
          "3D 시안 생성 중 서버 에러가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}
