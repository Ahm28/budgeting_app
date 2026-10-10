import type { CategoryRecord } from "@/lib/master-data/types";

export type BudgetPeriodInput = { startsOn: string; endsOn: string };

export type BudgetPeriodRecord = {
  id: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  updatedAt: string;
};

export type BudgetAllocationInput = { categoryId: string; amount: number };

export type BudgetPeriodDetails = BudgetPeriodRecord & {
  allocations: Array<{
    id: string | null;
    categoryId: string;
    category: Pick<CategoryRecord, "id" | "name" | "type" | "isArchived" | "parentId" | "parent">;
    amount: string;
    spent: string;
    directSpent: string;
    remaining: string;
  }>;
  totalBudget: string;
  totalSpent: string;
  totalRemaining: string;
};

export type DashboardResponse = {
  period: BudgetPeriodRecord;
  summary: {
    income: string;
    expense: string;
    netCashFlow: string;
    totalBudget: string;
    budgetSpent: string;
    budgetRemaining: string;
  };
  categories: BudgetPeriodDetails["allocations"];
  accountBalances: Array<{
    id: string;
    name: string;
    type: string;
    isArchived: boolean;
    balance: string;
  }>;
  recentActivity: Array<{
    id: string;
    date: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    title: string;
    detail: string;
    amount: string;
  }>;
};
