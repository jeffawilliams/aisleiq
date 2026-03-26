import { useState, useEffect } from "react";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Existing session — store anon UID if applicable, then settle auth state
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
          // Registered user signed in — migrate any anonymous list to their account
          const anonUid = localStorage.getItem(ANON_UID_KEY);
          if (anonUid && anonUid !== session.user.id) {
            supabase
              .rpc("claim_anonymous_lists", { anon_user_id: anonUid })
              .then(() => localStorage.removeItem(ANON_UID_KEY));
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
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAnonymous = isAnonUser(user);

  return { session, user, role, authLoading, isAnonymous, signIn, signInWithGoogle, signOut };
}
