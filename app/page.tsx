// app/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = { goals: string[]; tasks: { title: string; owner: string }[]; deliverables: string[] };
type ExpertPack = { risks: string[]; asks: string[]; checklist: string[] };
type RFP = {
  target_and_problem: { summary: string; details: string };
  key_features: { name: string; description: string }[];
  differentiation: { point: string; strategy: string }[];
  concept_and_references: { concept_summary: string; reference_keywords: string[] };
  visual_rfp: {
    project_title: string;
    background: string;
    objective: string;
    target_users: string;
    core_requirements: string[];
    design_direction: string;
    deliverables: string[];
  };
  double_diamond?: { discover: Phase; define: Phase; develop: Phase; deliver: Phase };
  experts_to_meet?: { role: string; why: string }[];
  expert_reviews?: { pm: ExpertPack; designer: ExpertPack; engineer: ExpertPack; marketer: ExpertPack };
};

function PhaseCard({ title, caption, phase }: { title: string; caption: string; phase?: Phase }) {
  if (!phase) return null;
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-gray-500">{caption}</p>
      <div className="text-sm">
        <p className="mb-1">
          <strong>🎯 Goals</strong>
        </p>
        <ul className="list-disc list-inside text-gray-700">
          {phase.goals?.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      </div>
      {!!phase.tasks?.length && (
        <div className="text-sm">
          <p className="mb-1">
            <strong>🛠️ Tasks</strong>
          </p>
          <ul className="space-y-1 text-gray-700">
            {phase.tasks.map((t, i) => (
              <li key={i} className="border rounded-lg px-2 py-1">
                <span className="font-medium">{t.title}</span>{" "}
                <span className="text-xs text-gray-500">({t.owner})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!phase.deliverables?.length && (
        <div className="text-sm">
          <p className="mb-1">
            <strong>🧾 Deliverables</strong>
          </p>
          <p className="text-gray-700">{phase.deliverables?.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [idea, setIdea] = useState("");
  const [emailTo, setEmailTo] = useState("");

  // 설문 값들
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priority, setPriority] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("");
  const [regulationFocus, setRegulationFocus] = useState("");

  const [rfp, setRfp] = useState<RFP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  // 진행 시간(초)
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processCaptions = useMemo(
    () => ({
      discover: "문제/사용자/맥락을 넓게 탐색하여 ‘무엇을 만들지’를 열어 보는 단계",
      define: "요구사항·성공 기준을 좁혀 ‘무엇을 만들지’를 명확히 정의",
      develop: "설계·시작품 제작·검증/인증 준비",
      deliver: "양산·런칭·판매 및 피드백 수렴",
    }),
    []
  );

  // RFP 생성
  async function handleGenerate() {
    setLoading(true);
    setError("");
    setRfp(null);
    setEmailMsg("");

    // 타이머 초기화
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setElapsedSec(0);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    try {
      const survey = {
        budget,
        timeline,
        target_market: targetMarket,
        priority,
        risk_tolerance: riskTolerance,
        regulation_focus: regulationFocus,
      };

      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, survey }),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 120));
      }
      if (!res.ok) throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
      setRfp(data as RFP);
    } catch (e: any) {
      setError(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  // 이메일 보내기 (기존 /api/email 사용)
  async function handleEmail() {
    if (!rfp || !emailTo) return;
    setEmailMsg("");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: "Aidee · 비주얼 RFP & 프로세스(안)",
          rfp,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "이메일 전송 실패");
      setEmailMsg("이메일을 보냈습니다.");
    } catch (e: any) {
      setEmailMsg(e?.message || "이메일 전송 에러");
    }
  }

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl text-gray-600 font-semibold">Aidee: 제품디자인 기획안, 텍스트 한 줄로 완성</h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하고, 예산·기간·시장 정보를 간단히 선택하면
          문제 정의부터 디자인 컨셉 도출, 프로세스(안), 전문가 가이드, RFP 요약까지 자동으로 정리합니다.
        </p>

        {/* 아이디어 입력 */}
        <textarea
          className="w-full p-4 border rounded-lg bg-white text-gray-300"
          rows={3}
          placeholder='예: "야외 러너를 위한 미니 공기청정 웨어러블 디바이스"'
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />

        {/* 설문 영역 */}
        <section className="bg-white p-4 rounded-2xl shadow-sm space-y-3">
          <h2 className="font-semibold text-gray-600 mb-1 text-sm">간단 설문 · 예산/기간/시장 정보</h2>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-600">예산(총/개발)</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="5천만 미만">5천만 미만</option>
                  <option value="5천만~1억">5천만~1억</option>
                  <option value="1~3억">1~3억</option>
                  <option value="3억 이상">3억 이상</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">희망 일정</span>
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                  value={timeline}
                  onChange={(e) => setTimeline(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="3개월 이내">3개월 이내</option>
                  <option value="6개월 이내">6개월 이내</option>
                  <option value="1년 이내">1년 이내</option>
                  <option value="1년 이상">1년 이상</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">타겟 시장/채널</span>
                <input
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  placeholder="예: 국내 B2C, 북미 아마존, 국내 B2B 등"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                />
              </label>
            </div>

            <div className="space-y-2">
              <label className="block">
                <span className="text-xs text-gray-600">우선순위</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="원가">원가</option>
                  <option value="품질">품질</option>
                  <option value="리드타임">리드타임</option>
                  <option value="디자인 임팩트">디자인 임팩트</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">리스크 허용도</span>
                <select
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  value={riskTolerance}
                  onChange={(e) => setRiskTolerance(e.target.value)}
                >
                  <option value="">선택 안 함</option>
                  <option value="보수적">보수적</option>
                  <option value="중간">중간</option>
                  <option value="공격적">공격적</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-600">규제/인증 이슈 (선택)</span>
                <input
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
                  placeholder="예: 전기용품, 생활제품 위생, 의료기기 가능성 등"
                  value={regulationFocus}
                  onChange={(e) => setRegulationFocus(e.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        {/* 상단 버튼 + 진행상황 */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={loading || !idea}
            className="px-6 text-gray-600 py-3 rounded-lg border bg-white disabled:opacity-50"
          >
            {loading ? "분석 및 RFP 생성 중..." : "RFP 생성하기"}
          </button>

          <input
            type="email"
            placeholder="이메일 주소"
            className="border text-gray-300 rounded-lg px-3 py-2 bg-white"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
          />
          <button
            onClick={handleEmail}
            disabled={!rfp || !emailTo}
            className="px-4 text-gray-600 py-2 rounded-lg border bg-white disabled:opacity-50"
          >
            이메일로 받기
          </button>

          {loading && (
            <span className="text-xs text-gray-500">
              분석 중… {elapsedSec}
              초 경과
            </span>
          )}
          {emailMsg && <span className="text-sm text-gray-600">{emailMsg}</span>}
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* ① 목표 설정 및 문제 정의 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">① 목표 설정 및 문제 정의</h2>
              <p className="font-medium text-gray-600 mb-1">{rfp.target_and_problem.summary}</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{rfp.target_and_problem.details}</p>
            </section>

            {/* ② 핵심 기능 제안 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">② 핵심 기능 제안</h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.key_features.map((f, i) => (
                  <li key={i}>
                    <strong>{f.name}</strong> — {f.description}
                  </li>
                ))}
              </ul>
            </section>

            {/* ③ 차별화 포인트 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">③ 차별화 포인트 & 전략</h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.differentiation.map((d, i) => (
                  <li key={i}>
                    <strong>{d.point}</strong>: {d.strategy}
                  </li>
                ))}
              </ul>
            </section>

            {/* ④ 컨셉 & 레퍼런스 키워드 */}
            <section className="bg-white text-gray-600 p-4 rounded-2xl shadow-sm">
              <h2 className="font-semibold text-gray-600 mb-2">④ 컨셉 & 레퍼런스 키워드</h2>
              <p className="text-sm text-gray-600 mb-2">{rfp.concept_and_references.concept_summary}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">
                    {k}
                  </span>
                ))}
              </div>
            </section>

            {/* ⑤ 디자인 및 사업화 프로세스(안) */}
            <section className="md:col-span-2 space-y-3">
              <h2 className="font-semibold text-gray-600">⑤ 디자인 및 사업화 프로세스(안)</h2>
              <div className="text-gray-600grid md:grid-cols-4 gap-3">
                <PhaseCard
                  title="Discover(탐색)"
                  caption={processCaptions.discover}
                  phase={rfp.double_diamond?.discover}
                />
                <PhaseCard title="Define(정의)" caption={processCaptions.define} phase={rfp.double_diamond?.define} />
                <PhaseCard title="Develop(개발)" caption={processCaptions.develop} phase={rfp.double_diamond?.develop} />
                <PhaseCard title="Deliver(배포)" caption={processCaptions.deliver} phase={rfp.double_diamond?.deliver} />
              </div>
            </section>

            {/* ⑥ 나의 협력 파트너 추천 */}
            <section className="bg-white p-4 text-gray-600 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-2">⑥ 나의 협력 파트너 추천</h2>
              <ul className="flex flex-wrap gap-2">
                {rfp.experts_to_meet?.map((e, i) => (
                  <li key={i} className="border rounded-xl px-3 py-2 text-sm bg-white">
                    <span className="font-medium">{e.role}</span>{" "}
                    <span className="text-gray-600">— {e.why}</span>
                  </li>
                )) || <li className="text-sm text-gray-500">추천 전문가 정보가 없습니다.</li>}
              </ul>
            </section>

            {/* ⑦ 전문가 관점 리뷰 */}
            <section className="bg-white p-4 text-gray-600 rounded-2xl shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-3">⑦ 전문가 관점 리뷰</h2>
              <div className="grid md:grid-cols-2 gap-3 text-gray-600 text-sm">
                {["pm", "designer", "engineer", "marketer"].map((k) => {
                  const pack = (rfp.expert_reviews as any)?.[k];
                  if (!pack) return null;
                  const label =
                    k === "pm" ? "PM/기획" : k === "designer" ? "디자이너" : k === "engineer" ? "엔지니어" : "마케터";
                  return (
                    <div key={k} className="rounded-2xl p-4 border">
                      <h4 className="font-semibold mb-2">{label}</h4>
                      <p className="text-gray-700">
                        <b>주의할 점</b>
                      </p>
                      <ul className="list-disc list-inside mb-2">
                        {pack.risks?.map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                      <p className="text-gray-700">
                        <b>지금 당장 할 일</b>
                      </p>
                      <ul className="list-disc list-inside mb-2">
                        {pack.asks?.map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                      <p className="text-gray-700">
                        <b>체크리스트</b>
                      </p>
                      <ul className="list-disc list-inside">
                        {pack.checklist?.map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ⑧ RFP 요약 (항상 마지막) */}
            <section className="bg-white p-4 rounded-2xl text-gray-600 shadow-sm md:col-span-2">
              <h2 className="font-semibold text-gray-600 mb-2">⑧ RFP 요약</h2>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <strong>프로젝트명:</strong> {rfp.visual_rfp.project_title}
                </p>
                <p>
                  <strong>배경:</strong> {rfp.visual_rfp.background}
                </p>
                <p>
                  <strong>목표:</strong> {rfp.visual_rfp.objective}
                </p>
                <p>
                  <strong>타겟 사용자:</strong> {rfp.visual_rfp.target_users}
                </p>
                <p>
                  <strong>핵심 요구사항:</strong> {rfp.visual_rfp.core_requirements.join(", ")}
                </p>
                <p>
                  <strong>디자인 방향:</strong> {rfp.visual_rfp.design_direction}
                </p>
                <p>
                  <strong>납품물:</strong> {rfp.visual_rfp.deliverables.join(", ")}
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
