// app/metrics-tracker.tsx
"use client";

import { useEffect } from "react";

export default function MetricsTracker() {
  useEffect(() => {
    // 페이지가 렌더링될 때 한 번만 방문 로그 전송
    fetch("/api/metrics/visit", {
      method: "POST",
    }).catch((e) => {
      console.error("metrics visit error:", e);
    });
  }, []);

  return null; // 화면에 아무것도 안 보여줌
}
