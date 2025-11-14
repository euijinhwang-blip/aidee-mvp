import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "product design";
  const provider = req.nextUrl.searchParams.get("provider") || "pexels";

  const PEXELS_KEY = process.env.PEXELS_API_KEY;
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;

  if (!PEXELS_KEY) {
    return NextResponse.json(
      { error: "PEXELS_API_KEY 환경변수가 없습니다." },
      { status: 500 }
    );
  }

  try {
    let images: any[] = [];

    /** PEXELS */
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=4`,
      { headers: { Authorization: PEXELS_KEY } }
    );

    if (!r.ok) throw new Error("Pexels API 요청 실패");

    const j = await r.json();

    images = j.photos.map((p: any) => ({
      id: String(p.id),
      thumb: p.src.medium,
      full: p.src.large2x,
      alt: p.alt || q,
      author: p.photographer,
      link: p.url,
      source: "pexels",
    }));

    return NextResponse.json({ images });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
