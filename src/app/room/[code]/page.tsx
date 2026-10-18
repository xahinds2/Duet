"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { RoomSession } from "@/components/RoomSession";
import { normalizeRoomCode } from "@/lib/room";

function RoomPageInner() {
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = useMemo(() => normalizeRoomCode(params.code ?? ""), [params.code]);
  const isHost = searchParams.get("host") === "1";

  if (!code) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-mist px-6">
        <p className="text-ink/60">Invalid room code.</p>
      </div>
    );
  }

  return (
    <RoomSession code={code} isHost={isHost} onLeave={() => router.push("/")} />
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-mist">
          <p className="font-display text-xl text-ink/50">Joining…</p>
        </div>
      }
    >
      <RoomPageInner />
    </Suspense>
  );
}
