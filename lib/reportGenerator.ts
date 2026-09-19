import { formatIndianCurrency } from './formatters';
import { calculateReport2Totals, calculateDaySanction, calculateDayNetGrowth, sumAmountList } from './calculations';

export const generateReport1Text = (data: any): string => {
  // Daily Totals
  const totalFresh = sumAmountList(data.freshBusiness);
  const totalRenewal = sumAmountList(data.renewalBusiness);
  const totalRedemption = sumAmountList(data.glRedemption);
  const totalConverted = sumAmountList(data.convertedAmount);

  const daySanction = calculateDaySanction(totalFresh, totalRenewal);
  const dayNetGrowth = calculateDayNetGrowth(daySanction, totalRedemption);

  // Month-To-Date (MTD) Totals & Cumulative Fields
  const monthFresh = (Number(data.prevMonthFresh) || 0) + totalFresh;
  const monthRenewal = (Number(data.prevMonthRenewal) || 0) + totalRenewal;
  const monthSanction = monthFresh + monthRenewal;
  const monthRedemption = (Number(data.prevMonthRedemption) || 0) + totalRedemption;
  const monthNetGrowth = monthSanction - monthRedemption;
  
  const totalPjbt = (Number(data.prevPjbtData) || 0) + (Number(data.pjbtData) || 0);

  return `Daily Business Report

Branch Name: ${data.branchName}
JE Name: ${data.jeName}
Date: ${data.date.split('-').reverse().join('/')}

Key Responsibilities

1st Key: ${data.firstKey || ''}
2nd Key: ${data.secondKey || ''}

Today's Business

Day Fresh Business Amount: ${formatIndianCurrency(totalFresh)}
Day Renewed Business Amount: ${formatIndianCurrency(totalRenewal)}
Day GL Total Sanction Amount: ${formatIndianCurrency(daySanction)}
Day GL Redemption Amount: ${formatIndianCurrency(totalRedemption)}
Day Net Growth: ${formatIndianCurrency(dayNetGrowth)}

Month Business Target:

Month Fresh Business Amount: ${formatIndianCurrency(monthFresh)}
Month Renewal Business Amount: ${formatIndianCurrency(monthRenewal)}
Month GL Sanction Amount: ${formatIndianCurrency(monthSanction)}
Month GL Redemption Amount: ${formatIndianCurrency(monthRedemption)}
Net Growth: ${formatIndianCurrency(monthNetGrowth)}

Expired Agreement

No of Agreement: ${data.expiredAgreements || 0}
No of Renewed: ${data.expiredRenewed || 0}
Today Renewed: ${data.todayRenewed || 0}
Balance: ${data.expiredBalance || 0}

Calling Report:

TOTAL PJBT DATA: ${totalPjbt}
No of calls: ${data.calls || 0}
No of converted: ${data.converted || 0}
Converted Amount: ${formatIndianCurrency(totalConverted)}

New customer

Total: ${data.newCustomers || 0}`;
};

export const generateReport2Text = (data: any, date: string): string => {
  const formattedDate = date.split('-').reverse().join('/');
  
  const newTwTotal = sumAmountList(data.newTwAmount);
  const ehTwTotal = sumAmountList(data.ehTwAmount);
  const usedTwTotal = sumAmountList(data.usedTwAmount);
  const splTotal = sumAmountList(data.splAmount);
  const csplTotal = sumAmountList(data.csplAmount);
  const goldTotal = sumAmountList(data.goldAmount);

  const totals = calculateReport2Totals([
    { cases: data.newTwCases, amount: newTwTotal },
    { cases: data.ehTwCases, amount: ehTwTotal },
    { cases: data.usedTwCases, amount: usedTwTotal },
    { cases: data.splCases, amount: splTotal },
    { cases: data.csplCases, amount: csplTotal },
    { cases: data.goldCases, amount: goldTotal },
  ]);

  return `DEAR SIR,

DATE = ${formattedDate}

TODAY BUSINESS DETAILS

NEW TW = ${String(data.newTwCases || 0).padStart(2, '0')} = ${formatIndianCurrency(newTwTotal)}
EH TW = ${String(data.ehTwCases || 0).padStart(2, '0')} = ${formatIndianCurrency(ehTwTotal)}
USED TW = ${String(data.usedTwCases || 0).padStart(2, '0')} = ${formatIndianCurrency(usedTwTotal)}
SPL = ${String(data.splCases || 0).padStart(2, '0')} = ${formatIndianCurrency(splTotal)}
CSPL = ${String(data.csplCases || 0).padStart(2, '0')} = ${formatIndianCurrency(csplTotal)}
GOLD = ${String(data.goldCases || 0).padStart(2, '0')} = ${formatIndianCurrency(goldTotal)}

TOTAL = ${String(totals.totalCases).padStart(2, '0')} = ${formatIndianCurrency(totals.totalAmount)}`;
};