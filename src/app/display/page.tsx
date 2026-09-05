import { Suspense } from "react";
import DisplayClient from "./display-client";

export default function DisplayRoutePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-page">
          <p className="font-display text-2xl text-secondary">Loading…</p>
        </div>
      }
    >
      <DisplayClient />
    </Suspense>
  );
}
