export const accountTypes = ["BANK", "EWALLET", "CASH", "OTHER"] as const;
export type AccountType = (typeof accountTypes)[number];

export const categoryTypes = ["INCOME", "EXPENSE"] as const;
export type CategoryType = (typeof categoryTypes)[number];

export type AccountRecord = {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: string;
  minimumBalance: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CategoryRecord = {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
  parent?: Pick<CategoryRecord, "id" | "name"> | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AccountInput = {
  name: string;
  type: AccountType;
  openingBalance: number;
  minimumBalance: number;
};

export type CategoryInput = {
  name: string;
  type: CategoryType;
  parentId: string | null;
};
