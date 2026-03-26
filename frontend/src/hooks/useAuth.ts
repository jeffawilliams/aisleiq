import { useState, useEffect, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export type UserRole = "standard" | "admin" | null;

// localStorage key used to track the anonymous user ID across navigation (magic link, OAuth redirect)
const ANON_UID_KEY = "sla_anon_uid";

function isAnonUser(user: User | null): boolean {
  return !!(user as any)?.is_anonymous;
}

async function fetchRole(userId: string): Promise<UserRole> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role as UserRole) ?? "standard";
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // When a registered sign-in needs migration, we hold the session here and
  // delay setting user state until claim_anonymous_lists completes — this
  // prevents useLists from loading before the migrated list is available.
  const [pendingMigrationUid, setPendingMigrationUid] = useState<string | null>(null);
  const pendingSessionRef = useRef<Session | null>(null);

  useEffect(() => {
    // If the app was opened via a magic link or OAuth redirect, the anon_uid
    // param we embedded in the redirect URL carries the anonymous UID into the
    // new browser window where localStorage would otherwise be empty.
    const urlParams = new URLSearchParams(window.location.search);
    const urlAnonUid = urlParams.get("anon_uid");
    if (urlAnonUid) {
      localStorage.setItem(ANON_UID_KEY, urlAnonUid);
      urlParams.delete("anon_uid");
      const cleanUrl = window.location.pathname + (urlParams.toString() ? "?" + urlParams.toString() : "");
      window.history.replaceState({}, "", cleanUrl);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        if (isAnonUser(session.user)) {
          localStorage.setItem(ANON_UID_KEY, session.user.id);
        }
        setSession(session);
        setUser(session.user);
        setAuthLoading(false);
      } else {
        // No session — create an anonymous one; onAuthStateChange handles state updates
        supabase.auth.signInAnonymously();
      }
    });

    // Synchronous callback — async here prevents React from reliably
    // processing state updates on sign-out (Supabase doesn't await the Promise)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (isAnonUser(session.user)) {
          // Anonymous session established — record UID for later migration
          localStorage.setItem(ANON_UID_KEY, session.user.id);
        } else {
          // Registered user signed in — migrate anonymous list if one is pending
          const anonUid = localStorage.getItem(ANON_UID_KEY);
          if (anonUid && anonUid !== session.user.id) {
            // Hold auth loading state until migration finishes so useLists
            // doesn't query before the list has been reassigned
            pendingSessionRef.current = session;
            setPendingMigrationUid(anonUid);
            return;
          }
        }
      }

      // Re-create anonymous session after sign-out — fire and forget,
      // the subsequent SIGNED_IN event will update state
      if (event === "SIGNED_OUT") {
        supabase.auth.signInAnonymously();
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Run migration then settle auth — keeps useLists from loading before the list is migrated
  useEffect(() => {
    if (!pendingMigrationUid || !pendingSessionRef.current) return;
    const targetSession = pendingSessionRef.current;

    supabase.rpc("claim_anonymous_lists", { anon_user_id: pendingMigrationUid })
      .then(() => {
        localStorage.removeItem(ANON_UID_KEY);
        pendingSessionRef.current = null;
        setPendingMigrationUid(null);
        setSession(targetSession);
        setUser(targetSession.user);
        setAuthLoading(false);
      });
  }, [pendingMigrationUid]);

  // Fetch role in a separate effect so onAuthStateChange stays synchronous.
  // Anonymous users are always standard — skip the DB call.
  useEffect(() => {
    if (!user || isAnonUser(user)) {
      setRole(null);
      return;
    }
    fetchRole(user.id).then(setRole);
  }, [user?.id]);

  const signIn = async (email: string) => {
    // Embed the anonymous UID in the redirect URL so it survives being opened
    // in a new browser window (magic link flow)
    const anonUid = localStorage.getItem(ANON_UID_KEY);
    const redirectTo = anonUid
      ? `${window.location.origin}?anon_uid=${anonUid}`
      : window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const anonUid = localStorage.getItem(ANON_UID_KEY);
    const redirectTo = anonUid
      ? `${window.location.origin}?anon_uid=${anonUid}`
      : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAnonymous = isAnonUser(user);

  return { session, user, role, authLoading, isAnonymous, signIn, signInWithGoogle, signOut };
}
