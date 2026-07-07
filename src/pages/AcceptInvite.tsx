import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error" | "login-required">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setStatus("error");
      setMessage("No invitation token provided.");
      return;
    }
    if (!session) {
      setStatus("login-required");
      return;
    }
    acceptInvitation();
  }, [token, session, authLoading]);

  const acceptInvitation = async () => {
    setStatus("accepting");
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", {
        body: { token },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setStatus("success");
      setMessage(`You've been assigned the ${data.role} role. Redirecting to dashboard...`);
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to accept invitation.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Accept Invitation</CardTitle>
          <CardDescription>You've been invited to join a center</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {(status === "loading" || status === "accepting") && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">
                {status === "loading" ? "Loading..." : "Accepting invitation..."}
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 text-green-600" />
              <p className="text-center text-foreground">{message}</p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-center text-destructive">{message}</p>
              <Button variant="outline" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </>
          )}

          {status === "login-required" && (
            <>
              <Mail className="h-10 w-10 text-primary" />
              <p className="text-center text-muted-foreground">
                Please sign in or create an account to accept this invitation.
              </p>
              <Button onClick={() => navigate(`/login?redirect=/accept-invite?token=${token}`)}>
                Sign In
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
