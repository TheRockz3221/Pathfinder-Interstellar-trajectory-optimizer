"use client";

import { useEffect, useState } from "react";
import { Github, LogIn, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";

export function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return (
      <section className="glass rounded-lg p-4 text-sm text-slate-300">
        Add Supabase environment variables to enable Email, Google, and GitHub authentication.
      </section>
    );
  }

  if (session) {
    return (
      <section className="glass rounded-lg p-4">
        <p className="text-sm font-medium text-white">{session.user.email}</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm text-slate-200"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </section>
    );
  }

  const signIn = async () => {
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in.");
  };

  const signUp = async () => {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Check your inbox to confirm the account.");
  };

  return (
    <section className="glass rounded-lg p-4">
      <div className="mb-3 flex items-center gap-2">
        <LogIn size={17} className="text-cyan-signal" />
        <h2 className="text-base font-semibold text-white">Mission Account</h2>
      </div>
      <div className="grid gap-2">
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="field" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" className="field" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={signIn} className="h-10 rounded-md border border-cyan-signal/25 bg-cyan-signal/10 text-sm text-cyan-soft">Sign in</button>
          <button onClick={signUp} className="h-10 rounded-md border border-white/10 bg-white/5 text-sm text-slate-200">Sign up</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: "google" })} className="h-10 rounded-md border border-gold-mission/25 bg-gold-mission/10 text-sm text-gold-mission">Google</button>
          <button onClick={() => supabase.auth.signInWithOAuth({ provider: "github" })} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 text-sm text-slate-200">
            <Github size={15} />
            GitHub
          </button>
        </div>
        {message && <p className="text-xs text-slate-300">{message}</p>}
      </div>
    </section>
  );
}
