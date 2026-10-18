"use client";

import { useEffect, useRef } from "react";

type VideoTileProps = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  label?: string;
  className?: string;
  fill?: boolean;
  micMuted?: boolean;
  emptyLabel?: string;
  /** Letter avatar when there’s no stream — off for the main stage */
  showEmptyAvatar?: boolean;
};

export function VideoTile({
  stream,
  muted = false,
  mirror = false,
  label,
  className = "",
  fill = false,
  micMuted = false,
  emptyLabel = "Waiting…",
  showEmptyAvatar = true,
}: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) {
      void el.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className={`relative overflow-hidden bg-[#2a2420] ${className}`}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full ${mirror ? "scale-x-[-1]" : ""} ${
          fill ? "object-contain bg-ink" : "object-cover"
        }`}
      />
      {!stream && showEmptyAvatar && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#3a322c] to-[#1f1b18] px-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foam/10 font-display text-xl text-foam/50">
            {emptyLabel.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      {micMuted && (
        <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-foam">
          <MicOffIcon className="h-3.5 w-3.5" />
        </span>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-ink/55 px-2 py-0.5 text-xs tracking-wide text-foam/90 backdrop-blur-sm">
          {label}
        </span>
      )}
    </div>
  );
}

function MicOffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19 11a7 7 0 0 1-14 0M12 18v3M8 21h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M4 4l16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
