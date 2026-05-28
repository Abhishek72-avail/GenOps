import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe, getGetMeQueryKey,
  useLogout,
  useListGenerators, getListGeneratorsQueryKey,
  useGetGeneratorStats, getGetGeneratorStatsQueryKey,
  useCreateGenerator, useUpdateGenerator, useDeleteGenerator,
} from "@workspace/api-client-react";
import type { GeneratorRecord } from "@workspace/api-client-react";
import {
  Zap, LogOut, Plus, Search, Edit2, Trash2,
  TrendingUp, Database, X, ChevronDown, Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";

const formSchema = z.object({
  tDate: z.string().min(1, "Date is required"),
  generatorId: z.string().min(1, "Generator ID is required"),
  status: z.string().min(1, "Status is required"),
  rating: z.string().optional().nullable(),
  hours: z.coerce.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  "Ready": { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  "Used Ready": { bg: "#fefce8", text: "#a86405ff", dot: "#f3c334ff" },
  "Under Repair": { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  "Under Readiness": { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
  "Other": { bg: "#f8fafc", text: "#64748b", dot: "#94a3b8" },
};

const STATUSES = ["Ready", "Used Ready", "Under Repair", "Under Readiness", "Other"];

interface CPanelConfig {
  id: string;
  label: string;
  prefixes: string[];
  isCustom?: boolean;
}

const DEFAULT_CPANELS: CPanelConfig[] = [
  { id: "C7", label: "C7 - ECW", prefixes: ["ECW"] },
  { id: "C9", label: "C9 - LX9", prefixes: ["LX9"] },
  { id: "C13", label: "C13 - DH40", prefixes: ["DH40"] },
  { id: "C15", label: "C15 - LXJ/2S300", prefixes: ["LXJ", "2S300"] },
  { id: "C18", label: "C18 - LXK", prefixes: ["LXK"] },
];

function getGeneratorPanel(generatorId: string, panels: CPanelConfig[]): string {
  const id = (generatorId || "").toUpperCase().trim();
  for (const panel of panels) {
    for (const prefix of panel.prefixes) {
      if (id.startsWith(prefix.toUpperCase().trim())) {
        return panel.id;
      }
    }
  }
  return "Other";
}


function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Other"];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {status}
    </span>
  );
}

function StatCard({
  icon, label, value, accent, onClick, isActive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const color = accent ?? "#ff6c00";
  return (
    <div
      className={`bg-white rounded-xl border p-5 flex items-center gap-4 shadow-sm transition-all ${onClick ? "cursor-pointer hover:shadow-md" : ""}`}
      style={{
        borderColor: isActive ? color : "#e5e7eb",
        boxShadow: isActive ? `0 0 0 2px ${color}33` : undefined,
      }}
      onClick={onClick}
    >
      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#9ca3af" }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "#111827" }}>{value}</p>
      </div>
      {onClick && (
        <ChevronDown
          className="w-4 h-4 transition-transform duration-200 flex-shrink-0"
          style={{ color: "#9ca3af", transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      )}
    </div>
  );
}

const TODAY = new Date().toISOString().split("T")[0];

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
}


export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

    const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GeneratorRecord | null>(null);
  const [showCPanel, setShowCPanel] = useState(false);
  const [selectedCPanel, setSelectedCPanel] = useState<string | null>(null);

  // Dynamic panels/models state
  const [panels, setPanels] = useState<CPanelConfig[]>(() => {
    const saved = localStorage.getItem("custom_cpanels");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_CPANELS;
  });

  // Modal helper states for adding custom models
  const [isAddSubModelOpen, setIsAddSubModelOpen] = useState(false);
  const [newModelNo, setNewModelNo] = useState("");
  const [newModelPrefix, setNewModelPrefix] = useState("");

  // Delivery states
  const [viewMode, setViewMode] = useState<"main" | "delivery" | "previous">("main");
  const [deliveryModalRecord, setDeliveryModalRecord] = useState<GeneratorRecord | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [returnModalRecord, setReturnModalRecord] = useState<GeneratorRecord | null>(null);
  const [returnStatus, setReturnStatus] = useState("Other");

  const { data: stats } = useGetGeneratorStats({ query: { queryKey: getGetGeneratorStatsQueryKey() } });

  // Fetch ALL records — filtering is done client-side so C Panel stats are always accurate
  const { data: allGenerators, isLoading: isLoadingGenerators } = useListGenerators(
    undefined,
    { query: { queryKey: getListGeneratorsQueryKey() } }
  );

  // Client-side filtered list for the table
  const generators = useMemo(() => {
    if (!allGenerators) return [];
    return allGenerators.filter((r) => {
      if (viewMode === "main") {
        if (r.deliveryStatus === "current") return false;
      } else if (viewMode === "delivery") {
        if (r.deliveryStatus !== "current") return false;
      } else if (viewMode === "previous") {
        if (r.deliveryStatus !== "previous") return false;
      }
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (selectedCPanel && getGeneratorPanel(r.generatorId, panels) !== selectedCPanel) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          r.generatorId.toLowerCase().includes(s) ||
          r.tDate.includes(s) ||
          (r.remarks ?? "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [allGenerators, statusFilter, selectedCPanel, search, viewMode, panels]);

  // Per C-Panel stats computed client-side
  const cpanelStats = useMemo(() => {
    if (!allGenerators) return null;
    return panels.map((panel) => {
      const records = allGenerators.filter((r) => getGeneratorPanel(r.generatorId, panels) === panel.id);
      const byStatus: Record<string, number> = {};
      for (const r of records) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      }
      return { ...panel, total: records.length, byStatus };
    });
  }, [allGenerators, panels]);

  const cpanelTotal = useMemo(
    () => allGenerators?.filter((r) => getGeneratorPanel(r.generatorId, panels) !== "Other").length ?? 0,
    [allGenerators, panels]
  );

  // Pre-compute selected panel data to avoid IIFE in JSX (which confuses React Fast Refresh)
  const selectedPanelData = useMemo(
    () => (selectedCPanel && cpanelStats ? cpanelStats.find((p) => p.id === selectedCPanel) ?? null : null),
    [selectedCPanel, cpanelStats]
  );

  const createMutation = useCreateGenerator();
  const updateMutation = useUpdateGenerator();
  const deleteMutation = useDeleteGenerator();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { tDate: TODAY, generatorId: "", status: "Ready", rating: "", hours: 0, remarks: "" },
  });

  useEffect(() => {
    if (isUserError || (!user && !isLoadingUser)) setLocation("/login");
  }, [user, isLoadingUser, isUserError, setLocation]);

  const openAdd = () => {
    setEditingRecord(null);
    form.reset({ tDate: TODAY, generatorId: "", status: "Ready", rating: "", hours: 0, remarks: "" });
    setIsFormOpen(true);
  };

  const openEdit = (record: GeneratorRecord) => {
    setEditingRecord(record);
    form.reset({
      tDate: record.tDate,
      generatorId: record.generatorId,
      status: record.status,
      rating: record.rating ?? "",
      hours: record.hours ?? 0,
      remarks: record.remarks ?? "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
      },
    });
  };

  const openDeliveryModal = (record: GeneratorRecord) => {
    setDeliveryModalRecord(record);
    setReceiverName("");
  };

  const submitDelivery = () => {
    if (!deliveryModalRecord || !receiverName.trim()) return;
    updateMutation.mutate(
      {
        id: deliveryModalRecord.id,
        data: {
          deliveryStatus: "current",
          deliveryTo: receiverName.trim(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
          setDeliveryModalRecord(null);
        },
      }
    );
  };

  const openReturnModal = (record: GeneratorRecord) => {
    setReturnModalRecord(record);
    setReturnStatus("Other");
  };

  const submitReturn = () => {
    if (!returnModalRecord) return;
    updateMutation.mutate(
      {
        id: returnModalRecord.id,
        data: {
          status: returnStatus,
          deliveryStatus: "previous",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
          setReturnModalRecord(null);
        },
      }
    );
  };

  const handleAddSubModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = newModelNo.trim().toUpperCase();
    const prefix = newModelPrefix.trim().toUpperCase();

    if (!id || !prefix) return;

    // Check if model number already exists
    if (panels.some((p) => p.id === id)) {
      alert("A model with this number already exists.");
      return;
    }

    const newPanel: CPanelConfig = {
      id,
      label: `${id} - ${prefix}`,
      prefixes: [prefix],
      isCustom: true,
    };

    const updated = [...panels, newPanel];
    setPanels(updated);
    localStorage.setItem("custom_cpanels", JSON.stringify(updated));

    setIsAddSubModelOpen(false);
    setNewModelNo("");
    setNewModelPrefix("");
  };

  const handleDeleteSubModel = (panelId: string) => {
    if (!window.confirm(`Are you sure you want to delete the model "${panelId}"?`)) return;
    const updated = panels.filter((p) => p.id !== panelId);
    setPanels(updated);
    localStorage.setItem("custom_cpanels", JSON.stringify(updated));
    if (selectedCPanel === panelId) {
      setSelectedCPanel(null);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/login"); },
    });
  };

  const onSubmit = (values: FormValues) => {
    const payload = {
      ...values,
      rating: values.rating || undefined,
      hours: values.hours ?? undefined,
      remarks: values.remarks || undefined,
    };
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
      setIsFormOpen(false);
      setEditingRecord(null);
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: payload }, { onSuccess: invalidate });
    } else {
      createMutation.mutate({ data: payload }, { onSuccess: invalidate });
    }
  };

  if (isLoadingUser || !user) return null;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f5" }}>

      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#ff6c00" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight" style={{ color: "#1f1f2e" }}>GenOps</span>
            <span className="hidden md:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#fff7ed", color: "#ff6c00" }}>
              Dashboard
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: "#6b7280" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs" style={{ background: "#ff6c00" }}>
                {user.username[0].toUpperCase()}
              </div>
              <span className="font-medium" style={{ color: "#374151" }}>{user.username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              style={{ color: "#6b7280" }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#111827" }}>Generator Records</h1>
          <p className="text-sm mt-1" style={{ color: "#6b7280" }}>All entries are synced to your Google Sheet automatically.</p>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Database className="w-5 h-5" />}
              label="Total Records"
              value={stats.total}
              onClick={() => setViewMode("main")}
              isActive={viewMode === "main"}
            />
            <StatCard
              icon={<Zap className="w-5 h-5" />}
              label=" All Model"
              value={cpanelTotal}
              accent="#7c3aed"
              onClick={() => {
                setShowCPanel((v) => !v);
                setSelectedCPanel(null);
              }}
              isActive={showCPanel}
            />
            <StatCard
              icon={<Truck className="w-5 h-5" />}
              label="Current Delivery"
              value={stats.currentDelivery}
              accent="#0891b2"
              onClick={() => setViewMode("delivery")}
              isActive={viewMode === "delivery"}
            />
            <StatCard
              icon={<Truck className="w-5 h-5" />}
              label="Previous Delivery"
              value={stats.previousDelivery}
              accent="#1e3a5f"
              onClick={() => setViewMode("previous")}
              isActive={viewMode === "previous"}
            />
          </div>
        )}

        {/* C Panel expandable section */}
        <AnimatePresence>
          {showCPanel && (
            <motion.div
              key="cpanel"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden"
              style={{ borderColor: "#7c3aed33" }}
            >
              <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#f3f0ff", background: "#faf5ff" }}>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "#7c3aed" }}>Sub-Model</h3>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>Click a model to view its stats and filter the table below</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setNewModelNo("");
                    setNewModelPrefix("");
                    setIsAddSubModelOpen(true);
                  }}
                  className="h-8 px-3 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Model
                </Button>
              </div>

              <div className="p-5">
                {/* Sub-panel buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {cpanelStats && cpanelStats.map((panel) => (
                    <div
                      key={panel.id}
                      className="relative group"
                    >
                      <button
                        onClick={() => setSelectedCPanel(selectedCPanel === panel.id ? null : panel.id)}
                        className="w-full rounded-xl p-4 text-left border transition-all hover:shadow-sm"
                        style={{
                          borderColor: selectedCPanel === panel.id ? "#7c3aed" : "#e5e7eb",
                          background: selectedCPanel === panel.id ? "#f5f3ff" : "#f9fafb",
                          boxShadow: selectedCPanel === panel.id ? "0 0 0 2px #7c3aed33" : undefined,
                        }}
                      >
                        <p className="text-sm font-bold" style={{ color: selectedCPanel === panel.id ? "#7c3aed" : "#374151" }}>
                          {panel.id}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "#9ca3af" }}>
                          {panel.label.split(" - ")[1]}
                        </p>
                        <p className="text-2xl font-bold mt-2" style={{ color: selectedCPanel === panel.id ? "#7c3aed" : "#111827" }}>
                          {panel.total}
                        </p>
                      </button>
                      {panel.isCustom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubModel(panel.id);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Model"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Selected panel stats */}
                <AnimatePresence>
                  {selectedPanelData && (
                    <motion.div
                      key={selectedPanelData.id}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: "#f3f0ff" }}>
                        <h4 className="text-sm font-semibold mb-3" style={{ color: "#374151" }}>
                          {selectedPanelData.label} — Status Breakdown
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="rounded-xl p-4 text-center border border-gray-200" style={{ background: "#f9fafb" }}>
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>Total</p>
                            <p className="text-2xl font-bold mt-1" style={{ color: "#111827" }}>{selectedPanelData.total}</p>
                          </div>
                          {STATUSES.map((status) => {
                            const cfg = STATUS_CONFIG[status];
                            return (
                              <div
                                key={status}
                                className="rounded-xl p-4 text-center border"
                                style={{ background: cfg.bg, borderColor: `${cfg.dot}44` }}
                              >
                                <p className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: cfg.text }}>{status}</p>
                                <p className="text-2xl font-bold mt-1" style={{ color: cfg.text }}>{selectedPanelData.byStatus[status] ?? 0}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status breakdown pills */}
        {stats && stats.byStatus.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCPanel && (
              <button
                onClick={() => { setSelectedCPanel(null); setShowCPanel(false); }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                style={{ background: "#f5f3ff", color: "#7c3aed", borderColor: "#7c3aed" }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#7c3aed" }} />
                {panels.find(p => p.id === selectedCPanel)?.label} <X className="w-3 h-3 ml-1" />
              </button>
            )}
            {stats.byStatus.map(s => (
              <button
                key={s.status}
                onClick={() => setStatusFilter(statusFilter === s.status ? "all" : s.status)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                style={{
                  background: statusFilter === s.status ? (STATUS_CONFIG[s.status]?.bg ?? "#f8fafc") : "#fff",
                  color: STATUS_CONFIG[s.status]?.text ?? "#64748b",
                  borderColor: statusFilter === s.status ? (STATUS_CONFIG[s.status]?.dot ?? "#94a3b8") : "#e5e7eb",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_CONFIG[s.status]?.dot ?? "#94a3b8" }} />
                {s.status}: {s.count}
              </button>
            ))}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9ca3af" }} />
                <Input
                  placeholder="Search by ID, date or remarks..."
                  className="pl-9 h-9 text-sm bg-gray-50 border-gray-200"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40 h-9 text-sm bg-gray-50 border-gray-200" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Used Ready">Used Ready</SelectItem>
                  <SelectItem value="Under Repair">Under Repair</SelectItem>
                  <SelectItem value="Under Readiness">Under Readiness</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 h-9">
                <button
                  type="button"
                  onClick={() => setViewMode("main")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === "main" ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-900"}`}
                  data-testid="button-view-main"
                >
                  Main View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("delivery")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === "delivery" ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-900"}`}
                  data-testid="button-view-delivery"
                >
                  Current Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("previous")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${viewMode === "previous" ? "bg-white text-gray-900 shadow-sm border border-gray-100" : "text-gray-500 hover:text-gray-900"}`}
                  data-testid="button-view-previous"
                >
                  Previous Delivery
                </button>
              </div>
            </div>
            <Button
              onClick={openAdd}
              className="h-9 px-4 text-sm font-semibold text-white rounded-lg flex items-center gap-2 whitespace-nowrap"
              style={{ background: "#ff6c00" }}
              data-testid="button-add-record"
            >
              <Plus className="w-4 h-4" />
              Add Record
            </Button>
          </div>

          {selectedCPanel && (
            <div className="px-5 py-2.5 border-b text-xs font-medium flex items-center gap-2" style={{ background: "#faf5ff", borderColor: "#ede9fe", color: "#7c3aed" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Filtering by {panels.find(p => p.id === selectedCPanel)?.label}
              <button onClick={() => setSelectedCPanel(null)} className="ml-1 underline hover:no-underline">Clear</button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {(viewMode === "delivery"
                    ? ["Date", "GENSET ID", "Model", "Status", "Rating", "Hours", "Remarks", "Delivered To", "R", ""]
                    : viewMode === "previous"
                      ? ["Date", "GENSET ID", "Model", "Status", "Rating", "Hours", "Remarks", "Prev Delivered To", ""]
                      : ["Date", "GENSET ID", "Model", "Status", "Rating", "Hours", "Remarks", "D", ""]
                  ).map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingGenerators ? (
                  <tr>
                    <td colSpan={viewMode === "delivery" ? 10 : 9} className="px-5 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>
                      Loading records...
                    </td>
                  </tr>
                ) : generators.length > 0 ? (
                  generators.map((record, idx) => {
                    const panel = getGeneratorPanel(record.generatorId, panels);
                    return (
                      <tr
                        key={record.id}
                        style={{ borderBottom: idx < generators.length - 1 ? "1px solid #f3f4f6" : "none" }}
                        className="hover:bg-orange-50/40 transition-colors"
                        data-testid={`row-generator-${record.id}`}
                      >
                        <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>{formatDate(record.tDate)}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold" style={{ color: "#111827" }}>{record.generatorId}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {panel !== "Other" ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold"
                              style={{ background: "#f5f3ff", color: "#7c3aed" }}
                            >
                              {panel}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="px-5 py-3.5" style={{ color: "#6b7280" }}>{record.rating || "-"}</td>
                        <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>{record.hours != null ? `${record.hours}h` : "-"}</td>
                        <td className="px-5 py-3.5 max-w-xs truncate" style={{ color: "#6b7280" }}>{record.remarks || "-"}</td>
                        {(viewMode === "delivery" || viewMode === "previous") && (
                          <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>
                            {record.deliveryTo || "-"}
                          </td>
                        )}
                        {/* D / R — Delivery button */}
                        {viewMode !== "previous" && (
                          <td className="px-5 py-3.5">
                            {viewMode === "delivery" ? (
                              <button
                                onClick={() => openReturnModal(record)}
                                title="Return Generator"
                                className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fee2e2",
                                }}
                                data-testid={`button-return-${record.id}`}
                              >
                                <Truck
                                  className="w-3.5 h-3.5"
                                  style={{ color: "#dc2626" }}
                                />
                              </button>
                            ) : (
                              (() => {
                                const isDeliverable = record.status === "Ready" || record.status === "Used Ready";
                                const cfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG["Other"];
                                return (
                                  <button
                                    onClick={() => openDeliveryModal(record)}
                                    disabled={!isDeliverable}
                                    title={isDeliverable ? "Deliver Generator" : "Only 'Ready' or 'Used Ready' generators can be delivered"}
                                    className="p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{
                                      background: isDeliverable ? cfg.bg : "#f3f4f6",
                                      border: `1px solid ${isDeliverable ? cfg.dot : "#e5e7eb"}`,
                                    }}
                                    data-testid={`button-deliver-${record.id}`}
                                  >
                                    <Truck
                                      className="w-3.5 h-3.5"
                                      style={{ color: isDeliverable ? cfg.text : "#9ca3af" }}
                                    />
                                  </button>
                                );
                              })()
                            )}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(record)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Edit"
                              data-testid={`button-edit-${record.id}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" style={{ color: "#3b82f6" }} />
                            </button>
                            <button
                              onClick={() => handleDelete(record.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="Delete"
                              data-testid={`button-delete-${record.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={viewMode === "delivery" ? 10 : 9} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#fff7ed" }}>
                          <Database className="w-6 h-6" style={{ color: "#ff6c00" }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: "#374151" }}>No records found</p>
                        <p className="text-xs" style={{ color: "#9ca3af" }}>
                          {selectedCPanel ? `No records in ${panels.find(p => p.id === selectedCPanel)?.label}` : 'Click "Add Record" to create your first entry'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {generators.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs" style={{ color: "#9ca3af" }}>
              Showing {generators.length} record{generators.length !== 1 ? "s" : ""}
              {selectedCPanel && ` in ${panels.find(p => p.id === selectedCPanel)?.label}`}
            </div>
          )}
        </div>
      </main>

      {/* Slide-over form panel */}
      <AnimatePresence>
        {isFormOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              style={{ background: "rgba(0,0,0,0.35)" }}
              onClick={() => setIsFormOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[460px] z-40 flex flex-col shadow-2xl"
              style={{ background: "#fff" }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: "#111827" }}>
                    {editingRecord ? "Edit Record" : "New Generator Record"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>
                    {editingRecord ? "Update the record details below" : "Fill in the details and save to sync with Google Sheets"}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  data-testid="button-close-form"
                >
                  <X className="w-5 h-5" style={{ color: "#6b7280" }} />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <Form {...form}>
                  <form id="generator-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="tDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Date</FormLabel>
                            <FormControl>
                              <Input type="date" className="h-10 bg-gray-50 border-gray-200" data-testid="input-date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="generatorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>GENSET ID</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. ECW-001, LX9-02" className="h-10 bg-gray-50 border-gray-200" data-testid="input-generator-id" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-10 bg-gray-50 border-gray-200" data-testid="select-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Ready">Ready</SelectItem>
                                <SelectItem value="Used Ready">Used Ready</SelectItem>
                                <SelectItem value="Under Repair">Under Repair</SelectItem>
                                <SelectItem value="Under Readiness">Under Readiness</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Hours</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="0"
                                className="h-10 bg-gray-50 border-gray-200"
                                data-testid="input-hours"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="rating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Rating</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. 500kVA, Good, Excellent"
                              className="h-10 bg-gray-50 border-gray-200"
                              data-testid="input-rating"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="remarks"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Remarks</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional notes..."
                              className="bg-gray-50 border-gray-200 resize-none"
                              rows={3}
                              data-testid="input-remarks"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </div>

              {/* Panel footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setIsFormOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="generator-form"
                  disabled={isPending}
                  className="flex-1 h-10 font-semibold text-white"
                  style={{ background: "#ff6c00" }}
                >
                  {isPending ? "Saving..." : editingRecord ? "Update Record" : "Save Record"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delivery Modal */}
      <AnimatePresence>
        {deliveryModalRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDeliveryModalRecord(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 z-10"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">Mark for Delivery</h3>
                <button
                  onClick={() => setDeliveryModalRecord(null)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Receiver Name</label>
                  <Input
                    placeholder="Enter receiver's name"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#ff6c00]"
                    data-testid="input-receiver-name"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeliveryModalRecord(null)}
                  className="flex-1 h-10 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitDelivery}
                  disabled={!receiverName.trim() || updateMutation.isPending}
                  className="flex-1 h-10 text-sm font-semibold text-white"
                  style={{ background: "#ff6c00" }}
                >
                  {updateMutation.isPending ? "Submitting..." : "Confirm Delivery"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Return Modal */}
      <AnimatePresence>
        {returnModalRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setReturnModalRecord(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 z-10"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-900">Return Generator</h3>
                <button
                  onClick={() => setReturnModalRecord(null)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">New Status</label>
                  <Select value={returnStatus} onValueChange={setReturnStatus}>
                    <SelectTrigger className="h-10 bg-gray-50 border-gray-200">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ready">Ready</SelectItem>
                      <SelectItem value="Used Ready">Used Ready</SelectItem>
                      <SelectItem value="Under Repair">Under Repair</SelectItem>
                      <SelectItem value="Under Readiness">Under Readiness</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setReturnModalRecord(null)}
                  className="flex-1 h-10 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitReturn}
                  disabled={updateMutation.isPending}
                  className="flex-1 h-10 text-sm font-semibold text-white"
                  style={{ background: "#ff6c00" }}
                >
                  {updateMutation.isPending ? "Submitting..." : "Confirm Return"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Sub-Model Modal */}
      <AnimatePresence>
        {isAddSubModelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsAddSubModelOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 z-10"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">Add New Sub-Model</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Define a model mapped to matching generator IDs</p>
                </div>
                <button
                  onClick={() => setIsAddSubModelOpen(false)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddSubModelSubmit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Model Name / Number</label>
                    <Input
                      required
                      placeholder="e.g. C7, C8, C9"
                      value={newModelNo}
                      onChange={(e) => setNewModelNo(e.target.value)}
                      className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#7c3aed]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Genset ID Prefix (Starting Characters)</label>
                    <Input
                      required
                      placeholder="e.g. EC8, LX8"
                      value={newModelPrefix}
                      onChange={(e) => setNewModelPrefix(e.target.value)}
                      className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#7c3aed]"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                      Make sure that whatever the Genset ID is, its starting digits or letters (e.g. the first 4 characters like <strong>EC8-</strong> or <strong>LX8-</strong>) match this prefix.
                    </p>
                  </div>
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddSubModelOpen(false)}
                    className="flex-1 h-10 text-sm font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 text-sm font-semibold text-white"
                    style={{ background: "#7c3aed" }}
                  >
                    Add Model
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

