import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const { session, primaryRole, centerId, rolesLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  // Redirect if user already has a role and center
  useEffect(() => {
    if (!rolesLoading && primaryRole && centerId) {
      navigate("/dashboard", { replace: true });
    }
  }, [rolesLoading, primaryRole, centerId, navigate]);
  const [centerName, setCenterName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerName.trim()) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("setup-center", {
        body: {
          center_name: centerName,
          center_phone: phone,
          center_email: email,
          center_address: address,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Center created! Welcome aboard.");
      // Force auth context to reload roles
      window.location.href = "/dashboard";
    } catch (err: any) {
      toast.error(err.message || "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome to EasySlot
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            Set up your center to get started. You'll be assigned as the admin.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Create Your Center</CardTitle>
            <CardDescription>
              Enter your center details below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="center-name">Center Name *</Label>
                <Input
                  id="center-name"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  placeholder="e.g. Downtown Sports Hub"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="center-phone">Phone</Label>
                <Input
                  id="center-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="center-email">Email</Label>
                <Input
                  id="center-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@center.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="center-address">Address</Label>
                <Input
                  id="center-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !centerName.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Center & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
