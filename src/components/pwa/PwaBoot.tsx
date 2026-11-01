"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaState {
  canInstall: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

const PwaCtx = createContext<PwaState>({
  canInstall: false,
  isStandalone: false,
  isIOS: false,
  promptInstall: async () => "unavailable",
});

export function usePwa() {
  return useContext(PwaCtx);
}

export default function PwaBoot({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(display-mode: standalone)");
    const navStandalone = "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(mq.matches || navStandalone);
    const onMq = (e: MediaQueryListEvent) => setIsStandalone(e.matches || navStandalone);
    mq.addEventListener("change", onMq);

    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) && !/MSStream/.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    setIsIOS(iOS && isSafari);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      // Register only in production — avoid a stale SW catching dev HMR assets.
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then((reg) => {
            // Check for updates on every page load.
            reg.update().catch(() => {});
            reg.addEventListener("updatefound", () => {
              const nw = reg.installing;
              if (!nw) return;
              nw.addEventListener("statechange", () => {
                if (nw.state === "installed" && navigator.serviceWorker.controller) {
                  nw.postMessage("SKIP_WAITING");
                }
              });
            });
          })
          .catch(() => {});

        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });
      } else {
        // Dev: ensure no leftover SW serves stale assets from a prior prod build.
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister().catch(() => {}));
        }).catch(() => {});
      }
    }

    return () => {
      mq.removeEventListener("change", onMq);
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      return choice.outcome;
    } catch {
      setDeferred(null);
      return "unavailable" as const;
    }
  }, [deferred]);

  const value = useMemo<PwaState>(
    () => ({
      canInstall: deferred !== null,
      isStandalone,
      isIOS,
      promptInstall,
    }),
    [deferred, isStandalone, isIOS, promptInstall],
  );

  return <PwaCtx.Provider value={value}>{children}</PwaCtx.Provider>;
}
