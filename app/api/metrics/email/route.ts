import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    await supabase.from("metrics").insert({
      type: "email",
      count: 1,
      meta: {}
    });

    return NextResponse.json({ ok: true });
} catch (err) {
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Unknown error" }, { status: 500 });
}

}
