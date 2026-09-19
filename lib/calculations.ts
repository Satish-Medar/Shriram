export const calculateDaySanction = (fresh: number, renewal: number): number => {
  return fresh + renewal;
};

export const calculateDayNetGrowth = (sanction: number, redemption: number): number => {
  return sanction - redemption;
};

export const calculateReport2Totals = (categories: { cases: number; amount: number }[]) => {
  return categories.reduce(
    (acc, curr) => ({
      totalCases: acc.totalCases + (curr.cases || 0),
      totalAmount: acc.totalAmount + (curr.amount || 0),
    }),
    { totalCases: 0, totalAmount: 0 }
  );
};

// New function to handle summing up dynamic lists of inputs
export const sumAmountList = (list: string[] | string | number | undefined): number => {
  if (!list) return 0;
  if (Array.isArray(list)) {
    return list.reduce((sum, val) => sum + (Number(val) || 0), 0);
  }
  return Number(list) || 0;
};