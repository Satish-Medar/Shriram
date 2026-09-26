"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Save } from "lucide-react";
import { formatIndianCurrency } from "@/lib/formatters";
import { generateReport2Text } from "@/lib/reportGenerator";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const CATEGORIES = [
  { label: "NEW TW", cases: "newTwCases", amounts: "newTwAmount" },
  { label: "EH TW", cases: "ehTwCases", amounts: "ehTwAmount" },
  { label: "USED TW", cases: "usedTwCases", amounts: "usedTwAmount" },
  { label: "SPL", cases: "splCases", amounts: "splAmount" },
  { label: "CSPL", cases: "csplCases", amounts: "csplAmount" },
] as const;

type AmountKey = (typeof CATEGORIES)[number]["amounts"];
type CaseKey = (typeof CATEGORIES)[number]["cases"];
type AmountLists = Record<AmountKey, string[]>;
type LegacyCaseCounts = Partial<Record<CaseKey, number>>;
type Report2Row = {
  report_date: string;
  new_tw_cases: number;
  new_tw_amount: number;
  eh_tw_cases: number;
  eh_tw_amount: number;
  used_tw_cases: number;
  used_tw_amount: number;
  spl_cases: number;
  spl_amount: number;
  cspl_cases: number;
  cspl_amount: number;
  amount_breakdown: Record<string, unknown> | null;
};

const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const blankAmounts = (): AmountLists => ({
  newTwAmount: [""],
  ehTwAmount: [""],
  usedTwAmount: [""],
  splAmount: [""],
  csplAmount: [""],
});

const restoreList = (value: unknown, fallback: unknown): string[] =>
  Array.isArray(value)
    ? value.map((amount) => String(amount ?? ""))
    : [String(fallback ?? "")];

const sumAmounts = (values: string[]) =>
  values.reduce((total, value) => total + (Number(value) || 0), 0);

const countCases = (values: string[]) =>
  values.filter((value) => value.trim() !== "").length;

