"use client";

// A minimal, immediate loading state -- shown the instant a page mounts
// while its auth check/data load is in flight, so a click always gives
// visible feedback right away instead of a blank void that can feel like
// nothing happened.
export default function PageLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--void)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        @keyframes pageLoadingPulse {
          0%, 100% { opacity: 0.25; transform: scale(0.85); }
          50% { opacity: 0.9; transform: scale(1); }
        }
        .page-loading-dot { animation: pageLoadingPulse 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .page-loading-dot { animation: none; opacity: 0.6; }
        }
      `}</style>
      <span
        className="page-loading-dot"
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "var(--gold)",
          boxShadow: "0 0 16px var(--gold)",
        }}
      />
    </main>
  );
}
