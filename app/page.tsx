"use client";

import { useState } from "react";

type RFP = {
  target_and_problem: {
    summary: string;
    details: string;
  };
  key_features: { name: string; description: string }[];
  differentiation: { point: string; strategy: string }[];
  concept_and_references: {
    concept_summary: string;
    reference_keywords: string[];
  };
  visual_rfp: {
    project_title: string;
    background: string;
    objective: string;
    target_users: string;
    core_requirements: string[];
    design_direction: string;
    deliverables: string[];
  };
};

export default function Home() {
  const [idea, setIdea] = useState("");
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

    const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setRfp(null);

    try {
      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });

      const text = await res.text();
      let data: any = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        // 서버가 JSON이 아닌 에러 페이지를 반환한 경우
        throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 200));
      }

      if (!res.ok) {
        // 서버에서 보낸 에러 메시지 보여주기
        const msg =
          (data && (data.error || data.detail)) ||
          `요청 실패 (status ${res.status})`;
        setError(msg);
      } else {
        setRfp(data as RFP);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-semibold">
          Aidee MVP · 아이디어를 구조화된 비주얼 RFP로
        </h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하면, 타겟/문제 정의부터 비주얼 RFP 초안까지 자동으로 구조화해 줍니다.
        </p>

        <textarea
          className="w-full p-4 border rounded-lg bg-white"
          rows={4}
          placeholder='예: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스"'
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />

        <button
          onClick={handleGenerate}
          disabled={loading || !idea}
          className="px-6 py-3 rounded-lg border bg-white disabled:opacity-50"
        >
          {loading ? "분석 및 RFP 생성 중..." : "RFP 생성하기"}
        </button>

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* 1. 타겟/문제 정의 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">① 타겟 & 문제 정의</h2>
              <p className="font-medium mb-1">{rfp.target_and_problem.summary}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {rfp.target_and_problem.details}
              </p>
            </section>

            {/* 2. 핵심 기능 제안 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">② 핵심 기능 제안</h2>
              <ul className="space-y-1 text-sm">
                {rfp.key_features.map((f, i) => (
                  <li key={i}>
                    <strong>{f.name}</strong> — {f.description}
                  </li>
                ))}
              </ul>
            </section>

            {/* 3. 차별화 포인트 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">③ 차별화 포인트 & 전략</h2>
              <ul className="space-y-1 text-sm">
                {rfp.differentiation.map((d, i) => (
                  <li key={i}>
                    <strong>{d.point}</strong>: {d.strategy}
                  </li>
                ))}
              </ul>
            </section>

            {/* 4. 컨셉 & 레퍼런스 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold mb-2">④ 컨셉 & 레퍼런스 키워드</h2>
              <p className="text-sm mb-2">
                {rfp.concept_and_references.concept_summary}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full border"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </section>

            {/* 5. 비주얼 RFP */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑤ 비주얼 RFP / 브리프 초안</h2>
              <div className="text-sm space-y-1">
                <p><strong>프로젝트명:</strong> {rfp.visual_rfp.project_title}</p>
                <p><strong>배경:</strong> {rfp.visual_rfp.background}</p>
                <p><strong>목표:</strong> {rfp.visual_rfp.objective}</p>
                <p><strong>타겟 사용자:</strong> {rfp.visual_rfp.target_users}</p>
                <p><strong>핵심 요구사항:</strong> {rfp.visual_rfp.core_requirements.join(", ")}</p>
                <p><strong>디자인 방향:</strong> {rfp.visual_rfp.design_direction}</p>
                <p><strong>납품물:</strong> {rfp.visual_rfp.deliverables.join(", ")}</p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
