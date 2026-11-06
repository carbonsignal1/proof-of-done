"use client";
import { useEffect, useRef, useState } from "react";

interface ButtonsInstance {
  render: (el: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}
declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: {
        style?: Record<string, unknown>;
        createOrder: () => Promise<string>;
        onApprove: (data: { orderID: string }) => Promise<void>;
        onError?: (err: unknown) => void;
      }) => ButtonsInstance;
    };
  }
}

let sdk: Promise<void> | null = null;
function loadSdk(clientId: string) {
  if (window.paypal) return Promise.resolve();
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    // intent=authorize: the buyer approves a hold, not an immediate charge.
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize&components=buttons`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      sdk = null;
      reject(new Error("Could not load the PayPal SDK"));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

export function PayPalHoldButton({ clientId, jobId, onHeld, onError }: { clientId: string; jobId: string; onHeld: () => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let buttons: ButtonsInstance | null = null;
    let cancelled = false;
    const post = async (body: unknown) => {
      const res = await fetch(`/api/jobs/${jobId}/hold`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "PayPal request failed");
      return json;
    };
    loadSdk(clientId)
      .then(() => {
        if (cancelled || !ref.current || !window.paypal) return;
        buttons = window.paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal", height: 44 },
          createOrder: async () => (await post({ action: "create" })).id,
          onApprove: async ({ orderID }) => {
            try {
              await post({ action: "authorize", orderID });
              onHeld();
            } catch (e) {
              onError(e instanceof Error ? e.message : String(e));
            }
          },
          onError: (err) => onError(err instanceof Error ? err.message : "PayPal checkout failed"),
        });
        ref.current.innerHTML = "";
        return buttons.render(ref.current).then(() => setReady(true));
      })
      .catch((e) => onError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      buttons?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, jobId]);

  return (
    <div>
      {!ready && <div className="muted small">Loading PayPal…</div>}
      <div ref={ref} />
    </div>
  );
}
