"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/responses";
import type { AccountTransferInput, AccountTransferRecord, CashFlowResponse, TransactionInput, TransactionRecord } from "@/lib/cash-flow/types";
import type { AccountRecord, CategoryRecord, CategoryType } from "@/lib/master-data/types";

type FormState = {
  transactionDate: string;
  amount: string;
  description: string;
  accountId: string;
  categoryId: string;
  budgetCategoryId: string;
  categoryType: CategoryType;
};

type TransferFormState = {
  transferDate: string;
  amount: string;
  description: string;
  fromAccountId: string;
  toAccountId: string;
};

type DialogState =
  | { kind: "transaction"; record?: TransactionRecord }
  | { kind: "transfer"; record?: AccountTransferRecord }
  | null;

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatMoney(value: string | number) {
  return currency.format(Number(value) || 0);
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localMonth() {
  return localToday().slice(0, 7);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
}

export default function CashFlowScreen() {
  const [month, setMonth] = useState(localMonth);
  const [data, setData] = useState<CashFlowResponse | null>(null);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [form, setForm] = useState<FormState>({
    transactionDate: localToday(),
    amount: "",
    description: "",
    accountId: "",
    categoryId: "",
    budgetCategoryId: "",
    categoryType: "EXPENSE",
  });
  const [transferForm, setTransferForm] = useState<TransferFormState>({
    transferDate: localToday(),
    amount: "",
    description: "",
    fromAccountId: "",
    toAccountId: "",
  });

  const loadCashFlow = useCallback(async () => {
    const [cashFlow, accountResponse, categoryResponse] = await Promise.all([
        apiRequest<ApiEnvelope<CashFlowResponse>>(`transactions?month=${month}`),
        apiRequest<ApiEnvelope<AccountRecord[]>>("accounts"),
        apiRequest<ApiEnvelope<CategoryRecord[]>>("categories"),
      ]);
    if (!cashFlow.data || !accountResponse.data || !categoryResponse.data) {
      throw new Error("Data arus kas belum dapat dimuat.");
    }
    return { cashFlow: cashFlow.data, accounts: accountResponse.data, categories: categoryResponse.data };
  }, [month]);

  const refresh = useCallback(async () => {
    try {
      const result = await loadCashFlow();
      setData(result.cashFlow);
      setAccounts(result.accounts);
      setCategories(result.categories);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [loadCashFlow]);

  useEffect(() => {
    let active = true;
    loadCashFlow()
      .then((result) => {
        if (!active) return;
        setData(result.cashFlow);
        setAccounts(result.accounts);
        setCategories(result.categories);
        setError("");
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [loadCashFlow]);

  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === form.categoryType && !category.isArchived),
    [categories, form.categoryType],
  );
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);

  function startCreate() {
    setForm({
      transactionDate: localToday(),
      amount: "",
      description: "",
      accountId: activeAccounts[0]?.id ?? "",
      categoryId: categories.find((category) => category.type === "EXPENSE" && !category.isArchived)?.id ?? "",
      budgetCategoryId: categories.find((category) => category.type === "EXPENSE" && !category.isArchived)?.id ?? "",
      categoryType: "EXPENSE",
    });
    setError("");
      setDialog({ kind: "transaction" });
  }

  function startEdit(record: TransactionRecord) {
    setForm({
      transactionDate: record.transactionDate.slice(0, 10),
      amount: String(Number(record.amount)),
      description: record.description ?? "",
      accountId: record.accountId,
      categoryId: record.categoryId,
      budgetCategoryId: record.budgetCategoryId ?? (record.category.type === "EXPENSE" ? record.categoryId : ""),
      categoryType: record.category.type,
    });
    setError("");
    setDialog({ kind: "transaction", record });
  }

  function startTransfer() {
    setTransferForm({
      transferDate: localToday(),
      amount: "",
      description: "",
      fromAccountId: activeAccounts[0]?.id ?? "",
      toAccountId: activeAccounts[1]?.id ?? "",
    });
    setError("");
    setDialog({ kind: "transfer" });
  }

  function startEditTransfer(record: AccountTransferRecord) {
    setTransferForm({
      transferDate: record.transferDate.slice(0, 10),
      amount: String(Number(record.amount)),
      description: record.description ?? "",
      fromAccountId: record.fromAccountId,
      toAccountId: record.toAccountId,
    });
    setError("");
    setDialog({ kind: "transfer", record });
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    if (!dialog || dialog.kind !== "transaction") return;
    event.preventDefault();
    setSaving(true);
    setError("");
    const input: TransactionInput = {
      transactionDate: form.transactionDate,
      amount: Number(form.amount),
      description: form.description,
      accountId: form.accountId,
      categoryId: form.categoryId,
      budgetCategoryId: form.categoryType === "EXPENSE" ? (form.budgetCategoryId || form.categoryId) : null,
      categoryType: form.categoryType,
    };
    try {
      await apiRequest<ApiEnvelope<TransactionRecord>>(
        dialog.record ? `transactions/${dialog.record.id}` : "transactions",
        {
          method: dialog.record ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      setDialog(null);
      setNotice(dialog.record ? "Transaksi diperbarui." : "Transaksi dicatat.");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function saveTransfer(event: FormEvent<HTMLFormElement>) {
    if (!dialog || dialog.kind !== "transfer") return;
    event.preventDefault();
    setSaving(true);
    setError("");
    const input: AccountTransferInput = {
      transferDate: transferForm.transferDate,
      amount: Number(transferForm.amount),
      description: transferForm.description,
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
    };
    try {
      await apiRequest<ApiEnvelope<AccountTransferRecord>>(
        dialog.record ? `transfers/${dialog.record.id}` : "transfers",
        {
          method: dialog.record ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      setDialog(null);
      setNotice(dialog.record ? "Transfer diperbarui." : "Transfer dicatat.");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: TransactionRecord) {
    if (!window.confirm(`Hapus transaksi ${formatMoney(record.amount)} dari ${record.description || record.category.name}?`)) return;
    setSaving(true);
    try {
      await apiRequest(`transactions/${record.id}`, { method: "DELETE" });
      setNotice("Transaksi dihapus dan saldo dihitung ulang.");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function removeTransfer(record: AccountTransferRecord) {
    if (!window.confirm(`Hapus transfer ${formatMoney(record.amount)} dari ${record.fromAccount.name} ke ${record.toAccount.name}?`)) return;
    setSaving(true);
    try {
      await apiRequest(`transfers/${record.id}`, { method: "DELETE" });
      setNotice("Transfer dihapus dan saldo akun dihitung ulang.");
      await refresh();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const entries = useMemo(() => [
    ...(data?.transactions ?? []).map((record) => ({ kind: "transaction" as const, record })),
    ...(data?.transfers ?? []).map((record) => ({ kind: "transfer" as const, record })),
  ].sort((a, b) => {
    const dateA = a.kind === "transaction" ? a.record.transactionDate : a.record.transferDate;
    const dateB = b.kind === "transaction" ? b.record.transactionDate : b.record.transferDate;
    return dateB.localeCompare(dateA) || b.record.createdAt.localeCompare(a.record.createdAt);
  }), [data]);

  const monthLabel = useMemo(() => {
    const date = new Date(`${month}-01T00:00:00.000Z`);
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }, [month]);

  return (
    <main className="cashflow-page">
      <div className="cashflow-container">
        <header className="cashflow-heading">
          <div>
            <p className="eyebrow">CATATAN HARIAN</p>
            <h1>Arus kas</h1>
            <p className="page-description">Catat pemasukan dan pengeluaran di setiap akun.</p>
          </div>
          <div className="cashflow-controls">
            <label className="month-picker">
              <span>Periode</span>
              <Input aria-label="Pilih bulan" type="month" value={month} onChange={(event) => { setLoading(true); setMonth(event.target.value); }} />
            </label>
            <Button className="button button-secondary transfer-button" type="button" onClick={startTransfer}>
              ⇄ Transfer
            </Button>
            <Button className="button button-primary add-button" type="button" onClick={startCreate}>
              <span aria-hidden="true">+</span> Tambah transaksi
            </Button>
          </div>
        </header>

        {notice && <div className="notice notice-success" role="status">{notice}<Button className="text-button" onClick={() => setNotice("")}>Tutup</Button></div>}
        {error && !dialog && <div className="notice notice-error" role="alert">{error}<Button className="text-button" onClick={() => setError("")}>Tutup</Button></div>}

        <section className="cashflow-summary" aria-label={`Ringkasan ${monthLabel}`}>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Pemasukan</span>
            <strong className="positive">{formatMoney(data?.summary.income ?? 0)}</strong>
          </Card>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Pengeluaran</span>
            <strong className="negative">{formatMoney(data?.summary.expense ?? 0)}</strong>
          </Card>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Selisih</span>
            <strong className={Number(data?.summary.net ?? 0) < 0 ? "negative" : "positive"}>{formatMoney(data?.summary.net ?? 0)}</strong>
          </Card>
        </section>

        <section className="cashflow-accounts" aria-labelledby="account-balance-title">
          <div className="cashflow-section-heading">
            <div><h2 id="account-balance-title">Saldo akun</h2><p>Saldo awal ditambah pemasukan dan dikurangi pengeluaran tercatat.</p></div>
          </div>
          {loading ? <div className="loading-state"><span className="loading-dot" /> Memuat saldo akun…</div> :
            data?.accountBalances.length ? (
              <div className="cashflow-account-grid">
                {data.accountBalances.map(({ account, balance }) => (
                  <article className="cashflow-account" key={account.id}>
                    <span className="account-type-label">{account.isArchived ? "Diarsipkan · " : ""}{account.type === "EWALLET" ? "E-wallet" : account.type === "CASH" ? "Tunai" : account.type === "BANK" ? "Bank" : "Lainnya"}</span>
                    <strong>{account.name}</strong>
                    <span className="cashflow-balance">{formatMoney(balance)}</span>
                  </article>
                ))}
              </div>
            ) : <p className="cashflow-inline-empty">Belum ada akun. Tambahkan akun di Master data.</p>}
        </section>

        <section className="cashflow-transactions" aria-labelledby="transaction-list-title">
          <div className="cashflow-section-heading">
            <div><h2 id="transaction-list-title">Aktivitas · {monthLabel}</h2><p>{entries.length} catatan pada periode ini</p></div>
          </div>
          {loading ? <div className="loading-state"><span className="loading-dot" /> Memuat transaksi…</div> :
            entries.length ? (
              <div className="transaction-list">
                {entries.map((entry) => entry.kind === "transaction" ? (
                  <article className="transaction-row" key={`transaction-${entry.record.id}`}>
                    <div className="transaction-date">{formatDate(entry.record.transactionDate)}</div>
                    <div className="transaction-description">
                      <strong>{entry.record.description || entry.record.category.name}</strong>
                      <span>{entry.record.category.parent ? `${entry.record.category.parent.name} / ` : ""}{entry.record.category.name} · {entry.record.account.name}{entry.record.budgetCategory && entry.record.budgetCategory.id !== entry.record.category.id ? ` · Budget: ${entry.record.budgetCategory.parent ? `${entry.record.budgetCategory.parent.name} / ` : ""}${entry.record.budgetCategory.name}` : ""}</span>
                    </div>
                    <strong className={entry.record.category.type === "INCOME" ? "transaction-amount positive" : "transaction-amount negative"}>
                      {entry.record.category.type === "INCOME" ? "+" : "−"}{formatMoney(entry.record.amount)}
                    </strong>
                    <div className="transaction-actions">
                      <Button className="text-button" type="button" onClick={() => startEdit(entry.record)}>Ubah</Button>
                      <Button className="text-button transaction-delete" type="button" disabled={saving} onClick={() => void remove(entry.record)}>Hapus</Button>
                    </div>
                  </article>
                ) : (
                  <article className="transaction-row transfer-row" key={`transfer-${entry.record.id}`}>
                    <div className="transaction-date">{formatDate(entry.record.transferDate)}</div>
                    <div className="transaction-description">
                      <strong>{entry.record.description || "Transfer antar akun"}</strong>
                      <span>{entry.record.fromAccount.name} <span aria-hidden="true">→</span> {entry.record.toAccount.name}</span>
                    </div>
                    <strong className="transaction-amount transfer-amount">{formatMoney(entry.record.amount)}</strong>
                    <div className="transaction-actions">
                      <Button className="text-button" type="button" onClick={() => startEditTransfer(entry.record)}>Ubah</Button>
                      <Button className="text-button transaction-delete" type="button" disabled={saving} onClick={() => void removeTransfer(entry.record)}>Hapus</Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-icon">↗</span>
                <h3>Belum ada transaksi</h3>
                <p>Catat pemasukan atau pengeluaran pertama untuk {monthLabel}.</p>
                <Button className="button button-primary" type="button" onClick={startCreate}>Tambah transaksi</Button>
              </div>
            )}
        </section>
      </div>

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open && !saving) setDialog(null); }}>
        <DialogContent className="dialog-card" showCloseButton={false}>
            <DialogHeader className="dialog-heading">
              <div><p className="eyebrow">ARUS KAS</p><DialogTitle id="transaction-dialog-title">{dialog?.kind === "transfer" ? (dialog.record ? "Ubah transfer" : "Transfer antar akun") : (dialog?.record ? "Ubah transaksi" : "Tambah transaksi")}</DialogTitle></div>
              <Button className="icon-button" type="button" aria-label="Tutup" disabled={saving} onClick={() => setDialog(null)}>×</Button>
            </DialogHeader>
            {dialog?.kind === "transaction" ? <form onSubmit={(event) => void saveTransaction(event)}>
              <div className="form-grid">
                <label className="form-field">Jenis transaksi
                  <SelectField value={form.categoryType} onValueChange={(value) => setForm((current) => ({ ...current, categoryType: value as CategoryType, categoryId: "", budgetCategoryId: "" }))} placeholder="Pilih jenis" required options={[{ value: "EXPENSE", label: "Pengeluaran" }, { value: "INCOME", label: "Pemasukan" }]} />
                </label>
                <label className="form-field">Tanggal
                  <Input type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
                </label>
              </div>
              <label className="form-field">Jumlah
                <div className="input-prefix"><span>Rp</span><Input type="number" min="1" step="1" required placeholder="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
              </label>
              <label className="form-field">Kategori
                <SelectField required value={form.categoryId} placeholder="Pilih kategori" onValueChange={(value) => setForm((current) => ({
                  ...current,
                  categoryId: value,
                  budgetCategoryId: current.budgetCategoryId === current.categoryId ? value : current.budgetCategoryId,
                }))} options={filteredCategories.map((category) => ({ value: category.id, label: category.parent ? `↳ ${category.name} (${category.parent.name})` : category.name }))} />
                {!filteredCategories.length && <small>Belum ada kategori aktif untuk jenis ini. Tambahkan di Master data.</small>}
              </label>
              {form.categoryType === "EXPENSE" && <label className="form-field">Potong budget dari
                <SelectField required value={form.budgetCategoryId || form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, budgetCategoryId: value }))} placeholder="Pilih kategori sumber budget" options={categories.filter((category) => category.type === "EXPENSE" && !category.isArchived).map((category) => ({ value: category.id, label: category.parent ? `↳ ${category.name} (${category.parent.name})` : category.name }))} />
                <small>Boleh berbeda dari kategori pencatatan; pengeluaran tetap dicatat pada kategori di atas.</small>
              </label>}
              <label className="form-field">Akun
                <SelectField required value={form.accountId} onValueChange={(value) => setForm((current) => ({ ...current, accountId: value }))} placeholder="Pilih akun" options={activeAccounts.map((account) => ({ value: account.id, label: account.name }))} />
                {!activeAccounts.length && <small>Belum ada akun aktif. Tambahkan di Master data.</small>}
              </label>
              <label className="form-field">Deskripsi <small>Opsional</small>
                <Input maxLength={160} placeholder="Contoh: Makan siang" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="dialog-actions">
                <Button className="button button-quiet" type="button" disabled={saving} onClick={() => setDialog(null)}>Batal</Button>
                <Button className="button button-primary" type="submit" disabled={saving || !activeAccounts.length || !filteredCategories.length}>
                  {saving ? "Menyimpan…" : "Simpan transaksi"}
                </Button>
              </div>
            </form> : dialog?.kind === "transfer" ? <form onSubmit={(event) => void saveTransfer(event)}>
              <div className="form-grid">
                <label className="form-field">Tanggal
                  <Input type="date" required value={transferForm.transferDate} onChange={(event) => setTransferForm((current) => ({ ...current, transferDate: event.target.value }))} />
                </label>
                <label className="form-field">Jumlah
                  <div className="input-prefix"><span>Rp</span><Input type="number" min="1" step="1" required placeholder="0" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))} /></div>
                </label>
              </div>
              <div className="form-grid">
                <label className="form-field">Dari akun
                  <SelectField required value={transferForm.fromAccountId} onValueChange={(value) => setTransferForm((current) => ({ ...current, fromAccountId: value }))} placeholder="Pilih akun asal" options={activeAccounts.map((account) => ({ value: account.id, label: account.name }))} />
                </label>
                <label className="form-field">Ke akun
                  <SelectField required value={transferForm.toAccountId} onValueChange={(value) => setTransferForm((current) => ({ ...current, toAccountId: value }))} placeholder="Pilih akun tujuan" options={activeAccounts.filter((account) => account.id !== transferForm.fromAccountId).map((account) => ({ value: account.id, label: account.name }))} />
                </label>
              </div>
              {activeAccounts.length < 2 && <p className="form-error">Tambahkan setidaknya dua akun aktif untuk melakukan transfer.</p>}
              <label className="form-field">Deskripsi <small>Opsional</small>
                <Input maxLength={160} placeholder="Contoh: Pindah dana ke rekening tabungan" value={transferForm.description} onChange={(event) => setTransferForm((current) => ({ ...current, description: event.target.value }))} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="dialog-actions">
                <Button className="button button-quiet" type="button" disabled={saving} onClick={() => setDialog(null)}>Batal</Button>
                <Button className="button button-primary" type="submit" disabled={saving || activeAccounts.length < 2 || transferForm.fromAccountId === transferForm.toAccountId}>
                  {saving ? "Menyimpan…" : "Simpan transfer"}
                </Button>
              </div>
            </form> : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
