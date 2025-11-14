// app/api/images/route.ts
import { NextRequest } from "next/server";

type Img = {
  id: string;
  thumb: string;
  full: string;
  alt: string;
  author?: string;
  link?: string;
  source: "pexels" | "unsplash";
};

const PEXELS = process.env.PEXELS_API_KEY!;
const UNSPLASH = process.env.UNSPLASH_ACCESS_KEY!; // server-side key

async function fromPexels(q: string, per = 4): Promise<Img[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${per}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS }, cache: "no-store" });
  if (!res.ok) throw new Error("Pexels error");
  const json = await res.json();
  return (json.photos || []).map((p: any) => ({
    id: String(p.id),
    thumb: p.src.medium,
    full: p.src.large2x || p.src.large,
    alt: p.alt || q,
    author: p.photographer,
    link: p.url,
    source: "pexels" as const,
  }));
}

async function fromUnsplash(q: string, per = 4): Promise<Img[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${per}&client_id=${UNSPLASH}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Unsplash error");
  const json = await res.json();
  return (json.results || []).map((r: any) => ({
    id: r.id,
    thumb: r.urls.small,
    full: r.urls.full || r.urls.regular,
    alt: r.alt_description || q,
    author: r.user?.name,
    link: r.links?.html,
    source: "unsplash" as const,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const provider = (searchParams.get("provider") || "pexels") as "pexels" | "unsplash";

    if (!q.trim()) return Response.json({ images: [] });

    let list: Img[] = [];
    const per = 4;

    try {
      list = provider === "pexels" ? await fromPexels(q, per) : await fromUnsplash(q, per);
    } catch {
      // fallback: 반대 공급자로 한 번 더 시도
      try {
        list = provider === "pexels" ? await fromUnsplash(q, per) : await fromPexels(q, per);
      } catch {
        list = [];
      }
    }

    return Response.json({ images: list.slice(0, 4) }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message || "image error" }, { status: 500 });
  }
}
