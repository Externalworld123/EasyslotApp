import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization, usePlans, useCreateOrganization, useUpdateOrganization, useOrganizationCenters } from "@/hooks/useOrganization";
import { openRazorpayCheckout } from "@/lib/razorpay";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Users, Layers, CreditCard, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const BILLING_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  trialing: "bg-blue-500/10 text-blue-700 border-blue-200",
  past_due: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  cancelled: "bg-red-500/10 text-red-700 border-red-200",
};

export default function Organization() {
  const { user } = useAuth();
  const { organization, isLoading } = useOrganization();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: centers } = useOrganizationCenters(organization?.id);
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();

  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [payingPlanId, setPayingPlanId] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleSubscribe = async (plan: any) => {
    if (!organization) return;
    if (Number(plan.price_monthly) <= 0) {
      toast.error("This plan has no price configured");
      return;
    }
    setPayingPlanId(plan.id);
    try {
      await openRazorpayCheckout({
        amount: Number(plan.price_monthly),
        name: "EasySlot",
        description: `${plan.name} subscription`,
        prefill: { email: user?.email || undefined },
        verifyContext: {
          purpose: "subscription",
          organization_id: organization.id,
        },
        notes: { plan_id: plan.id, plan_name: plan.name, org_id: organization.id },
      });
      // Update plan_id on success
      await updateOrg.mutateAsync({ id: organization.id, plan_id: plan.id });
      toast.success(`Subscribed to ${plan.name}!`);
      qc.invalidateQueries({ queryKey: ["organization"] });
    } catch (e: any) {
      if (e.message !== "Payment cancelled") toast.error(e.message || "Payment failed");
    } finally {
      setPayingPlanId(null);
    }
  };

  const handleCreateOrg = async () => {
    await createOrg.mutateAsync({ name: newOrgName, slug: newOrgSlug });
    setShowCreate(false);
    setNewOrgName("");
    setNewOrgSlug("");
  };

  const currentPlan = plans?.find((p) => p.id === organization?.plan_id);

  if (isLoading || plansLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader className="text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle className="mt-4">Create Your Organization</CardTitle>
            <CardDescription>
              Get started by creating an organization to manage your sports centers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button className="mx-auto block">Create Organization</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Organization</DialogTitle>
                  <DialogDescription>
                    Create an organization to manage multiple centers
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Organization Name</Label>
                    <Input
                      id="name"
                      value={newOrgName}
                      onChange={(e) => {
                        setNewOrgName(e.target.value);
                        setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                      }}
                      placeholder="Acme Sports"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">URL Slug</Label>
                    <Input
                      id="slug"
                      value={newOrgSlug}
                      onChange={(e) => setNewOrgSlug(e.target.value)}
                      placeholder="acme-sports"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your booking URL: yourapp.com/book/{newOrgSlug || "your-slug"}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateOrg}
                    disabled={!newOrgName || !newOrgSlug || createOrg.isPending}
                  >
                    {createOrg.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Plans Preview */}
        <h2 className="mb-4 mt-8 text-xl font-semibold">Available Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => (
            <Card key={plan.id} className={plan.name === "Pro" ? "border-primary ring-1 ring-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.name === "Pro" && (
                    <Badge variant="default">Popular</Badge>
                  )}
                </div>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    ${plan.price_monthly}
                  </span>
                  /month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_centers} centers
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_resources} resources
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_users} users
                  </div>
                </div>
                <div className="space-y-1">
                  {(plan.features as string[]).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                      {feature}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{organization.name}</h1>
        <p className="text-muted-foreground">Manage your organization settings and subscription</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Organization Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{organization.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">URL Slug</Label>
                <p className="font-medium">{organization.slug}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  <Badge className={BILLING_STATUS_COLORS[organization.billing_status]}>
                    {organization.billing_status}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Centers</Label>
                <p className="font-medium">{centers?.length || 0} / {currentPlan?.max_centers || "∞"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentPlan ? (
              <div className="space-y-4">
                <div>
                  <p className="text-2xl font-bold">{currentPlan.name}</p>
                  <p className="text-muted-foreground">
                    ${currentPlan.price_monthly}/month
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Centers</span>
                    <span>{centers?.length || 0} / {currentPlan.max_centers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resources</span>
                    <span>- / {currentPlan.max_resources}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Users</span>
                    <span>- / {currentPlan.max_users}</span>
                  </div>
                </div>
                <Button variant="outline" className="w-full" disabled>
                  Upgrade Plan (Coming Soon)
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground">No plan selected</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plans Comparison */}
      <h2 className="mb-4 mt-8 text-xl font-semibold">Upgrade Your Plan</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = plan.id === organization.plan_id;
          return (
            <Card
              key={plan.id}
              className={
                isCurrent
                  ? "border-primary bg-primary/5"
                  : plan.name === "Pro"
                  ? "border-primary/50"
                  : ""
              }
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                  {!isCurrent && plan.name === "Pro" && (
                    <Badge variant="secondary">Popular</Badge>
                  )}
                </div>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    ${plan.price_monthly}
                  </span>
                  /month
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_centers} centers
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_resources} resources
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Up to {plan.max_users} users
                  </div>
                </div>
                <Button
                  variant={isCurrent ? "secondary" : "default"}
                  className="w-full"
                  disabled={isCurrent || payingPlanId === plan.id || Number(plan.price_monthly) <= 0}
                  onClick={() => handleSubscribe(plan)}
                >
                  {payingPlanId === plan.id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {isCurrent ? "Current Plan" : Number(plan.price_monthly) > 0 ? "Subscribe" : "Free"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
