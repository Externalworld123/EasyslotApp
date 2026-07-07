import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/hooks/useCurrency";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Zap, Wrench, Banknote, Sparkles, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "electricity", label: "Electricity", icon: Zap },
  { value: "maintenance", label: "Maintenance", icon: Wrench },
  { value: "salary", label: "Salary", icon: Banknote },
  { value: "cleaning", label: "Cleaning", icon: Sparkles },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

export default function Expenses() {
  const { centerId, user } = useAuth();
  const { format: fmtCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("other");
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("center_id", centerId)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!centerId,
  });

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (categoryFilter === "all") return expenses;
    return expenses.filter((e) => e.category === categoryFilter);
  }, [expenses, categoryFilter]);

  const monthlySummary = useMemo(() => {
    if (!expenses) return { total: 0, byCategory: {} as Record<string, number> };
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();
    const thisMonth = expenses.filter(
      (e) => e.expense_date >= monthStart.slice(0, 10) && e.expense_date <= monthEnd.slice(0, 10)
    );
    const total = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
    const byCategory: Record<string, number> = {};
    thisMonth.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
    });
    return { total, byCategory };
  }, [expenses]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!centerId || !user) throw new Error("Not authenticated");
      const { error } = await supabase.from("expenses").insert({
        center_id: centerId,
        category: newCategory,
        amount: parseFloat(newAmount),
        description: newDescription.trim() || null,
        expense_date: newDate,
        recorded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      queryClient.invalidateQueries({ queryKey: ["expenses", centerId] });
      setShowAdd(false);
      setNewAmount("");
      setNewDescription("");
      setNewCategory("other");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground">Track center operational costs</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Expense
        </Button>
      </div>

      {/* Monthly summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">This Month Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{fmtCurrency(monthlySummary.total)}</p>
          </CardContent>
        </Card>
        {CATEGORIES.slice(0, 3).map((cat) => (
          <Card key={cat.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
                <cat.icon className="h-3 w-3" /> {cat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">
                {fmtCurrency(monthlySummary.byCategory[cat.value] || 0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto text-secondary bg-primary-foreground border-solid">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No expenses recorded yet
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">{format(parseISO(e.expense_date), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">{e.category}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{fmtCurrency(Number(e.amount))}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="0.00"
                min={0}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !newAmount || parseFloat(newAmount) <= 0}
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
