import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe, getGetMeQueryKey,
  useLogout,
  useListGenerators, getListGeneratorsQueryKey,
  useGetGeneratorStats, getGetGeneratorStatsQueryKey,
  useCreateGenerator, useUpdateGenerator, useDeleteGenerator,
  useUpdateMe,
} from "@workspace/api-client-react";
import type { GeneratorRecord } from "@workspace/api-client-react";
import {
  Zap, LogOut, Plus, Search, Edit2, Trash2,
  TrendingUp, Database, X, ChevronDown, Truck,
  ExternalLink, RefreshCw, Lock, Eye, EyeOff,
  Download, Printer, Home, Users, Bell,
  Calendar, Clock, Layers,
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown
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
import { ProfileModal } from "@/components/profile-modal";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const formSchema = z.object({
  tDate: z.string().min(1, "Date is required"),
  generatorId: z.string().min(1, "Generator ID is required"),
  status: z.string().min(1, "Status is required"),
  rating: z.string().optional().nullable(),
  hours: z.coerce.number().optional().nullable(),
  valveLashHrs: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  "Ready": { bg: "#ffffff", text: "#2E9E44", dot: "#2E9E44" },
  "Used Ready": { bg: "#ffffff", text: "#F0842A", dot: "#F0842A" },
  "Under Readiness": { bg: "#ffffff", text: "#2F6FE0", dot: "#2F6FE0" },
  "Under Repair": { bg: "#ffffff", text: "#E23B3B", dot: "#E23B3B" },
  "On-Site": { bg: "#ffffff", text: "#9333ea", dot: "#9333ea" },
  "Other": { bg: "#ffffff", text: "#6B7280", dot: "#6B7280" },
};

const STATUSES = ["Ready", "Used Ready", "Under Repair", "Under Readiness", "On-Site", "Other"];

interface CPanelConfig {
  id: string;
  label: string;
  prefixes: string[];
  isCustom?: boolean;
}

const DEFAULT_CPANELS: CPanelConfig[] = [];

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
      className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap"
      style={{ color: cfg.text }}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0 shadow-2xs" style={{ backgroundColor: cfg.dot }} />
      <span>{status}</span>
    </span>
  );
}

