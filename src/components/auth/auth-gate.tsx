"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/responses";
import MasterDataScreen from "@/components/master-data/master-data-screen";
import CashFlowScreen from "@/components/cash-flow/cash-flow-screen";
import BudgetScreen from "@/components/budget/budget-screen";
import DashboardScreen from "@/components/dashboard/dashboard-screen";

type Session = { authenticated: boolean; expiresAt: number | null };

export default function AuthGate() {
  const [status, setStatus] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<ApiEnvelope<Session>>("auth/session")
      .then(({ data }) => {
        setExpiresAt(data?.expiresAt ?? null);
        setStatus(data?.authenticated ? "signed-in" : "signed-out");
      })
      .catch(() => setStatus("signed-out"));
  }, []);

  useEffect(() => {
    if (status !== "signed-in" || expiresAt === null) return;
    const timeout = window.setTimeout(() => setStatus("signed-out"), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [status, expiresAt]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { data } = await apiRequest<ApiEnvelope<Session>>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      setExpiresAt(data?.expiresAt ?? null);
      setAccessKey("");
      setStatus("signed-in");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login gagal. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "checking") {
    return <main className="auth-page"><p className="auth-muted">Memeriksa sesi…</p></main>;
  }

  if (status === "signed-in") return <AuthenticatedWorkspace />;

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-label="Budgeting App">
          <span className="auth-brand-mark">B</span><span>Budgeting</span>
        </div>
        <p className="auth-eyebrow">RUANG PRIBADI</p>
        <h1 className="auth-title" id="auth-title">Masuk ke aplikasi</h1>
        <p className="auth-description">Masukkan kunci akses untuk membuka data budgeting Anda.</p>
        <form className="auth-form" onSubmit={login}>
          <label className="auth-label" htmlFor="access-key">Kunci akses</label>
          <Input
            className="auth-input"
            id="access-key"
            type="password"
            autoComplete="current-password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            required
            autoFocus
          />
          {error && <p className="auth-error" role="alert">{error}</p>}
          <Button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Memeriksa…" : "Masuk"}
          </Button>
        </form>
        <p className="auth-muted">Sesi berakhir otomatis setelah 30 menit.</p>
      </section>
    </main>
  );
}

function AuthenticatedWorkspace() {
  const [page, setPage] = useState<"dashboard" | "cash-flow" | "budget" | "master-data">("dashboard");

  async function logout() {
    await apiRequest("auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <>
      <header className="app-shell-header">
        <div className="app-shell-inner">
          <div className="brand-lockup" aria-label="Budgeting App">
            <span className="brand-mark">B</span><span>Budgeting</span>
          </div>
          <nav className="app-shell-nav" aria-label="Navigasi utama">
            <Button
              type="button"
              className={page === "dashboard" ? "app-nav-link active" : "app-nav-link"}
              aria-current={page === "dashboard" ? "page" : undefined}
              onClick={() => setPage("dashboard")}
            >
              Ringkasan
            </Button>
            <Button
              type="button"
              className={page === "budget" ? "app-nav-link active" : "app-nav-link"}
              aria-current={page === "budget" ? "page" : undefined}
              onClick={() => setPage("budget")}
            >
              Budgeting
            </Button>
            <Button
              type="button"
              className={page === "cash-flow" ? "app-nav-link active" : "app-nav-link"}
              aria-current={page === "cash-flow" ? "page" : undefined}
              onClick={() => setPage("cash-flow")}
            >
              Arus kas
            </Button>
            <Button
              type="button"
              className={page === "master-data" ? "app-nav-link active" : "app-nav-link"}
              aria-current={page === "master-data" ? "page" : undefined}
              onClick={() => setPage("master-data")}
            >
              Master data
            </Button>
          </nav>
          <Button className="button button-secondary app-logout" type="button" onClick={logout}>
            Keluar
          </Button>
        </div>
      </header>
      {page === "dashboard" ? <DashboardScreen /> : page === "cash-flow" ? <CashFlowScreen /> : page === "budget" ? <BudgetScreen /> : <MasterDataScreen />}
    </>
  );
}
