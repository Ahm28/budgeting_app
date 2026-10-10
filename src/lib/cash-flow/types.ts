import type { AccountRecord, CategoryRecord, CategoryType } from "@/lib/master-data/types";

export type TransactionInput = {
  transactionDate: string;
  amount: number;
  description: string;
  accountId: string;
  categoryId: string;
  budgetCategoryId: string | null;
  categoryType: CategoryType;
};

export type TransactionRecord = {
  id: string;
  transactionDate: string;
  amount: string;
  description: string | null;
  accountId: string;
  categoryId: string;
  budgetCategoryId: string | null;
  createdAt: string;
  updatedAt: string;
  account: Pick<AccountRecord, "id" | "name" | "type" | "isArchived">;
  category: Pick<CategoryRecord, "id" | "name" | "type" | "isArchived" | "parentId" | "parent">;
  budgetCategory: Pick<CategoryRecord, "id" | "name" | "type" | "isArchived" | "parentId" | "parent"> | null;
};

export type AccountTransferInput = {
  transferDate: string;
  amount: number;
  description: string;
  fromAccountId: string;
  toAccountId: string;
};

export type AccountTransferRecord = {
  id: string;
  transferDate: string;
  amount: string;
  description: string | null;
  fromAccountId: string;
  toAccountId: string;
  createdAt: string;
  updatedAt: string;
  fromAccount: Pick<AccountRecord, "id" | "name" | "type" | "isArchived">;
  toAccount: Pick<AccountRecord, "id" | "name" | "type" | "isArchived">;
};

export type CashFlowResponse = {
  transactions: TransactionRecord[];
  transfers: AccountTransferRecord[];
  summary: { income: string; expense: string; net: string };
  accountBalances: Array<{
    account: Pick<AccountRecord, "id" | "name" | "type" | "isArchived">;
    openingBalance: string;
    income: string;
    expense: string;
    transferIn: string;
    transferOut: string;
    balance: string;
  }>;
};
