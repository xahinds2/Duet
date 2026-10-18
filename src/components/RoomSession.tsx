"use client";

import Peer, { type DataConnection, type MediaConnection } from "peerjs";
import { useEffect, useRef, useState } from "react";
import { canUseMedia, getCameraStream, getScreenStream, stopStream } from "@/lib/media";
import { peerIdForRoom } from "@/lib/room";
import {
  CamIcon,
  CamOffIcon,
  InviteIcon,
  LeaveIcon,
  MicIcon,
  MicOffIcon,
  ScreenIcon,
} from "./RoomIcons";
import { VideoTile } from "./VideoTile";

type RoomSessionProps = {
  code: string;
  isHost: boolean;
  onLeave: () => void;
};

type Status = "connecting" | "waiting" | "connected" | "error";

type SignalMessage =
  | { type: "hello" }
  | { type: "screen-ended" }
  | { type: "yield-screen" };

export function RoomSession({ code, isHost, onLeave }: RoomSessionProps) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [permBusy, setPermBusy] = useState(false);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [localCam, setLocalCam] = useState<MediaStream | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [remoteCam, setRemoteCam] = useState<MediaStream | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [secureOk, setSecureOk] = useState(true);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const callsRef = useRef<MediaConnection[]>([]);
  const screenCallRef = useRef<MediaConnection | null>(null);
  const localCamRef = useRef<MediaStream | null>(null);
  const localScreenRef = useRef<MediaStream | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  const camSentRef = useRef(false);

  useEffect(() => {
    setSecureOk(canUseMedia());
  }, []);

  const stopLocalScreen = () => {
    screenCallRef.current?.close();
    screenCallRef.current = null;
    stopStream(localScreenRef.current);
    localScreenRef.current = null;
    setLocalScreen(null);
  };

  const enableMedia = async () => {
    setPermBusy(true);
    setError(null);

    if (!canUseMedia()) {
      setSecureOk(false);
      setError(
        "iPhone needs HTTPS for camera access. Open the https:// link from your Mac (not http://).",
      );
      setPermBusy(false);
      return;
    }

    try {
      const cam = await getCameraStream();
      localCamRef.current = cam;
      setLocalCam(cam);
      setSessionStarted(true);
      setStatus("connecting");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError") {
        setError("Permission denied. In Chrome → Site settings, allow Camera and Microphone, then try again.");
      } else if (name === "NotFoundError") {
        setError("No camera or mic found on this device.");
      } else {
        setError("Could not access camera or mic. Check Chrome permissions for this site.");
      }
    } finally {
      setPermBusy(false);
    }
  };

  useEffect(() => {
    if (!sessionStarted || !localCamRef.current) return;

    let cancelled = false;
    const hostId = peerIdForRoom(code);
    camSentRef.current = false;

    const hangUpCalls = () => {
      callsRef.current.forEach((c) => c.close());
      callsRef.current = [];
      screenCallRef.current = null;
    };

    const sendCam = (peer: Peer, remoteId: string) => {
      if (camSentRef.current || !localCamRef.current) return;
      camSentRef.current = true;
      const camCall = peer.call(remoteId, localCamRef.current, {
        metadata: { kind: "camera" },
      });
      if (camCall) callsRef.current.push(camCall);
    };

    const wireConnection = (peer: Peer, conn: DataConnection) => {
      connRef.current = conn;
      remotePeerIdRef.current = conn.peer;

      conn.on("open", () => {
        if (cancelled) return;
        setStatus("connected");
        conn.send({ type: "hello" } satisfies SignalMessage);
        sendCam(peer, conn.peer);
      });

      conn.on("data", (raw) => {
        const msg = raw as SignalMessage;
        if (msg.type === "yield-screen") {
          stopStream(localScreenRef.current);
          localScreenRef.current = null;
          setLocalScreen(null);
          screenCallRef.current?.close();
          screenCallRef.current = null;
          conn.send({ type: "screen-ended" } satisfies SignalMessage);
        }
        if (msg.type === "screen-ended") {
          setRemoteScreen(null);
        }
      });

      conn.on("close", () => {
        if (cancelled) return;
        setStatus("waiting");
        setRemoteCam(null);
        setRemoteScreen(null);
        remotePeerIdRef.current = null;
        camSentRef.current = false;
        stopStream(localScreenRef.current);
        localScreenRef.current = null;
        setLocalScreen(null);
      });
    };

    const peer = isHost ? new Peer(hostId, { debug: 0 }) : new Peer({ debug: 0 });
    peerRef.current = peer;

    peer.on("open", () => {
      if (cancelled) return;
      if (isHost) {
        setStatus("waiting");
      } else {
        const conn = peer.connect(hostId, { reliable: true });
        wireConnection(peer, conn);
      }
    });

    peer.on("connection", (conn) => {
      if (cancelled) return;
      if (connRef.current?.open) {
        conn.close();
        return;
      }
      wireConnection(peer, conn);
    });

    peer.on("call", (call) => {
      call.answer();
      callsRef.current.push(call);
      const kind = (call.metadata as { kind?: string } | undefined)?.kind ?? "camera";

      call.on("stream", (stream) => {
        if (kind === "screen") setRemoteScreen(stream);
        else setRemoteCam(stream);
      });

      call.on("close", () => {
        if (kind === "screen") setRemoteScreen(null);
        else setRemoteCam(null);
      });
    });

    peer.on("error", (err) => {
      if (cancelled) return;
      if (err.type === "peer-unavailable") {
        setError("Room not found yet — ask your partner to start the room first.");
        setStatus("error");
        return;
      }
      if (err.type === "unavailable-id") {
        setError("That room is already open in another tab.");
        setStatus("error");
        return;
      }
      setError(err.message || "Connection failed.");
      setStatus("error");
    });

    return () => {
      cancelled = true;
      hangUpCalls();
      connRef.current?.close();
      peer.destroy();
      stopStream(localScreenRef.current);
      localScreenRef.current = null;
      setLocalScreen(null);
      setRemoteCam(null);
      setRemoteScreen(null);
    };
  }, [sessionStarted, code, isHost]);

  const toggleCam = () => {
    const track = localCamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  };

  const toggleMic = () => {
    const track = localCamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const shareScreen = async () => {
    const peer = peerRef.current;
    const remoteId = remotePeerIdRef.current;
    if (!peer || !remoteId || sharingBusy) return;

    setSharingBusy(true);
    setError(null);

    try {
      if (remoteScreen) {
        connRef.current?.send({ type: "yield-screen" } satisfies SignalMessage);
        setRemoteScreen(null);
        await new Promise((r) => setTimeout(r, 200));
      }

      stopLocalScreen();

      const screen = await getScreenStream();
      localScreenRef.current = screen;
      setLocalScreen(screen);

      const call = peer.call(remoteId, screen, { metadata: { kind: "screen" } });
      if (call) {
        screenCallRef.current = call;
        callsRef.current.push(call);
      }

      screen.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopLocalScreen();
        connRef.current?.send({ type: "screen-ended" } satisfies SignalMessage);
      });
    } catch {
      setError("Screen share isn’t available in this browser (iPhone Chrome doesn’t support it).");
    } finally {
      setSharingBusy(false);
    }
  };

  const stopSharing = () => {
    stopLocalScreen();
    connRef.current?.send({ type: "screen-ended" } satisfies SignalMessage);
  };

  const copyInvite = async () => {
    const url = `${window.location.origin}/room/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // iOS may block clipboard without https / gesture — ignore
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const leave = () => {
    callsRef.current.forEach((c) => c.close());
    connRef.current?.close();
    peerRef.current?.destroy();
    stopStream(localCamRef.current);
    stopStream(localScreenRef.current);
    onLeave();
  };

  const stageStream = localScreen ?? remoteScreen;
  const stageLabel = localScreen ? "Your screen" : remoteScreen ? "Their screen" : undefined;
  const connected = status === "connected";

  const statusOverlay =
    status !== "connected" ? (
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-ink/75 px-5 text-center backdrop-blur-sm md:gap-3 md:px-6">
        {status === "connecting" && (
          <p className="room-status-copy font-display text-xl text-foam/90 md:text-2xl">
            Connecting…
          </p>
        )}
        {status === "waiting" && (
          <>
            <p className="room-status-copy font-display text-2xl text-foam md:text-3xl">
              Waiting for your person
            </p>
            <p className="room-status-sub max-w-sm text-sm text-foam/60 md:text-base">
              Copy the invite and send it. They join with the same room code.
            </p>
          </>
        )}
        {status === "error" && <p className="max-w-md text-sm text-berry-soft md:text-base">{error}</p>}
      </div>
    ) : null;

  const roundBtn =
    "flex h-12 w-12 items-center justify-center rounded-full transition active:scale-95";

  if (!sessionStarted) {
    return (
      <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-[#0f0e0d] px-6 text-center text-foam">
        <div className="pointer-events-none absolute inset-0 stage-glow" aria-hidden />
        <p className="font-display text-3xl">Duet</p>
        <p className="mt-2 text-sm tracking-wide text-foam/45">{code}</p>
        <p className="mt-6 max-w-sm text-base text-foam/70">
          Allow camera and mic so you can see each other. iPhone needs a tap to show the permission
          prompt.
        </p>
        {!secureOk && (
          <p className="mt-4 max-w-sm text-sm text-berry-soft">
            This page is not HTTPS. On iPhone, open the <strong>https://</strong> network URL from
            your Mac terminal (accept the certificate warning), then try again.
          </p>
        )}
        {error && <p className="mt-4 max-w-sm text-sm text-berry-soft">{error}</p>}
        <button
          type="button"
          onClick={enableMedia}
          disabled={permBusy}
          className="mt-8 touch-target rounded-2xl bg-foam px-8 py-3.5 text-base font-medium text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {permBusy ? "Requesting…" : "Allow camera & mic"}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="mt-4 text-sm text-foam/45 transition active:text-foam/70"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="room-shell relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-[#0f0e0d] text-foam">
      <div className="pointer-events-none absolute inset-0 stage-glow" aria-hidden />

      <header className="room-header room-header-phone safe-pad-x relative z-20 flex shrink-0 items-center gap-2 pt-[max(0.75rem,var(--safe-top))] pb-2">
        <span className="room-header-title font-display text-xl tracking-tight">Duet</span>
        <span className="truncate text-xs text-foam/45">{code}</span>
        {localScreen && (
          <span className="ml-auto truncate text-xs text-[#8ab4f8]">Presenting</span>
        )}
        {remoteScreen && !localScreen && (
          <span className="ml-auto truncate text-xs text-foam/45">Partner presenting</span>
        )}
      </header>

      <main className="room-layout-phone room-mobile-stack safe-pad-x relative z-10 flex min-h-0 flex-1 flex-col gap-2 pb-0">
        <div className="room-mobile-stage relative min-h-0 flex-[1.35] overflow-hidden rounded-xl border border-foam/10 bg-ink-soft">
          <VideoTile
            stream={stageStream}
            muted={Boolean(localScreen)}
            fill
            label={stageLabel}
            showEmptyAvatar={false}
            className="absolute inset-0 h-full w-full"
          />
          {statusOverlay}
          {connected && !stageStream && !statusOverlay && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="room-empty-hint font-display text-lg text-foam/35">
                Tap Share when you’re ready
              </p>
            </div>
          )}
        </div>

        <div className="room-mobile-cams grid shrink-0 grid-cols-2 gap-2">
          <VideoTile
            stream={remoteCam}
            label="Partner"
            emptyLabel="Partner"
            className="aspect-[4/3] rounded-xl border border-foam/20"
          />
          <VideoTile
            stream={localCam}
            muted
            mirror
            label="You"
            emptyLabel="You"
            micMuted={!micOn}
            className="aspect-[4/3] rounded-xl border border-foam/20"
          />
        </div>

        <div className="room-mobile-controls safe-pad-b flex shrink-0 items-center justify-center pt-1">
          <div className="flex items-center gap-2 rounded-full bg-[#2a2420]/95 px-2.5 py-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.45)] backdrop-blur-md">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={micOn ? "Mute mic" : "Unmute mic"}
              className={`${roundBtn} ${micOn ? "bg-foam/10 text-foam" : "bg-berry text-white"}`}
            >
              {micOn ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={toggleCam}
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
              className={`${roundBtn} ${camOn ? "bg-foam/10 text-foam" : "bg-berry text-white"}`}
            >
              {camOn ? <CamIcon className="h-5 w-5" /> : <CamOffIcon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={localScreen ? stopSharing : shareScreen}
              disabled={!connected || sharingBusy}
              aria-label={localScreen ? "Stop sharing" : "Share screen"}
              className={`${roundBtn} disabled:opacity-40 ${
                localScreen ? "bg-[#8ab4f8] text-ink" : "bg-foam/10 text-foam"
              }`}
            >
              <ScreenIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={copyInvite}
              aria-label={copied ? "Invite copied" : "Copy invite"}
              className={`${roundBtn} bg-foam/10 text-foam`}
            >
              <InviteIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={leave}
              aria-label="Leave"
              className={`${roundBtn} w-14 bg-berry text-white`}
            >
              <LeaveIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </main>

      <div className="room-layout-desktop relative z-10 min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 px-5 pt-3 pb-2 lg:px-6">
          <span className="font-display text-lg text-foam/90">Duet</span>
          <span className="text-foam/25">·</span>
          <span className="truncate text-sm tracking-wide text-foam/55">{code}</span>
          {localScreen && (
            <span className="ml-auto rounded-full bg-[#1e3a5f]/90 px-3 py-1 text-sm text-foam/90">
              You are presenting
            </span>
          )}
          {remoteScreen && !localScreen && (
            <span className="ml-auto rounded-full bg-foam/10 px-3 py-1 text-sm text-foam/70">
              Partner is presenting
            </span>
          )}
        </header>

        <div className="relative flex min-h-0 flex-1 gap-3 px-4 pb-24 lg:gap-4 lg:px-5">
          <section className="relative min-h-0 min-w-0 flex-[1_1_72%] overflow-hidden rounded-2xl bg-[#1a1714]">
            <VideoTile
              stream={stageStream}
              muted={Boolean(localScreen)}
              fill
              showEmptyAvatar={false}
              className="absolute inset-0 h-full w-full rounded-2xl"
            />
            {statusOverlay}
            {connected && !stageStream && !statusOverlay && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-display text-2xl text-foam/30">Waiting for a screen</p>
              </div>
            )}
          </section>

          <aside className="flex w-[min(22vw,280px)] shrink-0 flex-col gap-3">
            <VideoTile
              stream={remoteCam}
              label="Partner"
              emptyLabel="Partner"
              className="min-h-0 flex-1 rounded-2xl"
            />
            <VideoTile
              stream={localCam}
              muted
              mirror
              label="You"
              emptyLabel="You"
              micMuted={!micOn}
              className="min-h-0 flex-1 rounded-2xl"
            />
          </aside>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-5">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#2a2420]/95 px-3 py-2 shadow-[0_8px_32px_rgb(0_0_0/0.45)] backdrop-blur-md">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={micOn ? "Mute mic" : "Unmute mic"}
              className={`${roundBtn} ${
                micOn ? "bg-foam/10 text-foam hover:bg-foam/15" : "bg-berry text-white"
              }`}
            >
              {micOn ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={toggleCam}
              aria-label={camOn ? "Turn camera off" : "Turn camera on"}
              className={`${roundBtn} ${
                camOn ? "bg-foam/10 text-foam hover:bg-foam/15" : "bg-berry text-white"
              }`}
            >
              {camOn ? <CamIcon className="h-5 w-5" /> : <CamOffIcon className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={localScreen ? stopSharing : shareScreen}
              disabled={!connected || sharingBusy}
              aria-label={localScreen ? "Stop sharing" : "Share screen"}
              className={`${roundBtn} disabled:opacity-40 ${
                localScreen
                  ? "bg-[#8ab4f8] text-ink hover:bg-[#aecbfa]"
                  : "bg-foam/10 text-foam hover:bg-foam/15"
              }`}
            >
              <ScreenIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={copyInvite}
              aria-label={copied ? "Invite copied" : "Copy invite"}
              className={`${roundBtn} bg-foam/10 text-foam hover:bg-foam/15`}
            >
              <InviteIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={leave}
              aria-label="Leave"
              className={`${roundBtn} w-14 rounded-full bg-berry text-white hover:bg-berry/90`}
            >
              <LeaveIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {error && status === "connected" && (
          <p className="absolute bottom-20 left-1/2 z-30 -translate-x-1/2 text-sm text-berry-soft">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
