import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe, getGetMeQueryKey,
  useLogout,
  useListGenerators, getListGeneratorsQueryKey,
  useGetGeneratorStats, getGetGeneratorStatsQueryKey,
  useCreateGenerator, useUpdateGenerator, useDeleteGenerator,
  GeneratorRecord
} from "@workspace/api-client-react";
import {
  Zap, LogOut, Plus, Search, Edit2, Trash2,
  Activity, Clock, TrendingUp, Database, X
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
  Running:     { bg: "#f0fdf4", text: "#15803d", dot: "#22c55e" },
  Stopped:     { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444" },
  Maintenance: { bg: "#fffbeb", text: "#d97706", dot: "#f59e0b" },
  Fault:       { bg: "#fff1f2", text: "#be123c", dot: "#f43f5e" },
  Idle:        { bg: "#f8fafc", text: "#64748b", dot: "#94a3b8" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["Idle"];
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: accent ? `${accent}15` : "#ff6c0015" }}>
        <span style={{ color: accent ?? "#ff6c00" }}>{icon}</span>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#9ca3af" }}>{label}</p>
        <p className="text-2xl font-bold mt-0.5" style={{ color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

const TODAY = new Date().toISOString().split("T")[0];

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

  const { data: stats } = useGetGeneratorStats({ query: { queryKey: getGetGeneratorStatsQueryKey() } });
  const { data: generators, isLoading: isLoadingGenerators } = useListGenerators(
    { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined },
    { query: { queryKey: getListGeneratorsQueryKey({ search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined }) } }
  );

  const createMutation = useCreateGenerator();
  const updateMutation = useUpdateGenerator();
  const deleteMutation = useDeleteGenerator();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { tDate: TODAY, generatorId: "", status: "Running", rating: "", hours: 0, remarks: "" },
  });

  useEffect(() => {
    if (isUserError || (!user && !isLoadingUser)) setLocation("/login");
  }, [user, isLoadingUser, isUserError, setLocation]);

  const openAdd = () => {
    setEditingRecord(null);
    form.reset({ tDate: TODAY, generatorId: "", status: "Running", rating: "", hours: 0, remarks: "" });
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
            <StatCard icon={<Database className="w-5 h-5" />} label="Total Records" value={stats.total} />
            <StatCard icon={<Activity className="w-5 h-5" />} label="This Week" value={stats.recentCount} accent="#7c3aed" />
            <StatCard icon={<Clock className="w-5 h-5" />} label="Avg Hours" value={stats.avgHours != null ? `${Math.round(stats.avgHours)}h` : "-"} accent="#0891b2" />
            <StatCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Running Now"
              value={stats.byStatus.find(s => s.status === "Running")?.count ?? 0}
              accent="#15803d"
            />
          </div>
        )}

        {/* Status breakdown pills */}
        {stats && stats.byStatus.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
                <SelectTrigger className="w-36 h-9 text-sm bg-gray-50 border-gray-200" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Running">Running</SelectItem>
                  <SelectItem value="Stopped">Stopped</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Fault">Fault</SelectItem>
                  <SelectItem value="Idle">Idle</SelectItem>
                </SelectContent>
              </Select>
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Date", "Generator ID", "Status", "Rating", "Hours", "Remarks", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingGenerators ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm" style={{ color: "#9ca3af" }}>
                      Loading records...
                    </td>
                  </tr>
                ) : generators && generators.length > 0 ? (
                  generators.map((record, idx) => (
                    <tr
                      key={record.id}
                      style={{ borderBottom: idx < generators.length - 1 ? "1px solid #f3f4f6" : "none" }}
                      className="hover:bg-orange-50/40 transition-colors"
                      data-testid={`row-generator-${record.id}`}
                    >
                      <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>{record.tDate}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold" style={{ color: "#111827" }}>{record.generatorId}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-5 py-3.5" style={{ color: "#6b7280" }}>{record.rating || "-"}</td>
                      <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>{record.hours != null ? `${record.hours}h` : "-"}</td>
                      <td className="px-5 py-3.5 max-w-xs truncate" style={{ color: "#6b7280" }}>{record.remarks || "-"}</td>
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
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#fff7ed" }}>
                          <Database className="w-6 h-6" style={{ color: "#ff6c00" }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: "#374151" }}>No records found</p>
                        <p className="text-xs" style={{ color: "#9ca3af" }}>Click "Add Record" to create your first entry</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {generators && generators.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs" style={{ color: "#9ca3af" }}>
              Showing {generators.length} record{generators.length !== 1 ? "s" : ""}
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
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Generator ID</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. GEN-001" className="h-10 bg-gray-50 border-gray-200" data-testid="input-generator-id" {...field} />
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
                                <SelectItem value="Running">Running</SelectItem>
                                <SelectItem value="Stopped">Stopped</SelectItem>
                                <SelectItem value="Maintenance">Maintenance</SelectItem>
                                <SelectItem value="Fault">Fault</SelectItem>
                                <SelectItem value="Idle">Idle</SelectItem>
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
                              placeholder="Enter any notes or observations..."
                              className="bg-gray-50 border-gray-200 min-h-28 resize-none"
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
                  variant="outline"
                  className="flex-1 h-10 border-gray-200"
                  onClick={() => setIsFormOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="generator-form"
                  className="flex-1 h-10 font-semibold text-white"
                  style={{ background: "#ff6c00" }}
                  disabled={isPending}
                  data-testid="button-save"
                >
                  {isPending ? "Saving..." : editingRecord ? "Update Record" : "Save Record"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
