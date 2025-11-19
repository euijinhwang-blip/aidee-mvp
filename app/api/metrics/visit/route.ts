// app/api/metrics/visit/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 페이지가 열릴 때마다 호출되는 API
export async function POST() {
  try {
    const { error } = await supabase.from("metrics").insert({
      type: "visit",   // 방문자 로그
      count: 1,
      meta: {},        // 나중에 필요하면 IP, UA 등 넣을 수 있음
    });

    if (error) {
      console.error("[metrics] insert error:", error);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[metrics] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
