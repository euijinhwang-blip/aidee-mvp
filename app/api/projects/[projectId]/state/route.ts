// app/api/projects/[projectId]/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET  /api/projects/[projectId]/state
//  → 저장된 프로젝트 상태 불러오기
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  // 🔹 RouteHandlerConfig 타입에 맞게 Promise에서 꺼내기
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId 가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("project_states")
      .select("state")
      .eq("project_id", projectId)
      .maybeSingle();

    if (error) {
      console.error("[project_states] GET error:", error);
      return NextResponse.json(
        { error: "프로젝트 상태를 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ state: data?.state ?? null }, { status: 200 });
  } catch (e: any) {
    console.error("[project_states] GET unexpected error:", e);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST  /api/projects/[projectId]/state
//  → 프로젝트 상태 저장/업데이트
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId 가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const state = body?.state ?? null;

    const { error } = await supabase
      .from("project_states")
      .upsert(
        {
          project_id: projectId,
          state,
        },
        { onConflict: "project_id" }
      );

    if (error) {
      console.error("[project_states] POST error:", error);
      return NextResponse.json(
        { error: "프로젝트 상태를 저장하는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[project_states] POST unexpected error:", e);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
