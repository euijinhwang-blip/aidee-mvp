"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Phase = {
  goals: string[];
  tasks: { title: string; owner: string }[];
  deliverables: string[];
};

type ExpertPack = { risks: string[]; asks: string[]; checklist: string[] };

type RFP = {
  id: string;
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
    <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2 h-full">
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
  const [error, setError] = useState<any>(null);
  const [emailMsg, setEmailMsg] = useState("");

  // 진행 시간(초)
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 디자인 시안 관련 상태
  const [designImages, setDesignImages] = useState<string[]>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [designError, setDesignError] = useState<any>(null);

  // 이미지 엔진 선택 상태
  const [imageEngine, setImageEngine] = useState<"meshy" | "stability" | "dalle">("meshy");

  // 각 카드별 사용자 메모
  const [noteTargetProblem, setNoteTargetProblem] = useState("");
  const [noteKeyFeatures, setNoteKeyFeatures] = useState("");
  const [noteDifferentiation, setNoteDifferentiation] = useState("");
  const [noteConcept, setNoteConcept] = useState("");

  const processCaptions = useMemo(
    () => ({
      discover: "문제/사용자/맥락을 넓게 탐색하여 ‘무엇을 만들지’를 열어 보는 단계",
      define: "요구사항·성공 기준을 좁혀 ‘무엇을 만들지’를 명확히 정의",
      develop: "설계·시작품 제작·검증/인증 준비",
      deliver: "양산·런칭·판매 및 피드백 수렴",
    }),
    []
  );

  // 페이지 최초 방문 기록
  useEffect(() => {
    fetch("/api/metrics/visit", { method: "POST" }).catch(() => {});
  }, []);

  // RFP 생성
  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setRfp(null);
    setEmailMsg("");

    // 디자인 시안 초기화
    setDesignImages([]);
    setDesignError("");

    // 타이머 초기화
    if (timerRef.current) clearInterval(timerRef.current);
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

      // 사용자 메모 (향후 RFP 재생성에 활용할 수 있도록 전달)
      const userNotes = {
        target_and_problem: noteTargetProblem || null,
        key_features: noteKeyFeatures || null,
        differentiation: noteDifferentiation || null,
        concept_and_references: noteConcept || null,
      };

      const res = await fetch("/api/aidee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, survey, user_notes: userNotes }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error("서버 응답이 JSON 형식이 아닙니다: " + text.slice(0, 120));
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.detail || `요청 실패 (${res.status})`);
      }

      const newRfp = data as RFP;
      setRfp(newRfp);

      // ✅ RFP 생성 메트릭 기록
      await fetch("/api/metrics/rfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfpId: (newRfp as any).id,
          meta: {
            surveyUsed:
              !!budget ||
              !!timeline ||
              !!targetMarket ||
              !!priority ||
              !!riskTolerance ||
              !!regulationFocus,
          },
        }),
      });
    } catch (e: any) {
      console.error("RFP generate error:", e);
      const msg =
        typeof e === "string"
          ? e
          : e?.message || e?.error || e?.detail || "네트워크 오류";
      setError(msg);
    } finally {
      setLoading(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  // 이메일 보내기 (/api/email 사용)
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
          images: designImages.map((url, i) => ({
            full: url,
            alt: `design ${i + 1}`,
          })),
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "이메일 전송 실패");
      setEmailMsg("이메일을 보냈습니다.");

      await fetch("/api/metrics/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          meta: { rfpId: rfp.id },
        }),
      });
    } catch (e: any) {
      setEmailMsg(e?.message || "이메일 전송 중 오류가 발생했습니다.");
    }
  }

  // 제품 디자인 이미지 생성 (/api/design-images)
  async function handleGenerateDesign() {
    if (!idea || !rfp) {
      setDesignError("먼저 아이디어를 입력하고 RFP를 생성해 주세요.");
      return;
    }

    setDesignError("");
    setDesignLoading(true);
    setDesignImages([]);

    try {
      const res = await fetch("/api/design-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          rfp,
          provider: imageEngine,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "디자인 시안 생성 실패");

      const images: string[] = data.images || [];
      setDesignImages(images);

      await fetch("/api/metrics/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: images.length,
          model: imageEngine,
          meta: { rfpId: rfp.id, idea },
        }),
      });
    } catch (e: any) {
      console.error("design image error:", e);
      setDesignError(e?.message || "디자인 시안 생성 중 오류가 발생했습니다.");
    } finally {
      setDesignLoading(false);
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
        <h1 className="text-3xl text-gray-600 font-semibold">
          Aidee: 제품디자인 기획안, 텍스트 한 줄로 완성
        </h1>

        <p className="text-sm text-gray-600">
          제품 아이디어를 입력하고, 예산·기간·시장 정보를 간단히 선택하면 문제 정의부터 디자인 컨셉 도출,
          수행프로세스, 전문가 가이드, RFP 요약까지 자동으로 정리합니다.
        </p>

        {/* 아이디어 입력 */}
        <textarea
          className="w-full p-4 border rounded-lg bg-white text-gray-400"
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
                  className="mt-1 w-full text-gray-300 border rounded-lg px-3 py-2 bg-white"
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

          {/* 설문 요약 간단 표시 */}
          <p className="text-xs text-gray-500 mt-2">
            예산: {budget || "-"} · 일정: {timeline || "-"} · 우선순위: {priority || "-"} · 리스크 허용도:{" "}
            {riskTolerance || "-"}
          </p>
        </section>

        {/* 상단 버튼 + 진행상황 + 이미지 엔진 선택 */}
        <div className="flex flex-col gap-3">
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

            <button
              onClick={handleGenerateDesign}
              disabled={!rfp || designLoading}
              className="px-6 text-gray-600 py-3 rounded-lg border bg-white disabled:opacity-50"
            >
              {designLoading ? "디자인 시안 생성 중..." : "디자인 시안 생성하기"}
            </button>

            {loading && (
              <span className="text-xs text-gray-500">
                분석 중… {elapsedSec}
                초 경과
              </span>
            )}

            {emailMsg && (
              <span className="text-sm text-gray-600">{emailMsg}</span>
            )}
          </div>

          {/* 이미지 엔진 선택 버튼 */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="text-xs text-gray-500 mr-1">이미지 타입:</span>

            <button
              type="button"
              onClick={() => setImageEngine("meshy")}
              className={`px-3 py-2 rounded-full border ${
                imageEngine === "meshy"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              3D/실사 (제품 렌더)
            </button>

            <button
              type="button"
              onClick={() => setImageEngine("stability")}
              className={`px-3 py-2 rounded-full border ${
                imageEngine === "stability"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              컨셉 스케치 (컨셉)
            </button>

            <button
              type="button"
              onClick={() => setImageEngine("dalle")}
              className={`px-3 py-2 rounded-full border ${
                imageEngine === "dalle"
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              3D 렌더 이미지
            </button>
          </div>
        </div>

        {/* 시안 생성 에러/로딩 메시지 */}
        {designError && <p className="text-red-500 text-sm mt-2">{designError}</p>}
        {designLoading && <p className="text-sm text-gray-500 mt-2">디자인 시안 생성 중...</p>}

        {/* RFP 생성 에러 메시지 */}
        {error && (
          <div className="text-red-500 text-sm">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        {rfp && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            {/* ① 목표 설정 및 문제 정의 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
              <h2 className="font-semibold text-gray-600 mb-1">① 목표 설정 및 문제 정의</h2>
              <p className="font-medium text-gray-600 mb-1">{rfp.target_and_problem.summary}</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {rfp.target_and_problem.details}
              </p>

              {/* 사용자 메모 입력 */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">추가하고 싶은 점이 있나요?</p>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-700 bg-gray-50"
                  rows={2}
                  placeholder="예: 타겟을 더 구체화하고 싶은 내용, 문제 정의에 빠진 점 등"
                  value={noteTargetProblem}
                  onChange={(e) => setNoteTargetProblem(e.target.value)}
                />
              </div>
            </section>

            {/* ② 핵심 기능 제안 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
              <h2 className="font-semibold text-gray-600 mb-1">② 핵심 기능 제안</h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.key_features.map((f, i) => (
                  <li key={i}>
                    <strong>{f.name}</strong> — {f.description}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">추가하고 싶은 기능이나 빼고 싶은 기능이 있나요?</p>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-700 bg-gray-50"
                  rows={2}
                  placeholder="예: 꼭 필요하다고 생각하는 기능, 굳이 필요 없다고 느끼는 기능 등"
                  value={noteKeyFeatures}
                  onChange={(e) => setNoteKeyFeatures(e.target.value)}
                />
              </div>
            </section>

            {/* ③ 차별화 포인트 */}
            <section className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
              <h2 className="font-semibold text-gray-600 mb-1">③ 차별화 포인트 & 전략</h2>
              <ul className="space-y-1 text-gray-600 text-sm">
                {rfp.differentiation.map((d, i) => (
                  <li key={i}>
                    <strong>{d.point}</strong>: {d.strategy}
                  </li>
                ))}
              </ul>

              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">경쟁사 대비 더 강조하고 싶은 차별점이 있나요?</p>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-700 bg-gray-50"
                  rows={2}
                  placeholder="예: 꼭 강조하고 싶은 차별 포인트, 불필요하다고 느끼는 포인트 등"
                  value={noteDifferentiation}
                  onChange={(e) => setNoteDifferentiation(e.target.value)}
                />
              </div>
            </section>

            {/* ④ 컨셉 & 레퍼런스 키워드 */}
            <section className="bg-white text-gray-600 p-4 rounded-2xl shadow-sm space-y-2">
              <h2 className="font-semibold text-gray-600 mb-1">④ 컨셉 & 레퍼런스 키워드</h2>
              <p className="text-sm text-gray-600 mb-2">
                {rfp.concept_and_references.concept_summary}
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {rfp.concept_and_references.reference_keywords.map((k, i) => (
                  <span key={i} className="px-2 py-1 rounded-full border">
                    {k}
                  </span>
                ))}
              </div>

              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">컨셉이나 분위기에서 추가/수정하고 싶은 점이 있나요?</p>
                <textarea
                  className="w-full border rounded-lg px-2 py-1 text-xs text-gray-700 bg-gray-50"
                  rows={2}
                  placeholder="예: 더 차분하게/더 역동적으로, 컬러톤에 대한 의견 등"
                  value={noteConcept}
                  onChange={(e) => setNoteConcept(e.target.value)}
                />
              </div>
            </section>

            {/* ⑤ 디자인 및 사업화 프로세스(안) */}
            <section className="text-gray-600 md:col-span-2 space-y-3">
              <h2 className="font-semibold text-gray-600">⑤ 디자인 및 사업화 프로세스(안)</h2>
              <p className="text-xs text-gray-500">
                Discover → Define → Develop → Deliver 순서로, 왼쪽에서 오른쪽으로 흐르며 전체
                여정을 한 번에 볼 수 있도록 정리했습니다. 카드들을 가로로 스크롤하면서 각 단계의
                목표와 해야 할 일을 확인해 보세요.
              </p>

              <div className="mt-2 -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="1. Discover(탐색)"
                      caption={processCaptions.discover}
                      phase={rfp.double_diamond?.discover}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="2. Define(정의)"
                      caption={processCaptions.define}
                      phase={rfp.double_diamond?.define}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="3. Develop(개발)"
                      caption={processCaptions.develop}
                      phase={rfp.double_diamond?.develop}
                    />
                  </div>
                  <div className="min-w-[260px] md:min-w-[280px] flex-shrink-0 snap-start">
                    <PhaseCard
                      title="4. Deliver(배포)"
                      caption={processCaptions.deliver}
                      phase={rfp.double_diamond?.deliver}
                    />
                  </div>
                </div>
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
                  const pack = (rfp.expert_reviews as any)?.[k] as ExpertPack | undefined;
                  if (!pack) return null;

                  const label =
                    k === "pm" ? "PM/기획" : k === "designer" ? "디자이너" : k === "engineer" ? "엔지니어" : "마케터";

                  const quoteCandidate =
                    pack.checklist?.[0] || pack.asks?.[0] || pack.risks?.[0] || "";
                  const quote = quoteCandidate ? `“${quoteCandidate}”` : "";

                  return (
                    <div key={k} className="rounded-2xl p-4 border space-y-2">
                      <h4 className="font-semibold">{label}</h4>

                      {/* 말풍선 스타일 한 줄 요약 */}
                      {quote && (
                        <p className="text-xs bg-gray-50 border border-dashed border-gray-200 rounded-xl px-3 py-2">
                          {quote}
                        </p>
                      )}

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

            {/* ⑧ RFP 요약 */}
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

                        {/* ⑨ AI 생성 제품 디자인 시안 */}
            {(designError || designLoading || designImages.length > 0) && (
              <section className="bg-white p-4 rounded-2xl text-gray-600 shadow-sm md:col-span-2">
                <h2 className="font-semibold text-gray-600 mb-2">
                  ⑨ AI 생성 제품 디자인 시안
                </h2>

                {designError && (
                  <p className="text-red-500 text-sm mt-2">{designError}</p>
                )}

                {designLoading && (
                  <p className="text-sm text-gray-500 mt-2">
                    디자인 시안 생성 중...
                  </p>
                )}

                {!!designImages.length && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {designImages.map((url, i) => (
                      <div
                        key={i}
                        className="relative rounded-xl overflow-hidden border bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`design-${i}`}
                          className="w-full h-40 md:h-48 object-cover"
                        />

                        {/* 다운로드 버튼 */}
                        <a
                          href={url}
                          download={`aidee-design-${i + 1}.png`}
                          className="absolute bottom-2 right-2 bg-white/85 text-xs px-2 py-1 rounded shadow-sm border border-gray-200 hover:bg-white"
                        >
                          다운로드
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>
    </main>
  );
}
