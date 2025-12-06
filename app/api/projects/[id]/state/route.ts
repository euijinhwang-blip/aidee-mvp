// app/api/projects/[id]/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/projects/[id]/state
 *   - 프로젝트 상태 불러오기
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // ✅ Next 15 타입에 맞게 Promise에서 id 꺼내기
  const { id: projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json(
      { error: "project id가 없습니다." },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("project_states")
      .select("state")
      .eq("project_id", projectId)
      .limit(1);

    if (error) {
      console.error("[Supabase] project_states GET error:", error);
      return NextResponse.json(
        { error: "프로젝트 상태를 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    const row: any =
      Array.isArray(data) && data.length > 0 ? (data as any)[0] : null;

    return NextResponse.json(
      { state: row?.state ?? null },
      { status: 200 }
    );
  } catch (e) {
    console.error("[project_states] GET unexpected error:", e);
    return NextResponse.json(
      { error: "프로젝트 상태를 불러오는 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]/state
 *   - 프로젝트 상태 저장 / 업데이트
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json(
      { error: "project id가 없습니다." },
      { status: 400 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 JSON 요청입니다." },
      { status: 400 }
    );
  }

  const state = {
    idea: body.idea ?? "",
    survey: body.survey ?? null,
    rfp_json: body.rfp_json ?? null,
    user_notes: body.user_notes ?? null,
    step: body.step ?? null,
  };

  try {
    const { error } = await supabase.from("project_states").upsert(
      {
        project_id: projectId,
        state,
        updated_at: new Date().toISOString(),
      },
      {
        // project_id 기준으로 upsert
        onConflict: "project_id",
      }
    );

    if (error) {
      console.error("[Supabase] project_states PUT error:", error);
      return NextResponse.json(
        { error: "프로젝트 상태를 저장하는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[project_states] PUT unexpected error:", e);
    return NextResponse.json(
      { error: "프로젝트 상태를 저장하는 중 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
