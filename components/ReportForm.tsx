"use client";
import { useState, useEffect, useRef } from "react";
import {
  calculateDaySanction,
  calculateDayNetGrowth,
  calculateReport2Totals,
  sumAmountList,
} from "@/lib/calculations";
import { formatIndianCurrency } from "@/lib/formatters";
import {
  generateReport1Text,
  generateReport2Text,
} from "@/lib/reportGenerator";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const DRAFT_STORAGE_PREFIX = "daily-business-report-draft:";

const INITIAL_FORM_STATE = {
  date: new Date().toISOString().split("T")[0],
  branchName: "",
  jeName: "",
  firstKey: "",
  secondKey: "",

  prevMonthFresh: 0,
  prevMonthRenewal: 0,
  prevMonthRedemption: 0,
  prevPjbtData: 0,

  freshBusiness: [""],
  renewalBusiness: [""],
  glRedemption: [""],
  convertedAmount: [""],

  newTwAmount: [""],
  ehTwAmount: [""],
  usedTwAmount: [""],
  splAmount: [""],
  csplAmount: [""],
  goldAmount: [""],

  expiredAgreements: 0,
  expiredRenewed: 0,
  todayRenewed: 0,
  expiredBalance: 0,
  autoCalculateBalance: true,
  pjbtData: 0,
  calls: 0,
  converted: 0,
  newCustomers: 0,
  newTwCases: 0,
  ehTwCases: 0,
  usedTwCases: 0,
  splCases: 0,
  csplCases: 0,
  goldCases: 0,
};

