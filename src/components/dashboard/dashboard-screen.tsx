"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/responses";
import type { BudgetPeriodRecord, DashboardResponse } from "@/lib/budget/types";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function formatMoney(value: string | number) {
  return currency.format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatPeriod(period: Pick<BudgetPeriodRecord, "startsOn" | "endsOn">) {
  return `${formatDate(period.startsOn)} – ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${period.endsOn}T00:00:00.000Z`))}`;
}

function currentDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
}

const pieColors = ["#167a62", "#4b9b79", "#79b58e", "#a5c98e", "#d0bd6e", "#d99562", "#c97575", "#aa81b6", "#7189b7", "#63a8a5"];

function PieChartCard({
  title,
  description,
  slices,
  total,
  emptyMessage,
}: {
  title: string;
  description: string;
  slices: Array<{ id: string; label: string; amount: number }>;
  total: number;
  emptyMessage: string;
}) {
  const coloredSlices = slices.filter((slice) => slice.amount > 0).reduce<Array<typeof slices[number] & { color: string; start: number; end: number }>>((result, slice, index) => {
    const start = result.at(-1)?.end ?? 0;
    const end = start + (slice.amount / total) * 100;
    result.push({ ...slice, color: pieColors[index % pieColors.length], start, end });
    return result;
  }, []);
  const gradient = coloredSlices.length
    ? `conic-gradient(${coloredSlices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(", ")})`
    : "conic-gradient(#e9efeb 0% 100%)";

  return (
    <section className="dashboard-panel pie-chart-card" aria-label={title}>
      <div className="dashboard-panel-heading"><div><h2>{title}</h2><p>{description}</p></div></div>
      {coloredSlices.length ? <div className="pie-chart-content" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 20 }}>
        <div className="pie-chart" role="img" aria-label={`${title}, total ${formatMoney(total)}`} style={{ background: gradient, width: 184, height: 184, flex: "0 0 184px", borderRadius: "50%", display: "grid", placeItems: "center" } as CSSProperties}>
          <div className="pie-chart-center" style={{ display: "grid", width: "62%", aspectRatio: "1", alignContent: "center", justifyItems: "center", gap: 4, overflow: "hidden", padding: 8, borderRadius: "50%", background: "white", textAlign: "center" }}><strong>{formatMoney(total)}</strong><span>Total</span></div>
        </div>
        <ul className="pie-chart-legend" style={{ flex: "1 1 180px", minWidth: 0, display: "grid", gap: 10, margin: 0, padding: 0, listStyle: "none" }}>
          {coloredSlices.map((slice) => <li key={slice.id} style={{ display: "flex", minWidth: 0, alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span className="pie-legend-label" style={{ display: "flex", minWidth: 0, alignItems: "center", gap: 7, fontSize: 10 }}><i style={{ background: slice.color, width: 9, height: 9, flex: "0 0 auto", borderRadius: 3 }} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slice.label}</span></span>
            <span className="pie-legend-value" style={{ display: "grid", flex: "0 0 auto", justifyItems: "end", gap: 2, fontSize: 10, fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{Math.round((slice.amount / total) * 100)}%<small style={{ color: "#75827d", fontSize: 9, fontWeight: 450 }}>{formatMoney(slice.amount)}</small></span>
          </li>)}
        </ul>
      </div> : <div className="pie-chart-empty">{emptyMessage}</div>}
    </section>
  );
}

export default function DashboardScreen() {
  const [periods, setPeriods] = useState<BudgetPeriodRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<ApiEnvelope<BudgetPeriodRecord[]>>("budget-periods")
      .then(({ data: items }) => {
        if (!active) return;
        const available = items ?? [];
        setPeriods(available);
        const today = currentDate();
        const current = available.find((period) => period.startsOn <= today && period.endsOn >= today);
        setSelectedId(current?.id ?? available[0]?.id ?? "");
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoadingPeriods(false);
      });
    return () => { active = false; };
  }, []);

  const loadDashboard = useCallback(async () => {
    const response = await apiRequest<ApiEnvelope<DashboardResponse>>(`dashboard?periodId=${selectedId}`);
    if (!response.data) throw new Error("Ringkasan periode belum dapat dimuat.");
    return response.data;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    loadDashboard()
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => { active = false; };
  }, [loadDashboard, selectedId]);

  const categories = useMemo(
    () => [...(data?.categories ?? [])].sort((a, b) => Number(b.spent) - Number(a.spent)),
    [data],
  );
  const budgetChartSlices = useMemo(() => (data?.categories ?? [])
    .filter((category) => !category.category.parentId)
    .map((category) => ({ id: category.categoryId, label: category.category.name, amount: Number(category.amount) })), [data]);
  const expenseChartSlices = useMemo(() => (data?.categories ?? [])
    .filter((category) => !category.category.parentId)
    .map((category) => ({ id: category.categoryId, label: category.category.name, amount: Number(category.spent) })), [data]);

  if (loadingPeriods) {
    return <main className="dashboard-page"><div className="dashboard-container"><div className="loading-state"><span className="loading-dot" /> Memuat dashboard…</div></div></main>;
  }

  if (!periods.length) {
    return <main className="dashboard-page"><div className="dashboard-container">
      <header className="dashboard-heading"><div><p className="eyebrow">RINGKASAN</p><h1>Dashboard</h1><p className="page-description">Pantau arus kas dan pemakaian budget dalam satu periode.</p></div></header>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <section className="budget-empty"><span className="empty-icon">◷</span><h2>Belum ada periode budget</h2><p>Buat periode budget terlebih dulu. Dashboard akan menampilkan ringkasan untuk periode yang dipilih.</p></section>
    </div></main>;
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-container">
        <header className="dashboard-heading">
          <div><p className="eyebrow">RINGKASAN</p><h1>Dashboard</h1><p className="page-description">Pantau arus kas dan pemakaian budget dalam satu periode.</p></div>
          <label className="budget-period-picker"><span>Periode</span><Select value={selectedId} onValueChange={(value) => { setLoadingData(true); setSelectedId(value); }}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{formatPeriod(period)}</SelectItem>)}</SelectContent>
          </Select></label>
        </header>

        {error && <div className="notice notice-error" role="alert">{error}<Button className="text-button" onClick={() => setError("")}>Tutup</Button></div>}
        {loadingData || !data ? <div className="loading-state"><span className="loading-dot" /> Memuat ringkasan…</div> : <>
          <div className="dashboard-period-label">Periode {formatPeriod(data.period)}</div>
          <section className="dashboard-metrics" aria-label="Ringkasan keuangan">
            <Card className="dashboard-metric"><span>Pemasukan</span><strong className="positive">{formatMoney(data.summary.income)}</strong></Card>
            <Card className="dashboard-metric"><span>Pengeluaran</span><strong className="negative">{formatMoney(data.summary.expense)}</strong></Card>
            <Card className="dashboard-metric"><span>Selisih arus kas</span><strong className={Number(data.summary.netCashFlow) < 0 ? "negative" : "positive"}>{formatMoney(data.summary.netCashFlow)}</strong></Card>
            <Card className="dashboard-metric"><span>Sisa budget</span><strong className={Number(data.summary.budgetRemaining) < 0 ? "negative" : "positive"}>{formatMoney(data.summary.budgetRemaining)}</strong></Card>
          </section>

        <section className="dashboard-pies" aria-label="Visualisasi alokasi budget dan pengeluaran" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 16, marginBottom: 16 }}>
          <PieChartCard
            title="Alokasi budget"
            description="Proporsi budget per kategori induk, termasuk subkategori"
            slices={budgetChartSlices}
            total={Number(data.summary.totalBudget)}
            emptyMessage="Belum ada alokasi budget pada periode ini."
          />
          <PieChartCard
            title="Distribusi pengeluaran"
            description="Pengeluaran per kategori induk, termasuk subkategori"
            slices={expenseChartSlices}
            total={Number(data.summary.budgetSpent)}
            emptyMessage="Belum ada pengeluaran pada periode ini."
          />
        </section>

          <div className="dashboard-columns">
            <section className="dashboard-panel dashboard-budget-panel" aria-labelledby="dashboard-budget-title">
              <div className="dashboard-panel-heading"><div><h2 id="dashboard-budget-title">Pemakaian budget</h2><p>{formatMoney(data.summary.budgetSpent)} terpakai dari {formatMoney(data.summary.totalBudget)}</p></div></div>
              {categories.length ? <div className="dashboard-category-list">
                {categories.map((category) => {
                  const planned = Number(category.amount);
                  const spent = Number(category.spent);
                  const percent = planned > 0 ? Math.min((spent / planned) * 100, 100) : spent > 0 ? 100 : 0;
                  const overBudget = spent > planned;
                  return <article className="dashboard-category" key={category.categoryId}>
                    <div className="dashboard-category-top"><strong>{category.category.parent ? `↳ ${category.category.name}` : category.category.name}{category.category.isArchived ? " · Diarsipkan" : ""}</strong><span className={overBudget ? "negative" : ""}>{formatMoney(category.remaining)}</span></div>
                    <div className="budget-progress" role="progressbar" aria-label={`Pemakaian budget ${category.category.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
                      <span className={overBudget ? "over" : ""} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="dashboard-category-bottom"><span>{formatMoney(spent)} terpakai{planned === 0 && spent > 0 ? " · belum dianggarkan" : ""}</span><span>Budget {formatMoney(planned)}</span></div>
                  </article>;
                })}
              </div> : <div className="empty-state"><h3>Belum ada kategori budget</h3><p>Tambahkan kategori pengeluaran di Master data.</p></div>}
            </section>

            <div className="dashboard-side-column">
              <section className="dashboard-panel" aria-labelledby="dashboard-accounts-title">
                <div className="dashboard-panel-heading"><div><h2 id="dashboard-accounts-title">Saldo akun</h2><p>Saldo terakhir berdasarkan catatan</p></div></div>
                {data.accountBalances.length ? <div className="dashboard-account-list">{data.accountBalances.map((account) => <div className="dashboard-account" key={account.id}>
                  <div><strong>{account.name}</strong><span>{account.isArchived ? "Diarsipkan" : account.type === "EWALLET" ? "E-wallet" : account.type === "CASH" ? "Tunai" : account.type === "BANK" ? "Bank" : "Lainnya"}</span></div><b>{formatMoney(account.balance)}</b>
                </div>)}</div> : <p className="dashboard-muted">Belum ada akun.</p>}
              </section>

              <section className="dashboard-panel" aria-labelledby="dashboard-activity-title">
                <div className="dashboard-panel-heading"><div><h2 id="dashboard-activity-title">Aktivitas terbaru</h2><p>Transaksi dan transfer pada periode ini</p></div></div>
                {data.recentActivity.length ? <div className="dashboard-activity-list">{data.recentActivity.map((activity) => <article className="dashboard-activity" key={activity.id}>
                  <div className={`activity-mark ${activity.type.toLowerCase()}`}>{activity.type === "INCOME" ? "+" : activity.type === "EXPENSE" ? "−" : "↔"}</div>
                  <div className="activity-copy"><strong>{activity.title}</strong><span>{activity.detail} · {formatDate(activity.date)}</span></div>
                  <b className={activity.type === "INCOME" ? "positive" : activity.type === "EXPENSE" ? "negative" : ""}>{activity.type === "INCOME" ? "+" : activity.type === "EXPENSE" ? "−" : ""}{formatMoney(activity.amount)}</b>
                </article>)}</div> : <p className="dashboard-muted">Belum ada aktivitas pada periode ini.</p>}
              </section>
            </div>
          </div>
        </>}
      </div>
    </main>
  );
}
