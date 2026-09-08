import React, { useEffect, useState } from "react";
import Icon from "./Icon.tsx";
import { enablePush, pushPermissionState } from "../lib/push.ts";

interface Props {
  userId: string;
  role: "admin" | "customer";
  /** "chip" (default) shows a pill button; "icon" shows just a bell icon button */
  variant?: "chip" | "icon";
  className?: string;
}

/**
 * Lets a signed-in user turn on push notifications for THIS device.
 * Hidden entirely when the browser can't do web push or Firebase isn't configured.
 */
export default function PushToggle({ userId, role, variant = "chip", className = "" }: Props) {
  const [state, setState] = useState<ReturnType<typeof pushPermissionState>>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setState(pushPermissionState()); }, []);

  // Already on, or the platform can't do it → nothing to show.
  if (state === "unsupported" || state === "granted") return null;

  const denied = state === "denied";

  const onClick = async () => {
    if (denied || busy) return;
    setBusy(true);
    const result = await enablePush(userId, role);
    setBusy(false);
    setState(result === "granted" ? "granted" : result === "denied" ? "denied" : "default");
  };

  const label = denied ? "Notifications blocked" : busy ? "Enabling…" : "Enable notifications";

  if (variant === "icon") {
    return (
      <button
        onClick={onClick}
        disabled={denied || busy}
        title={label}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-full border border-current/20 hover:bg-black/5 transition-all disabled:opacity-50 ${className}`}
      >
        <Icon name={denied ? "notifications_off" : "notifications_active"} size={16} />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={denied || busy}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-full border border-current/20 text-xs font-semibold hover:bg-black/5 transition-all disabled:opacity-50 ${className}`}
    >
      <Icon name={denied ? "notifications_off" : "notifications_active"} size={14} />
      {label}
    </button>
  );
}
