"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createRoomCode, normalizeRoomCode } from "@/lib/room";

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const startRoom = () => {
    const code = createRoomCode();
    router.push(`/room/${code}?host=1`);
  };

  const joinRoom = (e: FormEvent) => {
    e.preventDefault();
    const code = normalizeRoomCode(joinCode);
    if (code.length < 4) return;
    setJoining(true);
    router.push(`/room/${code}`);
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
      <div className="atmosphere" aria-hidden />
      <div className="drift-orb drift-orb-a" aria-hidden />
      <div className="drift-orb drift-orb-b" aria-hidden />

      <main className="safe-pad relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-10 md:py-16">
        <p className="font-display text-[clamp(3.25rem,12vw,5.5rem)] leading-none tracking-tight text-ink">
          Duet
        </p>
        <h1 className="mt-5 max-w-xl font-display text-[clamp(1.5rem,5vw,2.25rem)] leading-snug text-ink/90 md:mt-6">
          Watch together. Faces on.
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-ink/55 md:mt-4 md:text-lg">
          A private room for two — cameras on, one screen between you, same couch energy.
        </p>

        <div className="mt-10 flex w-full max-w-2xl flex-col gap-3 md:mt-12 md:flex-row md:items-stretch md:gap-4">
          <button
            type="button"
            onClick={startRoom}
            className="touch-target rounded-2xl bg-ink px-6 py-3.5 text-base font-medium text-foam transition hover:bg-ink/90 active:scale-[0.98] md:px-8 md:py-4"
          >
            Start a room
          </button>

          <form
            onSubmit={joinRoom}
            className="flex w-full flex-1 flex-col gap-3 sm:flex-row sm:items-stretch"
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="go"
              className="touch-target min-w-0 flex-1 rounded-2xl border border-ink/15 bg-foam/60 px-5 text-base tracking-[0.2em] text-ink outline-none placeholder:tracking-normal placeholder:text-ink/35 focus:border-berry/50"
              aria-label="Room code"
            />
            <button
              type="submit"
              disabled={joining || normalizeRoomCode(joinCode).length < 4}
              className="touch-target rounded-2xl border border-ink/15 bg-foam/80 px-6 text-base font-medium text-ink transition hover:border-ink/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-8"
            >
              Join room
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
