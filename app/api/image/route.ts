// app/api/images/route.ts
import { NextRequest, NextResponse } from "next/server";

type Provider = "pexels" | "unsplash";

type Img = {
  id: string;
  thumb: string;
  full: string;
  alt: string;
  author?: string;
  link?: string;
  source: string;
};

// Pexels에서 이미지 가져오기
async function fetchFromPexels(query: string): Promise<Img[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new Error("PEXELS_API_KEY 환경변수가 없습니다.");
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query
  )}&per_page=4`;

  const res = await fetch(url, {
    headers: {
      Authorization: key,
    },
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      "이미지 서버 응답이 JSON이 아닙니다: " + text.slice(0, 120)
    );
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(
      errJson?.error || `Pexels 요청 실패 (status ${res.status})`
    );
  }

  const data = (await res.json()) as any;
  const photos = Array.isArray(data.photos) ? data.photos : [];

  return photos.slice(0, 4).map((p: any) => ({
    id: String(p.id),
    thumb: p.src?.medium || p.src?.small || p.src?.tiny,
    full: p.src?.large2x || p.src?.large || p.src?.original,
    alt: p.alt || query,
    author: p.photographer,
    link: p.url,
    source: "pexels",
  }));
}

// Unsplash에서 이미지 가져오기 (키 없으면 Pexels로 폴백)
async function fetchFromUnsplashOrFallback(query: string): Promise<Img[]> {
  const key = process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY;

  if (!key) {
    // Unsplash 키가 없으면 그냥 Pexels 사용
    return fetchFromPexels(query);
  }

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
    query
  )}&per_page=4&content_filter=high`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${key}`,
    },
  });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      "이미지 서버 응답이 JSON이 아닙니다: " + text.slice(0, 120)
    );
  }

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(
      errJson?.error || `Unsplash 요청 실패 (status ${res.status})`
    );
  }

  const data = (await res.json()) as any;
  const results = Array.isArray(data.results) ? data.results : [];

  return results.slice(0, 4).map((p: any) => ({
    id: String(p.id),
    thumb: p.urls?.small || p.urls?.thumb,
    full: p.urls?.regular || p.urls?.full,
    alt: p.alt_description || p.description || query,
    author: p.user?.name,
    link: p.links?.html,
    source: "unsplash",
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q =
      searchParams.get("q")?.trim() || "product design concept";
    const providerParam = searchParams.get("provider") as Provider | null;

    const provider: Provider =
      providerParam === "unsplash" ? "unsplash" : "pexels";

    let images: Img[] = [];

    if (provider === "unsplash") {
      images = await fetchFromUnsplashOrFallback(q);
    } else {
      images = await fetchFromPexels(q);
    }

    return NextResponse.json({ images });
  } catch (err: any) {
    console.error("images route error:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "이미지 검색 중 오류가 발생했습니다.",
        images: [],
      },
      { status: 500 }
    );
  }
}
