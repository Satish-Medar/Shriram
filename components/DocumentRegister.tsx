"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, Pencil, Search, X } from "lucide-react";
import writeXlsxFile from "write-excel-file/browser";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const DOCUMENT_TYPES = [
  { key: "insurance", label: "Insurance" },
  { key: "invoice", label: "Invoice" },
  { key: "dp_receipt", label: "DP receipt" },
  { key: "quotation", label: "Quotation" },
  { key: "aadhaar_signed", label: "Aadhaar card with customer sign" },
  { key: "pan_signed", label: "PAN card with sign" },
  { key: "bank_passbook", label: "Bank passbook" },
  { key: "electricity_bill", label: "Electricity bill" },
  { key: "demand_promissory_note", label: "Demand promissory note" },
  { key: "dgh_photo", label: "DGH form with photo" },
] as const;

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DocumentKey = (typeof DOCUMENT_TYPES)[number]["key"];
type StoredDocument = { path: string; name: string };
type DocumentMap = Partial<Record<DocumentKey, boolean | StoredDocument>> & {
  mode?: "missing-checklist";
  missing?: DocumentKey[];
};
type CustomerFileRecord = {
  id: string;
  user_id: string;
  agent_name: string;
  customer_name: string;
  file_date: string;
  documents: DocumentMap;
  created_at: string;
};
const isDocumentMissing = (
  record: CustomerFileRecord,
  key: DocumentKey,
): boolean => {
  if (record.documents?.mode === "missing-checklist") {
    return record.documents.missing?.includes(key) ?? false;
  }
  return !(
    record.documents?.[key] === true ||
    (typeof record.documents?.[key] === "object" &&
      record.documents[key] !== null)
  );
};

const getFileUrgency = (record: CustomerFileRecord, today: string) => {
  const missingCount = DOCUMENT_TYPES.filter((item) =>
    isDocumentMissing(record, item.key),
  ).length;
  if (missingCount === 0) {
    return {
      label: "Complete",
      rank: 4,
      backgroundColor: "#FFFFFF",
      textColor: "#334155",
    };
  }

  const [fileYear, fileMonth, fileDay] = record.file_date
    .split("-")
    .map(Number);
  const [todayYear, todayMonth, todayDay] = today.split("-").map(Number);
  const daysOld = Math.floor(
    (Date.UTC(todayYear, todayMonth - 1, todayDay) -
      Date.UTC(fileYear, fileMonth - 1, fileDay)) /
      86400000,
  );

  if (daysOld < 0) {
    return {
      label: "Not due",
      rank: 3,
      backgroundColor: "#FFFFFF",
      textColor: "#334155",
    };
  }
  if (daysOld <= 3) {
    return {
      label: `Yellow · ${daysOld}d`,
      rank: 2,
      backgroundColor: "#FEF3C7",
      textColor: "#92400E",
    };
  }
  if (daysOld <= 7) {
    return {
      label: `Red · ${daysOld}d`,
      rank: 1,
      backgroundColor: "#FEE2E2",
      textColor: "#B91C1C",
    };
  }
  return {
    label: `Dark red · ${daysOld}d`,
    rank: 0,
    backgroundColor: "#7F1D1D",
    textColor: "#FFFFFF",
  };
};

