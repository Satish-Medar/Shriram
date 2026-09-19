export const formatIndianCurrency = (amount: number): string => {
  const isNegative = amount < 0;
  const absoluteAmount = Math.abs(amount);
  
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(absoluteAmount);

  return isNegative ? `-${formatted}` : formatted;
};