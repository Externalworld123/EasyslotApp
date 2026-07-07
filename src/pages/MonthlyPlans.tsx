import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CalendarRange, Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanWizardStep1 from "@/components/monthly-plans/PlanWizardStep1";
import PlanWizardStep2, { type Participant } from "@/components/monthly-plans/PlanWizardStep2";
import PlanWizardStep3 from "@/components/monthly-plans/PlanWizardStep3";
import PlanListCard from "@/components/monthly-plans/PlanListCard";
import PlanStatsBar from "@/components/monthly-plans/PlanStatsBar";
import { useUserRoles } from "@/hooks/useUserRoles";

const FORM_KEY = "easyslot_monthly_plan_form";
const STEP_LABELS = ["Plan Details", "Participants", "Payment Summary"];

export default function MonthlyPlans() {
  const { centerId, user } = useAuth();
  const { primaryRole } = useUserRoles();
  const canEdit = primaryRole === "center_admin" || primaryRole === "super_admin" || primaryRole === "organization_admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  // Form state
  const [planType, setPlanType] = useState("members");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [groupName, setGroupName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [notes, setNotes] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Persist form to sessionStorage
  useEffect(() => {
    if (dialogOpen) {
      sessionStorage.setItem(FORM_KEY, JSON.stringify({
        step, planType, customerName, customerPhone, groupName, leaderName,
        resourceId, startDate, endDate, slotTime, duration, daysOfWeek,
        notes, totalAmount, participants, editingPlanId,
      }));
    }
  }, [dialogOpen, step, planType, customerName, customerPhone, groupName, leaderName,
      resourceId, startDate, endDate, slotTime, duration, daysOfWeek, notes, totalAmount, participants, editingPlanId]);

  // Restore form from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(FORM_KEY);
    if (saved) {
      try {
        const s = JSON.parse(saved);
        setPlanType(s.planType || "members");
        setCustomerName(s.customerName || "");
        setCustomerPhone(s.customerPhone || "");
        setGroupName(s.groupName || "");
        setLeaderName(s.leaderName || "");
        setResourceId(s.resourceId || "");
        setStartDate(s.startDate || "");
        setEndDate(s.endDate || "");
        setSlotTime(s.slotTime || "");
        setDuration(s.duration || 60);
        setDaysOfWeek(s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
        setNotes(s.notes || "");
        setTotalAmount(s.totalAmount || 0);
        setParticipants(s.participants || []);
        setStep(s.step || 0);
        setEditingPlanId(s.editingPlanId || null);
        setDialogOpen(true);
      } catch { /* ignore */ }
    }
  }, []);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["monthly-plans-all", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("monthly_plans")
        .select("*, plan_participants(*)")
        .eq("center_id", centerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });

  const { data: resources } = useQuery({
    queryKey: ["monthly-plan-resources", centerId],
    queryFn: async () => {
      if (!centerId) return [];
      const { data, error } = await supabase
        .from("resources")
        .select("id, name, type, hourly_rate")
        .eq("center_id", centerId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!centerId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!centerId || !user) throw new Error("Not authenticated");
      const membersTotal = participants.reduce((s, p) => s + (p.amount || 0), 0);
      const finalTotal = planType === "group" ? totalAmount : membersTotal;

      const { data: plan, error } = await supabase.from("monthly_plans").insert({
        center_id: centerId,
        resource_id: resourceId,
        customer_name: planType === "group" ? (groupName || "Group") : customerName.trim(),
        customer_phone: planType === "group" ? null : (customerPhone.trim() || null),
        start_date: startDate,
        end_date: endDate,
        slot_time: slotTime,
        duration_minutes: duration,
        days_of_week: daysOfWeek,
        notes: notes.trim() || null,
        created_by: user.id,
        plan_type: planType,
        group_name: planType === "group" ? groupName.trim() : null,
        leader_name: planType === "group" ? leaderName.trim() : null,
        total_amount: finalTotal,
      }).select("id").single();
      if (error) throw error;

      // Insert participants for members type
      if (planType === "members" && participants.length > 0 && plan) {
        const rows = participants.map((p) => ({
          plan_id: plan.id,
          name: p.name.trim(),
          phone: p.phone.trim() || null,
          amount: p.amount,
          payment_status: p.payment_status,
        }));
        const { error: pErr } = await supabase.from("plan_participants").insert(rows);
        if (pErr) throw pErr;
      }
    },
    onSuccess: () => {
      toast({ title: "Monthly plan created" });
      qc.invalidateQueries({ queryKey: ["monthly-plans"] });
      qc.invalidateQueries({ queryKey: ["monthly-plans-all"] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create plan", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlanId) throw new Error("No plan to edit");
      const membersTotal = participants.reduce((s, p) => s + (p.amount || 0), 0);
      const finalTotal = planType === "group" ? totalAmount : membersTotal;

      const { error: planErr } = await supabase.from("monthly_plans").update({
        resource_id: resourceId,
        customer_name: planType === "group" ? (groupName || "Group") : customerName.trim(),
        customer_phone: planType === "group" ? null : (customerPhone.trim() || null),
        start_date: startDate,
        end_date: endDate,
        slot_time: slotTime,
        duration_minutes: duration,
        days_of_week: daysOfWeek,
        notes: notes.trim() || null,
        plan_type: planType,
        group_name: planType === "group" ? groupName.trim() : null,
        leader_name: planType === "group" ? leaderName.trim() : null,
        total_amount: finalTotal,
      }).eq("id", editingPlanId);
      if (planErr) throw planErr;

      // Sync participants: fetch existing, diff against current
      if (planType === "members") {
        const { data: existing, error: fetchErr } = await supabase
          .from("plan_participants")
          .select("id")
          .eq("plan_id", editingPlanId);
        if (fetchErr) throw fetchErr;

        const existingIds = new Set((existing ?? []).map((p) => p.id));
        const currentIds = new Set(participants.map((p) => p.id).filter((id) => existingIds.has(id)));
        const toDelete = [...existingIds].filter((id) => !currentIds.has(id));
        const toInsert = participants.filter((p) => !existingIds.has(p.id));
        const toUpdate = participants.filter((p) => existingIds.has(p.id));

        if (toDelete.length) {
          const { error } = await supabase.from("plan_participants").delete().in("id", toDelete);
          if (error) throw error;
        }
        if (toInsert.length) {
          const rows = toInsert.map((p) => ({
            plan_id: editingPlanId,
            name: p.name.trim(),
            phone: p.phone.trim() || null,
            amount: p.amount,
            payment_status: p.payment_status,
          }));
          const { error } = await supabase.from("plan_participants").insert(rows);
          if (error) throw error;
        }
        for (const p of toUpdate) {
          const { error } = await supabase.from("plan_participants").update({
            name: p.name.trim(),
            phone: p.phone.trim() || null,
            amount: p.amount,
            payment_status: p.payment_status,
          }).eq("id", p.id);
          if (error) throw error;
        }
      } else {
        // Group plan: clear out any leftover participant rows
        await supabase.from("plan_participants").delete().eq("plan_id", editingPlanId);
      }
    },
    onSuccess: () => {
      toast({ title: "Plan updated" });
      qc.invalidateQueries({ queryKey: ["monthly-plans-all"] });
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update plan", description: err.message, variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (planId: string) => {
      const { data, error } = await supabase
        .from("monthly_plans")
        .update({ is_active: false })
        .eq("id", planId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied or plan not found");
    },
    onSuccess: () => {
      toast({ title: "Plan deactivated" });
      qc.invalidateQueries({ queryKey: ["monthly-plans"] });
      qc.invalidateQueries({ queryKey: ["monthly-plans-all"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to deactivate", description: err.message, variant: "destructive" });
    },
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: async ({ participantId, status }: { participantId: string; status: string }) => {
      const { error } = await supabase
        .from("plan_participants")
        .update({ payment_status: status })
        .eq("id", participantId);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast({ title: vars.status === "paid" ? "Marked as paid" : "Marked as pending" });
      qc.invalidateQueries({ queryKey: ["monthly-plans-all"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["monthly-plans-all"] });
    },
  });

  const filteredPlans = useMemo(() => {
    if (!plans) return [];
    if (filter === "all") return plans;
    return plans.filter((plan: any) => {
      if (plan.plan_type === "group") return false;
      const parts = plan.plan_participants ?? [];
      if (parts.length === 0) return true;
      return parts.some((p: any) => p.payment_status !== "paid");
    });
  }, [plans, filter]);

  const resetForm = useCallback(() => {
    setStep(0);
    setPlanType("members");
    setCustomerName("");
    setCustomerPhone("");
    setGroupName("");
    setLeaderName("");
    setResourceId("");
    setStartDate("");
    setEndDate("");
    setSlotTime("");
    setDuration(60);
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
    setNotes("");
    setTotalAmount(0);
    setParticipants([]);
    setEditingPlanId(null);
    sessionStorage.removeItem(FORM_KEY);
  }, []);

  const handleCloseDialog = () => {
    resetForm();
    setDialogOpen(false);
  };

  const openEditDialog = (plan: any) => {
    setEditingPlanId(plan.id);
    setPlanType(plan.plan_type || "members");
    setCustomerName(plan.customer_name || "");
    setCustomerPhone(plan.customer_phone || "");
    setGroupName(plan.group_name || "");
    setLeaderName(plan.leader_name || "");
    setResourceId(plan.resource_id || "");
    setStartDate(plan.start_date || "");
    setEndDate(plan.end_date || "");
    setSlotTime((plan.slot_time || "").slice(0, 5));
    setDuration(plan.duration_minutes || 60);
    setDaysOfWeek(plan.days_of_week || [0, 1, 2, 3, 4, 5, 6]);
    setNotes(plan.notes || "");
    setTotalAmount(Number(plan.total_amount) || 0);
    setParticipants(
      (plan.plan_participants ?? []).map((p: any) => ({
        id: p.id,
        name: p.name || "",
        phone: p.phone || "",
        amount: Number(p.amount) || 0,
        payment_status: p.payment_status || "pending",
      }))
    );
    setStep(0);
    setDialogOpen(true);
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const isStep1Valid = planType === "group"
    ? !!(groupName.trim() && leaderName.trim().length >= 10 && resourceId && startDate && endDate && slotTime && daysOfWeek.length)
    : !!(customerName.trim() && customerPhone.trim().length >= 10 && resourceId && startDate && endDate && slotTime && daysOfWeek.length);

  const isStep2Valid = planType === "group"
    ? totalAmount > 0
    : participants.length > 0 && participants.every((p) => p.name.trim() && p.amount > 0);

  const canSubmit = isStep1Valid && isStep2Valid;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary shrink-0" /> Monthly Plans
          </h1>
          <p className="text-xs text-muted-foreground">Recurring slot reservations</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="h-8 shrink-0">
          <Plus className="h-3.5 w-3.5 mr-1" /> New Plan
        </Button>
      </div>

      {plans && plans.length > 0 && <PlanStatsBar plans={plans as any} />}

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "pending")}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-6">All Plans</TabsTrigger>
          <TabsTrigger value="pending" className="text-xs h-6">Pending Payments</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !filteredPlans?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {filter === "pending" ? "No plans with pending payments." : "No monthly plans yet. Create one to block recurring slots."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPlans.map((plan) => (
            <PlanListCard
              key={plan.id}
              plan={plan as any}
              resource={resources?.find((r) => r.id === plan.resource_id)}
              participants={(plan as any).plan_participants ?? []}
              onDeactivate={(id) => deactivateMutation.mutate(id)}
              onUpdateParticipantStatus={(participantId, status) =>
                updateParticipantStatusMutation.mutate({ participantId, status })
              }
              onEdit={canEdit ? () => openEditDialog(plan) : undefined}
              isPending={deactivateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Wizard Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlanId ? "Edit Monthly Plan" : "Create Monthly Plan"}</DialogTitle>
            <div className="pt-2 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                {STEP_LABELS.map((label, i) => (
                  <span key={i} className={i === step ? "text-primary font-medium" : ""}>{label}</span>
                ))}
              </div>
              <Progress value={((step + 1) / 3) * 100} className="h-1.5" />
            </div>
          </DialogHeader>

          <div className="py-2">
            {step === 0 && (
              <PlanWizardStep1
                planType={planType} setPlanType={setPlanType}
                customerName={customerName} setCustomerName={setCustomerName}
                customerPhone={customerPhone} setCustomerPhone={setCustomerPhone}
                groupName={groupName} setGroupName={setGroupName}
                leaderName={leaderName} setLeaderName={setLeaderName}
                resourceId={resourceId} setResourceId={setResourceId}
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                slotTime={slotTime} setSlotTime={setSlotTime}
                duration={duration} setDuration={setDuration}
                daysOfWeek={daysOfWeek} toggleDay={toggleDay}
                notes={notes} setNotes={setNotes}
                resources={resources ?? []}
              />
            )}
            {step === 1 && (
              <PlanWizardStep2
                planType={planType}
                groupName={groupName}
                leaderName={leaderName}
                totalAmount={totalAmount}
                setTotalAmount={setTotalAmount}
                participants={participants}
                setParticipants={setParticipants}
              />
            )}
            {step === 2 && (
              <PlanWizardStep3
                planType={planType}
                customerName={customerName}
                customerPhone={customerPhone}
                groupName={groupName}
                leaderName={leaderName}
                resourceId={resourceId}
                resources={resources ?? []}
                startDate={startDate}
                endDate={endDate}
                slotTime={slotTime}
                duration={duration}
                daysOfWeek={daysOfWeek}
                notes={notes}
                totalAmount={totalAmount}
                participants={participants}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {step < 2 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 ? !isStep1Valid : !isStep2Valid}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : editingPlanId ? (
              <Button onClick={() => updateMutation.mutate()} disabled={!canSubmit || updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Update Plan
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Create Plan
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