export default function DocumentRegister({
  role,
  assignedAgent,
}: {
  role: "owner" | "agent";
  assignedAgent?: string;
}) {
  const [records, setRecords] = useState<CustomerFileRecord[]>([]);
  const [agentName, setAgentName] = useState(assignedAgent ?? "");
  const [customerName, setCustomerName] = useState("");
  const [fileDate, setFileDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [missingDocuments, setMissingDocuments] = useState<
    Partial<Record<DocumentKey, boolean>>
  >({});
  const [searchTerm, setSearchTerm] = useState("");
  const [exportMonth, setExportMonth] = useState(
    toLocalDateString(new Date()).slice(0, 7),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    if (!isSupabaseConfigured || !supabase) {
      queueMicrotask(() => {
        if (!isCurrent) return;
        setMessage("Supabase is not configured.");
        setIsLoading(false);
      });
    } else {
      void supabase
        .from("customer_files")
        .select("*")
        .order("file_date", { ascending: false })
        .then(({ data, error }) => {
          if (!isCurrent) return;
          if (error) {
            setMessage(
              "Unable to load file records. Apply the Supabase migration and try again.",
            );
          } else {
            setRecords((data ?? []) as CustomerFileRecord[]);
            setMessage("");
          }
          setIsLoading(false);
        });
    }

    return () => {
      isCurrent = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.agent_name, record.customer_name, record.file_date]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, searchTerm]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setMessage("Supabase is not configured.");
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage("Your session has expired. Sign in and try again.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    const documents: DocumentMap = {
      mode: "missing-checklist",
      missing: DOCUMENT_TYPES.filter((item) => missingDocuments[item.key]).map(
        (item) => item.key,
      ),
    };

    try {
      const recordData = {
        user_id: user.id,
        agent_name: agentName.trim(),
        customer_name: customerName.trim(),
        file_date: fileDate,
        documents,
      };
      const { error } = editingRecordId
        ? await supabase
            .from("customer_files")
            .update(recordData)
            .eq("id", editingRecordId)
            .eq("user_id", user.id)
        : await supabase.from("customer_files").insert(recordData);
      if (error) throw error;

      setAgentName(role === "agent" ? (assignedAgent ?? "") : "");
      setCustomerName("");
      setFileDate(new Date().toISOString().slice(0, 10));
      setMissingDocuments({});
      setEditingRecordId(null);
      const { data, error: refreshError } = await supabase
        .from("customer_files")
        .select("*")
        .order("file_date", { ascending: false });
      if (refreshError) throw refreshError;
      setRecords((data ?? []) as CustomerFileRecord[]);
      setMessage(
        editingRecordId ? "File record updated." : "File record saved.",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setMessage(`Could not save the record: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (record: CustomerFileRecord) => {
    setEditingRecordId(record.id);
    setAgentName(record.agent_name);
    setCustomerName(record.customer_name);
    setFileDate(record.file_date);
    setMissingDocuments(
      Object.fromEntries(
        DOCUMENT_TYPES.map((item) => [
          item.key,
          isDocumentMissing(record, item.key),
        ]),
      ),
    );
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditing = () => {
    setEditingRecordId(null);
    setAgentName(role === "agent" ? (assignedAgent ?? "") : "");
    setCustomerName("");
    setFileDate(new Date().toISOString().slice(0, 10));
    setMissingDocuments({});
    setMessage("");
  };

  const today = toLocalDateString(new Date());
  const selectedMonthStart = `${exportMonth}-01`;
  const [selectedYear, selectedMonthNumber] = exportMonth
    .split("-")
    .map(Number);
  const selectedMonthEnd = toLocalDateString(
    new Date(selectedYear, selectedMonthNumber, 0),
  );
  const selectedMonthThrough =
    exportMonth === today.slice(0, 7) ? today : selectedMonthEnd;
  const selectedMonthRecords = records.filter(
    (record) =>
      record.file_date >= selectedMonthStart &&
      record.file_date <= selectedMonthThrough,
  );
  const hasMissingDocuments = (record: CustomerFileRecord) =>
    DOCUMENT_TYPES.some((item) => isDocumentMissing(record, item.key));
  const selectedMonthMissingRecords =
    selectedMonthRecords.filter(hasMissingDocuments);
  const sortByUrgency = (items: CustomerFileRecord[]) =>
    [...items].sort((first, second) => {
      const firstUrgency = getFileUrgency(first, today);
      const secondUrgency = getFileUrgency(second, today);
      return (
        firstUrgency.rank - secondUrgency.rank ||
        first.file_date.localeCompare(second.file_date)
      );
    });
  const prioritizedFilteredRecords = sortByUrgency(filteredRecords);

  const exportExcel = async (
    exportRecords: CustomerFileRecord[],
    fileName: string,
  ) => {
    const columns = [
      {
        header: { value: "Date", fontWeight: "bold" as const },
        cell: (record: CustomerFileRecord) => ({
          value: record.file_date,
          type: String,
          backgroundColor: getFileUrgency(record, today).backgroundColor,
          textColor: getFileUrgency(record, today).textColor,
        }),
      },
      {
        header: { value: "Agent Name", fontWeight: "bold" as const },
        cell: (record: CustomerFileRecord) => ({
          value: record.agent_name,
          type: String,
          backgroundColor: getFileUrgency(record, today).backgroundColor,
          textColor: getFileUrgency(record, today).textColor,
        }),
      },
      {
        header: { value: "Customer Name", fontWeight: "bold" as const },
        cell: (record: CustomerFileRecord) => ({
          value: record.customer_name,
          type: String,
          backgroundColor: getFileUrgency(record, today).backgroundColor,
          textColor: getFileUrgency(record, today).textColor,
        }),
      },
      {
        header: { value: "Urgency", fontWeight: "bold" as const },
        cell: (record: CustomerFileRecord) => ({
          value: getFileUrgency(record, today).label,
          type: String,
          backgroundColor: getFileUrgency(record, today).backgroundColor,
          textColor: getFileUrgency(record, today).textColor,
        }),
      },
      {
        header: {
          value: "Missing Documents",
          fontWeight: "bold" as const,
          textColor: "#C62828",
        },
        cell: (record: CustomerFileRecord) => ({
          value:
            DOCUMENT_TYPES.filter((item) => isDocumentMissing(record, item.key))
              .map((item) => item.label)
              .join(", ") || "None",
          type: String,
          backgroundColor: getFileUrgency(record, today).backgroundColor,
          textColor:
            getFileUrgency(record, today).rank === 0 ? "#FFFFFF" : "#C62828",
        }),
      },
    ];
    await writeXlsxFile(sortByUrgency(exportRecords), {
      columns,
      sheet: "Customer Files",
    }).toFile(fileName);
  };

  const inputClass =
    "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12">
      <section className="border-b border-slate-200 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800">
              Customer operations
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">
              Customer file register
            </h2>
          </div>
          {role === "owner" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-medium text-slate-700">
                Export month
                <input
                  type="month"
                  value={exportMonth}
                  max={today.slice(0, 7)}
                  onChange={(event) => setExportMonth(event.target.value)}
                  className={`${inputClass} mt-1 min-w-40`}
                />
              </label>
              <p className="text-xs text-slate-600">
                {selectedMonthRecords.length} files entered ·{" "}
                {selectedMonthMissingRecords.length} with missing documents
              </p>
              <p className="w-full text-right text-xs text-slate-500">
                Yellow: 0–3 days · Red: 4–7 days · Dark red: 8+ days
              </p>
              <button
                type="button"
                onClick={() =>
                  void exportExcel(
                    selectedMonthMissingRecords,
                    `customer-files-missing-${exportMonth}-through-${selectedMonthThrough}.xlsx`,
                  )
                }
                disabled={!selectedMonthMissingRecords.length}
                className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} /> Export missing documents
              </button>
              <button
                type="button"
                onClick={() =>
                  void exportExcel(
                    selectedMonthRecords,
                    `customer-files-all-${exportMonth}-through-${selectedMonthThrough}.xlsx`,
                  )
                }
                disabled={!selectedMonthRecords.length}
                className="inline-flex items-center gap-2 rounded-md border border-teal-800 px-4 py-2.5 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={16} /> Export all files
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <FilePlus2 size={18} className="text-teal-800" />
            <h3 className="font-semibold text-slate-900">
              {editingRecordId ? "Edit customer file" : "Add customer file"}
            </h3>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Agent name
                <select
                  required
                  disabled={role === "agent"}
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  className={`${inputClass} mt-1 font-normal disabled:bg-slate-100`}
                >
                  <option value="" disabled>
                    Select an agent
                  </option>
                  <option value="Surykanth">Surykanth</option>
                  <option value="Babu Pawne">Babu Pawne</option>
                  <option value="Akash">Akash</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Customer name
                <input
                  required
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className={`${inputClass} mt-1 font-normal`}
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              File date
              <input
                required
                type="date"
                value={fileDate}
                onChange={(event) => setFileDate(event.target.value)}
                className={`${inputClass} mt-1 font-normal`}
              />
            </label>

            <div className="border-y border-slate-200 py-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">
                  Mark missing documents
                </h4>
                <span className="text-xs text-slate-500">
                  Checked = Missing · unchecked = Given
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {DOCUMENT_TYPES.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between gap-3 py-2.5"
                  >
                    <span className="text-sm text-slate-700">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={missingDocuments[item.key] ?? false}
                        onChange={(event) =>
                          setMissingDocuments((current) => ({
                            ...current,
                            [item.key]: event.target.checked,
                          }))
                        }
                        className="size-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                      />
                      <span
                        className={`w-14 text-right text-xs font-semibold ${missingDocuments[item.key] ? "text-rose-700" : "text-teal-800"}`}
                      >
                        {missingDocuments[item.key] ? "Missing" : "Given"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {message && (
              <p role="status" className="text-sm text-slate-700">
                {message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
              >
                {editingRecordId ? (
                  <Pencil size={16} />
                ) : (
                  <FilePlus2 size={16} />
                )}
                {isSaving
                  ? "Saving..."
                  : editingRecordId
                    ? "Update file record"
                    : "Save file record"}
              </button>
              {editingRecordId && role === "owner" && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-semibold text-slate-900">Saved records</h3>
            </div>
            <label className="relative block w-full sm:w-56">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search records"
                className={`${inputClass} pl-9`}
              />
            </label>
          </div>
          {isLoading ? (
            <p className="py-6 text-sm text-slate-500">Loading records...</p>
          ) : filteredRecords.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">
              No customer files found.
            </p>
          ) : (
            <div className="divide-y divide-slate-200">
              {prioritizedFilteredRecords.map((record) => {
                const urgency = getFileUrgency(record, today);
                return (
                  <article
                    key={record.id}
                    className="flex items-center justify-between gap-3 py-3"
                    style={{ backgroundColor: urgency.backgroundColor }}
                  >
                    <div className="min-w-0">
                      <h4
                        className="truncate font-medium"
                        style={{ color: urgency.textColor }}
                      >
                        {record.customer_name}
                      </h4>
                      <p
                        className="mt-0.5 text-xs"
                        style={{ color: urgency.textColor }}
                      >
                        {urgency.label}
                      </p>
                    </div>
                    {role === "owner" && (
                      <button
                        type="button"
                        onClick={() => startEditing(record)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-800 hover:text-teal-900"
                        aria-label={`Edit ${record.customer_name}`}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
