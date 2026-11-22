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
  subcategoryId: string;
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

const noSubcategoryValue = "__no_subcategory__";
const allAccountsValue = "__all_accounts__";
const allCategoriesValue = "__all_categories__";
const allTransactionTypesValue = "__all_transaction_types__";

function formatMoney(value: string | number) {
  return currency.format(Number(value) || 0);
}

function formatRupiahInput(value: string | number) {
  const digits = String(value)
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");

  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiahInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterAccountId, setFilterAccountId] = useState(allAccountsValue);
  const [filterTransactionType, setFilterTransactionType] = useState(allTransactionTypesValue);
  const [filterCategoryId, setFilterCategoryId] = useState(allCategoriesValue);
  const [filterSubcategoryId, setFilterSubcategoryId] = useState("");
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
    subcategoryId: "",
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

  const parentCategories = useMemo(
    () => categories.filter((category) => category.type === form.categoryType && !category.isArchived && !category.parentId),
    [categories, form.categoryType],
  );
  const selectedSubcategories = useMemo(
    () => categories.filter((category) => category.parentId === form.categoryId && !category.isArchived),
    [categories, form.categoryId],
  );
  const expenseParentCategories = useMemo(
    () => categories.filter((category) => category.type === "EXPENSE" && !category.isArchived && !category.parentId),
    [categories],
  );
  const activeAccounts = useMemo(() => accounts.filter((account) => !account.isArchived), [accounts]);
  const filterParentCategories = useMemo(
    () => categories.filter((category) =>
      !category.parentId &&
      (filterTransactionType === allTransactionTypesValue || category.type === filterTransactionType),
    ),
    [categories, filterTransactionType],
  );
  const filterSubcategories = useMemo(
    () => categories.filter((category) => category.parentId === filterCategoryId),
    [categories, filterCategoryId],
  );

  function startCreate() {
    setForm({
      transactionDate: localToday(),
      amount: "",
      description: "",
      accountId: activeAccounts[0]?.id ?? "",
      categoryId: expenseParentCategories[0]?.id ?? "",
      subcategoryId: "",
      budgetCategoryId: expenseParentCategories[0]?.id ?? "",
      categoryType: "EXPENSE",
    });
    setError("");
      setDialog({ kind: "transaction" });
  }

  function startEdit(record: TransactionRecord) {
    const categoryId = record.category.parentId ?? record.categoryId;
    const budgetCategoryId = record.budgetCategory
      ? (record.budgetCategory.parentId ?? record.budgetCategory.id)
      : categoryId;

    setForm({
      transactionDate: record.transactionDate.slice(0, 10),
      amount: formatRupiahInput(record.amount),
      description: record.description ?? "",
      accountId: record.accountId,
      categoryId,
      subcategoryId: record.category.parentId ? record.categoryId : "",
      budgetCategoryId: record.category.type === "EXPENSE" ? budgetCategoryId : "",
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
      amount: formatRupiahInput(record.amount),
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
    setError("");
    const amount = parseRupiahInput(form.amount);
    if (amount < 1) {
      setError("Jumlah harus lebih dari Rp 0.");
      return;
    }

    const categoryId = form.subcategoryId || form.categoryId;
    setSaving(true);
    const input: TransactionInput = {
      transactionDate: form.transactionDate,
      amount,
      description: form.description,
      accountId: form.accountId,
      categoryId,
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
    setError("");
    const amount = parseRupiahInput(transferForm.amount);
    if (amount < 1) {
      setError("Jumlah harus lebih dari Rp 0.");
      return;
    }

    setSaving(true);
    const input: AccountTransferInput = {
      transferDate: transferForm.transferDate,
      amount,
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

  const filteredEntries = useMemo(() => entries.filter((entry) => {
    if (filterTransactionType === "TRANSFER" && entry.kind !== "transfer") return false;
    if (filterTransactionType !== allTransactionTypesValue && filterTransactionType !== "TRANSFER") {
      if (entry.kind !== "transaction" || entry.record.category.type !== filterTransactionType) return false;
    }

    const date = entry.kind === "transaction" ? entry.record.transactionDate : entry.record.transferDate;
    if (dateFrom && date.slice(0, 10) < dateFrom) return false;
    if (dateTo && date.slice(0, 10) > dateTo) return false;

    if (filterAccountId !== allAccountsValue) {
      const accountMatches = entry.kind === "transaction"
        ? entry.record.accountId === filterAccountId
        : entry.record.fromAccountId === filterAccountId || entry.record.toAccountId === filterAccountId;
      if (!accountMatches) return false;
    }

    if (filterCategoryId !== allCategoriesValue) {
      if (entry.kind !== "transaction") return false;
      if (filterSubcategoryId) {
        if (entry.record.categoryId !== filterSubcategoryId) return false;
      } else if (entry.record.categoryId !== filterCategoryId && entry.record.category.parentId !== filterCategoryId) {
        return false;
      }
    }

    return true;
  }), [dateFrom, dateTo, entries, filterAccountId, filterCategoryId, filterSubcategoryId, filterTransactionType]);
  const filteredIncome = useMemo(() => filteredEntries.reduce((sum, entry) => (
    entry.kind === "transaction" && entry.record.category.type === "INCOME" ? sum + Number(entry.record.amount) : sum
  ), 0), [filteredEntries]);
  const filteredExpense = useMemo(() => filteredEntries.reduce((sum, entry) => (
    entry.kind === "transaction" && entry.record.category.type === "EXPENSE" ? sum + Number(entry.record.amount) : sum
  ), 0), [filteredEntries]);
  const hasActiveFilters = Boolean(dateFrom || dateTo || filterAccountId !== allAccountsValue || filterTransactionType !== allTransactionTypesValue || filterCategoryId !== allCategoriesValue);

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setFilterAccountId(allAccountsValue);
    setFilterTransactionType(allTransactionTypesValue);
    setFilterCategoryId(allCategoriesValue);
    setFilterSubcategoryId("");
  }

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

        <section className="cashflow-filters" aria-label="Filter arus kas">
          <label className="form-field">Dari tanggal
            <Input aria-label="Tanggal mulai filter" type="date" max={dateTo || undefined} value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="form-field">Sampai tanggal
            <Input aria-label="Tanggal akhir filter" type="date" min={dateFrom || undefined} value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="form-field">Akun
            <SelectField value={filterAccountId} onValueChange={setFilterAccountId} placeholder="Pilih akun" options={[
              { value: allAccountsValue, label: "Semua akun" },
              ...accounts.map((account) => ({ value: account.id, label: `${account.name}${account.isArchived ? " · Diarsipkan" : ""}` })),
            ]} />
          </label>
          <label className="form-field">Jenis transaksi
            <SelectField value={filterTransactionType} onValueChange={(value) => {
              setFilterTransactionType(value);
              setFilterCategoryId(allCategoriesValue);
              setFilterSubcategoryId("");
            }} placeholder="Pilih jenis transaksi" options={[
              { value: allTransactionTypesValue, label: "Semua jenis" },
              { value: "INCOME", label: "Pemasukan" },
              { value: "EXPENSE", label: "Pengeluaran" },
              { value: "TRANSFER", label: "Transfer" },
            ]} />
          </label>
          <label className="form-field">Kategori
            <SelectField disabled={filterTransactionType === "TRANSFER"} value={filterCategoryId} onValueChange={(value) => { setFilterCategoryId(value); setFilterSubcategoryId(""); }} placeholder="Pilih kategori" options={[
              { value: allCategoriesValue, label: filterTransactionType === "TRANSFER" ? "Tidak berlaku untuk transfer" : "Semua kategori" },
              ...filterParentCategories.map((category) => ({ value: category.id, label: `${category.name} · ${category.type === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}` })),
            ]} />
          </label>
          {filterCategoryId !== allCategoriesValue && filterSubcategories.length > 0 && <label className="form-field">Subkategori
            <SelectField value={filterSubcategoryId || noSubcategoryValue} onValueChange={(value) => setFilterSubcategoryId(value === noSubcategoryValue ? "" : value)} placeholder="Pilih subkategori" options={[
              { value: noSubcategoryValue, label: "Semua subkategori" },
              ...filterSubcategories.map((category) => ({ value: category.id, label: category.name })),
            ]} />
          </label>}
          {hasActiveFilters && <Button className="button button-quiet cashflow-filter-reset" type="button" onClick={resetFilters}>Reset filter</Button>}
        </section>

        <p className="cashflow-filter-context">Ringkasan dan aktivitas mengikuti filter aktif pada {monthLabel}.</p>

        <section className="cashflow-summary" aria-label={`Ringkasan ${monthLabel}`}>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Pemasukan</span>
            <strong className="positive">{formatMoney(filteredIncome)}</strong>
          </Card>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Pengeluaran</span>
            <strong className="negative">{formatMoney(filteredExpense)}</strong>
          </Card>
          <Card className="cashflow-total">
            <span className="cashflow-total-label">Selisih</span>
            <strong className={filteredIncome - filteredExpense < 0 ? "negative" : "positive"}>{formatMoney(filteredIncome - filteredExpense)}</strong>
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
            <div><h2 id="transaction-list-title">Aktivitas · {monthLabel}</h2><p>{filteredEntries.length} catatan · Total pengeluaran {formatMoney(filteredExpense)}</p></div>
          </div>
          {loading ? <div className="loading-state"><span className="loading-dot" /> Memuat transaksi…</div> :
            filteredEntries.length ? (
              <div className="transaction-list">
                {filteredEntries.map((entry) => entry.kind === "transaction" ? (
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
                <h3>{hasActiveFilters ? "Tidak ada catatan yang cocok" : "Belum ada transaksi"}</h3>
                <p>{hasActiveFilters ? "Coba ubah atau reset filter untuk melihat catatan lain." : `Catat pemasukan atau pengeluaran pertama untuk ${monthLabel}.`}</p>
                {hasActiveFilters ? <Button className="button button-secondary" type="button" onClick={resetFilters}>Reset filter</Button> : <Button className="button button-primary" type="button" onClick={startCreate}>Tambah transaksi</Button>}
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
                  <SelectField value={form.categoryType} onValueChange={(value) => setForm((current) => ({ ...current, categoryType: value as CategoryType, categoryId: "", subcategoryId: "", budgetCategoryId: "" }))} placeholder="Pilih jenis" required options={[{ value: "EXPENSE", label: "Pengeluaran" }, { value: "INCOME", label: "Pemasukan" }]} />
                </label>
                <label className="form-field">Tanggal
                  <Input type="date" required value={form.transactionDate} onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
                </label>
              </div>
              <label className="form-field">Jumlah
                <div className="input-prefix"><span>Rp</span><Input type="text" inputMode="numeric" pattern="[0-9.]*" required placeholder="0" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: formatRupiahInput(event.target.value) }))} /></div>
              </label>
              <label className="form-field">Kategori
                <SelectField required value={form.categoryId} placeholder="Pilih kategori" onValueChange={(value) => setForm((current) => ({
                  ...current,
                  categoryId: value,
                  subcategoryId: "",
                  budgetCategoryId: current.categoryType === "EXPENSE" && (!current.budgetCategoryId || current.budgetCategoryId === current.categoryId) ? value : current.budgetCategoryId,
                }))} options={parentCategories.map((category) => ({ value: category.id, label: category.name }))} />
                {!parentCategories.length && <small>Belum ada kategori induk aktif untuk jenis ini. Tambahkan di Master data.</small>}
              </label>
              <label className="form-field">Subkategori <small>Opsional</small>
                <SelectField
                  disabled={!form.categoryId || selectedSubcategories.length === 0}
                  value={form.subcategoryId || noSubcategoryValue}
                  placeholder="Pilih subkategori"
                  onValueChange={(value) => setForm((current) => ({ ...current, subcategoryId: value === noSubcategoryValue ? "" : value }))}
                  options={[
                    { value: noSubcategoryValue, label: !form.categoryId ? "Pilih kategori dulu" : selectedSubcategories.length ? "Tanpa subkategori" : "Tidak ada subkategori" },
                    ...selectedSubcategories.map((category) => ({ value: category.id, label: category.name })),
                  ]}
                />
                <small>{selectedSubcategories.length > 0 ? "Pilihan subkategori mengikuti kategori induk. Mengganti kategori akan mengosongkan pilihan ini." : "Kategori ini belum memiliki subkategori; transaksi akan dicatat pada kategori induk."}</small>
              </label>
              {form.categoryType === "EXPENSE" && <label className="form-field">Potong budget dari
                <SelectField required value={form.budgetCategoryId || form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, budgetCategoryId: value }))} placeholder="Pilih kategori sumber budget" options={expenseParentCategories.map((category) => ({ value: category.id, label: category.name }))} />
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
                <Button className="button button-primary" type="submit" disabled={saving || !activeAccounts.length || !parentCategories.length}>
                  {saving ? "Menyimpan…" : "Simpan transaksi"}
                </Button>
              </div>
            </form> : dialog?.kind === "transfer" ? <form onSubmit={(event) => void saveTransfer(event)}>
              <div className="form-grid">
                <label className="form-field">Tanggal
                  <Input type="date" required value={transferForm.transferDate} onChange={(event) => setTransferForm((current) => ({ ...current, transferDate: event.target.value }))} />
                </label>
                <label className="form-field">Jumlah
                  <div className="input-prefix"><span>Rp</span><Input type="text" inputMode="numeric" pattern="[0-9.]*" required placeholder="0" value={transferForm.amount} onChange={(event) => setTransferForm((current) => ({ ...current, amount: formatRupiahInput(event.target.value) }))} /></div>
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
