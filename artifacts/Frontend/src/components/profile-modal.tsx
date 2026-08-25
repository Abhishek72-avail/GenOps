import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDemoUsers,
  useCreateDemoUser,
  useUpdateDemoUser,
  useDeleteDemoUser,
  getListDemoUsersQueryKey,
  getGetMeQueryKey,
  User,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2,
  Shield,
  UserPlus,
  Clock,
  Copy,
  CheckCircle2,
  Lock,
  UserCheck,
  Globe,
  Eye,
  Pencil,
  AlertTriangle,
  Users,
  User as UserIcon,
  TimerOff,
  Activity,
  BadgeCheck,
  ExternalLink,
  Sparkles,
  Check,
  ShieldCheck,
  Zap,
  Key,
} from "lucide-react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User & { isDemoUser?: boolean; permissions?: string; sheetLink?: string };
}

const DURATION_OPTIONS = [
  { value: "1h", label: "1 Hour" },
  { value: "5h", label: "5 Hours" },
  { value: "24h", label: "24 Hours" },
  { value: "1w", label: "1 Week" },
  { value: "1m", label: "1 Month" },
];

export function ProfileModal({ isOpen, onClose, user }: ProfileModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("profile");
  const [copied, setCopied] = useState(false);

  // Form states for creating a new demo user
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPermission, setNewPermission] = useState<"view" | "edit">("view");
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [duration, setDuration] = useState("24h");
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = !user.isDemoUser;
  const { data: demoUsers, isLoading: isLoadingDemos } = useListDemoUsers({
    query: {
      enabled: isOpen && isAdmin,
      queryKey: getListDemoUsersQueryKey(),
    },
  });

  const createMutation = useCreateDemoUser();
  const updateMutation = useUpdateDemoUser();
  const deleteMutation = useDeleteDemoUser();

  const handleCopySheet = () => {
    if (user.sheetLink) {
      navigator.clipboard.writeText(user.sheetLink);
      setCopied(true);
      toast({ title: "Copied!", description: "Google Sheet link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateDemo = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const u = newUsername.trim();
    const p = newPassword.trim();
    if (!u || !p) { setErrorMsg("Username and password are required."); return; }
    if (p.length < 4) { setErrorMsg("Password must be at least 4 characters."); return; }

    createMutation.mutate(
      { data: { username: u, password: p, permissions: newPermission, isActive: true, duration: isUnlimited ? "none" : duration } },
      {
        onSuccess: () => {
          toast({ title: "✅ Account created", description: `"${u}" guest account is ready.` });
          setNewUsername(""); setNewPassword(""); setNewPermission("view");
          setIsUnlimited(false); setDuration("24h");
          queryClient.invalidateQueries({ queryKey: getListDemoUsersQueryKey() });
        },
        onError: (err: any) => {
          const msg = err?.data?.error || err?.message || "Failed to create demo user.";
          setErrorMsg(msg);
        },
      }
    );
  };

  const handleToggleActive = (demoId: number, currentActive: boolean) => {
    updateMutation.mutate(
      { id: demoId, data: { isActive: !currentActive } },
      {
        onSuccess: (updated) => {
          toast({
            title: updated.isActive ? "Account Activated" : "Account Deactivated",
            description: `Demo account is now ${updated.isActive ? "active" : "inactive"}.`,
          });
          queryClient.invalidateQueries({ queryKey: getListDemoUsersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to update.", variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteDemo = (demoId: number, username: string) => {
    if (!window.confirm(`Delete guest account "${username}"? This cannot be undone.`)) return;
    deleteMutation.mutate(
      { id: demoId },
      {
        onSuccess: () => {
          toast({ title: "Deleted", description: `"${username}" has been removed.` });
          queryClient.invalidateQueries({ queryKey: getListDemoUsersQueryKey() });
        },
        onError: (err: any) => {
          toast({ title: "Error", description: err?.data?.error || "Failed to delete.", variant: "destructive" });
        },
      }
    );
  };

  const formatRemainingTime = (expiresAtStr: string | null | undefined) => {
    if (!expiresAtStr) return "No expiry";
    const diff = new Date(expiresAtStr).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h left`;
    return `${Math.floor(hrs / 24)}d left`;
  };

  const getStatusInfo = (isActive: boolean, expiresAtStr: string | null | undefined) => {
    const expired = expiresAtStr && new Date(expiresAtStr) < new Date();
    if (!isActive) return { label: "Inactive", color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-200", dot: "bg-gray-400" };
    if (expired) return { label: "Expired", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-500" };
    return { label: "Active", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500 animate-pulse" };
  };

  const activeCount = demoUsers?.filter(u => u.isActive && !(u.expiresAt && new Date(u.expiresAt) < new Date())).length ?? 0;
  const totalCount = demoUsers?.length ?? 0;
  const slotPercentage = Math.min((totalCount / 5) * 100, 100);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[92vh] sm:max-h-[88vh] p-0 overflow-hidden bg-gradient-to-b from-gray-50 via-white to-gray-50 border border-gray-100 shadow-2xl rounded-3xl flex flex-col">

        {/* Top Mobbin-style Decorative Ambient Header */}
        <div className="relative px-5 sm:px-6 pt-5 pb-4 border-b border-gray-100 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-gray-900 leading-tight tracking-tight flex items-center gap-2">
                  Account Hub
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-orange-100 text-orange-700 border border-orange-200/60">
                    {isAdmin ? "Admin Console" : "Guest Mode"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Manage profile credentials and guest account access
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Segment Switcher (Mobbin mobile iOS pill design) */}
        <div className="px-4 sm:px-6 pt-4 pb-2 flex-shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-200/70 p-1 rounded-2xl h-11 border border-gray-200/50">
              <TabsTrigger
                value="profile"
                className="text-xs sm:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-md text-gray-500 flex items-center justify-center gap-2 py-2"
              >
                <UserIcon className="w-4 h-4 text-orange-500" />
                <span>My Account</span>
              </TabsTrigger>
              <TabsTrigger
                value="demo"
                className="text-xs sm:text-sm font-bold rounded-xl transition-all data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-md text-gray-500 flex items-center justify-center gap-2 py-2 disabled:opacity-50"
                disabled={!isAdmin}
              >
                <Users className="w-4 h-4 text-amber-500" />
                <span>Guest Accounts</span>
                {isAdmin && totalCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-[10px] font-black bg-orange-500 text-white rounded-full shadow-sm">
                    {totalCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content Area */}
        <div className="px-4 sm:px-6 py-4 overflow-y-auto flex-1 space-y-4 scrollbar-thin">
          <Tabs value={activeTab} className="w-full">

            {/* ════════════════════════════════════════════
                SECTION 1: MY ACCOUNT ("my account wala")
               ════════════════════════════════════════════ */}
            <TabsContent value="profile" className="space-y-4 focus:outline-none mt-0">
              
              {/* Profile Hero Card (Mobbin modern cover styling) */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5 sm:p-6 text-white shadow-xl">
                {/* Decorative background blur glow */}
                <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-orange-500/20 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-amber-500/20 blur-xl pointer-events-none" />

                <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                  {/* User Avatar with Ring */}
                  <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-orange-500 via-amber-500 to-orange-400 p-1 shadow-lg shadow-orange-500/30">
                      <div className="w-full h-full rounded-[22px] bg-gray-900 flex items-center justify-center font-black text-white text-2xl sm:text-3xl uppercase tracking-wider">
                        {user.username[0]}
                      </div>
                    </div>
                    {/* Live Online Badge */}
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-gray-900 flex items-center justify-center shadow-md" title="Active Session">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </span>
                  </div>

                  {/* Account Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                        {user.username}
                      </h3>
                      {user.isDemoUser ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 backdrop-blur-md">
                          <Eye className="w-3 h-3" /> Guest Account
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/25">
                          <BadgeCheck className="w-3.5 h-3.5" /> Administrator
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-300 mt-1 font-medium truncate flex items-center justify-center sm:justify-start gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>

                    {/* Quick Access Badges Bar */}
                    <div className="mt-3.5 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <div className="px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-gray-200 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Status: <strong className="text-emerald-400">Online</strong></span>
                      </div>
                      <div className="px-3 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-gray-200 flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-orange-400" />
                        <span>Access: <strong className="text-white">{user.permissions === "edit" ? "Read & Write" : "Full Access"}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Details Card Frame Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Username Card Frame */}
                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-600 flex-shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Account Handle</span>
                    <p className="font-bold text-gray-900 text-sm truncate mt-0.5">{user.username}</p>
                  </div>
                </div>

                {/* Email Address Card Frame */}
                <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">Email Address</span>
                    <p className="font-bold text-gray-900 text-sm truncate mt-0.5">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Linked Google Sheet Integration Card Frame (Mobbin quick-copy component) */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-gray-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-gray-900">Google Sheet Integration</h4>
                      <p className="text-[11px] text-gray-400">Connected database spreadsheet URL</p>
                    </div>
                  </div>

                  {user.sheetLink && (
                    <a
                      href={user.sheetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Open
                    </a>
                  )}
                </div>

                <div className="relative group">
                  <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/70 text-xs font-mono text-gray-700 break-all leading-relaxed flex items-center justify-between gap-3">
                    <span className="line-clamp-2 select-all text-[11px]">
                      {user.sheetLink || "No Google Sheet URL connected to this account."}
                    </span>
                    {user.sheetLink && (
                      <Button
                        type="button"
                        onClick={handleCopySheet}
                        size="sm"
                        className="h-8 px-3 text-xs font-bold bg-white text-gray-800 border border-gray-200 hover:bg-gray-100 shadow-sm flex items-center gap-1.5 flex-shrink-0 rounded-xl"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-extrabold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-gray-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Guest Access Info Banner (if viewing as Guest User) */}
              {user.isDemoUser && (
                <div className="p-4 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 to-indigo-50/40 flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/20">
                    {user.permissions === "edit" ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-blue-950">
                      {user.permissions === "edit" ? "Read & Write Guest Account" : "View-Only Guest Account"}
                    </h5>
                    <p className="text-xs text-blue-700/80 mt-0.5 leading-relaxed">
                      {user.permissions === "edit"
                        ? "You have permission to view, add, and modify generator entries."
                        : "You can view generator data and export reports. Modifying or deleting records is restricted."}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ════════════════════════════════════════════
                SECTION 2: MY GUEST ACCOUNTS ("my guest account wala")
               ════════════════════════════════════════════ */}
            {isAdmin && (
              <TabsContent value="demo" className="focus:outline-none mt-0">
                <div className="space-y-4">

                  {/* Slot Usage Capacity Card Frame (Mobbin progress gauge) */}
                  <div className="p-4 rounded-3xl bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-transparent border border-orange-200/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">Guest Accounts Capacity</h4>
                        <p className="text-[11px] text-gray-500">Create up to 5 guest login credentials</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-gray-900">{totalCount} / 5</span>
                        <span className="text-[11px] text-gray-400 font-semibold">Slots Used</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${slotPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                    {/* Left: Create Form (Mobile friendly touch components) */}
                    <div className="lg:col-span-5 space-y-3.5 p-4 sm:p-5 rounded-3xl bg-white border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                          <UserPlus className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-gray-900">New Guest Credential</h4>
                      </div>

                      {totalCount >= 5 ? (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-3">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                          <div>
                            <p className="text-xs font-bold">Slot limit reached (5/5)</p>
                            <p className="text-[11px] mt-0.5 text-amber-700">Delete an existing account below to issue new credentials.</p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleCreateDemo} className="space-y-3.5">
                          {errorMsg && (
                            <div className="p-3 text-xs bg-red-50 text-red-600 border border-red-100 rounded-xl flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
                              <span>{errorMsg}</span>
                            </div>
                          )}

                          {/* Username Input */}
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-700">Guest Username</Label>
                            <Input
                              placeholder="e.g. guest_john"
                              value={newUsername}
                              onChange={(e) => { setNewUsername(e.target.value); setErrorMsg(""); }}
                              className="h-10 text-xs sm:text-sm rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-orange-500"
                            />
                          </div>

                          {/* Password Input */}
                          <div className="space-y-1">
                            <Label className="text-xs font-bold text-gray-700">Access Password</Label>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Min. 4 characters"
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(""); }}
                                className="h-10 text-xs sm:text-sm rounded-xl bg-gray-50 border-gray-200 focus-visible:ring-orange-500 pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Access Permission Segmented Pills */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-gray-700">Access Permission</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setNewPermission("view")}
                                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                  newPermission === "view"
                                    ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>View Only</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewPermission("edit")}
                                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                  newPermission === "edit"
                                    ? "bg-purple-50 border-purple-300 text-purple-700 shadow-sm"
                                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5 text-purple-500" />
                                <span>Read & Write</span>
                              </button>
                            </div>
                          </div>

                          {/* Duration Selection Pills */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-bold text-gray-700">Session Expiration</Label>
                              <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 cursor-pointer">
                                <span>No Expiry</span>
                                <Switch id="unlimited" checked={isUnlimited} onCheckedChange={setIsUnlimited} />
                              </label>
                            </div>

                            {!isUnlimited && (
                              <div className="grid grid-cols-5 gap-1.5">
                                {DURATION_OPTIONS.map((o) => (
                                  <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => setDuration(o.value)}
                                    className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                                      duration === o.value
                                        ? "bg-orange-500 text-white shadow-sm"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                                  >
                                    {o.value}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Submit Button */}
                          <Button
                            type="submit"
                            disabled={createMutation.isPending}
                            className="w-full h-11 text-xs sm:text-sm font-bold text-white rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md shadow-orange-500/25 transition-all"
                          >
                            {createMutation.isPending ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Creating Account...
                              </span>
                            ) : (
                              <span className="flex items-center justify-center gap-2">
                                <UserPlus className="w-4 h-4" />
                                Create Guest Credentials
                              </span>
                            )}
                          </Button>
                        </form>
                      )}
                    </div>

                    {/* Right: Guest Accounts List Cards (Mobbin mobile card frames) */}
                    <div className="lg:col-span-7 space-y-3 p-4 sm:p-5 rounded-3xl bg-white border border-gray-100 shadow-sm flex flex-col">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
                            <Lock className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-gray-900">Active Guest Profiles</h4>
                        </div>

                        <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {activeCount} Active Now
                        </span>
                      </div>

                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin flex-1">
                        {isLoadingDemos ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin mb-2" />
                            <p className="text-xs text-gray-400">Loading guest profiles...</p>
                          </div>
                        ) : demoUsers && demoUsers.length > 0 ? (
                          demoUsers.map((u) => {
                            const status = getStatusInfo(u.isActive, u.expiresAt);
                            return (
                              <div
                                key={u.id}
                                className="group p-3.5 sm:p-4 rounded-2xl border border-gray-100 bg-gray-50/70 hover:bg-white hover:border-gray-200 hover:shadow-md transition-all space-y-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* Avatar circle */}
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-gray-200 to-gray-300 flex items-center justify-center font-extrabold text-gray-700 text-sm flex-shrink-0">
                                      {u.username[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-xs sm:text-sm text-gray-900 truncate">{u.username}</span>
                                        {/* Status Chip */}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.bg} ${status.color} ${status.border}`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                          {status.label}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {/* Permission badge */}
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          u.permissions === "edit"
                                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                                            : "bg-blue-50 text-blue-700 border border-blue-200"
                                        }`}>
                                          {u.permissions === "edit" ? <><Pencil className="w-2.5 h-2.5" /> Read & Write</> : <><Eye className="w-2.5 h-2.5" /> View Only</>}
                                        </span>

                                        {/* Expiry status */}
                                        <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                          {u.expiresAt ? (
                                            <><Clock className="w-3 h-3 text-gray-400" /> {formatRemainingTime(u.expiresAt)}</>
                                          ) : (
                                            <><TimerOff className="w-3 h-3 text-gray-400" /> No Expiry</>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Quick Actions (Switch + Delete) */}
                                  <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                                    <Switch
                                      checked={u.isActive}
                                      onCheckedChange={() => handleToggleActive(u.id, u.isActive)}
                                      title={u.isActive ? "Deactivate account" : "Activate account"}
                                    />
                                    <button
                                      onClick={() => handleDeleteDemo(u.id, u.username)}
                                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                      title="Delete account"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-2.5 text-gray-400">
                              <Users className="w-6 h-6" />
                            </div>
                            <p className="text-xs font-bold text-gray-600">No guest accounts created</p>
                            <p className="text-[11px] text-gray-400 mt-1 max-w-[200px]">
                              Issue temporary login credentials for viewers or co-administrators.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </TabsContent>
            )}

          </Tabs>
        </div>

      </DialogContent>
    </Dialog>
  );
}