const DynamicAmountList = ({
  label,
  fieldKey,
  formData,
  setFormData,
}: {
  label: string;
  fieldKey: string;
  formData: any;
  setFormData: any;
}) => {
  const values = formData[fieldKey] as string[];
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-600 mb-1">
        {label}
      </label>
      {values.map((amount, index) => (
        <div key={index} className="flex gap-2 mb-2">
          <input
            type="number"
            className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={amount}
            onChange={(e) => {
              const newList = [...values];
              newList[index] = e.target.value;
              setFormData({ ...formData, [fieldKey]: newList });
            }}
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            placeholder="0"
          />
          {values.length > 1 && (
            <button
              onClick={() =>
                setFormData({
                  ...formData,
                  [fieldKey]: values.filter((_, i) => i !== index),
                })
              }
              className="px-4 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 font-bold transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() =>
          setFormData({ ...formData, [fieldKey]: [...values, ""] })
        }
        className="text-sm font-semibold text-blue-600 hover:text-blue-700 mt-1"
      >
        + Add amount
      </button>
    </div>
  );
};

const Report2Row = ({
  label,
  caseKey,
  amountKey,
  formData,
  setFormData,
}: {
  label: string;
  caseKey: string;
  amountKey: string;
  formData: any;
  setFormData: any;
}) => {
  const values = formData[amountKey] as string[];
  return (
    <div className="grid grid-cols-12 gap-4 items-start border-b border-gray-100 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <div className="col-span-3 font-medium text-sm text-gray-700 mt-3">
        {label}
      </div>
      <div className="col-span-3">
        <input
          type="number"
          min="0"
          className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none mt-1"
          value={(formData as any)[caseKey] || ""}
          onChange={(e) =>
            setFormData({ ...formData, [caseKey]: Number(e.target.value) })
          }
          onWheel={(e) => (e.target as HTMLInputElement).blur()}
          placeholder="Cases"
        />
      </div>
      <div className="col-span-6 space-y-2 mt-1">
        {values.map((amount, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="number"
              className="w-full p-3 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={amount}
              onChange={(e) => {
                const newList = [...values];
                newList[index] = e.target.value;
                setFormData({ ...formData, [amountKey]: newList });
              }}
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="Amount (₹)"
            />
            {values.length > 1 && (
              <button
                onClick={() =>
                  setFormData({
                    ...formData,
                    [amountKey]: values.filter((_, i) => i !== index),
                  })
                }
                className="px-3 bg-red-50 text-red-500 rounded hover:bg-red-100 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() =>
            setFormData({ ...formData, [amountKey]: [...values, ""] })
          }
          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          + Add amount
        </button>
      </div>
    </div>
  );
};

export default function ReportForm() {
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [draftStorageKey, setDraftStorageKey] = useState<string | null>(null);
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const skipNextDraftSave = useRef(false);

  const [derived, setDerived] = useState({
    totalFresh: 0,
    totalRenewal: 0,
    totalRedemption: 0,
    sanction: 0,
    netGrowth: 0,
    monthFresh: 0,
    monthRenewal: 0,
    monthSanction: 0,
    monthRedemption: 0,
    monthNetGrowth: 0,
    totalPjbtData: 0,
    report2Cases: 0,
    report2Amount: 0,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [showMtdInputs, setShowMtdInputs] = useState(false);

  const [savedReport1Snapshot, setSavedReport1Snapshot] = useState("");
  const [savedReport2Snapshot, setSavedReport2Snapshot] = useState("");

  // FETCH FROM DATABASE ON MOUNT
  useEffect(() => {
    async function loadUserData() {
      if (!isSupabaseConfigured || !supabase) {
        setIsMounted(true);
        setShowMtdInputs(true);
        setIsDraftHydrated(true);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsMounted(true);
        setIsDraftHydrated(true);
        return;
      }

      const storageKey = `${DRAFT_STORAGE_PREFIX}${user.id}`;
      setDraftStorageKey(storageKey);

      let savedDraft: Partial<typeof INITIAL_FORM_STATE> | null = null;
      try {
        const rawDraft = window.localStorage.getItem(storageKey);
        if (rawDraft) {
          savedDraft = JSON.parse(rawDraft);
        }
      } catch (error) {
        console.warn("Unable to restore saved draft:", error);
      }

      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const today = new Date();
        const reportDate = new Date(data.date);

        let newPrevFresh = 0;
        let newPrevRenewal = 0;
        let newPrevRedemption = 0;
        let newPrevPjbt = 0;

        // If the last report was from this same month, calculate the new running totals automatically
        if (
          today.getMonth() === reportDate.getMonth() &&
          today.getFullYear() === reportDate.getFullYear()
        ) {
          newPrevFresh =
            Number(data.prev_month_fresh || 0) +
            Number(data.fresh_business || 0);
          newPrevRenewal =
            Number(data.prev_month_renewal || 0) +
            Number(data.renewal_business || 0);
          newPrevRedemption =
            Number(data.prev_month_redemption || 0) +
            Number(data.gl_redemption || 0);
          newPrevPjbt =
            Number(data.prev_pjbt_data || 0) + Number(data.pjbt_data || 0);
        }

        // Apply profile names and calculated MTD from DB
        setFormData((prev) => ({
          ...prev,
          branchName: data.branch_name || prev.branchName,
          jeName: data.je_name || prev.jeName,
          firstKey: data.first_key || prev.firstKey,
          secondKey: data.second_key || prev.secondKey,
          prevMonthFresh: newPrevFresh,
          prevMonthRenewal: newPrevRenewal,
          prevMonthRedemption: newPrevRedemption,
          prevPjbtData: newPrevPjbt,
          ...savedDraft,
        }));

        // Only show the box if the calculated DB totals are absolutely 0
        if (
          newPrevFresh === 0 &&
          newPrevRenewal === 0 &&
          newPrevRedemption === 0
        ) {
          setShowMtdInputs(true);
        } else {
          setShowMtdInputs(false);
        }
      } else {
        // No reports found in DB at all (First day using the app)
        setShowMtdInputs(true);
        if (savedDraft) {
          setFormData((prev) => ({ ...prev, ...savedDraft }));
        }
      }
      setIsMounted(true);
      setIsDraftHydrated(true);
    }

    loadUserData();
  }, []);

  useEffect(() => {
    if (!isDraftHydrated || !draftStorageKey) return;

    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }

    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(formData));
    } catch (error) {
      console.warn("Unable to save report draft:", error);
    }
  }, [draftStorageKey, formData, isDraftHydrated]);

  // AUTO-CALCULATIONS
  useEffect(() => {
    const totalFresh = sumAmountList(formData.freshBusiness);
    const totalRenewal = sumAmountList(formData.renewalBusiness);
    const totalRedemption = sumAmountList(formData.glRedemption);

    const sanction = calculateDaySanction(totalFresh, totalRenewal);
    const netGrowth = calculateDayNetGrowth(sanction, totalRedemption);

    const monthFresh = (Number(formData.prevMonthFresh) || 0) + totalFresh;
    const monthRenewal =
      (Number(formData.prevMonthRenewal) || 0) + totalRenewal;
    const monthSanction = monthFresh + monthRenewal;
    const monthRedemption =
      (Number(formData.prevMonthRedemption) || 0) + totalRedemption;
    const monthNetGrowth = monthSanction - monthRedemption;
    const totalPjbtData =
      (Number(formData.prevPjbtData) || 0) + (Number(formData.pjbtData) || 0);

    const r2Totals = calculateReport2Totals([
      {
        cases: formData.newTwCases,
        amount: sumAmountList(formData.newTwAmount),
      },
      { cases: formData.ehTwCases, amount: sumAmountList(formData.ehTwAmount) },
      {
        cases: formData.usedTwCases,
        amount: sumAmountList(formData.usedTwAmount),
      },
      { cases: formData.splCases, amount: sumAmountList(formData.splAmount) },
      { cases: formData.csplCases, amount: sumAmountList(formData.csplAmount) },
      { cases: formData.goldCases, amount: sumAmountList(formData.goldAmount) },
    ]);

    let newBalance = formData.expiredBalance;
    if (formData.autoCalculateBalance) {
      newBalance = Math.max(
        0,
        formData.expiredAgreements -
          (formData.expiredRenewed + formData.todayRenewed),
      );
    }

    setDerived({
      totalFresh,
      totalRenewal,
      totalRedemption,
      sanction,
      netGrowth,
      monthFresh,
      monthRenewal,
      monthSanction,
      monthRedemption,
      monthNetGrowth,
      totalPjbtData,
      report2Cases: r2Totals.totalCases,
      report2Amount: r2Totals.totalAmount,
    });

    if (
      formData.autoCalculateBalance &&
      newBalance !== formData.expiredBalance
    ) {
      setFormData((prev) => ({ ...prev, expiredBalance: newBalance }));
    }
  }, [formData]);

  const handleSaveReport = async () => {
    if (!isSupabaseConfigured || !supabase) {
      alert(
        "Supabase is not configured yet. Add your environment variables before saving reports.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to save reports.");
        return;
      }

      const dbRecord = {
        user_id: user.id,
        date: formData.date,
        branch_name: formData.branchName,
        je_name: formData.jeName,
        first_key: formData.firstKey,
        second_key: formData.secondKey,

        // NEW: Saving the MTD offset explicitly
        prev_month_fresh: formData.prevMonthFresh || 0,
        prev_month_renewal: formData.prevMonthRenewal || 0,
        prev_month_redemption: formData.prevMonthRedemption || 0,
        prev_pjbt_data: formData.prevPjbtData || 0,

        fresh_business: sumAmountList(formData.freshBusiness),
        renewal_business: sumAmountList(formData.renewalBusiness),
        gl_redemption: sumAmountList(formData.glRedemption),

        expired_agreements: formData.expiredAgreements || 0,
        expired_renewed: formData.expiredRenewed || 0,
        today_renewed: formData.todayRenewed || 0,
        expired_balance: formData.expiredBalance || 0,

        pjbt_data: formData.pjbtData || 0,
        calls: formData.calls || 0,
        converted: formData.converted || 0,
        converted_amount: sumAmountList(formData.convertedAmount),

        new_customers: formData.newCustomers || 0,

        new_tw_cases: formData.newTwCases || 0,
        new_tw_amount: sumAmountList(formData.newTwAmount),
        eh_tw_cases: formData.ehTwCases || 0,
        eh_tw_amount: sumAmountList(formData.ehTwAmount),
        used_tw_cases: formData.usedTwCases || 0,
        used_tw_amount: sumAmountList(formData.usedTwAmount),
        spl_cases: formData.splCases || 0,
        spl_amount: sumAmountList(formData.splAmount),
        cspl_cases: formData.csplCases || 0,
        cspl_amount: sumAmountList(formData.csplAmount),
        gold_cases: formData.goldCases || 0,
        gold_amount: sumAmountList(formData.goldAmount),

        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("daily_reports")
        .upsert(dbRecord, { onConflict: "user_id, date" });

      if (error) throw error;

      if (draftStorageKey) {
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch (error) {
          console.warn("Unable to clear saved draft:", error);
        }
      }
      skipNextDraftSave.current = true;

      setShowMtdInputs(false);

      setSavedReport1Snapshot(generateReport1Text(formData));
      setSavedReport2Snapshot(generateReport2Text(formData, formData.date));

      setShowPreview(true);

      setFormData((prev) => ({
        ...INITIAL_FORM_STATE,
        date: new Date().toISOString().split("T")[0],
        branchName: prev.branchName,
        jeName: prev.jeName,
        firstKey: prev.firstKey,
        secondKey: prev.secondKey,
        // Carry forward the newly calculated MTD for immediate view without page reload
        prevMonthFresh: derived.monthFresh,
        prevMonthRenewal: derived.monthRenewal,
        prevMonthRedemption: derived.monthRedemption,
        prevPjbtData: derived.totalPjbtData,
      }));
    } catch (error: any) {
      console.error("Save error:", error);
      alert("❌ Failed to save: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const closePreview = () => {
    setShowPreview(false);
    setSavedReport1Snapshot("");
    setSavedReport2Snapshot("");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
      {/* SECTION A - BASIC INFORMATION */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 text-gray-800">
          Basic Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Date
            </label>
            <input
              type="date"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Branch Name
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.branchName}
              onChange={(e) =>
                setFormData({ ...formData, branchName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              JE Name
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.jeName}
              onChange={(e) =>
                setFormData({ ...formData, jeName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              1st Key
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.firstKey}
              onChange={(e) =>
                setFormData({ ...formData, firstKey: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              2nd Key
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.secondKey}
              onChange={(e) =>
                setFormData({ ...formData, secondKey: e.target.value })
              }
            />
          </div>
        </div>
      </section>

      {/* SECTION B - REPORT 1 */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        {/* SMART HEADER */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg text-gray-800">
            Report 1 - Daily Business
          </h2>
          {isMounted && !showMtdInputs && (
            <button
              onClick={() => setShowMtdInputs(true)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              ⚙️ Edit MTD Balances
            </button>
          )}
        </div>

        {/* CONDITIONALLY RENDERED MTD BOX FROM DB */}
        {isMounted && showMtdInputs && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-blue-900 text-sm">
                  Previous Month-To-Date Data
                </h3>
                <p className="text-xs text-blue-700">
                  Enter your running totals up until yesterday.
                </p>
              </div>
              <button
                onClick={() => setShowMtdInputs(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  Prev MTD Fresh Business
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.prevMonthFresh || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prevMonthFresh: Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  Prev MTD Renewal
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.prevMonthRenewal || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prevMonthRenewal: Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  Prev MTD GL Redemption
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.prevMonthRedemption || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prevMonthRedemption: Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-blue-800 mb-1">
                  Prev PJBT Data
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  value={formData.prevPjbtData || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      prevPjbtData: Number(e.target.value),
                    })
                  }
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        <DynamicAmountList
          label="Today's Fresh Business Amount(s)"
          fieldKey="freshBusiness"
          formData={formData}
          setFormData={setFormData}
        />
        <DynamicAmountList
          label="Today's Renewal Business Amount(s)"
          fieldKey="renewalBusiness"
          formData={formData}
          setFormData={setFormData}
        />
        <DynamicAmountList
          label="Today's GL Redemption Amount(s)"
          fieldKey="glRedemption"
          formData={formData}
          setFormData={setFormData}
        />

        {/* Daily Summary */}
        <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>
              Total Fresh:{" "}
              <b className="text-gray-700">
                {formatIndianCurrency(derived.totalFresh)}
              </b>
            </span>
            <span>
              Total Renewal:{" "}
              <b className="text-gray-700">
                {formatIndianCurrency(derived.totalRenewal)}
              </b>
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Day GL Sanction:</span>
            <span className="font-bold text-gray-900 text-lg">
              {formatIndianCurrency(derived.sanction)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 font-medium">Day Net Growth:</span>
            <span
              className={`font-bold text-lg ${derived.netGrowth < 0 ? "text-red-600" : "text-green-600"}`}
            >
              {formatIndianCurrency(derived.netGrowth)}
            </span>
          </div>
        </div>

        {/* New MTD Summary Preview */}
        <div className="pt-4 mt-4 border-t border-gray-200 space-y-2 bg-gray-50 p-3 rounded-lg">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            New MTD Projections
          </h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">New MTD Sanction:</span>
            <span className="font-semibold text-gray-900">
              {formatIndianCurrency(derived.monthSanction)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">New MTD Growth:</span>
            <span
              className={`font-semibold ${derived.monthNetGrowth < 0 ? "text-red-600" : "text-green-600"}`}
            >
              {formatIndianCurrency(derived.monthNetGrowth)}
            </span>
          </div>
        </div>
      </section>

      {/* SECTION C - EXPIRED AGREEMENT */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 text-gray-800">
          Expired Agreement
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              No of Agreement
            </label>
            <input
              type="number"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.expiredAgreements || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expiredAgreements: Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              No of Renewed
            </label>
            <input
              type="number"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.expiredRenewed || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expiredRenewed: Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Today Renewed
            </label>
            <input
              type="number"
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.todayRenewed || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  todayRenewed: Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-gray-600">
                Balance
              </label>
              <label className="text-xs text-blue-600 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoCalculateBalance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      autoCalculateBalance: e.target.checked,
                    })
                  }
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Auto
              </label>
            </div>
            <input
              type="number"
              disabled={formData.autoCalculateBalance}
              className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              value={formData.expiredBalance || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  expiredBalance: Number(e.target.value),
                })
              }
              onWheel={(e) => (e.target as HTMLInputElement).blur()}
              placeholder="0"
            />
          </div>
        </div>
      </section>

      {/* SECTION D - CALLING REPORT */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 text-gray-800">Calling Report</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Today's PJBT DATA
              </label>
              <input
                type="number"
                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.pjbtData || ""}
                onChange={(e) =>
                  setFormData({ ...formData, pjbtData: Number(e.target.value) })
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
              />
              <p className="text-xs text-gray-500 mt-1">
                Total will be: {derived.totalPjbtData}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                No of calls
              </label>
              <input
                type="number"
                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.calls || ""}
                onChange={(e) =>
                  setFormData({ ...formData, calls: Number(e.target.value) })
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                No of converted
              </label>
              <input
                type="number"
                className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                value={formData.converted || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    converted: Number(e.target.value),
                  })
                }
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                placeholder="0"
              />
            </div>
            <DynamicAmountList
              label="Converted Amount(s)"
              fieldKey="convertedAmount"
              formData={formData}
              setFormData={setFormData}
            />
          </div>
        </div>
      </section>

      {/* SECTION E - NEW CUSTOMER */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 text-gray-800">New Customer</h2>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Total New Customers
          </label>
          <input
            type="number"
            className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.newCustomers || ""}
            onChange={(e) =>
              setFormData({ ...formData, newCustomers: Number(e.target.value) })
            }
            onWheel={(e) => (e.target as HTMLInputElement).blur()}
            placeholder="0"
          />
        </div>
      </section>

      {/* SECTION F - REPORT 2 */}
      <section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="font-bold text-lg mb-4 text-gray-800">
          Report 2 - Today Business Details
        </h2>
        <div className="space-y-2">
          <Report2Row
            label="NEW TW"
            caseKey="newTwCases"
            amountKey="newTwAmount"
            formData={formData}
            setFormData={setFormData}
          />
          <Report2Row
            label="EH TW"
            caseKey="ehTwCases"
            amountKey="ehTwAmount"
            formData={formData}
            setFormData={setFormData}
          />
          <Report2Row
            label="USED TW"
            caseKey="usedTwCases"
            amountKey="usedTwAmount"
            formData={formData}
            setFormData={setFormData}
          />
          <Report2Row
            label="SPL"
            caseKey="splCases"
            amountKey="splAmount"
            formData={formData}
            setFormData={setFormData}
          />
          <Report2Row
            label="CSPL"
            caseKey="csplCases"
            amountKey="csplAmount"
            formData={formData}
            setFormData={setFormData}
          />
          <Report2Row
            label="GOLD"
            caseKey="goldCases"
            amountKey="goldAmount"
            formData={formData}
            setFormData={setFormData}
          />
        </div>
        <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-lg">
            <span className="text-blue-900 font-bold text-lg">TOTAL</span>
            <div className="text-right">
              <span className="text-blue-900 font-bold mr-4 text-lg">
                {String(derived.report2Cases).padStart(2, "0")} Cases
              </span>
              <span className="text-blue-900 font-bold text-lg">
                {formatIndianCurrency(derived.report2Amount)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex gap-3 z-40">
        <button
          onClick={() => setShowPreview(true)}
          className="flex-1 bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
        >
          Preview
        </button>
        <button
          onClick={handleSaveReport}
          disabled={isSaving}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save Report"}
        </button>
      </div>

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 relative shadow-xl">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {savedReport1Snapshot
                  ? "✅ Report Saved! Copy Below"
                  : "Report Preview"}
              </h2>
              <button
                onClick={closePreview}
                className="text-gray-500 hover:text-gray-800 font-bold p-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Report 1 Preview Box */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">Report 1</h3>
                  <button
                    onClick={async () => {
                      navigator.clipboard.writeText(
                        savedReport1Snapshot || generateReport1Text(formData),
                      );
                      alert("Report 1 copied to clipboard!");
                    }}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-medium hover:bg-blue-200"
                  >
                    Copy Report
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {savedReport1Snapshot || generateReport1Text(formData)}
                </pre>
              </div>

              {/* Report 2 Preview Box */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-800">Report 2</h3>
                  <button
                    onClick={async () => {
                      navigator.clipboard.writeText(
                        savedReport2Snapshot ||
                          generateReport2Text(formData, formData.date),
                      );
                      alert("Report 2 copied to clipboard!");
                    }}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded font-medium hover:bg-green-200"
                  >
                    Copy Report
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                  {savedReport2Snapshot ||
                    generateReport2Text(formData, formData.date)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
