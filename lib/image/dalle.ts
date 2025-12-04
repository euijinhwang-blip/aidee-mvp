// lib/images/dalle.ts
export async function generateWithDalle(
  prompt: string,
  n: number = 2
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is missing");
    return [];
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // 현재 권장 모델은 gpt-image-1 (이미지 전용) 이고,
      // DALL·E 3도 같은 /images/generations 엔드포인트에서 사용 가능. :contentReference[oaicite:1]{index=1}
      model: "gpt-image-1",
      prompt,
      n,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("[DALL-E] error:", error);
    return [];
  }

  const json = await res.json();
  const images: string[] = (json.data || []).map((d: any) =>
    `data:image/png;base64,${d.b64_json}`
  );

  return images;
}
