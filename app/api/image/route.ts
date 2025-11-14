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
    throw new Error("PEXELS_API_KEY 환경변수가 없습니다. Pexels 대시보드와 Vercel 설정을 확인해 주세요.");
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
    query
  )}&per_page=4`;

  const res = await fetch(url, {
    headers: { Authorization: key },
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text(); // 한 번만 읽고 재사용

  const isJson = contentType.includes("application/json");

  if (!isJson) {
    console.error(
      "[Pexels] Non-JSON response",
      res.status,
      contentType,
      text.slice(0, 200)
    );
    throw new Error(
      `Pexels API 응답이 JSON이 아닙니다 (status ${res.status}). ` +
        `보통은 API 키가 잘못되었거나, 사용량 제한/인증 오류일 때 이런 현상이 나타납니다. ` +
        `Pexels 대시보드에서 키를 다시 확인해 주세요.`
    );
  }

  if (!res.ok) {
    console.error("[Pexels] Error response", res.status, text.slice(0, 200));
    let errMsg = `Pexels 요청 실패 (status ${res.status})`;
    try {
      const json = JSON.parse(text);
      if (json?.error) errMsg = `Pexels 에러: ${json.error}`;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = JSON.parse(text) as any;
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

// Unsplash (없으면 Pexels로 폴백)
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
    headers: { Authorization: `Client-ID ${key}` },
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  const isJson = contentType.includes("application/json");

  if (!isJson) {
    console.error(
      "[Unsplash] Non-JSON response",
      res.status,
      contentType,
      text.slice(0, 200)
    );
    throw new Error(
      `Unsplash API 응답이 JSON이 아닙니다 (status ${res.status}). API 키/요청 설정을 확인해 주세요.`
    );
  }

  if (!res.ok) {
    console.error("[Unsplash] Error response", res.status, text.slice(0, 200));
    let errMsg = `Unsplash 요청 실패 (status ${res.status})`;
    try {
      const json = JSON.parse(text);
      if (json?.errors?.length) errMsg = `Unsplash 에러: ${json.errors[0]}`;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const data = JSON.parse(text) as any;
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
    const providerParam =
      (searchParams.get("provider") as Provider | null) || "pexels";

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
          "이미지 검색 중 오류가 발생했습니다. (관리자: 서버 로그를 확인해 주세요.)",
        images: [],
      },
      { status: 500 }
    );
  }
}
