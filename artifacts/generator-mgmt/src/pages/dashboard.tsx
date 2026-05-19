import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMe, getGetMeQueryKey, 
  useLogout, 
  useListGenerators, getListGeneratorsQueryKey,
  useGetGeneratorStats, getGetGeneratorStatsQueryKey,
  useCreateGenerator, useUpdateGenerator, useDeleteGenerator
} from "@workspace/api-client-react";
import { GeneratorRecord } from "@workspace/api-client-react/src/generated/api.schemas";

import { Activity, LogOut, Plus, Search, Filter, MoreHorizontal, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  tDate: z.string().min(1, "Date is required"),
  generatorId: z.string().min(1, "Generator ID is required"),
  status: z.string().min(1, "Status is required"),
  rating: z.string().optional().nullable(),
  hours: z.coerce.number().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading: isLoadingUser, isError: isUserError } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const logoutMutation = useLogout();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: stats } = useGetGeneratorStats({
    query: { queryKey: getGetGeneratorStatsQueryKey() }
  });

  const { data: generators, isLoading: isLoadingGenerators } = useListGenerators({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined
  }, {
    query: { queryKey: getListGeneratorsQueryKey({ search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined }) }
  });

  const createMutation = useCreateGenerator();
  const updateMutation = useUpdateGenerator();
  const deleteMutation = useDeleteGenerator();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GeneratorRecord | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tDate: format(new Date(), "yyyy-MM-dd"),
      generatorId: "",
      status: "Running",
      rating: "",
      hours: 0,
      remarks: "",
    },
  });

  useEffect(() => {
    if (isUserError || (!user && !isLoadingUser)) {
      setLocation("/login");
    }
  }, [user, isLoadingUser, isUserError, setLocation]);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const handleEdit = (record: GeneratorRecord) => {
    setEditingRecord(record);
    form.reset({
      tDate: record.tDate,
      generatorId: record.generatorId,
      status: record.status,
      rating: record.rating || "",
      hours: record.hours || 0,
      remarks: record.remarks || "",
    });
    setIsFormOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Delete this record?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
        }
      });
    }
  };

  const onSubmitForm = (values: z.infer<typeof formSchema>) => {
    const payload = {
      ...values,
      rating: values.rating || undefined,
      hours: values.hours || undefined,
      remarks: values.remarks || undefined,
    };
    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
          setIsFormOpen(false);
        }
      });
    } else {
      createMutation.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGeneratorsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetGeneratorStatsQueryKey() });
          setIsFormOpen(false);
        }
      });
    }
  };

  if (isLoadingUser || !user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Topbar */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center border border-primary/30">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <span className="font-mono font-bold tracking-tight text-lg">GEN_OPS</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-muted-foreground hidden md:inline-block">
              OP: {user.username}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col gap-6">
        
        {/* Stats Row */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card/40 border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Total Records</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-mono">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Recent (7d)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-mono text-primary">{stats.recentCount}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Avg Hours</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-mono">{stats.avgHours ? Math.round(stats.avgHours) : 0}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/40 border-border/50">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-2">
                {stats.byStatus.map(s => (
                  <div key={s.status} className="flex items-center gap-1 text-sm font-mono">
                    <span className="text-muted-foreground">{s.status}:</span>
                    <span>{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card/20 p-4 rounded-lg border border-border/50">
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search ID or remarks..." 
                className="pl-9 font-mono bg-background/50 text-sm"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 font-mono bg-background/50">
                <SelectValue placeholder="Status" />
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
          <Button onClick={() => { setEditingRecord(null); form.reset({ tDate: format(new Date(), "yyyy-MM-dd"), generatorId: "", status: "Running", rating: "", hours: 0, remarks: "" }); setIsFormOpen(true); }} className="w-full sm:w-auto font-mono tracking-wide">
            <Plus className="w-4 h-4 mr-2" />
            Log Entry
          </Button>
        </div>

        {/* Data Table */}
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card/30">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="font-mono text-xs uppercase tracking-wider w-32">Date</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider w-40">Gen ID</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider w-32">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider w-24">Rating</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider w-24 text-right">Hours</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider">Remarks</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingGenerators ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center font-mono text-muted-foreground">
                    Fetching records...
                  </TableCell>
                </TableRow>
              ) : generators && generators.length > 0 ? (
                generators.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm">{record.tDate}</TableCell>
                    <TableCell className="font-mono text-sm font-medium">{record.generatorId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-mono text-xs uppercase rounded-sm border ${
                        record.status === "Running" ? "text-success border-success/30 bg-success/10" :
                        record.status === "Stopped" ? "text-destructive border-destructive/30 bg-destructive/10" :
                        record.status === "Maintenance" ? "text-warning border-warning/30 bg-warning/10" :
                        record.status === "Fault" ? "text-destructive border-destructive/30 bg-destructive/20 font-bold" :
                        "text-muted-foreground border-border bg-muted/20"
                      }`}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">{record.rating || "-"}</TableCell>
                    <TableCell className="font-mono text-sm text-right">{record.hours || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{record.remarks}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 font-mono">
                          <DropdownMenuItem onClick={() => handleEdit(record)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(record.id)} className="text-destructive focus:bg-destructive/10">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center font-mono text-muted-foreground">
                    No records found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* Form Sheet */}
      <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
        <SheetContent className="bg-card border-l border-border/50 sm:max-w-md w-full">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-mono text-xl tracking-tight">
              {editingRecord ? "Edit Record" : "New Log Entry"}
            </SheetTitle>
            <SheetDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Update generator telemetry and status.
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitForm)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="tDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Date</FormLabel>
                      <FormControl>
                        <Input type="date" className="font-mono bg-background/50" {...field} />
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
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Gen ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GEN-01" className="font-mono bg-background/50 uppercase" {...field} />
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
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="font-mono bg-background/50">
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
                      <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Op Hours</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" className="font-mono bg-background/50" {...field} value={field.value ?? ""} />
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
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Rating/Load</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 500kVA" className="font-mono bg-background/50" {...field} value={field.value ?? ""} />
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
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Remarks / Telemetry</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter operational notes..." className="font-mono min-h-32 resize-none bg-background/50" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button type="submit" className="w-full font-mono uppercase tracking-widest" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Transmitting..." : "Commit Record"}
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
