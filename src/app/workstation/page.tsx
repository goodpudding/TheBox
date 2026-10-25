import { Suspense } from "react";
import { WorkstationClient } from "./workstation-client";

export const metadata = {
  title: "Workstation",
};

export default function WorkstationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-page">
          <p className="font-display text-xl text-secondary">Loading desk…</p>
        </div>
      }
    >
      <WorkstationClient />
    </Suspense>
  );
}
