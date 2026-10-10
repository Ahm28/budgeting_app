"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/responses";
import type { BudgetPeriodDetails, BudgetPeriodInput, BudgetPeriodRecord } from "@/lib/budget/types";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function formatMoney(value: string | number) {
  return currency.format(Number(value) || 0);
}

function dateInput(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function suggestedPeriod(): BudgetPeriodInput {
  const today = new Date();
  const year = today.getFullYear();
  let month = today.getMonth();
  if (today.getDate() >= 25) month += 1;
  const start = new Date(year, month, 25);
  const end = new Date(year, month + 1, 24);
  return { startsOn: dateInput(start), endsOn: dateInput(end) };
}

function formatPeriod(period: Pick<BudgetPeriodRecord, "startsOn" | "endsOn">) {
  const format = (date: string) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
  return `${format(period.startsOn)} – ${format(period.endsOn)}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
}

export default function BudgetScreen() {
  const [periods, setPeriods] = useState<BudgetPeriodRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [details, setDetails] = useState<BudgetPeriodDetails | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [periodDialog, setPeriodDialog] = useState<"create" | "edit" | null>(null);
  const [periodInput, setPeriodInput] = useState<BudgetPeriodInput>(suggestedPeriod);

  const loadPeriods = useCallback(async () => {
    const response = await apiRequest<ApiEnvelope<BudgetPeriodRecord[]>>("budget-periods");
    if (!response.data) throw new Error("Periode budget belum dapat dimuat.");
    return response.data;
  }, []);

  const loadDetails = useCallback(async (id: string) => {
    const response = await apiRequest<ApiEnvelope<BudgetPeriodDetails>>(`budget-periods/${id}`);
    if (!response.data) throw new Error("Rencana budget belum dapat dimuat.");
    return response.data;
  }, []);

  const refreshSelectedPeriod = useCallback(async () => {
    if (!selectedId) return;
    try {
      const detail = await loadDetails(selectedId);
      setDetails(detail);
      setAmounts(Object.fromEntries(detail.allocations.map((allocation) => [allocation.categoryId, String(Number(allocation.amount))])));
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [loadDetails, selectedId]);

  useEffect(() => {
    let active = true;
    loadPeriods()
      .then((items) => {
        if (!active) return;
        setPeriods(items);
        const today = dateInput(new Date());
        const current = items.find((item) => item.startsOn <= today && item.endsOn >= today);
        setSelectedId(current?.id ?? items[0]?.id ?? "");
        if (!items.length) setLoading(false);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(errorMessage(cause));
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [loadPeriods]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    loadDetails(selectedId)
      .then((detail) => {
        if (!active) return;
        setDetails(detail);
        setAmounts(Object.fromEntries(detail.allocations.map((allocation) => [allocation.categoryId, String(Number(allocation.amount))])));
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [loadDetails, selectedId]);

  const totalBudget = useMemo(
    () => details?.allocations.filter((row) => !row.category.parentId).reduce((sum, row) => sum + (Number(amounts[row.categoryId]) || 0), 0) ?? 0,
    [amounts, details],
  );
  const invalidParentBudgets = useMemo(() => {
    if (!details) return [] as string[];
    const invalid = new Set<string>();
    for (const row of details.allocations) {
      const parentId = row.category.parentId;
      if (!parentId) continue;
      const childrenTotal = details.allocations
        .filter((candidate) => candidate.category.parentId === parentId)
        .reduce((sum, child) => sum + (Number(amounts[child.categoryId]) || 0), 0);
      if (childrenTotal > (Number(amounts[parentId]) || 0)) invalid.add(parentId);
    }
    return [...invalid];
  }, [amounts, details]);
  const totalSpent = Number(details?.totalSpent ?? 0);
  const totalRemaining = totalBudget - totalSpent;

  function openCreatePeriod() {
    setPeriodInput(suggestedPeriod());
    setPeriodDialog("create");
    setError("");
  }

  function openEditPeriod() {
    if (!details) return;
    setPeriodInput({ startsOn: details.startsOn, endsOn: details.endsOn });
    setPeriodDialog("edit");
    setError("");
  }

  async function savePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (periodDialog === "create") {
        const response = await apiRequest<ApiEnvelope<BudgetPeriodRecord>>("budget-periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(periodInput),
        });
        if (!response.data) throw new Error("Periode budget belum dapat dibuat.");
        const items = await loadPeriods();
        setLoading(true);
        setPeriods(items);
        setSelectedId(response.data.id);
        setDetails(null);
        setPeriodDialog(null);
        setNotice("Periode budget dibuat. Atur alokasi tiap kategori lalu simpan.");
      } else if (periodDialog === "edit" && selectedId) {
        await apiRequest<ApiEnvelope<BudgetPeriodRecord>>(`budget-periods/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(periodInput),
        });
        setPeriods(await loadPeriods());
        setPeriodDialog(null);
        setNotice("Tanggal periode diperbarui.");
        await refreshSelectedPeriod();
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function saveAllocations() {
    if (!details) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest<ApiEnvelope<BudgetPeriodDetails>>(`budget-periods/${details.id}/allocations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: details.allocations.map(({ categoryId }) => ({
            categoryId,
            amount: Number(amounts[categoryId]) || 0,
          })),
        }),
      });
      if (!response.data) throw new Error("Rencana budget belum dapat disimpan.");
      setDetails(response.data);
      setAmounts(Object.fromEntries(response.data.allocations.map((allocation) => [allocation.categoryId, String(Number(allocation.amount))])));
      setNotice("Rencana budget disimpan.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="budget-page">
      <div className="budget-container">
        <header className="budget-heading">
          <div>
            <p className="eyebrow">PERENCANAAN</p>
            <h1>Budgeting</h1>
            <p className="page-description">Atur alokasi untuk setiap periode gajian dan lihat pemakaiannya.</p>
          </div>
          <div className="budget-period-controls">
            {periods.length > 0 && <div className="budget-period-picker">
              <span>Periode budget</span>
              <Select value={selectedId} onValueChange={(value) => { setLoading(true); setSelectedId(value); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{periods.map((period) => <SelectItem key={period.id} value={period.id}>{formatPeriod(period)}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            <Button className="button button-primary" type="button" onClick={openCreatePeriod}><span aria-hidden="true">+</span> Periode baru</Button>
          </div>
        </header>

        {notice && <div className="notice notice-success" role="status">{notice}<Button className="text-button" onClick={() => setNotice("")}>Tutup</Button></div>}
        {error && !periodDialog && <div className="notice notice-error" role="alert">{error}<Button className="text-button" onClick={() => setError("")}>Tutup</Button></div>}

        {loading ? <div className="loading-state"><span className="loading-dot" /> Memuat periode budget…</div> : details ? <>
          <section className="budget-period-banner">
            <div><span className="cashflow-total-label">Periode yang dipilih</span><strong>{formatPeriod(details)}</strong></div>
            <Button className="button button-secondary" type="button" onClick={openEditPeriod}>Ubah tanggal</Button>
          </section>

          <section className="budget-summary" aria-label="Ringkasan budget">
            <Card className="cashflow-total"><span className="cashflow-total-label">Total budget</span><strong>{formatMoney(totalBudget)}</strong></Card>
            <Card className="cashflow-total"><span className="cashflow-total-label">Terpakai</span><strong className="negative">{formatMoney(totalSpent)}</strong></Card>
            <Card className="cashflow-total"><span className="cashflow-total-label">Sisa budget</span><strong className={totalRemaining < 0 ? "negative" : "positive"}>{formatMoney(totalRemaining)}</strong></Card>
          </section>

          <section className="budget-card" aria-labelledby="budget-category-title">
            <div className="budget-card-heading">
              <div><h2 id="budget-category-title">Alokasi per kategori</h2><p>Budget subkategori termasuk di dalam budget induk, bukan tambahan.</p></div>
              <Button className="button button-primary" type="button" disabled={saving || invalidParentBudgets.length > 0} onClick={() => void saveAllocations()}>{saving ? "Menyimpan…" : "Simpan alokasi"}</Button>
            </div>
            {details.allocations.length ? <div className="budget-table">
              <div className="budget-table-header"><span>Kategori</span><span>Rencana</span><span>Terpakai</span><span>Sisa</span></div>
              {details.allocations.map((allocation) => {
                const planned = Number(amounts[allocation.categoryId]) || 0;
                const spent = Number(allocation.spent);
                const remaining = planned - spent;
                return <div className="budget-table-row" key={allocation.categoryId}>
                  <strong>{allocation.category.parent ? `↳ ${allocation.category.name}` : allocation.category.name}{allocation.category.parent && <small>Subkategori dari {allocation.category.parent.name}</small>}{allocation.category.isArchived && <small> Diarsipkan</small>}</strong>
                  <label className="budget-amount-input"><span>Rp</span><Input aria-label={`Budget ${allocation.category.name}`} type="number" min="0" step="1" value={amounts[allocation.categoryId] ?? "0"} disabled={allocation.category.isArchived} onChange={(event) => setAmounts((current) => ({ ...current, [allocation.categoryId]: event.target.value }))} /></label>
                  <span>{formatMoney(spent)}</span>
                  <strong className={remaining < 0 ? "negative" : ""}>{formatMoney(remaining)}</strong>
                </div>;
              })}
            </div> : <div className="empty-state"><h3>Belum ada kategori pengeluaran</h3><p>Buat kategori pengeluaran di Master data agar bisa menyusun budget.</p></div>}
            {invalidParentBudgets.length > 0 && <p className="form-error" role="alert">Total budget subkategori tidak boleh melebihi budget kategori induk.</p>}
            <p className="budget-footnote">Sisa atau kelebihan budget periode sebelumnya tidak dibawa otomatis. Anda bisa menyesuaikan rencana periode berikutnya secara manual.</p>
          </section>
        </> : <section className="budget-empty">
          <span className="empty-icon">◷</span>
          <h2>Belum ada periode budget</h2>
          <p>Buat periode sesuai tanggal gajian Anda. Tanggal awal dan akhir bisa diubah untuk menyesuaikan jadwal aktual.</p>
          <Button className="button button-primary" type="button" onClick={openCreatePeriod}>Buat periode pertama</Button>
        </section>}
      </div>

      <Dialog open={Boolean(periodDialog)} onOpenChange={(open) => { if (!open && !saving) setPeriodDialog(null); }}>
        <DialogContent className="dialog-card" showCloseButton={false}>
          <DialogHeader className="dialog-heading"><div><p className="eyebrow">BUDGETING</p><DialogTitle id="period-dialog-title">{periodDialog === "create" ? "Periode budget baru" : "Ubah periode budget"}</DialogTitle></div><Button className="icon-button" aria-label="Tutup" type="button" disabled={saving} onClick={() => setPeriodDialog(null)}>×</Button></DialogHeader>
          <form onSubmit={(event) => void savePeriod(event)}>
            <div className="form-grid">
              <label className="form-field">Tanggal mulai<Input type="date" required value={periodInput.startsOn} onChange={(event) => setPeriodInput((current) => ({ ...current, startsOn: event.target.value }))} /></label>
              <label className="form-field">Tanggal berakhir<Input type="date" required min={periodInput.startsOn} value={periodInput.endsOn} onChange={(event) => setPeriodInput((current) => ({ ...current, endsOn: event.target.value }))} /></label>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="budget-footnote">Periode baru tidak boleh tumpang tindih dengan periode yang sudah ada.</p>
            <div className="dialog-actions"><Button className="button button-quiet" type="button" disabled={saving} onClick={() => setPeriodDialog(null)}>Batal</Button><Button className="button button-primary" type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan periode"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
