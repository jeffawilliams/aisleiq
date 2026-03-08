import { useState, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient.js";

export type UserRole = "standard" | "admin" | null;

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
    // Resolve initial session — clears authLoading once known
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    // Synchronous callback — async here prevents React from reliably
    // processing state updates on sign-out (Supabase doesn't await the Promise)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch role in a separate effect so onAuthStateChange stays synchronous
  useEffect(() => {
    if (!user) {
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, role, authLoading, signIn, signOut };
}
