import type { MeResponse } from './auth.models';

const KEY = 'thriftos.session';
export const SIGNED_OUT_EVENT = 'thriftos:signed-out';

/**
 * The signed-in person's own profile and business, kept on this phone so the installed app opens at once
 * (they are refreshed from the server in the background). Bound to one user id, removed at sign-out.
 */
interface SessionCache {
  userId: string;
  me?: MeResponse;
  tenant?: unknown;
  /** Other answers a screen wants to show at once next time (owner home numbers). */
  screens?: Record<string, unknown>;
}

function read(): SessionCache | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && typeof v.userId === 'string' ? v : null;
  } catch {
    return null;
  }
}

function write(v: SessionCache): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode: the app just loads from the server */
  }
}

export const sessionCache = {
  /** The cached profile, only if it belongs to this user. */
  me(userId: string): MeResponse | null {
    const c = read();
    return c?.userId === userId ? (c.me ?? null) : null;
  },
  saveMe(me: MeResponse): void {
    const c = read();
    write(c?.userId === me.user.id ? { ...c, me } : { userId: me.user.id, me });
  },
  tenant<T>(): T | null {
    return (read()?.tenant as T) ?? null;
  },
  saveTenant(tenant: unknown): void {
    const c = read();
    if (c) write({ ...c, tenant });
  },
  /** A screen's last answer for this person (shown at once while the fresh one loads). */
  screen<T>(key: string): T | null {
    return (read()?.screens?.[key] as T) ?? null;
  },
  saveScreen(key: string, value: unknown): void {
    const c = read();
    if (c) write({ ...c, screens: { ...c.screens, [key]: value } });
  },
  /** Sign-out: forget everything about this person on the phone, and tell the services holding it. */
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  },
};
