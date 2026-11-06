/**
 * Session store — sign-in gate for the demo app.
 *
 * The demo accepts any well-formed email + any password ≥ 8 chars (the
 * credentials never leave the store; there is no backend). What IS real
 * is the state machine every app needs: idle → validating → signed-in,
 * with field-level validation errors and a session error path.
 *
 * Snapshots must be stable objects (useSyncExternalStore contract) —
 * the session object is only replaced on a real state change.
 */

import { useSyncExternalStore } from "react";

export type SessionState = {
  status: "signed-out" | "validating" | "signed-in";
  email: string | null;
  /** last submitted-but-rejected reason, cleared on next attempt */
  error: string | null;
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

let state: SessionState = {
  status: "signed-out",
  email: null,
  error: null,
};

const listeners = new Set<() => void>();

function commit(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const sessionActions = {
  /** validate → brief validating state → signed-in (deterministic demo) */
  signIn(email: string, password: string): { emailError: string | null; passwordError: string | null } {
    if (state.status === "validating") return { emailError: null, passwordError: null };
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (emailError ?? passwordError) {
      commit({ ...state, error: emailError ?? passwordError });
      return { emailError, passwordError };
    }
    const clean = email.trim().toLowerCase();
    commit({ status: "validating", email: clean, error: null });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // demo rule (disclosed on the login card): well-formed credentials
      // sign in; the app holds no real accounts
      commit({ status: "signed-in", email: clean, error: null });
    }, 900);
    return { emailError: null, passwordError: null };
  },

  signOut() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    commit({ status: "signed-out", email: null, error: null });
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
