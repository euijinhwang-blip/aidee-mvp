// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "프로젝트 목록을 불러오지 못했습니다.");
      setProjects(data.projects || []);
    } catch (e: any) {
      setError(e?.message || "목록 로딩 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "새 제품 아이디어" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "프로젝트 생성 실패");
      const project = data.project as Project;
      router.push(`/project/${project.id}`);
    } catch (e: any) {
      setError(e?.message || "프로젝트 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-700">
              내 제품 아이디어 프로젝트
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              로그인(향후 예정)한 사용자가 만든 기획안들을 한 곳에서 관리합니다.
            </p>
          </div>
          <button
            onClick={handleCreateProject}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm disabled:opacity-50"
          >
            {creating ? "프로젝트 생성 중..." : "새 프로젝트 만들기"}
          </button>
        </header>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-500">프로젝트 목록을 불러오는 중...</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-gray-500">
            아직 생성된 프로젝트가 없습니다. 오른쪽 상단의{" "}
            <b>새 프로젝트 만들기</b> 버튼을 눌러 시작해 보세요.
          </p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y border">
            {projects.map((p) => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                onClick={() => router.push(`/project/${p.id}`)}
              >
                <div>
                  <p className="font-medium text-gray-700">{p.title}</p>
                  <p className="text-xs text-gray-400">
                    상태: {p.status} · 최근 수정{" "}
                    {new Date(p.updated_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs text-gray-400">&gt;</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
