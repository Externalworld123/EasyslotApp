import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SubmitFeedback() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["feedback-session", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("sessions")
        .select("id, customer_name, center_id, status, resources!inner(name), centers!inner(name)")
        .eq("id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Check if feedback already exists
  const { data: existing } = useQuery({
    queryKey: ["existing-feedback", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await supabase
        .from("feedback")
        .select("id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!session || !rating) throw new Error("Please select a rating");
      const { error } = await supabase.from("feedback").insert({
        session_id: session.id,
        center_id: session.center_id,
        rating,
        comment: comment.trim() || null,
        customer_name: session.customer_name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Thank you for your feedback!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Skeleton className="h-64 w-full max-w-md rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-4">
        <Clock className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Session Not Found</h1>
        <p className="text-muted-foreground text-center">This feedback link is invalid or expired.</p>
      </div>
    );
  }

  if (existing || submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-4">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <h1 className="text-xl font-bold text-foreground">Thank You!</h1>
        <p className="text-muted-foreground text-center">Your feedback has been recorded.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Rate Your Experience</CardTitle>
          <CardDescription>
            {(session.resources as any)?.name} at {(session.centers as any)?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Star rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={cn(
                    "h-10 w-10 transition-colors",
                    (hoveredRating || rating) >= star
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              {rating === 1 && "Poor"}
              {rating === 2 && "Fair"}
              {rating === 3 && "Good"}
              {rating === 4 && "Great"}
              {rating === 5 && "Excellent"}
            </p>
          )}

          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!rating || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Submit Feedback
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
