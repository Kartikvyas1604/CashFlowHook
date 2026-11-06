/**
 * Session store — sign-in gate for the demo app.
 *
 * Two auth paths:
 *  - privy: Privy (email/wallet) drives the session; lib bridge mirrors
 *    the Privy user into this store (components/privy.tsx). Sign-out
 *    requests route through Privy's logout to close its session too.
 *  - demo: fallback used ONLY when no Privy app id is configured — any
 *    well-formed email + password ≥ 8 chars signs in (disclosed in UI).
 *
 * Every action PRUNES no-op commits so `getSnapshot` stays a stable
 * object between real changes (useSyncExternalStore contract).
 */

import { useSyncExternalStore } from "react";

export type SessionProvider = "privy" | "demo";

export type SessionState = {
  status: "signed-out" | "validating" | "signed-in";
  email: string | null;
  /** last submitted-but-rejected reason, cleared on next attempt */
  error: string | null;
  /** which auth path is holding the session */
  provider: SessionProvider | null;
  /** set so the Privy bridge runs the real logout() on its own tick */
  pendingSignOut: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_MIN = 8;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return "Enter your email";
  if (!EMAIL_RE.test(value.trim()))
    return "That doesn't look like a valid email address";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Enter your password";
  if (value.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters`;
  return null;
}

function freshSignOut(): SessionState {
  return {
    status: "signed-out",
    email: null,
    error: null,
    provider: null,
    pendingSignOut: false,
  };
}

let state: SessionState = freshSignOut();

const listeners = new Set<() => void>();

function commit(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const sessionActions = {
  /** Privy confirmed an authenticated user — mirror it (no-op-safe). */
  privySignIn(email: string | null) {
    if (state.pendingSignOut || state.status === "validating") return;
    if (
      state.provider === "privy" &&
      state.status === "signed-in" &&
      state.email === email
    ) {
      return; // identical — keep the snapshot stable
    }
    commit({
      status: "signed-in",
      email,
      error: null,
      provider: "privy",
      pendingSignOut: false,
    });
  },

  /** Privy reported no session — clear it only if Privy owns ours. */
  privySessionInactive() {
    if (state.provider !== "privy") return;
    commit(freshSignOut());
  },

  /** demo fallback sign-in (only when Privy is not configured) */
  signIn(email: string, password: string): {
    emailError: string | null;
    passwordError: string | null;
  } {
    if (state.status === "validating") {
      return { emailError: null, passwordError: null };
    }
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError ?? passwordError) {
      commit({ ...state, error: emailError ?? passwordError });
      return { emailError, passwordError };
    }
    const clean = email.trim().toLowerCase();
    commit({
      status: "validating",
      email: clean,
      error: null,
      provider: state.provider ?? "demo",
      pendingSignOut: false,
    });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      commit({
        status: "signed-in",
        email: clean,
        error: null,
        provider: "demo",
        pendingSignOut: false,
      });
    }, 900);
    return { emailError: null, passwordError: null };
  },

  signOut() {
    if (state.provider === "privy") {
      if (state.pendingSignOut) return;
      commit({ ...state, pendingSignOut: true }); // bridge completes via logout()
      return;
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    commit(freshSignOut());
  },
};

export function getSession(): SessionState {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** stable snapshots only (getSnapshot contract) */
export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSession, getSession);
}
