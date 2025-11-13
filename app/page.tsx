"use client";

import { useState } from "react";

/** ---------- 데이터 타입 ---------- */
type Phase = {
  /** 각 단계의 한 줄 목적(초보자 가이드) */
  purpose: string;
  goals: string[];
  /** 기간 제거: owner만 표기 */
  tasks: { title: string; owner: string }[];
  deliverables: string[];
};

type ExpertPack = { risks: string[]; asks: string[]; checklist: string[] };

type ProcessMeta = {
  estimated_budget_total_krw: string;        // 예: "80,000,000 ~ 200,000,000"
  estimated_duration_weeks: string;          // 예: "16 ~ 36"
  budget_split_percentages: { discover: number; define: number; develop: number; deliver: number };
  duration_split_percentages: { discover: number; define: number; develop: number; deliver: number };
  assumptions: string[];
};

type RFP = {
  // 기존 RFP 필드
  target_and_problem: { summary: string; details: string };
  key_features: { name: string; description: string }[];
  differentiation: { point: string; strategy: string }[];
  concept_and_references: { concept_summary: string; reference_keywords: string[] };

  /** 🔹 NEW: 더블다이아몬드(=디자인·사업화 프로세스) */
  double_diamond?: {
    discover: Phase;
    define: Phase;
    develop: Phase;
    deliver: Phase;
  };

  /** 🔹 NEW: 예산/기간 메타 정보 */
  process_meta?: ProcessMeta;

  /** 🔹 NEW: 만나야 할 전문가 리스트 */
  experts_to_meet?: { role: string; why: string }[];

  /** 🔹 NEW: 전문가 4인 관점 리뷰 */
  expert_reviews?: {
    pm: ExpertPack;
    designer: ExpertPack;
    engineer: ExpertPack;
    marketer: ExpertPack;
  };

  /** 🔹 마지막 요약 카드 */
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

/** ---------- 유틸 ---------- */
const pct = (n?: number) => (typeof n === "number" ? Math.round(n * 100) : undefined);

/** ---------- 프레젠테이션 컴포넌트 ---------- */
function PhaseCard({ title, phase }: { title: string; phase?: Phase }) {
  if (!phase) return null;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
      <h3 className="font-semibold">{title}</h3>

      {/* 한 줄 목적 */}
      {phase.purpose && (
        <p className="text-xs text-gray-600 border rounded-lg px-2 py-1">{phase.purpose}</p>
      )}

      <div className="text-sm">
        <p className="mb-1"><strong>🎯 Goals</strong></p>
        <ul className="list-disc list-inside text-gray-700">
          {phase.goals?.map((g, i) => <li key={i}>{g}</li>)}
        </ul>
      </div>

      <div className="text-sm">
        <p className="mb-1"><strong>🛠️ Tasks</strong></p>
        <ul className="space-y-1 text-gray-700">
          {phase.tasks?.map((t, i) => (
            <li key={i} className="border rounded-lg px-2 py-1">
              <span className="font-medium">{t.title}</span>{" "}
              <span className="text-xs text-gray-500">({t.owner})</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-sm">
        <p className="mb-1"><strong>🧾 Deliverables</strong></p>
        <p className="text-gray-700">{phase.deliverables?.join(", ")}</p>
      </div>
    </div>
  );
}

function ExpertTab({ pack }: { pack?: ExpertPack }) {
  if (!pack) return null;
  return (
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">⚠️ Risks</h4>
        <ul className="list-disc list-inside text-gray-700">
          {pack.risks?.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">📌 Asks</h4>
        <ul className="list-disc list-inside text-gray-700">
          {pack.asks?.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="font-semibold mb-2">✅ Checklist</h4>
        <ul className="list-disc list-inside text-gray-700">
          {pack.checklist?.map((x, i) => <li key={i}>{x}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ExpertTabs({ data }: { data?: RFP["expert_reviews"] }) {
  const [tab, setTab] = useState<"pm" | "designer" | "engineer" | "marketer">("pm");

  const Btn = ({ k, label }: { k: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(k)}
      className={
        "px-3 py-1 rounded-full text-sm border mr-2 " +
        (tab === k ? "bg-black text-white" : "bg-white")
      }
    >
      {label}
    </button>
  );

  if (!data) return <p className="text-sm text-gray-500">리뷰 정보가 없습니다.</p>;

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <Btn k="pm" label="PM/기획" />
        <Btn k="designer" label="디자이너" />
        <Btn k="engineer" label="엔지니어" />
        <Btn k="marketer" label="마케터" />
      </div>

      {tab === "pm" && <ExpertTab pack={data.pm} />}
      {tab === "designer" && <ExpertTab pack={data.designer} />}
      {tab === "engineer" && <ExpertTab pack={data.engineer} />}
      {tab === "marketer" && <ExpertTab pack={data.marketer} />}
    </div>
  );
}

/** ---------- 페이지 ---------- */
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
        throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 200));
      }

      if (!res.ok) {
        const msg = (data && (data.error || data.detail)) || `요청 실패 (status ${res.status})`;
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
        <h1 className="text-3xl font-semibold">Aidee MVP · 아이디어를 구조화된 비주얼 RFP로</h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하면, 타겟/문제 정의부터 전문가 리뷰, 디자인·사업화 로드맵까지 자동으로 구조화해 줍니다.
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

        {error && <div className="text-red-500 text-sm">{error}</div>}

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
              <p className="text-sm mb-2">{rfp.concept_and_references.concept_summary}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">{k}</span>
                ))}
              </div>
            </section>

            {/* 5. 디자인 및 사업화 프로세스(안) */}
            <section className="md:col-span-2 space-y-3">
              <h2 className="font-semibold">⑤ 디자인 및 사업화 프로세스(안)</h2>
              <div className="grid md:grid-cols-4 gap-3">
                <PhaseCard title="DISCOVER" phase={rfp.double_diamond?.discover} />
                <PhaseCard title="DEFINE"   phase={rfp.double_diamond?.define} />
                <PhaseCard title="DEVELOP"  phase={rfp.double_diamond?.develop} />
                <PhaseCard title="DELIVER"  phase={rfp.double_diamond?.deliver} />
              </div>

              {/* 메타 정보 (예산/기간/비율) */}
              {rfp.process_meta && (
                <div className="bg-white p-4 rounded-2xl shadow-sm">
                  <h3 className="font-semibold mb-2">예상 예산·기간(가이드)</h3>
                  <p className="text-sm text-gray-700">
                    총 예산: {rfp.process_meta.estimated_budget_total_krw} / 예상 기간: {rfp.process_meta.estimated_duration_weeks}주
                  </p>
                  <div className="text-xs text-gray-600 mt-2 space-y-1">
                    <p>
                      예산 비율 — Dcv {pct(rfp.process_meta.budget_split_percentages.discover)}% ·
                      Def {pct(rfp.process_meta.budget_split_percentages.define)}% ·
                      Dev {pct(rfp.process_meta.budget_split_percentages.develop)}% ·
                      Dlv {pct(rfp.process_meta.budget_split_percentages.deliver)}%
                    </p>
                    <p>
                      기간 비율 — Dcv {pct(rfp.process_meta.duration_split_percentages.discover)}% ·
                      Def {pct(rfp.process_meta.duration_split_percentages.define)}% ·
                      Dev {pct(rfp.process_meta.duration_split_percentages.develop)}% ·
                      Dlv {pct(rfp.process_meta.duration_split_percentages.deliver)}%
                    </p>
                    {rfp.process_meta.assumptions?.length ? (
                      <ul className="list-disc list-inside">
                        {rfp.process_meta.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            {/* 6. 누구를 만나야 할까 (전문가 가이드) */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑥ 누구를 만나야 할까</h2>
              <ul className="flex flex-wrap gap-2">
                {rfp.experts_to_meet?.map((e, i) => (
                  <li key={i} className="border rounded-xl px-3 py-2 text-sm bg-white">
                    <span className="font-medium">{e.role}</span>{" "}
                    <span className="text-gray-600">— {e.why}</span>
                  </li>
                )) || <li className="text-sm text-gray-500">추천 전문가 정보가 없습니다.</li>}
              </ul>
            </section>

            {/* 7. 전문가 4인 관점 리뷰 (탭) */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-3">⑦ 전문가 관점 리뷰</h2>
              <ExpertTabs data={rfp.expert_reviews} />
            </section>

            {/* 8. 비주얼 RFP — 항상 마지막 요약 카드 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold mb-2">⑧ 비주얼 RFP / 브리프 초안</h2>
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
