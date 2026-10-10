"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SelectField } from "@/components/ui/select-field";
import { apiRequest } from "@/lib/api/client";
import type { ApiEnvelope } from "@/lib/api/responses";
import type {
  AccountInput,
  AccountRecord,
  AccountType,
  CategoryInput,
  CategoryRecord,
  CategoryType,
} from "@/lib/master-data/types";

type Section = "categories" | "accounts";
type DialogState =
  | { kind: "category"; record?: CategoryRecord }
  | { kind: "account"; record?: AccountRecord }
  | null;

const accountTypeLabels: Record<AccountType, string> = {
  BANK: "Bank",
  EWALLET: "E-wallet",
  CASH: "Tunai",
  OTHER: "Lainnya",
};

const categoryTypeLabels: Record<CategoryType, string> = {
  EXPENSE: "Pengeluaran",
  INCOME: "Pemasukan",
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(amount: string | number) {
  return currency.format(Number(amount) || 0);
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi.";
}

export default function MasterDataScreen() {
  const [section, setSection] = useState<Section>("categories");
  const [categoryType, setCategoryType] = useState<CategoryType>("EXPENSE");
  const [showArchived, setShowArchived] = useState(false);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);

  const refresh = useCallback(async () => {
    try {
      const [categoryResponse, accountResponse] = await Promise.all([
        apiRequest<ApiEnvelope<CategoryRecord[]>>("categories"),
        apiRequest<ApiEnvelope<AccountRecord[]>>("accounts"),
      ]);

      if (!categoryResponse.data || !accountResponse.data) {
        throw new Error("Data master belum dapat dimuat.");
      }

      setPageError("");
      setCategories(categoryResponse.data);
      setAccounts(accountResponse.data);
    } catch (error) {
      setPageError(messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest<ApiEnvelope<CategoryRecord[]>>("categories"),
      apiRequest<ApiEnvelope<AccountRecord[]>>("accounts"),
    ])
      .then(([categoryResponse, accountResponse]) => {
        if (!categoryResponse.data || !accountResponse.data) {
          throw new Error("Data master belum dapat dimuat.");
        }

        if (active) {
          setPageError("");
          setCategories(categoryResponse.data);
          setAccounts(accountResponse.data);
        }
      })
      .catch((error: unknown) => {
        if (active) setPageError(messageFrom(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === categoryType && category.isArchived === showArchived,
      ),
    [categories, categoryType, showArchived],
  );

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => account.isArchived === showArchived),
    [accounts, showArchived],
  );

  const activeCategoryCount = categories.filter((item) => !item.isArchived).length;
  const activeAccountCount = accounts.filter((item) => !item.isArchived).length;

  async function saveCategory(values: CategoryInput, record?: CategoryRecord) {
    const response = await apiRequest<ApiEnvelope<CategoryRecord>>(
      record ? `categories/${record.id}` : "categories",
      {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    await refresh();
    setCategoryType(response.data?.type ?? values.type);
    setNotice(record ? "Kategori berhasil diperbarui." : "Kategori berhasil ditambahkan.");
    setDialog(null);
  }

  async function saveAccount(values: AccountInput, record?: AccountRecord) {
    await apiRequest<ApiEnvelope<AccountRecord>>(
      record ? `accounts/${record.id}` : "accounts",
      {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      },
    );

    await refresh();
    setNotice(record ? "Akun berhasil diperbarui." : "Akun berhasil ditambahkan.");
    setDialog(null);
  }

  async function toggleArchive(kind: "category" | "account", record: CategoryRecord | AccountRecord) {
    const archived = record.isArchived;
    const action = archived ? "memulihkan" : "mengarsipkan";
    if (!window.confirm(`Yakin ingin ${action} ${kind === "category" ? "data ini" : "akun ini"}?`)) {
      return;
    }

    setSavingId(record.id);
    setNotice("");
    try {
      await apiRequest<ApiEnvelope<CategoryRecord | AccountRecord>>(
        `${kind === "category" ? "categories" : "accounts"}/${record.id}`,
        archived
          ? {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isArchived: false }),
            }
          : { method: "DELETE" },
      );
      await refresh();
      setNotice(archived ? "Data berhasil dipulihkan." : "Data dipindahkan ke arsip.");
    } catch (error) {
      setPageError(messageFrom(error));
    } finally {
      setSavingId(null);
    }
  }

  function openCreateDialog() {
    setNotice("");
    setDialog(section === "categories" ? { kind: "category" } : { kind: "account" });
  }

  return (
    <main className="master-page">
      <div className="master-container">
        <header className="master-header">
          <div className="master-heading-row">
            <div>
              <p className="eyebrow">PENGATURAN</p>
              <h1>Master data</h1>
              <p className="page-description">
                Atur akun dan kategori yang akan digunakan dalam pencatatan keuangan.
              </p>
            </div>
            <div className="master-summary" aria-label="Ringkasan master data">
              <div>
                <span className="summary-value">{activeCategoryCount}</span>
                <span className="summary-label">Kategori aktif</span>
              </div>
              <span className="summary-divider" />
              <div>
                <span className="summary-value">{activeAccountCount}</span>
                <span className="summary-label">Akun aktif</span>
              </div>
            </div>
          </div>
        </header>

        <section className="master-card" aria-labelledby="master-section-title">
          <div className="card-topline">
            <Tabs value={section} onValueChange={(value) => { setSection(value as Section); setShowArchived(false); setNotice(""); }}>
              <TabsList className="section-tabs" aria-label="Jenis master data">
                <TabsTrigger className={section === "categories" ? "section-tab active" : "section-tab"} value="categories">Kategori</TabsTrigger>
                <TabsTrigger className={section === "accounts" ? "section-tab active" : "section-tab"} value="accounts">Akun</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button className="button button-primary add-button" onClick={openCreateDialog}>
              <span aria-hidden="true">＋</span>
              Tambah {section === "categories" ? "kategori" : "akun"}
            </Button>
          </div>

          <div className="list-heading">
            <div>
              <h2 id="master-section-title">
                {section === "categories" ? "Kategori" : "Akun keuangan"}
              </h2>
              <p>
                {section === "categories"
                  ? "Pisahkan kategori pemasukan dan pengeluaran sesuai kebutuhan Anda."
                  : "Saldo awal dan saldo minimum menjadi dasar informasi saldo akun."}
              </p>
            </div>
            <label className="archive-toggle">
              <Input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Tampilkan arsip
            </label>
          </div>

          {section === "categories" && (
            <Tabs value={categoryType} onValueChange={(value) => setCategoryType(value as CategoryType)}>
              <TabsList className="filter-row" aria-label="Filter jenis kategori">
                {(["EXPENSE", "INCOME"] as const).map((type) => (
                  <TabsTrigger
                  className={categoryType === type ? "filter-chip selected" : "filter-chip"}
                  key={type}
                  value={type}
                >
                  {categoryTypeLabels[type]}
                  <span className="filter-count">
                    {categories.filter((item) => item.type === type && item.isArchived === showArchived).length}
                  </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {notice && <div className="notice notice-success" role="status">{notice}</div>}
          {pageError && (
            <div className="notice notice-error" role="alert">
              <span>{pageError}</span>
              <Button className="text-button" onClick={() => void refresh()} type="button">
                Coba lagi
              </Button>
            </div>
          )}

          {loading ? (
            <div className="loading-state" aria-live="polite">
              <span className="loading-dot" /> Memuat master data...
            </div>
          ) : section === "categories" ? (
            <CategoryList
              categories={visibleCategories}
              archived={showArchived}
              savingId={savingId}
              onEdit={(record) => setDialog({ kind: "category", record })}
              onArchive={(record) => void toggleArchive("category", record)}
              onCreate={openCreateDialog}
            />
          ) : (
            <AccountList
              accounts={visibleAccounts}
              archived={showArchived}
              savingId={savingId}
              onEdit={(record) => setDialog({ kind: "account", record })}
              onArchive={(record) => void toggleArchive("account", record)}
              onCreate={openCreateDialog}
            />
          )}
        </section>

        <p className="master-footnote">
          Data yang diarsipkan tetap tersimpan agar catatan keuangan berikutnya dapat menjaga riwayat tetap utuh.
        </p>
      </div>

      {dialog?.kind === "category" && (
        <CategoryDialog
          key={dialog.record?.id ?? "new-category"}
          record={dialog.record}
          categories={categories}
          onClose={() => setDialog(null)}
          onSave={saveCategory}
        />
      )}
      {dialog?.kind === "account" && (
        <AccountDialog
          key={dialog.record?.id ?? "new-account"}
          record={dialog.record}
          onClose={() => setDialog(null)}
          onSave={saveAccount}
        />
      )}
    </main>
  );
}

function CategoryList({
  categories,
  archived,
  savingId,
  onEdit,
  onArchive,
  onCreate,
}: {
  categories: CategoryRecord[];
  archived: boolean;
  savingId: string | null;
  onEdit: (record: CategoryRecord) => void;
  onArchive: (record: CategoryRecord) => void;
  onCreate: () => void;
}) {
  if (categories.length === 0) {
    return (
      <EmptyState
        title={archived ? "Belum ada kategori arsip" : "Belum ada kategori"}
        description={
          archived
            ? "Kategori yang diarsipkan akan muncul di sini."
            : "Tambahkan kategori agar pemasukan dan pengeluaran bisa dicatat dengan rapi."
        }
        onCreate={archived ? undefined : onCreate}
      />
    );
  }

  return (
    <div className="record-list">
      <div className="record-list-head category-grid">
        <span>Nama kategori</span>
        <span>Jenis</span>
        <span>Status</span>
        <span className="align-right">Aksi</span>
      </div>
      {categories.map((category) => (
        <article className="record-row category-grid" key={category.id}>
          <div className="record-name-cell">
            <span className={`record-icon ${category.type === "INCOME" ? "icon-income" : "icon-expense"}`}>
              {category.type === "INCOME" ? "↙" : "↗"}
            </span>
            <div>
              <strong>{category.parent ? `↳ ${category.name}` : category.name}</strong>
              {category.parent && <small className="category-parent-hint">{category.parent.name}</small>}
              <span className="mobile-row-label">{category.parent ? `Subkategori Â· ${category.parent.name}` : "Kategori induk"}</span>
            </div>
          </div>
          <span className="type-label">{categoryTypeLabels[category.type]}</span>
          <span className={archived ? "status-pill status-archived" : "status-pill status-active"}>
            {archived ? "Diarsipkan" : "Aktif"}
          </span>
          <RecordActions
            archived={archived}
            busy={savingId === category.id}
            onEdit={() => onEdit(category)}
            onArchive={() => onArchive(category)}
          />
        </article>
      ))}
    </div>
  );
}

function AccountList({
  accounts,
  archived,
  savingId,
  onEdit,
  onArchive,
  onCreate,
}: {
  accounts: AccountRecord[];
  archived: boolean;
  savingId: string | null;
  onEdit: (record: AccountRecord) => void;
  onArchive: (record: AccountRecord) => void;
  onCreate: () => void;
}) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title={archived ? "Belum ada akun arsip" : "Belum ada akun"}
        description={
          archived
            ? "Akun yang diarsipkan akan muncul di sini."
            : "Tambahkan rekening, e-wallet, atau akun tunai yang Anda gunakan."
        }
        onCreate={archived ? undefined : onCreate}
      />
    );
  }

  return (
    <div className="record-list">
      <div className="record-list-head account-grid">
        <span>Nama akun</span>
        <span>Jenis</span>
        <span>Saldo awal</span>
        <span>Saldo minimum</span>
        <span>Status</span>
        <span className="align-right">Aksi</span>
      </div>
      {accounts.map((account) => (
        <article className="record-row account-grid" key={account.id}>
          <div className="record-name-cell">
            <span className="record-icon icon-account">{account.type === "CASH" ? "◌" : "▤"}</span>
            <div>
              <strong>{account.name}</strong>
              <span className="mobile-row-label">Akun</span>
            </div>
          </div>
          <span className="type-label">{accountTypeLabels[account.type]}</span>
          <span className="money-value">{formatRupiah(account.openingBalance)}</span>
          <span className="money-value">{formatRupiah(account.minimumBalance)}</span>
          <span className={archived ? "status-pill status-archived" : "status-pill status-active"}>
            {archived ? "Diarsipkan" : "Aktif"}
          </span>
          <RecordActions
            archived={archived}
            busy={savingId === account.id}
            onEdit={() => onEdit(account)}
            onArchive={() => onArchive(account)}
          />
        </article>
      ))}
    </div>
  );
}

function RecordActions({
  archived,
  busy,
  onEdit,
  onArchive,
}: {
  archived: boolean;
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="record-actions">
      <Button className="text-button" disabled={busy} onClick={onEdit} type="button">
        Ubah
      </Button>
      <Button
        className={archived ? "text-button restore-button" : "text-button archive-button"}
        disabled={busy}
        onClick={onArchive}
        type="button"
      >
        {busy ? "Menyimpan..." : archived ? "Pulihkan" : "Arsipkan"}
      </Button>
    </div>
  );
}

function EmptyState({
  title,
  description,
  onCreate,
}: {
  title: string;
  description: string;
  onCreate?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">＋</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {onCreate && (
        <Button className="button button-secondary" onClick={onCreate} type="button">
          Tambah data pertama
        </Button>
      )}
    </div>
  );
}

function CategoryDialog({
  record,
  categories,
  onClose,
  onSave,
}: {
  record?: CategoryRecord;
  categories: CategoryRecord[];
  onClose: () => void;
  onSave: (values: CategoryInput, record?: CategoryRecord) => Promise<void>;
}) {
  const [name, setName] = useState(record?.name ?? "");
  const [type, setType] = useState<CategoryType>(record?.type ?? "EXPENSE");
  const [parentId, setParentId] = useState(record?.parentId ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({ name, type, parentId: parentId || null }, record);
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogFrame title={record ? "Ubah kategori" : "Tambah kategori"} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="form-field">
          <span>Nama kategori</span>
          <Input
            autoFocus
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: Makan dan minum"
            required
            value={name}
          />
        </label>
        <label className="form-field">
          <span>Jenis kategori</span>
          <SelectField value={type} onValueChange={(value) => { setType(value as CategoryType); setParentId(""); }} placeholder="Pilih jenis kategori" options={[
            { value: "EXPENSE", label: "Pengeluaran" },
            { value: "INCOME", label: "Pemasukan" },
          ]} />
        </label>
        <label className="form-field">
          <span>Kategori induk <small>Opsional, maksimal satu tingkat</small></span>
          <SelectField value={parentId || "__none__"} onValueChange={(value) => setParentId(value === "__none__" ? "" : value)} placeholder="Pilih kategori induk" options={[
            { value: "__none__", label: "Tidak ada — kategori induk" },
            ...categories.filter((category) => category.type === type && !category.parentId && !category.isArchived && category.id !== record?.id).map((category) => ({ value: category.id, label: category.name })),
          ]} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <DialogActions busy={busy} onClose={onClose} submitLabel={record ? "Simpan perubahan" : "Tambah kategori"} />
      </form>
    </DialogFrame>
  );
}

function AccountDialog({
  record,
  onClose,
  onSave,
}: {
  record?: AccountRecord;
  onClose: () => void;
  onSave: (values: AccountInput, record?: AccountRecord) => Promise<void>;
}) {
  const [name, setName] = useState(record?.name ?? "");
  const [type, setType] = useState<AccountType>(record?.type ?? "BANK");
  const [openingBalance, setOpeningBalance] = useState(
    record ? String(Math.round(Number(record.openingBalance))) : "0",
  );
  const [minimumBalance, setMinimumBalance] = useState(
    record ? String(Math.round(Number(record.minimumBalance))) : "0",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onSave({ name, type, openingBalance: Number(openingBalance), minimumBalance: Number(minimumBalance) }, record);
    } catch (saveError) {
      setError(messageFrom(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogFrame title={record ? "Ubah akun" : "Tambah akun"} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="form-field">
          <span>Nama akun</span>
          <Input
            autoFocus
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Contoh: BCA"
            required
            value={name}
          />
        </label>
        <label className="form-field">
          <span>Jenis akun</span>
          <SelectField value={type} onValueChange={(value) => setType(value as AccountType)} placeholder="Pilih jenis akun" options={Object.entries(accountTypeLabels).map(([value, label]) => ({ value, label }))} />
        </label>
        <div className="form-grid">
          <label className="form-field">
            <span>Saldo awal</span>
            <div className="input-prefix">
              <span>Rp</span>
              <Input
                inputMode="numeric"
                min="0"
                onChange={(event) => setOpeningBalance(event.target.value)}
                required
                step="1"
                type="number"
                value={openingBalance}
              />
            </div>
            <small>Saldo pada awal penggunaan aplikasi.</small>
          </label>
          <label className="form-field">
            <span>Saldo minimum tertahan</span>
            <div className="input-prefix">
              <span>Rp</span>
              <Input
                inputMode="numeric"
                min="0"
                onChange={(event) => setMinimumBalance(event.target.value)}
                required
                step="1"
                type="number"
                value={minimumBalance}
              />
            </div>
            <small>Dana minimum yang tidak dianggap tersedia.</small>
          </label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <DialogActions busy={busy} onClose={onClose} submitLabel={record ? "Simpan perubahan" : "Tambah akun"} />
      </form>
    </DialogFrame>
  );
}

function DialogFrame({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="dialog-card" showCloseButton={false}>
        <DialogHeader className="dialog-heading">
          <div>
            <p className="eyebrow">MASTER DATA</p>
            <DialogTitle id="dialog-title">{title}</DialogTitle>
          </div>
          <Button aria-label="Tutup" className="icon-button" onClick={onClose} type="button">×</Button>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function DialogActions({
  busy,
  onClose,
  submitLabel,
}: {
  busy: boolean;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="dialog-actions">
      <Button className="button button-quiet" disabled={busy} onClick={onClose} type="button">
        Batal
      </Button>
      <Button className="button button-primary" disabled={busy} type="submit">
        {busy ? "Menyimpan..." : submitLabel}
      </Button>
    </div>
  );
}