function getRgba(color: string, opacity: number): string {
  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${opacity})`);
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
}

function StatCard({
  icon,
  label,
  value,
  accent = "rgb(255, 108, 0)",
  onClick,
  isActive,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
  onClick?: () => void;
  isActive?: boolean;
}) {
  const accentColor = accent;
  const bgTint12 = getRgba(accentColor, 0.12);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-between gap-2.5 sm:gap-3 rounded-xl border p-2.5 sm:p-3 overflow-hidden transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]" : ""
      }`}
      style={{
        background: `linear-gradient(145deg, #ffffff 40%, ${getRgba(accentColor, 0.05)} 75%, ${getRgba(accentColor, 0.15)} 100%)`,
        borderColor: isActive ? accentColor : "#e5e7eb",
        boxShadow: isActive
          ? `0 0 0 1.5px ${accentColor}, 0 2px 10px ${getRgba(accentColor, 0.12)}`
          : "0 1px 2px rgba(0,0,0,0.03)",
      }}
    >
      {/* Left + Middle: Icon inside box + Text */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200"
          style={{ background: bgTint12 }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>

        {/* Middle: Label on top, Value below */}
        <div className="min-w-0 flex-1">
          <p
            className="text-[9.5px] sm:text-[10.5px] uppercase tracking-wider font-semibold truncate"
            style={{
              color: "#8A8A8A",
              fontFamily: "Google_Sans, 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif",
            }}
          >
            {label}
          </p>
          <p
            className="text-lg sm:text-xl font-bold mt-0.5 leading-none tracking-tight truncate"
            style={{
              color: "#111827",
              fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif",
            }}
          >
            {value}
          </p>
        </div>
      </div>

      {/* Right: Small Chevron */}
      <ChevronDown
        className="w-3.5 h-3.5 transition-transform duration-200 flex-shrink-0 mr-0.5"
        style={{
          transform: isActive ? "rotate(180deg)" : "rotate(0deg)",
          color: isActive ? accentColor : "#9ca3af",
        }}
      />
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

interface FormattedRemarks {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
}

function parseRemarks(remarksStr: string | null | undefined): FormattedRemarks {
  if (!remarksStr) return { text: "", bold: false, italic: false, underline: false, color: "" };
  try {
    if (remarksStr.startsWith("{") && remarksStr.endsWith("}")) {
      const parsed = JSON.parse(remarksStr);
      if (typeof parsed === "object" && parsed !== null && "text" in parsed) {
        return {
          text: parsed.text || "",
          bold: !!parsed.bold,
          italic: !!parsed.italic,
          underline: !!parsed.underline,
          color: parsed.color || "",
        };
      }
    }
  } catch (e) { }
  return { text: remarksStr, bold: false, italic: false, underline: false, color: "" };
}

function stringifyRemarks(text: string, bold: boolean, italic: boolean, underline: boolean, color: string): string {
  if (!bold && !italic && !underline && !color) {
    return text;
  }
  return JSON.stringify({ text, bold, italic, underline, color });
}

function getColorCode(color: string, isDarkBg = false): string | undefined {
  switch (color) {
    case "red": return isDarkBg ? "#f87171" : "#dc2626";
    case "yellow": return isDarkBg ? "#fbbf24" : "#b45309";
    case "green": return isDarkBg ? "#4ade80" : "#16a34a";
    case "blue": return isDarkBg ? "#60a5fa" : "#2563eb";
    case "pink": return isDarkBg ? "#f472b6" : "#db2777";
    default: return undefined;
  }
}

function RemarksCell({ record, panel }: { record: GeneratorRecord; panel: string }) {
  const [open, setOpen] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  if (!record.remarks) return <span>-</span>;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextClicked = !isClicked;
    setIsClicked(nextClicked);
    setOpen(nextClicked);
  };

  const parsed = parseRemarks(record.remarks);

  return (
    <Tooltip open={open} onOpenChange={(val) => {
      if (!val) {
        setOpen(false);
        setIsClicked(false);
      }
    }}>
      <TooltipTrigger asChild>
        <span
          onClick={handleToggle}
          className="cursor-pointer hover:text-orange-500 transition-colors block truncate underline decoration-dotted decoration-gray-300 underline-offset-2"
          style={{
            fontWeight: parsed.bold ? "bold" : "normal",
            fontStyle: parsed.italic ? "italic" : "normal",
            textDecoration: parsed.underline ? "underline" : "none",
            color: parsed.color ? getColorCode(parsed.color) : undefined,
          }}
        >
          {parsed.text}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        onPointerDownOutside={(e) => {
          setOpen(false);
          setIsClicked(false);
        }}
        className="bg-slate-900 border border-slate-800 text-slate-100 px-4 py-3 rounded-xl shadow-xl max-w-xs text-xs font-normal"
      >
        <p
          className="whitespace-pre-wrap break-words leading-relaxed max-h-36 overflow-y-auto pr-1 text-[12px]"
          style={{
            fontWeight: parsed.bold ? "bold" : "normal",
            fontStyle: parsed.italic ? "italic" : "normal",
            textDecoration: parsed.underline ? "underline" : "none",
            color: parsed.color ? getColorCode(parsed.color, true) : "#e2e8f0",
          }}
        >
          {parsed.text}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();
  const updateMeMutation = useUpdateMe();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GeneratorRecord | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isReadOnly = !!(user as any)?.isDemoUser && (user as any)?.permissions === "view";
  const [showCPanel, setShowCPanel] = useState(false);
  const [selectedCPanel, setSelectedCPanel] = useState<string | null>(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  // Download & Print state variables
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<number>>(new Set());
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadFilterScope, setDownloadFilterScope] = useState<"filtered" | "selected" | "custom">("filtered");
  const [downloadFilterDateType, setDownloadFilterDateType] = useState<"all" | "today" | "range">("all");
  const [downloadStartDate, setDownloadStartDate] = useState("");
  const [downloadEndDate, setDownloadEndDate] = useState("");
  const [downloadFilterModel, setDownloadFilterModel] = useState("all");
  const [downloadFilterStatus, setDownloadFilterStatus] = useState("all");

  // Dynamic panels/models state
  const [panels, setPanels] = useState<CPanelConfig[]>(DEFAULT_CPANELS);

  useEffect(() => {
    if (user) {
      if (user.customPanels) {
        try {
          const parsed = JSON.parse(user.customPanels);
          if (Array.isArray(parsed)) {
            setPanels(parsed);
            return;
          }
        } catch (e) {
          // fallback
        }
      } else {
        const saved = localStorage.getItem(`custom_cpanels_${user.id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setPanels(parsed);
              if (!isReadOnly) {
                updateMeMutation.mutate({ data: { customPanels: saved } });
              }
              return;
            }
          } catch (e) { }
        }
      }
    }
    setPanels(DEFAULT_CPANELS);
  }, [user]);

  // Modal helper states for adding custom models
  const [isAddSubModelOpen, setIsAddSubModelOpen] = useState(false);
  const [newModelNo, setNewModelNo] = useState("");
  const [newModelPrefix, setNewModelPrefix] = useState("");

  // Edit sub-model states
  const [isEditSubModelOpen, setIsEditSubModelOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<CPanelConfig | null>(null);
  const [editModelNo, setEditModelNo] = useState("");
  const [editModelPrefix, setEditModelPrefix] = useState("");

  // Delivery states
  const [viewMode, setViewMode] = useState<"main" | "delivery" | "previous">("main");
  const [deliveryModalRecord, setDeliveryModalRecord] = useState<GeneratorRecord | null>(null);
  const [receiverName, setReceiverName] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(TODAY);
  const [returnModalRecord, setReturnModalRecord] = useState<GeneratorRecord | null>(null);
  const [returnStatus, setReturnStatus] = useState("");
  const [returnDate, setReturnDate] = useState(TODAY);

  // Sheet access states
  const [showSheetPasswordModal, setShowSheetPasswordModal] = useState(false);
  const [sheetPassword, setSheetPassword] = useState("");
  const [sheetPasswordError, setSheetPasswordError] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [showSheetPasswordText, setShowSheetPasswordText] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Table sorting & pagination states (MUI DataGrid style)
  const [sortField, setSortField] = useState<"tDate" | "generatorId" | "panel" | "status" | "rating" | "hours" | "valveLashHrs">("tDate");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const handleSort = (field: "tDate" | "generatorId" | "panel" | "status" | "rating" | "hours" | "valveLashHrs") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "generatorId" || field === "status");
    }
  };

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => { },
  });

  const { data: stats } = useGetGeneratorStats({ query: { queryKey: getGetGeneratorStatsQueryKey() } });

  // Fetch ALL records — filtering is done client-side so C Panel stats are always accurate
  const { data: allGenerators, isLoading: isLoadingGenerators } = useListGenerators(
    undefined,
    { query: { queryKey: getListGeneratorsQueryKey() } }
  );

  // Client-side filtered list for the table with dynamic sorting
  const generators = useMemo(() => {
    if (!allGenerators) return [];
    return allGenerators
      .filter((r) => {
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
          const parsedRemarks = parseRemarks(r.remarks).text;
          return (
            r.generatorId.toLowerCase().includes(s) ||
            r.tDate.includes(s) ||
            (r.valveLashHrs && r.valveLashHrs.toLowerCase().includes(s)) ||
            parsedRemarks.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortField === "tDate") {
          comp = a.tDate.localeCompare(b.tDate);
        } else if (sortField === "generatorId") {
          comp = a.generatorId.localeCompare(b.generatorId, undefined, { numeric: true });
        } else if (sortField === "panel") {
          const pa = getGeneratorPanel(a.generatorId, panels);
          const pb = getGeneratorPanel(b.generatorId, panels);
          comp = pa.localeCompare(pb);
        } else if (sortField === "status") {
          comp = a.status.localeCompare(b.status);
        } else if (sortField === "rating") {
          comp = (a.rating || "").localeCompare(b.rating || "");
        } else if (sortField === "hours") {
          comp = (a.hours ?? 0) - (b.hours ?? 0);
        } else if (sortField === "valveLashHrs") {
          comp = (a.valveLashHrs || "").localeCompare(b.valveLashHrs || "", undefined, { numeric: true });
        }
        return sortAsc ? comp : -comp;
      });
  }, [allGenerators, statusFilter, selectedCPanel, search, viewMode, panels, sortField, sortAsc]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, viewMode, selectedCPanel, pageSize]);

  const totalRecords = generators.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedGenerators = useMemo(() => {
    const start = (page - 1) * pageSize;
    return generators.slice(start, start + pageSize);
  }, [generators, page, pageSize]);

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
    defaultValues: { tDate: TODAY, generatorId: "", status: "Ready", rating: "", hours: 0, valveLashHrs: "", remarks: "" },
  });

  useEffect(() => {
    if (isUserError || (!user && !isLoadingUser)) setLocation("/login");
  }, [user, isLoadingUser, isUserError, setLocation]);

  const openAdd = () => {
    setEditingRecord(null);
    form.reset({ tDate: TODAY, generatorId: "", status: "Ready", rating: "", hours: 0, valveLashHrs: "", remarks: "" });
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
      valveLashHrs: record.valveLashHrs ?? "",
      remarks: record.remarks ?? "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: "Delete Generator Record",
      description: "You are deleting this data. This action is permanent and cannot be undone. Are you sure you want to proceed?",
      onConfirm: () => {
        deleteMutation.mutate({ id }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
            setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }));
          },
        });
      },
    });
  };

  const openDeliveryModal = (record: GeneratorRecord) => {
    setDeliveryModalRecord(record);
    setReceiverName("");
    setDeliveryDate(TODAY);
  };

  const submitDelivery = () => {
    if (!deliveryModalRecord || !receiverName.trim()) return;
    const statusUpdate = (deliveryModalRecord.status === "Ready" || deliveryModalRecord.status === "Used Ready")
      ? { status: "On-Site" }
      : {};
    updateMutation.mutate(
      {
        id: deliveryModalRecord.id,
        data: {
          deliveryStatus: "current",
          deliveryTo: receiverName.trim(),
          tDate: deliveryDate,
          ...statusUpdate,
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
    setReturnStatus("");
    setReturnDate(TODAY);
  };

  const submitReturn = () => {
    if (!returnModalRecord) return;
    updateMutation.mutate(
      {
        id: returnModalRecord.id,
        data: {
          status: returnStatus,
          deliveryStatus: "previous",
          tDate: returnDate,
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
    const prefixInput = newModelPrefix.trim().toUpperCase();

    if (!id || !prefixInput) return;

    // Check if model number already exists
    if (panels.some((p) => p.id === id)) {
      alert("A model with this number already exists.");
      return;
    }

    const prefixes = prefixInput.split(/[\s,;]+/).filter(Boolean);
    if (prefixes.length === 0) return;

    const newPanel: CPanelConfig = {
      id,
      label: `${id} - ${prefixes.join(", ")}`,
      prefixes: prefixes,
      isCustom: true,
    };

    const updated = [...panels, newPanel];
    setPanels(updated);
    if (user) {
      localStorage.setItem(`custom_cpanels_${user.id}`, JSON.stringify(updated));
    }

    if (!isReadOnly) {
      updateMeMutation.mutate(
        { data: { customPanels: JSON.stringify(updated) } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          },
          onError: (err: any) => {
            toast({
              title: "Error saving model",
              description: err?.data?.error || err?.message || "Failed to save custom model in database",
              variant: "destructive",
            });
          },
        }
      );
    }

    setIsAddSubModelOpen(false);
    setNewModelNo("");
    setNewModelPrefix("");
  };

  const handleOpenEditSubModel = (panel: CPanelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPanel(panel);
    setEditModelNo(panel.id);
    setEditModelPrefix(panel.prefixes.join(" "));
    setIsEditSubModelOpen(true);
  };

  const handleEditSubModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPanel) return;
    const newId = editModelNo.trim().toUpperCase();
    const newPrefixInput = editModelPrefix.trim().toUpperCase();
    if (!newId || !newPrefixInput) return;

    // If ID changed, check for duplicates
    if (newId !== editingPanel.id && panels.some((p) => p.id === newId)) {
      alert("A model with this number already exists.");
      return;
    }

    const prefixes = newPrefixInput.split(/[\s,;]+/).filter(Boolean);
    if (prefixes.length === 0) return;

    const updated = panels.map((p) =>
      p.id === editingPanel.id
        ? { ...p, id: newId, label: `${newId} - ${prefixes.join(", ")}`, prefixes }
        : p
    );
    setPanels(updated);
    if (user) {
      localStorage.setItem(`custom_cpanels_${user.id}`, JSON.stringify(updated));
    }
    if (selectedCPanel === editingPanel.id) setSelectedCPanel(newId);

    if (!isReadOnly) {
      updateMeMutation.mutate(
        { data: { customPanels: JSON.stringify(updated) } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          },
          onError: (err: any) => {
            toast({
              title: "Error updating model",
              description: err?.data?.error || err?.message || "Failed to save changes in database",
              variant: "destructive",
            });
          },
        }
      );
    }

    setIsEditSubModelOpen(false);
    setEditingPanel(null);
    setEditModelNo("");
    setEditModelPrefix("");
  };

  const handleDeleteSubModel = (panelId: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: "Delete Model",
      description: "You are deleting this data. This action is permanent and cannot be undone. Are you sure you want to proceed?",
      onConfirm: () => {
        const updated = panels.filter((p) => p.id !== panelId);
        setPanels(updated);
        if (user) {
          localStorage.setItem(`custom_cpanels_${user.id}`, JSON.stringify(updated));
        }
        if (selectedCPanel === panelId) {
          setSelectedCPanel(null);
        }

        // Close modal immediately — don't wait for the API call
        setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }));

        if (!isReadOnly) {
          updateMeMutation.mutate(
            { data: { customPanels: JSON.stringify(updated) } },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
              },
              onError: (err: any) => {
                toast({
                  title: "Error deleting model",
                  description: err?.data?.error || err?.message || "Failed to save changes in database",
                  variant: "destructive",
                });
              },
            }
          );
        }
      },
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/login"); },
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
    ]);
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const openSheetPasswordModal = () => {
    setSheetPassword("");
    setSheetPasswordError("");
    setShowSheetPasswordText(false);
    setShowSheetPasswordModal(true);
  };

  const closeSheetPasswordModal = () => {
    setShowSheetPasswordModal(false);
    setSheetPassword("");
    setSheetPasswordError("");
  };

  const verifyPasswordAndOpenSheet = async () => {
    if (!sheetPassword.trim()) {
      setSheetPasswordError("Please enter your password.");
      return;
    }
    setIsVerifyingPassword(true);
    setSheetPasswordError("");
    try {
      const res = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: sheetPassword }),
      });
      if (res.ok) {
        const sheetLink = (user as any)?.sheetLink;
        if (sheetLink) {
          window.open(sheetLink, "_blank", "noopener,noreferrer");
        }
        closeSheetPasswordModal();
      } else {
        const data = await res.json().catch(() => ({}));
        setSheetPasswordError(data.error || "Incorrect password. Please try again.");
      }
    } catch {
      setSheetPasswordError("Connection error. Please try again.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const onSubmit = (values: FormValues) => {
    // Client-side check for duplicate Genset ID
    const isDuplicate = allGenerators?.some((r) => {
      if (editingRecord && r.id === editingRecord.id) return false;
      return r.generatorId.toLowerCase().trim() === values.generatorId.toLowerCase().trim();
    });

    if (isDuplicate) {
      toast({
        title: "Duplicate Genset ID",
        description: "This genset ID is already exists",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      ...values,
      rating: values.rating?.trim() || undefined,
      hours: values.hours !== undefined && values.hours !== null && !isNaN(Number(values.hours)) ? Number(values.hours) : undefined,
      valveLashHrs: values.valveLashHrs?.trim() || undefined,
      remarks: values.remarks?.trim() || undefined,
    };
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
      setIsFormOpen(false);
      setEditingRecord(null);
    };
    if (editingRecord) {
      updateMutation.mutate(
        { id: editingRecord.id, data: payload },
        {
          onSuccess: invalidate,
          onError: (err: any) => {
            const errMsg = err?.data?.error || err?.message || "Failed to update record";
            toast({
              title: "Error",
              description: errMsg,
              variant: "destructive",
            });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: payload },
        {
          onSuccess: invalidate,
          onError: (err: any) => {
            const errMsg = err?.data?.error || err?.message || "Failed to create record";
            toast({
              title: "Error",
              description: errMsg,
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  // Filter logic for export/print
  const getExportData = () => {
    // 1. If scope is 'selected', return selected records
    if (downloadFilterScope === "selected") {
      if (!allGenerators) return [];
      return allGenerators.filter(r => selectedRecordIds.has(r.id));
    }

    // 2. If scope is 'filtered', return generators currently visible in the table
    if (downloadFilterScope === "filtered") {
      return generators;
    }

    // 3. If scope is 'custom', apply custom filters configured in the modal
    if (!allGenerators) return [];
    return allGenerators.filter((r) => {
      // Date filter
      if (downloadFilterDateType === "today") {
        const todayStr = new Date().toISOString().split("T")[0];
        if (r.tDate !== todayStr) return false;
      } else if (downloadFilterDateType === "range") {
        if (downloadStartDate && r.tDate < downloadStartDate) return false;
        if (downloadEndDate && r.tDate > downloadEndDate) return false;
      }

      // Model/Panel filter
      if (downloadFilterModel !== "all") {
        const panel = getGeneratorPanel(r.generatorId, panels);
        if (panel !== downloadFilterModel) return false;
      }

      // Status filter
      if (downloadFilterStatus !== "all") {
        if (r.status !== downloadFilterStatus) return false;
      }

      return true;
    });
  };

  const handleDownloadPDF = () => {
    const records = getExportData();
    if (records.length === 0) {
      toast({
        title: "No data found",
        description: "There are no records matching the selected filters.",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Add GenOps title and styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(31, 31, 46); // #1f1f2e
    doc.text("GenOps", 10, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // #6b7280
    doc.text("Generator Management & Operations System Report", 10, 20);

    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99); // #4b5563
    const reportDate = `Report Date: ${new Date().toLocaleString()}`;
    const recordCount = `Record Count: ${records.length}`;
    doc.text(reportDate, 200, 15, { align: "right" });
    doc.text(recordCount, 200, 20, { align: "right" });

    // Draw a divider line
    doc.setDrawColor(255, 108, 0); // #ff6c00
    doc.setLineWidth(0.5);
    doc.line(10, 23, 200, 23);

    // Columns
    const headers = [
      "Date",
      "GENSET ID",
      "Model",
      "Status",
      "Rating",
      "Hours",
      "Remarks",
      "Valve Lash Hrs",
      "Delivered To"
    ];

    const rows = records.map(r => [
      formatDate(r.tDate),
      r.generatorId,
      getGeneratorPanel(r.generatorId, panels) !== "Other" ? getGeneratorPanel(r.generatorId, panels) : "—",
      r.status,
      r.rating || "—",
      r.hours != null ? `${r.hours}h` : "—",
      parseRemarks(r.remarks).text || "—",
      r.valveLashHrs || "—",
      r.deliveryTo || "—"
    ]);

    // Helper: convert hex color to RGB array for jsPDF
    const hexToRgb = (hex: string): [number, number, number] => {
      const h = hex.replace("#", "");
      return [
        parseInt(h.substring(0, 2), 16),
        parseInt(h.substring(2, 4), 16),
        parseInt(h.substring(4, 6), 16),
      ];
    };

    // Helper: convert named remark color to hex
    const remarkColorToHex = (color: string): string | null => {
      switch (color) {
        case "red": return "#dc2626";
        case "yellow": return "#d4b815ff";
        case "green": return "#16a34a";
        case "blue": return "#2563eb";
        case "pink": return "#db2777";
        default: return null;
      }
    };

    autoTable(doc, {
      startY: 27,
      head: [headers],
      body: rows,
      theme: "plain",
      headStyles: {
        fillColor: [31, 31, 46], // #1f1f2e
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
        cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [55, 65, 81], // #374151
        valign: "middle",
        fillColor: [255, 255, 255],
        cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 3 },
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Date
        1: { cellWidth: 23, fontStyle: "bold" }, // GENSET ID
        2: { cellWidth: 18 }, // Model
        3: { cellWidth: 22 }, // Status
        4: { cellWidth: 16 }, // Rating
        5: { cellWidth: 14 }, // Hours
        6: { cellWidth: 32 }, // Remarks
        7: { cellWidth: 20 }, // Valve Lash Hrs
        8: { cellWidth: 23 }  // Delivered To
      },
      styles: {
        overflow: "linebreak",
        lineColor: [229, 231, 235], // #e5e7eb border
        lineWidth: 0.1,
      },
      margin: { top: 10, right: 10, bottom: 15, left: 10 },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const record = records[data.row.index];
        if (!record) return;

        // Column 3 = Status — apply status color
        if (data.column.index === 3) {
          const cfg = STATUS_CONFIG[record.status];
          if (cfg) {
            data.cell.styles.textColor = hexToRgb(cfg.text);
            data.cell.styles.fontStyle = "bold";
          }
        }

        // Column 6 = Remarks — apply remark color
        if (data.column.index === 6) {
          const parsed = parseRemarks(record.remarks);
          if (parsed.color) {
            const hex = remarkColorToHex(parsed.color);
            if (hex) {
              data.cell.styles.textColor = hexToRgb(hex);
            }
          }
          if (parsed.bold) {
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      didDrawPage: (data) => {
        // Footer (Page X of Y)
        const str = `Page ${data.pageNumber}`;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // #9ca3af
        doc.text(str, 200, 287, { align: "right" });
      }
    });

    doc.save(`generator_records_${new Date().toISOString().split("T")[0]}.pdf`);

    toast({
      title: "Success",
      description: `Successfully downloaded ${records.length} records as PDF.`
    });

    setIsDownloadModalOpen(false);
  };

  const handlePrint = () => {
    const records = getExportData();
    if (records.length === 0) {
      toast({
        title: "No data found",
        description: "There are no records matching the selected filters.",
        variant: "destructive"
      });
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups to print report.",
        variant: "destructive"
      });
      return;
    }

    const title = `Generator Records Report - ${new Date().toLocaleDateString()}`;
    const rowsHtml = records.map(r => {
      const statusCfg = STATUS_CONFIG[r.status];
      const statusColor = statusCfg ? statusCfg.text : "#374151";
      const parsedR = parseRemarks(r.remarks);
      const remarkHex = parsedR.color ? ({
        red: "#dc2626", yellow: "#b45309", green: "#16a34a",
        blue: "#2563eb", pink: "#db2777"
      } as Record<string, string>)[parsedR.color] || "" : "";
      const remarkStyle = [
        remarkHex ? `color:${remarkHex}` : "",
        parsedR.bold ? "font-weight:bold" : "",
        parsedR.italic ? "font-style:italic" : "",
        parsedR.underline ? "text-decoration:underline" : "",
      ].filter(Boolean).join(";");
      return `
      <tr>
        <td>${formatDate(r.tDate)}</td>
        <td><strong>${r.generatorId}</strong></td>
        <td>${getGeneratorPanel(r.generatorId, panels) !== "Other" ? getGeneratorPanel(r.generatorId, panels) : "—"}</td>
        <td style="color:${statusColor};font-weight:bold">${r.status}</td>
        <td>${r.rating || "—"}</td>
        <td>${r.hours != null ? `${r.hours}h` : "—"}</td>
        <td${remarkStyle ? ` style="${remarkStyle}"` : ""}>${parsedR.text || "—"}</td>
        <td>${r.valveLashHrs || "—"}</td>
        <td>${r.deliveryTo || "—"}</td>
      </tr>
    `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              color: #111827;
              padding: 20px 18px;
              margin: 0;
              line-height: 1.3;
              background: #fff;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #ff6c00;
              padding-bottom: 10px;
              margin-bottom: 12px;
            }
            .logo-title {
              font-size: 22px;
              font-weight: 800;
              color: #1f1f2e;
            }
            .subtitle {
              font-size: 12px;
              color: #6b7280;
              margin-top: 2px;
            }
            .meta {
              font-size: 11px;
              color: #4b5563;
              text-align: right;
              line-height: 1.4;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
              margin-top: 8px;
              border: 1px solid #e5e7eb;
            }
            th {
              background-color: #1f1f2e;
              color: #ffffff;
              font-weight: 700;
              text-transform: uppercase;
              font-size: 9px;
              letter-spacing: 0.05em;
              border: 1px solid #374151;
              padding: 5px 7px;
              text-align: left;
            }
            td {
              padding: 4px 7px;
              border: 1px solid #e5e7eb;
              color: #374151;
              background-color: #ffffff;
              vertical-align: middle;
            }
            @media print {
              body { padding: 0; background: #fff; }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo-title">GenOps</div>
              <div class="subtitle">Generator Management & Operations System Report</div>
            </div>
            <div class="meta">
              <div><strong>Report Date:</strong> ${new Date().toLocaleString()}</div>
              <div><strong>Record Count:</strong> ${records.length}</div>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 11%;">Date</th>
                <th style="width: 13%;">GENSET ID</th>
                <th style="width: 9%;">Model</th>
                <th style="width: 13%;">Status</th>
                <th style="width: 9%;">Rating</th>
                <th style="width: 8%;">Hours</th>
                <th>Remarks</th>
                <th style="width: 12%;">Valve Lash Hrs</th>
                <th style="width: 12%;">Delivered To</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setIsDownloadModalOpen(false);
  };

  if (isLoadingUser || !user) return null;

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#efebe4" }}>

      {/* Top navigation bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Left side: Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img src="/genops-logo.png" alt="GenOps.Live" className="h-8 sm:h-9 w-auto object-contain rounded-[10%]" />
            <span className="hidden sm:inline-block ml-1.5 text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#fff7ed", color: "#ff6c00" }}>
              Dashboard
            </span>
            {/* Desktop Generator Records Header */}
            <div className="hidden md:flex flex-col ml-2 pl-3 border-l border-gray-200 justify-center">
              <span className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
                Generator Records
              </span>
              <span className="text-xs text-gray-500 leading-tight">
                All entries are synced to your Google Sheet automatically.
              </span>
            </div>
          </div>

          {/* Mobile Top Search Bar matching mockup */}
          <div className="flex md:hidden items-center flex-1 max-w-[170px] xs:max-w-[210px] relative mx-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-8 h-8 text-xs bg-gray-50 border-gray-200 rounded-full w-full focus:bg-white transition-colors"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Right side: Action Buttons + Profile + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Action buttons - desktop only */}
            <div className="hidden md:flex items-center gap-2 mr-2 pr-3 border-r border-gray-200">
              <button
                id="nav-button-refresh-data"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh all data"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
              <button
                id="nav-button-download-data"
                onClick={() => setIsDownloadModalOpen(true)}
                title="Download or Print Generator Data"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-gray-600" />
                <span>Download</span>
              </button>
              {(user as any)?.sheetLink && (
                <button
                  id="nav-button-open-sheet"
                  onClick={openSheetPasswordModal}
                  title="Open Google Sheet (requires password)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm hover:opacity-90 active:scale-95"
                  style={{ background: "#ff6c00" }}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span className="whitespace-nowrap">Open Sheet</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setIsProfileOpen(true)}
              className="hidden md:flex items-center gap-2 text-sm hover:opacity-85 transition-opacity cursor-pointer border border-transparent p-1 rounded-lg hover:bg-gray-50"
              title="Open Profile Settings"
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-xs bg-orange-500 shadow-sm shadow-orange-500/10">
                {user.username[0].toUpperCase()}
              </div>
              <span className="font-semibold text-gray-700">{user.username}</span>
              {user.isDemoUser && (
                <span className="text-[10px] font-bold px-1.5 py-0.25 bg-blue-50 text-blue-600 rounded border border-blue-100 uppercase">
                  Guest
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm px-2.5 sm:px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              style={{ color: "#6b7280" }}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8 flex flex-col gap-4 sm:gap-6">

        {/* Page title + action buttons (mobile only, moved to navbar header on desktop) */}
        <div className="flex md:hidden flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: "#111827" }}>Generator Records</h1>
            <p className="text-xs sm:text-sm mt-0.5 sm:mt-1" style={{ color: "#6b7280" }}>All entries are synced to your Google Sheet automatically.</p>
          </div>
          {/* Action buttons - mobile only (hidden on md+, shown in navbar there) */}
          <div className="flex md:hidden items-center gap-2 w-full overflow-x-auto no-scrollbar pb-1">
            {/* Refresh button */}
            <button
              id="button-refresh-data"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh all data"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {/* Download Data button */}
            <button
              id="button-download-data"
              onClick={() => setIsDownloadModalOpen(true)}
              title="Download or Print Generator Data"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Download</span>
            </button>

            {(user as any)?.sheetLink && (
              /* Open Sheet button (password-protected) */
              <button
                id="button-open-sheet"
                onClick={openSheetPasswordModal}
                title="Open Google Sheet (requires password)"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white transition-all shadow-sm hover:opacity-90 active:scale-95"
                style={{ background: "#ff6c00" }}
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">Open Sheet</span>
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
            <StatCard
              icon={<Database className="w-4 h-4 sm:w-5 sm:h-5" />}
              accent="rgb(255, 108, 0)"
              label="TOTAL RECORDS"
              value={stats.total}
              onClick={() => setViewMode("main")}
              isActive={viewMode === "main"}
            />
            <StatCard
              icon={<Zap className="w-4 h-4 sm:w-5 sm:h-5" />}
              accent="rgb(124, 58, 237)"
              label="ALL MODEL"
              value={cpanelTotal}
              onClick={() => {
                setShowCPanel((v) => !v);
                setSelectedCPanel(null);
              }}
              isActive={showCPanel}
            />
            <StatCard
              icon={<Truck className="w-4 h-4 sm:w-5 sm:h-5" />}
              accent="rgb(8, 145, 178)"
              label="CURRENT DELIVERY"
              value={stats.currentDelivery}
              onClick={() => setViewMode("delivery")}
              isActive={viewMode === "delivery"}
            />
            <StatCard
              icon={<Truck className="w-4 h-4 sm:w-5 sm:h-5" />}
              accent="rgb(30, 58, 95)"
              label="PREVIOUS DELIVERY"
              value={stats.previousDelivery}
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
              className="bg-white rounded-xl border border-purple-200 shadow-xs overflow-hidden"
              style={{ borderColor: "#7c3aed33" }}
            >
              {/* Header Bar */}
              <div
                className="px-3.5 py-2 sm:px-4 sm:py-2.5 border-b flex flex-wrap items-center justify-between gap-2"
                style={{ borderColor: "#f3f0ff", background: "#faf5ff" }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-bold text-purple-950 tracking-tight">Sub-Models</h3>
                      {cpanelStats && cpanelStats.length > 0 && (
                        <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-700 border border-purple-200/80">
                          {cpanelStats.length} {cpanelStats.length === 1 ? "model" : "models"}
                        </span>
                      )}
                      {selectedCPanel && (
                        <span className="inline-flex items-center gap-1 text-[9.5px] font-medium px-2 py-0.2 rounded-full bg-purple-600 text-white shadow-xs">
                          Active: {selectedCPanel}
                          <button
                            type="button"
                            onClick={() => setSelectedCPanel(null)}
                            className="hover:bg-purple-700 rounded-full p-0.5 transition-colors"
                            title="Clear selection"
                            aria-label="Clear active model filter"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}
                    </div>
                    <p className="text-[9.5px] sm:text-[10.5px] text-gray-500">
                      Select a model card to filter the generator inventory below
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  {selectedCPanel && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedCPanel(null)}
                      className="h-6 px-1.5 text-xs text-purple-600 hover:text-purple-800 hover:bg-purple-100/50"
                    >
                      Clear filter
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={isReadOnly}
                    onClick={() => {
                      setNewModelNo("");
                      setNewModelPrefix("");
                      setIsAddSubModelOpen(true);
                    }}
                    className="h-7 px-2.5 text-xs font-semibold text-purple-700 bg-white hover:bg-purple-50 border border-purple-200 shadow-xs rounded-md flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isReadOnly ? "Disabled in view-only guest session" : ""}
                  >
                    <Plus className="w-3 h-3 text-purple-600" />
                    <span>Add New Model</span>
                  </Button>
                </div>
              </div>

              {/* Sub-Models Body */}
              <div className="p-2 sm:p-3">
                {/* Empty State */}
                {(!cpanelStats || cpanelStats.length === 0) ? (
                  <div className="py-6 px-3 text-center rounded-lg border border-dashed border-purple-200 bg-purple-50/20">
                    <div className="w-8 h-8 mx-auto mb-1.5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                      <Layers className="w-4 h-4" />
                    </div>
                    <p className="text-xs font-semibold text-gray-800">No Sub-Models Configured</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 max-w-xs mx-auto">
                      Define sub-models with generator ID prefixes to track and filter subsets of your fleet.
                    </p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewModelNo("");
                          setNewModelPrefix("");
                          setIsAddSubModelOpen(true);
                        }}
                        className="mt-2 text-xs font-semibold text-purple-600 hover:text-purple-700 underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add your first sub-model
                      </button>
                    )}
                  </div>
                ) : (
                  /* Cards Grid - compact and responsive with tighter spacing */
                  <div className="grid grid-cols-2 min-[440px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-1 sm:gap-1.5">
                    {[...cpanelStats]
                      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" }))
                      .map((panel) => {
                        const isSelected = selectedCPanel === panel.id;
                        return (
                          <div
                            key={panel.id}
                            onClick={() => setSelectedCPanel(isSelected ? null : panel.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedCPanel(isSelected ? null : panel.id);
                              }
                            }}
                            className={`group relative rounded-lg border px-2 py-1 sm:px-2.5 sm:py-1.5 transition-all duration-150 cursor-pointer flex flex-col justify-between select-none text-left ${
                              isSelected
                                ? "bg-gradient-to-br from-purple-50 via-white to-purple-100/50 border-purple-500 shadow-xs ring-1.5 ring-purple-500/20"
                                : "bg-white border-gray-200 hover:border-purple-300 hover:shadow-xs hover:bg-purple-50/15"
                            }`}
                          >
                            {/* Card Top Row: Model Name & Dedicated Action Buttons */}
                            <div className="flex items-center justify-between gap-1 pb-0.5">
                              {/* Model ID - bada/bigger & bolder */}
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <span
                                  className={`text-xs sm:text-[13.5px] font-black truncate tracking-tight leading-none ${
                                    isSelected ? "text-purple-700" : "text-gray-950"
                                  }`}
                                  title={panel.id}
                                >
                                  {panel.id}
                                </span>
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0 animate-pulse" />
                                )}
                              </div>

                              {/* Actions: Edit & Delete (Only show when clicked/selected) */}
                              {!isReadOnly && isSelected && (
                                <div
                                  className="flex items-center gap-0.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => handleOpenEditSubModel(panel, e)}
                                    className="p-0.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-100 transition-colors"
                                    title="Edit Model"
                                    aria-label={`Edit ${panel.id}`}
                                  >
                                    <Edit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSubModel(panel.id);
                                    }}
                                    className="p-0.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-100 transition-colors"
                                    title="Delete Model"
                                    aria-label={`Delete ${panel.id}`}
                                  >
                                    <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Card Bottom Row: Prefixes Tag & Total Count */}
                            <div className="flex items-baseline justify-between gap-1 pt-0.5 border-t border-gray-100">
                              <div className="min-w-0 flex-1">
                                <span className="text-[7.5px] font-semibold uppercase tracking-wider text-gray-400 block leading-tight">
                                  Prefix
                                </span>
                                <span
                                  className="text-[9px] sm:text-[9.5px] font-medium text-gray-600 truncate block leading-tight"
                                  title={panel.prefixes.join(", ")}
                                >
                                  {panel.prefixes.join(", ") || "—"}
                                </span>
                              </div>

                              <div className="text-right shrink-0">
                                <span
                                  className={`text-sm sm:text-base font-extrabold tabular-nums leading-tight block ${
                                    isSelected ? "text-purple-700" : "text-gray-950"
                                  }`}
                                >
                                  {panel.total}
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-gray-400 font-medium block leading-tight">
                                  units
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* Selected panel stats - Status Breakdown */}
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
                      <div className="mt-2 pt-2 border-t border-purple-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                            <h4 className="text-xs font-bold text-gray-800 tracking-tight">
                              Status Breakdown: <span className="text-purple-700">{selectedPanelData.id}</span>
                            </h4>
                            <span className="text-[9.5px] text-gray-400 font-normal hidden sm:inline">
                              ({selectedPanelData.prefixes.join(", ")})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCPanel(null)}
                            className="text-[10.5px] font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                            <span>Close</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 sm:gap-1.5">
                          {/* Total Status Card */}
                          <div
                            className="rounded-lg p-1 px-2 sm:px-2.5 sm:py-1 flex items-center justify-between border transition-all"
                            style={{
                              background: "linear-gradient(145deg, #ffffff 40%, rgba(30,41,59,0.04) 75%, rgba(30,41,59,0.12) 100%)",
                              borderColor: "rgba(30,41,59,0.18)",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div className="min-w-0 flex-1 pr-1">
                              <p
                                className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate leading-tight"
                                style={{ fontFamily: "Google_Sans, 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif" }}
                              >
                                TOTAL
                              </p>
                              <p
                                className="text-sm sm:text-base font-extrabold leading-tight tracking-tight text-slate-900 mt-0.5 tabular-nums"
                                style={{ fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif" }}
                              >
                                {selectedPanelData.total}
                              </p>
                            </div>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-700" />
                          </div>

                          {/* Individual Status Breakdown Cards */}
                          {STATUSES.map((status) => {
                            const cfg = STATUS_CONFIG[status];
                            const statusColor = cfg.text;
                            const count = selectedPanelData.byStatus[status] ?? 0;
                            return (
                              <div
                                key={status}
                                className="rounded-lg p-1 px-2 sm:px-2.5 sm:py-1 flex items-center justify-between border transition-all"
                                style={{
                                  background: `linear-gradient(145deg, #ffffff 40%, ${getRgba(statusColor, 0.04)} 75%, ${getRgba(statusColor, 0.12)} 100%)`,
                                  borderColor: getRgba(statusColor, 0.28),
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                }}
                              >
                                <div className="min-w-0 flex-1 pr-1">
                                  <p
                                    className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate leading-tight"
                                    style={{
                                      color: statusColor,
                                      fontFamily: "Google_Sans, 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif",
                                    }}
                                  >
                                    {status}
                                  </p>
                                  <p
                                    className="text-sm sm:text-base font-extrabold leading-tight tracking-tight mt-0.5 tabular-nums"
                                    style={{
                                      color: statusColor,
                                      fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Plus Jakarta Sans', 'Inter', sans-serif",
                                    }}
                                  >
                                    {count}
                                  </p>
                                </div>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: statusColor }} />
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

        {/* Status breakdown pills - Sliding left to right on mobile */}
        {stats && stats.byStatus.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 flex-nowrap sm:flex-wrap w-full">
            {selectedCPanel && (
              <button
                onClick={() => { setSelectedCPanel(null); setShowCPanel(false); }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border transition-all shrink-0 shadow-xs"
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
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 shadow-xs active:scale-95"
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
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-200 bg-white">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 flex-1 items-stretch sm:items-center">
              {/* Search input (left-aligned, ~40% width) */}
              <div className="relative w-full sm:w-[40%] min-w-[240px] max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by ID, date or remarks..."
                  className="pl-9 h-9 text-xs sm:text-sm bg-white border-gray-300 rounded-lg w-full focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search"
                />
              </div>

              {/* "All Status" dropdown/select (outlined style) */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-xs sm:text-sm bg-white border-gray-300 rounded-lg shadow-2xs" data-testid="select-status-filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Ready">Ready</SelectItem>
                  <SelectItem value="Used Ready">Used Ready</SelectItem>
                  <SelectItem value="Under Repair">Under Repair</SelectItem>
                  <SelectItem value="Under Readiness">Under Readiness</SelectItem>
                  <SelectItem value="On-Site">On-Site</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>

              {/* Segmented tab group (pill segments) */}
              <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-100/80 h-9 overflow-x-auto no-scrollbar whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setViewMode("main")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === "main" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                  data-testid="button-view-main"
                >
                  Main View
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("delivery")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === "delivery" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                  data-testid="button-view-delivery"
                >
                  Current Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("previous")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    viewMode === "previous" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
                  }`}
                  data-testid="button-view-previous"
                >
                  Previous Delivery
                </button>
              </div>
            </div>

            {/* Primary "+ Add Record" button (orange/amber #F5821F) */}
            <Button
              onClick={openAdd}
              disabled={isReadOnly}
              className="h-9 px-4 text-xs sm:text-sm font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 w-full sm:w-auto whitespace-nowrap transition-all active:scale-95 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#F5821F" }}
              data-testid="button-add-record"
              title={isReadOnly ? "Disabled in view-only guest session" : ""}
            >
              <Plus className="w-4 h-4" />
              <span>Add Record</span>
            </Button>
          </div>

          {selectedCPanel && (
            <div className="px-4 sm:px-5 py-2.5 border-b text-xs font-medium flex items-center gap-2" style={{ background: "#faf5ff", borderColor: "#ede9fe", color: "#7c3aed" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Filtering by {panels.find(p => p.id === selectedCPanel)?.label}
              <button onClick={() => setSelectedCPanel(null)} className="ml-1 underline hover:no-underline">Clear</button>
            </div>
          )}

          {/* Mobile Card List View (< md screens) */}
          <div className="block md:hidden space-y-3.5 p-3.5 bg-gray-100/60">
            {isLoadingGenerators ? (
              <div className="p-8 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
                Loading records...
              </div>
            ) : paginatedGenerators.length > 0 ? (
              <>
              {paginatedGenerators.map((record) => {
                const panel = getGeneratorPanel(record.generatorId, panels);
                const isDeliverable = (record.status === "Ready" || record.status === "Used Ready") && !isReadOnly;
                const statusCfg = STATUS_CONFIG[record.status] ?? STATUS_CONFIG["On-Site"];

                return (
                  <div
                    key={record.id}
                    className="bg-white rounded-2xl border border-gray-200/90 shadow-md hover:shadow-lg transition-all overflow-hidden flex flex-col"
                    style={{ borderLeft: `5px solid ${statusCfg.dot || '#f97316'}` }}
                  >
                    {/* Card Header Row */}
                    <div className="p-3.5 pb-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/30 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedRecordIds.has(record.id)}
                          onChange={(e) => {
                            const newIds = new Set(selectedRecordIds);
                            if (e.target.checked) newIds.add(record.id);
                            else newIds.delete(record.id);
                            setSelectedRecordIds(newIds);
                          }}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-4.5 w-4.5 cursor-pointer flex-shrink-0"
                        />
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-base text-gray-900 tracking-tight truncate">
                            {record.generatorId}
                          </span>
                          {panel !== "Other" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 border border-purple-200/60">
                              {panel}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={record.status} />
                    </div>

                    {/* Body Details Grid (Material UI specs layout) */}
                    <div className="p-3.5 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-orange-100/80 text-orange-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Zap className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Rating / kVA</span>
                            <span className="font-extrabold text-gray-900 text-xs truncate block">{record.rating || "—"}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Running Hours</span>
                            <span className="font-extrabold text-gray-900 text-xs truncate block">{record.hours != null ? `${record.hours} hrs` : "—"}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Record Date</span>
                            <span className="font-extrabold text-gray-900 text-xs truncate block">{formatDate(record.tDate)}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100/80 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valve Lash</span>
                            <span className="font-extrabold text-gray-900 text-xs truncate block">
                              {record.valveLashHrs ? `${record.valveLashHrs}${/^\d+(\.\d+)?$/.test(String(record.valveLashHrs).trim()) ? 'h' : ''}` : "—"}
                            </span>
                          </div>
                        </div>

                        {(viewMode === "delivery" || viewMode === "previous") && (
                          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-amber-100/80 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
                              <Truck className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Delivered To</span>
                              <span className="font-extrabold text-gray-900 text-xs truncate block">{record.deliveryTo || "—"}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Material Remarks / Notes Cell */}
                      {record.remarks && (
                        <div className="p-2.5 rounded-xl bg-amber-50/40 border border-amber-100 text-xs">
                          <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider block mb-1">
                            Material Details & Remarks
                          </span>
                          <div className="text-gray-800 leading-relaxed font-medium">
                            <RemarksCell record={record} panel={panel} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Footer Buttons Bar */}
                    <div className="p-3 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="text-[11px] font-bold text-gray-400">
                        Record #{record.id}
                      </div>

                      <div className="flex items-center gap-2">
                        {viewMode !== "previous" && (
                          viewMode === "delivery" ? (
                            <button
                              onClick={() => openReturnModal(record)}
                              disabled={isReadOnly}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-40"
                            >
                              <Truck className="w-3.5 h-3.5" /> Return
                            </button>
                          ) : (
                            <button
                              onClick={() => openDeliveryModal(record)}
                              disabled={!isDeliverable}
                              className="px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-40"
                              style={{
                                background: isDeliverable ? statusCfg.bg : "#f3f4f6",
                                color: isDeliverable ? statusCfg.text : "#9ca3af",
                                border: `1px solid ${isDeliverable ? statusCfg.dot : "#e5e7eb"}`,
                              }}
                            >
                              <Truck className="w-3.5 h-3.5" /> Deliver
                            </button>
                          )
                        )}

                        <button
                          onClick={() => openEdit(record)}
                          disabled={isReadOnly}
                          className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 shadow-sm active:scale-95 disabled:opacity-40"
                          title="Edit Genset Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          disabled={isReadOnly}
                          className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200/80 shadow-sm active:scale-95 disabled:opacity-40"
                          title="Delete Genset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Mobile Pagination Footer */}
              <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-gray-200 px-3 py-2.5 shadow-sm">
                <span className="text-[11px] text-gray-500">
                  {totalRecords === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)} of {totalRecords}
                </span>
                <div className="flex items-center gap-2">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-7 px-1.5 bg-gray-50 border border-gray-200 rounded text-[11px] font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-gray-500">
                      {page}/{totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              </>
            ) : (
              <div className="px-4 py-12 text-center text-sm text-gray-500 bg-white rounded-2xl border border-gray-100">
                <div className="flex flex-col items-center gap-2">
                  <Database className="w-6 h-6 text-orange-500" />
                  <p className="font-medium text-gray-700">No records found</p>
                </div>
              </div>
            )}
          </div>

          {/* Table (Desktop >= md screens) - MUI DataGrid inspired UI */}
          <div className="hidden md:block border-t border-gray-200">
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-gray-300">
              <table className="w-full text-sm border-collapse table-fixed">
                <thead className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-xs shadow-[0_1px_0_0_rgba(229,231,235,1)]">
                  <tr className="border-b border-gray-200 text-left">
                    {/* Checkbox (fixed 40px, sticky left) */}
                    <th className="w-[40px] min-w-[40px] max-w-[40px] px-2.5 py-2.5 text-center sticky left-0 z-30 bg-gray-50 border-r border-gray-200">
                      <input
                        type="checkbox"
                        checked={paginatedGenerators.length > 0 && paginatedGenerators.every(r => selectedRecordIds.has(r.id))}
                        onChange={(e) => {
                          const newIds = new Set(selectedRecordIds);
                          if (e.target.checked) {
                            paginatedGenerators.forEach(r => newIds.add(r.id));
                          } else {
                            paginatedGenerators.forEach(r => newIds.delete(r.id));
                          }
                          setSelectedRecordIds(newIds);
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                        title="Select All on Page"
                      />
                    </th>

                    {/* DATE (width ~110px) */}
                    <th
                      onClick={() => handleSort("tDate")}
                      className="w-[110px] min-w-[110px] max-w-[110px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Date"
                    >
                      <div className="flex items-center gap-1">
                        <span>DATE</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "tDate" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* GENSET ID (bold, width ~110px) */}
                    <th
                      onClick={() => handleSort("generatorId")}
                      className="w-[110px] min-w-[110px] max-w-[110px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Genset ID"
                    >
                      <div className="flex items-center gap-1">
                        <span>GENSET ID</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "generatorId" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* MODEL (chip-style purple, width ~80px) */}
                    <th
                      onClick={() => handleSort("panel")}
                      className="w-[80px] min-w-[80px] max-w-[80px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Model"
                    >
                      <div className="flex items-center gap-1">
                        <span>MODEL</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "panel" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* STATUS (colored dot + label, width ~140px) */}
                    <th
                      onClick={() => handleSort("status")}
                      className="w-[140px] min-w-[140px] max-w-[140px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Status"
                    >
                      <div className="flex items-center gap-1">
                        <span>STATUS</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "status" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* RATING (plain text, width ~90px) */}
                    <th
                      onClick={() => handleSort("rating")}
                      className="w-[90px] min-w-[90px] max-w-[90px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Rating"
                    >
                      <div className="flex items-center gap-1">
                        <span>RATING</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "rating" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* HOURS (plain text, width ~80px) */}
                    <th
                      onClick={() => handleSort("hours")}
                      className="w-[80px] min-w-[80px] max-w-[80px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors"
                      title="Sort by Hours"
                    >
                      <div className="flex items-center gap-1">
                        <span>HOURS</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "hours" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* REMARKS (flex-grow column) */}
                    <th className="min-w-[160px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                      REMARKS
                    </th>

                    {/* VALVE LASH HRS (width ~155px) */}
                    <th
                      onClick={() => handleSort("valveLashHrs")}
                      className="w-[155px] min-w-[155px] max-w-[155px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] cursor-pointer select-none hover:text-gray-900 transition-colors whitespace-nowrap"
                      title="Sort by Valve Lash Hrs"
                    >
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <span className="whitespace-nowrap">VALVE LASH HRS</span>
                        <span className="shrink-0 text-gray-400">
                          {sortField === "valveLashHrs" ? (
                            sortAsc ? <ArrowUp className="w-3.5 h-3.5 text-orange-500" /> : <ArrowDown className="w-3.5 h-3.5 text-orange-500" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>

                    {/* DELIVERED TO (conditional for delivery/previous view) */}
                    {(viewMode === "delivery" || viewMode === "previous") && (
                      <th className={`w-[130px] min-w-[130px] max-w-[130px] px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#6B7280] ${viewMode === "previous" ? "border-r border-gray-200" : ""}`}>
                        {viewMode === "previous" ? "PREV DELIVERED TO" : "DELIVERED TO"}
                      </th>
                    )}

                    {/* D / R (deliver button, width ~50px) */}
                    {viewMode !== "previous" && (
                      <th className="w-[50px] min-w-[50px] max-w-[50px] px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#6B7280] border-r border-gray-200">
                        {viewMode === "delivery" ? "R" : "D"}
                      </th>
                    )}

                    {/* ACTIONS (width ~70px, sticky right) */}
                    <th className="w-[70px] min-w-[70px] max-w-[70px] px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-[#6B7280] sticky right-0 z-30 bg-gray-50 border-l border-gray-200">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/80">
                  {isLoadingGenerators ? (
                    <tr>
                      <td colSpan={viewMode === "delivery" ? 12 : 11} className="px-5 py-12 text-center text-sm text-gray-400">
                        <div className="w-5 h-5 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-2" />
                        Loading records...
                      </td>
                    </tr>
                  ) : paginatedGenerators.length > 0 ? (
                    paginatedGenerators.map((record) => {
                      const panel = getGeneratorPanel(record.generatorId, panels);
                      const isDeliverable = (record.status === "Ready" || record.status === "Used Ready") && !isReadOnly;

                      return (
                        <tr
                          key={record.id}
                          className="group h-[42px] even:bg-[#FAFAFA] hover:bg-[#F5F5F5] transition-colors"
                          data-testid={`row-generator-${record.id}`}
                        >
                          {/* Checkbox (sticky left) */}
                          <td className="w-[40px] min-w-[40px] max-w-[40px] px-2.5 py-1 text-center sticky left-0 z-10 bg-white group-even:bg-[#FAFAFA] group-hover:bg-[#F5F5F5] border-r border-gray-200">
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.has(record.id)}
                              onChange={(e) => {
                                const newIds = new Set(selectedRecordIds);
                                if (e.target.checked) newIds.add(record.id);
                                else newIds.delete(record.id);
                                setSelectedRecordIds(newIds);
                              }}
                              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                            />
                          </td>

                          {/* DATE (DD-MM-YYYY) */}
                          <td className="w-[110px] min-w-[110px] max-w-[110px] px-2.5 py-1 text-xs font-medium text-gray-700 whitespace-nowrap">
                            {formatDate(record.tDate)}
                          </td>

                          {/* GENSET ID (bold) */}
                          <td className="w-[110px] min-w-[110px] max-w-[110px] px-2.5 py-1 text-xs font-bold text-gray-900 truncate">
                            {record.generatorId}
                          </td>

                          {/* MODEL (chip in purple #6C4FE0) */}
                          <td className="w-[80px] min-w-[80px] max-w-[80px] px-2.5 py-1">
                            {panel !== "Other" ? (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#f5f3ff] text-[#6C4FE0] border border-[#ede9fe]">
                                {panel}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>

                          {/* STATUS (colored dot + label) */}
                          <td className="w-[140px] min-w-[140px] max-w-[140px] px-2.5 py-1">
                            <StatusBadge status={record.status} />
                          </td>

                          {/* RATING */}
                          <td className="w-[90px] min-w-[90px] max-w-[90px] px-2.5 py-1 text-xs text-gray-600 font-medium truncate">
                            {record.rating || "—"}
                          </td>

                          {/* HOURS */}
                          <td className="w-[80px] min-w-[80px] max-w-[80px] px-2.5 py-1 text-xs text-gray-700 font-semibold tabular-nums">
                            {record.hours != null ? `${record.hours}h` : "—"}
                          </td>

                          {/* REMARKS (flex-grow, single-line ellipsis) */}
                          <td className="min-w-[160px] px-2.5 py-1 text-xs max-w-xs truncate text-gray-700">
                            <RemarksCell record={record} panel={panel} />
                          </td>

                          {/* VALVE LASH HRS */}
                          <td className="w-[155px] min-w-[155px] max-w-[155px] px-2.5 py-1 text-xs text-gray-700 font-semibold tabular-nums truncate">
                            {record.valveLashHrs ? `${record.valveLashHrs}${/^\d+(\.\d+)?$/.test(String(record.valveLashHrs).trim()) ? 'h' : ''}` : "—"}
                          </td>

                          {/* DELIVERED TO */}
                          {(viewMode === "delivery" || viewMode === "previous") && (
                            <td className={`w-[130px] min-w-[130px] max-w-[130px] px-2.5 py-1 text-xs font-medium text-gray-700 truncate ${viewMode === "previous" ? "border-r border-gray-200" : ""}`}>
                              {record.deliveryTo || "—"}
                            </td>
                          )}

                          {/* D / R (deliver button, outline box) */}
                          {viewMode !== "previous" && (
                            <td className="w-[50px] min-w-[50px] max-w-[50px] px-1.5 py-1 text-center border-r border-gray-200">
                              {viewMode === "delivery" ? (
                                <button
                                  onClick={() => openReturnModal(record)}
                                  disabled={isReadOnly}
                                  title={isReadOnly ? "Disabled in view-only session" : "Return Generator"}
                                  className="w-7 h-7 rounded border border-[#E23B3B] bg-[#E23B3B]/10 text-[#E23B3B] hover:bg-[#E23B3B]/20 transition-all active:scale-95 inline-flex items-center justify-center disabled:opacity-40"
                                  data-testid={`button-return-${record.id}`}
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              ) : isDeliverable ? (
                                <button
                                  onClick={() => openDeliveryModal(record)}
                                  title="Deliver Generator"
                                  className="w-7 h-7 rounded border border-[#2E9E44] bg-[#2E9E44]/10 text-[#2E9E44] hover:bg-[#2E9E44]/20 transition-all active:scale-95 inline-flex items-center justify-center"
                                  data-testid={`button-deliver-${record.id}`}
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  disabled
                                  title="Only 'Ready' or 'Used Ready' generators can be delivered"
                                  className="w-7 h-7 rounded border border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed inline-flex items-center justify-center"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}

                          {/* ACTIONS (pencil, trash icon buttons, sticky right) */}
                          <td className="w-[70px] min-w-[70px] max-w-[70px] px-1.5 py-1 text-center sticky right-0 z-10 bg-white group-even:bg-[#FAFAFA] group-hover:bg-[#F5F5F5] border-l border-gray-200">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEdit(record)}
                                disabled={isReadOnly}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isReadOnly ? "Disabled in view-only session" : "Edit"}
                                data-testid={`button-edit-${record.id}`}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(record.id)}
                                disabled={isReadOnly}
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isReadOnly ? "Disabled in view-only session" : "Delete"}
                                data-testid={`button-delete-${record.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={viewMode === "delivery" ? 12 : 11} className="px-5 py-14 text-center">
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-50">
                            <Database className="w-5 h-5 text-orange-500" />
                          </div>
                          <p className="text-sm font-semibold text-gray-800">No records found</p>
                          <p className="text-xs text-gray-500">
                            {selectedCPanel ? `No records in ${panels.find(p => p.id === selectedCPanel)?.label}` : 'Click "Add Record" to create your first entry'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MUI X DataGrid Compact Footer: "Showing X records" + pagination controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 bg-white text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>
                  Showing {totalRecords === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRecords)} of {totalRecords} records
                </span>
                {selectedRecordIds.size > 0 && (
                  <span className="font-semibold text-orange-600 ml-1">
                    • {selectedRecordIds.size} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-500 text-[11px]">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-7 px-2 bg-gray-50 border border-gray-200 rounded text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-gray-500 text-[11px] mr-1">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

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
              className="fixed inset-0 z-[45]"
              style={{ background: "rgba(0,0,0,0.35)" }}
              onClick={() => setIsFormOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[460px] z-50 flex flex-col shadow-2xl"
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
                                <SelectItem value="On-Site">On-Site</SelectItem>
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

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Rating</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 500kVA, Good"
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
                        name="valveLashHrs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Valve Lash Hrs</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g. 250h or 500"
                                className="h-10 bg-gray-50 border-gray-200"
                                data-testid="input-valve-lash-hrs"
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
                      name="remarks"
                      render={({ field }) => {
                        const { text, bold, italic, underline, color } = parseRemarks(field.value);
                        return (
                          <FormItem>
                            <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Remarks</FormLabel>
                            <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
                              {/* Styling toolbar */}
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-1">
                                <div className="flex items-center gap-1.5">
                                  {/* Bold button */}
                                  <button
                                    type="button"
                                    onClick={() => field.onChange(stringifyRemarks(text, !bold, italic, underline, color))}
                                    className={`w-7 h-7 rounded flex items-center justify-center font-bold text-sm border transition-colors ${bold ? "bg-[#ff6c00]/10 border-[#ff6c00] text-[#ff6c00]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                      }`}
                                  >
                                    B
                                  </button>
                                  {/* Italic button */}
                                  <button
                                    type="button"
                                    onClick={() => field.onChange(stringifyRemarks(text, bold, !italic, underline, color))}
                                    className={`w-7 h-7 rounded flex items-center justify-center italic text-sm border transition-colors ${italic ? "bg-[#ff6c00]/10 border-[#ff6c00] text-[#ff6c00]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                      }`}
                                  >
                                    I
                                  </button>
                                  {/* Underline button */}
                                  <button
                                    type="button"
                                    onClick={() => field.onChange(stringifyRemarks(text, bold, italic, !underline, color))}
                                    className={`w-7 h-7 rounded flex items-center justify-center underline text-sm border transition-colors ${underline ? "bg-[#ff6c00]/10 border-[#ff6c00] text-[#ff6c00]" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                                      }`}
                                  >
                                    U
                                  </button>
                                </div>

                                {/* Color picker */}
                                <div className="flex items-center gap-1.5">
                                  {[
                                    { name: "red", bg: "bg-red-500" },
                                    { name: "yellow", bg: "bg-amber-500" },
                                    { name: "green", bg: "bg-green-500" },
                                    { name: "blue", bg: "bg-blue-500" },
                                    { name: "pink", bg: "bg-pink-500" }
                                  ].map((c) => (
                                    <button
                                      key={c.name}
                                      type="button"
                                      onClick={() => field.onChange(stringifyRemarks(text, bold, italic, underline, color === c.name ? "" : c.name))}
                                      className={`w-5 h-5 rounded-full border-2 transition-all ${c.bg} ${color === c.name ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
                                        }`}
                                      title={`Color: ${c.name}`}
                                    />
                                  ))}
                                  {color && (
                                    <button
                                      type="button"
                                      onClick={() => field.onChange(stringifyRemarks(text, bold, italic, underline, ""))}
                                      className="text-[10px] text-gray-400 hover:text-gray-600 underline ml-1"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>

                              <FormControl>
                                <Textarea
                                  placeholder="Any additional notes..."
                                  className="bg-white border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-1 resize-none text-sm leading-relaxed focus-visible:outline-none focus:outline-none"
                                  rows={3}
                                  data-testid="input-remarks"
                                  style={{
                                    fontWeight: bold ? "bold" : "normal",
                                    fontStyle: italic ? "italic" : "normal",
                                    textDecoration: underline ? "underline" : "none",
                                    color: color ? getColorCode(color) : undefined,
                                  }}
                                  value={text}
                                  onChange={(e) => field.onChange(stringifyRemarks(e.target.value, bold, italic, underline, color))}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </form>
                </Form>
              </div>

              {/* Panel footer - extra bottom padding on mobile so buttons stay above the bottom nav bar */}
              <div className="px-6 py-4 pb-20 md:pb-4 border-t border-gray-100 flex gap-3">
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
                <div className="flex items-center gap-2.5">
                  <h3
                    className="font-bold text-lg text-gray-900 tracking-tight"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    To Delivery
                  </h3>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-50 text-[#ff6c00] border border-orange-200 tracking-wide"
                    style={{ fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    {deliveryModalRecord.generatorId}
                  </span>
                </div>
                <button
                  onClick={() => setDeliveryModalRecord(null)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Genset ID
                  </label>
                  <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm">
                    <span
                      className="text-gray-900 font-bold text-[14.5px] tracking-wide"
                      style={{ fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    >
                      {deliveryModalRecord.generatorId}
                    </span>
                    {getGeneratorPanel(deliveryModalRecord.generatorId, panels) && (
                      <span
                        className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-2xs"
                        style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                      >
                        Model: {getGeneratorPanel(deliveryModalRecord.generatorId, panels)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Receiver Name
                  </label>
                  <Input
                    placeholder="Enter receiver's name"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#ff6c00]"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    data-testid="input-receiver-name"
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Delivery Date
                  </label>
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#ff6c00]"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    data-testid="input-delivery-date"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeliveryModalRecord(null)}
                  className="flex-1 h-10 text-sm font-medium"
                  style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitDelivery}
                  disabled={!receiverName.trim() || updateMutation.isPending}
                  className="flex-1 h-10 text-sm font-semibold text-white"
                  style={{
                    background: "#ff6c00",
                    fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif"
                  }}
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
                <div className="flex items-center gap-2.5">
                  <h3
                    className="font-bold text-lg text-gray-900 tracking-tight"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Return Generator
                  </h3>
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 tracking-wide"
                    style={{ fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    {returnModalRecord.generatorId}
                  </span>
                </div>
                <button
                  onClick={() => setReturnModalRecord(null)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Genset ID
                  </label>
                  <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm">
                    <span
                      className="text-gray-900 font-bold text-[14.5px] tracking-wide"
                      style={{ fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    >
                      {returnModalRecord.generatorId}
                    </span>
                    {getGeneratorPanel(returnModalRecord.generatorId, panels) && (
                      <span
                        className="text-xs font-semibold text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded shadow-2xs"
                        style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                      >
                        Model: {getGeneratorPanel(returnModalRecord.generatorId, panels)}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1.5"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    New Status
                  </label>
                  <Select value={returnStatus} onValueChange={setReturnStatus}>
                    <SelectTrigger
                      className="h-10 bg-gray-50 border-gray-200"
                      style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    >
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ready">Ready</SelectItem>
                      <SelectItem value="Used Ready">Used Ready</SelectItem>
                      <SelectItem value="Under Repair">Under Repair</SelectItem>
                      <SelectItem value="Under Readiness">Under Readiness</SelectItem>
                      <SelectItem value="On-Site">On-Site</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 block mb-1"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                  >
                    Return Date
                  </label>
                  <Input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="h-10 border-gray-200 bg-gray-50 focus-visible:ring-[#ff6c00]"
                    style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                    data-testid="input-return-date"
                  />
                </div>
              </div>
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setReturnModalRecord(null)}
                  className="flex-1 h-10 text-sm font-medium"
                  style={{ fontFamily: "Google_Sans, 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif" }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={submitReturn}
                  disabled={!returnStatus || updateMutation.isPending}
                  className="flex-1 h-10 text-sm font-semibold text-white"
                  style={{
                    background: "#ff6c00",
                    fontFamily: "Google_Sans_Medium, 'Google Sans Medium', 'Google Sans', 'Product Sans', 'Plus Jakarta Sans', Roboto, 'Inter', sans-serif"
                  }}
                >
                  {updateMutation.isPending ? "Updating..." : "Confirm Return"}
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
              className="bg-white rounded-xl shadow-xl max-w-sm sm:max-w-md w-full overflow-hidden border border-gray-100 z-10"
            >
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900">Add New Sub-Model</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Define a model mapped to matching generator IDs</p>
                </div>
                <button
                  onClick={() => setIsAddSubModelOpen(false)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddSubModelSubmit}>
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Model Name / Number</label>
                    <Input
                      required
                      placeholder="e.g. C7, C8, C9"
                      value={newModelNo}
                      onChange={(e) => setNewModelNo(e.target.value)}
                      className="h-9 text-sm border-gray-200 bg-gray-50 focus-visible:ring-[#7c3aed]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Genset ID Prefix (Starting Characters)</label>
                    <Input
                      required
                      placeholder="e.g. ABC XYZ or EC8, LX8"
                      value={newModelPrefix}
                      onChange={(e) => setNewModelPrefix(e.target.value)}
                      className="h-9 text-sm border-gray-200 bg-gray-50 focus-visible:ring-[#7c3aed]"
                    />
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      Make sure that whatever the Genset ID is, its starting digits or letters match one of these prefixes. You can enter multiple prefixes separated by space or comma.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2.5">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setIsAddSubModelOpen(false)}
                    className="flex-1 h-9 text-xs sm:text-sm font-medium"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-9 text-xs sm:text-sm font-semibold text-white"
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

      {/* Edit Sub-Model Modal */}
      <AnimatePresence>
        {isEditSubModelOpen && editingPanel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsEditSubModelOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-sm sm:max-w-md w-full overflow-hidden border border-gray-100 z-10"
            >
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-gray-900">Edit Sub-Model</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Update the model name or prefix</p>
                </div>
                <button
                  onClick={() => setIsEditSubModelOpen(false)}
                  className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubModelSubmit}>
                <div className="p-4 sm:p-5 space-y-3.5">
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Model Name / Number</label>
                    <input
                      required
                      placeholder="e.g. C7, C8, C9"
                      value={editModelNo}
                      onChange={(e) => setEditModelNo(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-700 block mb-1">Genset ID Prefix (Starting Characters)</label>
                    <input
                      required
                      placeholder="e.g. ABC XYZ or EC8, LX8"
                      value={editModelPrefix}
                      onChange={(e) => setEditModelPrefix(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent"
                    />
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                      Make sure that whatever the Genset ID is, its starting digits or letters match one of these prefixes. You can enter multiple prefixes separated by space or comma.
                    </p>
                  </div>
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsEditSubModelOpen(false)}
                    className="flex-1 h-9 text-xs sm:text-sm font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-9 text-xs sm:text-sm font-semibold text-white rounded-lg transition-colors"
                    style={{ background: "#7c3aed" }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden border border-gray-100 z-10 p-6"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-gray-900 leading-6">{deleteConfirmModal.title}</h3>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">{deleteConfirmModal.description}</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setDeleteConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="h-10 text-sm font-medium px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={deleteConfirmModal.onConfirm}
                  className="h-10 text-sm font-semibold text-white px-4 bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user as any}
      />

      {/* ── Sheet Password Modal ── */}
      <AnimatePresence>
        {showSheetPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeSheetPasswordModal}
            />

            {/* Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 z-10"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-5 border-b border-gray-100">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "#fff7ed" }}
                  >
                    <Lock className="w-5 h-5" style={{ color: "#ff6c00" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-base leading-tight">Verify Identity</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Enter your password to open the Google Sheet
                    </p>
                  </div>
                  <button
                    onClick={closeSheetPasswordModal}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showSheetPasswordText ? "text" : "password"}
                      placeholder="Enter your password..."
                      value={sheetPassword}
                      onChange={(e) => {
                        setSheetPassword(e.target.value);
                        setSheetPasswordError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") verifyPasswordAndOpenSheet();
                      }}
                      className="h-10 bg-gray-50 border-gray-200 pr-10 focus-visible:ring-[#ff6c00]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowSheetPasswordText((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showSheetPasswordText
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {sheetPasswordError && (
                    <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                      {sheetPasswordError}
                    </p>
                  )}
                </div>

                {/* Info note */}
                <div
                  className="flex items-start gap-2 rounded-lg p-3 text-xs"
                  style={{ background: "#fff7ed", color: "#92400e" }}
                >
                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "#ff6c00" }} />
                  <span>
                    Your Google Sheet will open in a new tab once your password is verified.
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={closeSheetPasswordModal}
                  className="flex-1 h-10 text-sm font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={verifyPasswordAndOpenSheet}
                  disabled={isVerifyingPassword || !sheetPassword.trim()}
                  className="flex-1 h-10 text-sm font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{ background: "#ff6c00" }}
                >
                  {isVerifyingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Sheet
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download & Print Modal */}
      <AnimatePresence>
        {isDownloadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsDownloadModalOpen(false)}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-[95vw] sm:w-full overflow-hidden border border-gray-100 z-50 flex flex-col max-h-[92vh] my-auto"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-tight">
                      Download & Print Data
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Export your generator records or prepare them for printing</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 rounded-xl p-1.5 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 scrollbar-thin">
                {/* 1. Filter Scope selection */}
                <div>
                  <label className="text-xs sm:text-sm font-bold text-gray-700 block mb-2">Select Data Scope</label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setDownloadFilterScope("filtered")}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${downloadFilterScope === "filtered"
                        ? "border-orange-500 bg-orange-50/80 text-orange-950 font-bold shadow-sm ring-1 ring-orange-400/40"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                    >
                      <span className="text-[11px] sm:text-xs font-bold leading-tight">Filtered Table</span>
                      <span className="text-[10px] text-gray-500 font-semibold">({generators.length} records)</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedRecordIds.size === 0}
                      onClick={() => setDownloadFilterScope("selected")}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${downloadFilterScope === "selected"
                        ? "border-orange-500 bg-orange-50/80 text-orange-950 font-bold shadow-sm ring-1 ring-orange-400/40"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                    >
                      <span className="text-[11px] sm:text-xs font-bold leading-tight">Selected Rows</span>
                      <span className="text-[10px] text-gray-500 font-semibold">({selectedRecordIds.size} records)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDownloadFilterScope("custom")}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${downloadFilterScope === "custom"
                        ? "border-orange-500 bg-orange-50/80 text-orange-950 font-bold shadow-sm ring-1 ring-orange-400/40"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                        }`}
                    >
                      <span className="text-[11px] sm:text-xs font-bold leading-tight">Custom Filters</span>
                      <span className="text-[10px] text-gray-500 font-semibold">Specify below</span>
                    </button>
                  </div>
                </div>

                {/* 2. Custom filters area */}
                {downloadFilterScope === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 pt-2 border-t border-gray-100"
                  >
                    {/* Date filter type */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">1. Date Filter</label>
                      <div className="grid grid-cols-3 gap-2">
                        {["all", "today", "range"].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setDownloadFilterDateType(type as any)}
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${downloadFilterDateType === type
                              ? "border-orange-500 bg-orange-50 text-orange-800 shadow-sm"
                              : "border-gray-200 hover:bg-gray-50 text-gray-600"
                              }`}
                          >
                            {type === "all" ? "All Dates" : type === "today" ? "Today Only" : "Custom Range"}
                          </button>
                        ))}
                      </div>

                      {downloadFilterDateType === "range" && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <span className="text-[11px] text-gray-500 font-medium block mb-1">Start Date</span>
                            <Input
                              type="date"
                              value={downloadStartDate}
                              onChange={(e) => setDownloadStartDate(e.target.value)}
                              className="h-10 text-xs bg-gray-50 border-gray-200 rounded-xl font-sans"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-gray-500 font-medium block mb-1">End Date</span>
                            <Input
                              type="date"
                              value={downloadEndDate}
                              onChange={(e) => setDownloadEndDate(e.target.value)}
                              className="h-10 text-xs bg-gray-50 border-gray-200 rounded-xl font-sans"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Model filter */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">2. Model / Panel Filter</label>
                      <Select value={downloadFilterModel} onValueChange={setDownloadFilterModel}>
                        <SelectTrigger className="h-10 text-xs bg-gray-50 border-gray-200 rounded-xl">
                          <SelectValue placeholder="All Models" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Models</SelectItem>
                          <SelectItem value="Other">Other (Unassigned)</SelectItem>
                          {panels.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status filter */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">3. Status Filter</label>
                      <Select value={downloadFilterStatus} onValueChange={setDownloadFilterStatus}>
                        <SelectTrigger className="h-10 text-xs bg-gray-50 border-gray-200 rounded-xl">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </motion.div>
                )}

                {/* Info summary */}
                <div className="bg-gray-50 rounded-2xl p-3.5 sm:p-4 flex justify-between items-center text-xs border border-gray-100">
                  <span className="text-gray-600 font-semibold">Records that will be exported:</span>
                  <span className="font-black text-sm text-gray-900 bg-white border border-gray-200 px-3.5 py-1 rounded-xl shadow-sm">
                    {getExportData().length}
                  </span>
                </div>
              </div>

              {/* Footer Buttons (Mobile-first stacked & desktop side-by-side) */}
              <div className="p-4 sm:p-6 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="w-full sm:flex-1 h-11 text-xs sm:text-sm font-bold border-gray-300 text-gray-700 bg-white hover:bg-gray-100 rounded-2xl"
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={handlePrint}
                  className="w-full sm:flex-1 h-11 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 rounded-2xl shadow-md shadow-blue-500/20"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </Button>

                <Button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="w-full sm:flex-1 h-11 text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 rounded-2xl shadow-md shadow-orange-500/25"
                  style={{ background: "#ff6c00" }}
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Bottom Navigation Bar for Mobile View */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 px-2 py-1.5 grid grid-cols-5 items-center justify-items-center md:hidden shadow-lg">
        {/* 1. Home Button */}
        <button
          type="button"
          onClick={() => {
            setViewMode("main");
            setStatusFilter("all");
            setSearch("");
            setSelectedCPanel(null);
            setShowCPanel(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-orange-500 transition-colors p-1 cursor-pointer w-full"
          title="Home Dashboard"
        >
          <Home className="w-5 h-5 text-gray-700 hover:text-orange-500" />
          <span className="text-[10px] font-semibold text-gray-700">Home</span>
        </button>

        {/* 2. Network / Guest Users Icon */}
        <button
          type="button"
          onClick={() => setIsGuestModalOpen(true)}
          className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-orange-500 transition-colors p-1 cursor-pointer w-full"
          title="Network Accounts"
        >
          <Users className="w-5 h-5 text-gray-700 hover:text-orange-500" />
          <span className="text-[10px] font-semibold text-gray-700">Network</span>
        </button>

        {/* 3. Center Add Record Prominent Button */}
        <button
          type="button"
          onClick={() => {
            if (isReadOnly) {
              toast({ title: "View-only Mode", description: "You are logged in as a guest. Creating records is disabled.", variant: "destructive" });
              return;
            }
            openAdd();
          }}
          className="w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg shadow-orange-500/30 transition-transform active:scale-90 -mt-5 bg-[#ff6c00] cursor-pointer"
          title="Add Record"
        >
          <Plus className="w-6 h-6 text-white" />
        </button>

        {/* 4. Notification Icon with Red Badge */}
        <button
          type="button"
          onClick={() => {
            toast({
              title: "Notifications",
              description: "No new notifications. System operating normally.",
            });
          }}
          className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-orange-500 transition-colors p-1 relative cursor-pointer w-full"
          title="Notifications"
        >
          <div className="relative">
            <Bell className="w-5 h-5 text-gray-700 hover:text-orange-500" />
            <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white font-bold text-[9px] flex items-center justify-center shadow-xs">
              1
            </span>
          </div>
          <span className="text-[10px] font-semibold text-gray-700">Alerts</span>
        </button>

        {/* 5. Profile Avatar Icon at Bottom Right */}
        <button
          type="button"
          onClick={() => setIsProfileOpen(true)}
          className="flex flex-col items-center gap-0.5 text-gray-700 hover:text-orange-500 transition-colors p-1 cursor-pointer w-full"
          title="Profile Settings"
        >
          <div className="w-5.5 h-5.5 rounded-full flex items-center justify-center font-bold text-white text-[10px]" style={{ background: "#ff6c00" }}>
            {user.username[0].toUpperCase()}
          </div>
          <span className="text-[10px] font-semibold text-gray-700">Profile</span>
        </button>
      </div>

      {/* Guest / Network Accounts Modal */}
      <AnimatePresence>
        {isGuestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base">Network & Guest Accounts</h3>
                    <p className="text-xs text-gray-500">Active demo and network sessions</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGuestModalOpen(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="bg-orange-50/70 border border-orange-100 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0 animate-ping" />
                  <div>
                    <p className="text-xs font-bold text-orange-950">Current Active Session</p>
                    <p className="text-xs text-orange-800 mt-0.5">
                      Logged in as: <strong className="font-bold">{user.username}</strong> ({user.isDemoUser ? "Guest User" : "Primary User"})
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Demo / Network Accounts</p>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                    <div className="p-3 flex items-center justify-between bg-white hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center">
                          G
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">guest_demo</p>
                          <p className="text-[10px] text-gray-400">Guest Viewer Session</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100">
                        Online
                      </span>
                    </div>

                    <div className="p-3 flex items-center justify-between bg-white hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold text-xs flex items-center justify-center">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800">{user.username}</p>
                          <p className="text-[10px] text-gray-400">Current Session</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                        Active Now
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <Button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="px-5 h-9 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-xs"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
