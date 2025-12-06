// app/api/projects/[id]/state/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// URL(/api/projects/:id/state) 에서 :id 추출하는 헬퍼
function extractProjectId(req: NextRequest): string | null {
  try {
    const { pathname } = new URL(req.url);
    // 예: "/api/projects/abc123/state" → ["api","projects","abc123","state"]
    const parts = pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("projects");
    if (idx === -1 || idx + 1 >= parts.length) return null;
    return parts[idx + 1];
  } catch {
    return null;
  }
}

// GET: 프로젝트 상태 불러오기
export async function GET(req: NextRequest) {
  const projectId = extractProjectId(req);

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
      .limit(1)
      .maybeSingle?.(); // v2 에서만 동작

    // maybeSingle 없을 수도 있으니 fallback 처리
    const row: any =
      (data as any) ??
      (Array.isArray(data) && data.length > 0 ? (data as any)[0] : null);

    if (error) {
      console.error("[Supabase] project_states GET error:", error);
      return NextResponse.json(
        { error: "프로젝트 상태를 불러오는 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

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

// PUT: 프로젝트 상태 저장/업데이트
export async function PUT(req: NextRequest) {
  const projectId = extractProjectId(req);

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
        onConflict: "project_id", // project_id 기준 upsert
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
