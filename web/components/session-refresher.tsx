"use client";

import { useEffect } from "react";
import { ApiError, api } from "@/lib/api";
import { getToken, removeToken, setToken, subscribeAuth } from "@/lib/auth";

// Renew the access token this long before it actually expires, so a slightly
// stale clock or network latency never lets a real request race the expiry.
const REFRESH_BUFFER_MS = 60_000;
// If a refresh attempt fails for a reason that isn't "the session is truly over"
// (e.g. the API was briefly unreachable), retry instead of forcing a logout.
const RETRY_DELAY_MS = 15_000;

function decodeExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Mounted once near the root of the app. Keeps the session alive by silently
 * renewing the access token shortly before it expires — the user never sees
 * a logout unless the underlying session has genuinely run out (server-side
 * REFRESH_TOKEN_EXPIRE_DAYS) or the account was deactivated.
 */
export function SessionRefresher() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    let cancelled = false;

    function clear() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    async function doRefresh() {
      if (refreshing || cancelled) return;
      const token = getToken();
      if (!token) return;
      refreshing = true;
      try {
        const { access_token } = await api.auth.refresh(token);
        if (cancelled) return;
        setToken(access_token); // notifies subscribeAuth -> reschedule() runs for the new token
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          // The session genuinely ran out (or the account was deactivated) —
          // this is the one case where the user should actually be logged out.
          removeToken();
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard")) {
            window.location.href = "/login";
          }
        } else {
          clear();
          timer = setTimeout(doRefresh, RETRY_DELAY_MS);
        }
      } finally {
        refreshing = false;
      }
    }

    function reschedule() {
      clear();
      const token = getToken();
      if (!token) return;
      const exp = decodeExp(token);
      if (exp === null) return;
      const delay = Math.max(exp * 1000 - Date.now() - REFRESH_BUFFER_MS, 0);
      timer = setTimeout(doRefresh, delay);
    }

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const token = getToken();
      if (!token) return;
      const exp = decodeExp(token);
      // The tab may have been backgrounded (and its timers throttled) right past
      // the refresh point — catch up immediately instead of waiting for the timer.
      if (exp !== null && exp * 1000 - Date.now() <= REFRESH_BUFFER_MS) {
        doRefresh();
      } else {
        reschedule();
      }
    }

    const unsubscribe = subscribeAuth(reschedule);
    document.addEventListener("visibilitychange", onVisible);
    reschedule();

    return () => {
      cancelled = true;
      clear();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