export default function Report2Form() {
  const [reportDate, setReportDate] = useState(localDate);
  const [amounts, setAmounts] = useState<AmountLists>(blankAmounts);
  const [legacyCaseCounts, setLegacyCaseCounts] = useState<LegacyCaseCounts>(
    {},
  );
  const [gold, setGold] = useState({ cases: 0, amount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [copyText, setCopyText] = useState("");

  const categoryRows = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        ...category,
        values: amounts[category.amounts],
        cases:
          legacyCaseCounts[category.cases] ??
          countCases(amounts[category.amounts]),
        total: sumAmounts(amounts[category.amounts]),
      })),
    [amounts, legacyCaseCounts],
  );

  const totalCases = categoryRows.reduce(
    (sum, category) => sum + category.cases,
    gold.cases,
  );
  const totalAmount = categoryRows.reduce(
    (sum, category) => sum + category.total,
    gold.amount,
  );

  useEffect(() => {
    let isCurrent = true;
    const loadDate = async () => {
      setIsLoading(true);
      setMessage("");
      setCopyText("");
      if (!supabase || !isSupabaseConfigured) {
        setMessage("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      const [
        { data: saved, error: savedError },
        { data: goldData, error: goldError },
      ] = await Promise.all([
        supabase
          .from("daily_report2")
          .select("*")
          .eq("report_date", reportDate)
          .maybeSingle(),
        supabase.rpc("get_report2_gold", { p_report_date: reportDate }),
      ]);
      if (!isCurrent) return;

      if (savedError || goldError) {
        setMessage(
          "Could not load this date. Check that the access migration has been applied.",
        );
      } else {
        const row = saved as Report2Row | null;
        const breakdown = row?.amount_breakdown ?? {};
        const restoredAmounts: AmountLists = {
          newTwAmount: restoreList(breakdown.newTwAmount, row?.new_tw_amount),
          ehTwAmount: restoreList(breakdown.ehTwAmount, row?.eh_tw_amount),
          usedTwAmount: restoreList(
            breakdown.usedTwAmount,
            row?.used_tw_amount,
          ),
          splAmount: restoreList(breakdown.splAmount, row?.spl_amount),
          csplAmount: restoreList(breakdown.csplAmount, row?.cspl_amount),
        };
        const storedCounts: Partial<Record<CaseKey, number>> = row
          ? {
              newTwCases: Number(row.new_tw_cases ?? 0),
              ehTwCases: Number(row.eh_tw_cases ?? 0),
              usedTwCases: Number(row.used_tw_cases ?? 0),
              splCases: Number(row.spl_cases ?? 0),
              csplCases: Number(row.cspl_cases ?? 0),
            }
          : {};
        const legacyCounts: LegacyCaseCounts = {};
        for (const category of CATEGORIES) {
          const storedCount = storedCounts[category.cases];
          if (
            storedCount !== undefined &&
            storedCount !== countCases(restoredAmounts[category.amounts])
          ) {
            legacyCounts[category.cases] = storedCount;
          }
        }
        setAmounts(restoredAmounts);
        setLegacyCaseCounts(legacyCounts);
        const goldRow = Array.isArray(goldData) ? goldData[0] : goldData;
        setGold({
          cases: Number(goldRow?.gold_cases ?? 0),
          amount: Number(goldRow?.gold_amount ?? 0),
        });
        setMessage(
          row
            ? "Saved Report 2 loaded."
            : "No Report 2 saved for this date yet.",
        );
      }
      setIsLoading(false);
    };
    void loadDate();
    return () => {
      isCurrent = false;
    };
  }, [reportDate]);

  const handleSave = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setMessage("Supabase is not configured.");
      return;
    }
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("Your session expired. Sign in again.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const dbRow = {
      report_date: reportDate,
      updated_by: user.id,
      new_tw_cases:
        legacyCaseCounts.newTwCases ?? countCases(amounts.newTwAmount),
      new_tw_amount: sumAmounts(amounts.newTwAmount),
      eh_tw_cases: legacyCaseCounts.ehTwCases ?? countCases(amounts.ehTwAmount),
      eh_tw_amount: sumAmounts(amounts.ehTwAmount),
      used_tw_cases:
        legacyCaseCounts.usedTwCases ?? countCases(amounts.usedTwAmount),
      used_tw_amount: sumAmounts(amounts.usedTwAmount),
      spl_cases: legacyCaseCounts.splCases ?? countCases(amounts.splAmount),
      spl_amount: sumAmounts(amounts.splAmount),
      cspl_cases: legacyCaseCounts.csplCases ?? countCases(amounts.csplAmount),
      cspl_amount: sumAmounts(amounts.csplAmount),
      amount_breakdown: amounts,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("daily_report2")
      .upsert(dbRow, { onConflict: "report_date" });
    if (error) {
      setMessage(`Could not save Report 2: ${error.message}`);
    } else {
      setMessage("Report 2 saved.");
    }
    setIsSaving(false);
  };

  const reportText = generateReport2Text(
    {
      newTwCases:
        legacyCaseCounts.newTwCases ?? countCases(amounts.newTwAmount),
      newTwAmount: amounts.newTwAmount,
      ehTwCases: legacyCaseCounts.ehTwCases ?? countCases(amounts.ehTwAmount),
      ehTwAmount: amounts.ehTwAmount,
      usedTwCases:
        legacyCaseCounts.usedTwCases ?? countCases(amounts.usedTwAmount),
      usedTwAmount: amounts.usedTwAmount,
      splCases: legacyCaseCounts.splCases ?? countCases(amounts.splAmount),
      splAmount: amounts.splAmount,
      csplCases: legacyCaseCounts.csplCases ?? countCases(amounts.csplAmount),
      csplAmount: amounts.csplAmount,
      goldCases: gold.cases,
      goldAmount: [String(gold.amount)],
    },
    reportDate,
  );

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <section className="border-b border-slate-200 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
          Daily operations
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-900">
          Report 2 · Today business details
        </h2>
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block max-w-xs text-sm font-medium text-slate-700">
          Report date
          <input
            type="date"
            value={reportDate}
            onChange={(event) => setReportDate(event.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        {isLoading ? (
          <p className="py-6 text-sm text-slate-500">Loading report...</p>
        ) : (
          <div className="mt-5 divide-y divide-slate-100">
            {categoryRows.map((category) => (
              <div
                key={category.amounts}
                className="grid grid-cols-[minmax(70px,0.6fr)_70px_minmax(0,1.4fr)] gap-3 py-4 sm:grid-cols-[minmax(100px,0.7fr)_90px_minmax(0,1.3fr)]"
              >
                <span className="pt-2 text-sm font-medium text-slate-700">
                  {category.label}
                </span>
                <div>
                  <span className="mb-1 block text-xs text-slate-500">
                    Cases
                  </span>
                  <input
                    readOnly
                    value={category.cases}
                    aria-label={`${category.label} cases`}
                    className={`${inputClass} bg-slate-100`}
                  />
                </div>
                <div className="space-y-2">
                  <span className="mb-1 block text-xs text-slate-500">
                    Amounts
                  </span>
                  {category.values.map((value, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(event) => {
                          const next = [...amounts[category.amounts]];
                          next[index] = event.target.value;
                          setAmounts((current) => ({
                            ...current,
                            [category.amounts]: next,
                          }));
                          setLegacyCaseCounts((current) => ({
                            ...current,
                            [category.cases]: undefined,
                          }));
                        }}
                        className={inputClass}
                        placeholder="Amount (₹)"
                      />
                      {category.values.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = category.values.filter(
                              (_, itemIndex) => itemIndex !== index,
                            );
                            setAmounts((current) => ({
                              ...current,
                              [category.amounts]: next,
                            }));
                            setLegacyCaseCounts((current) => ({
                              ...current,
                              [category.cases]: undefined,
                            }));
                          }}
                          className="rounded px-3 text-rose-700 hover:bg-rose-50"
                          aria-label={`Remove ${category.label} amount`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setAmounts((current) => ({
                        ...current,
                        [category.amounts]: [...current[category.amounts], ""],
                      }));
                      setLegacyCaseCounts((current) => ({
                        ...current,
                        [category.cases]: undefined,
                      }));
                    }}
                    className="text-xs font-semibold text-teal-800 hover:text-teal-950"
                  >
                    + Add amount
                  </button>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[minmax(70px,0.6fr)_70px_minmax(0,1.4fr)] gap-3 py-4 sm:grid-cols-[minmax(100px,0.7fr)_90px_minmax(0,1.3fr)]">
              <span className="pt-2 text-sm font-medium text-slate-700">
                GOLD
              </span>
              <div>
                <span className="mb-1 block text-xs text-slate-500">Cases</span>
                <input
                  readOnly
                  value={gold.cases}
                  className={`${inputClass} bg-slate-100`}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-slate-500">
                  Amount from Report 1
                </span>
                <input
                  readOnly
                  value={gold.amount}
                  className={`${inputClass} bg-slate-100`}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="font-semibold text-slate-900">
            Total: {totalCases} cases · {formatIndianCurrency(totalAmount)}
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || isLoading}
            className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
          >
            <Save size={16} /> {isSaving ? "Saving..." : "Save Report 2"}
          </button>
        </div>
        {message && (
          <p role="status" className="mt-3 text-sm text-slate-600">
            {message}
          </p>
        )}
      </section>

      <section className="mt-5 border-t border-slate-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-800">Report text</h3>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(reportText);
              setCopyText("Report 2 copied.");
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {copyText ? <Check size={15} /> : <Copy size={15} />}{" "}
            {copyText || "Copy Report 2"}
          </button>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-100 p-4 text-xs text-slate-700">
          {reportText}
        </pre>
      </section>
    </div>
  );
}
