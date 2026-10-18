function isMobileUa(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function canUseMedia(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export async function getCameraStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API unavailable. Open Duet over HTTPS or localhost.");
  }

  const mobile = isMobileUa();

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: mobile
        ? { facingMode: { ideal: "user" } }
        : {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
      audio: true,
    });
  } catch (firstError) {
    // iOS often rejects richer constraints — fall back to the simplest ask
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      throw firstError;
    }
  }
}

export async function getScreenStream(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen share is not supported in this browser.");
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
