import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

export interface Participant {
  id: string;
  name: string;
  phone: string;
  amount: number;
  payment_status: string;
}

interface Step2Props {
  planType: string;
  groupName: string;
  leaderName: string;
  totalAmount: number;
  setTotalAmount: (v: number) => void;
  participants: Participant[];
  setParticipants: (p: Participant[]) => void;
}

export default function PlanWizardStep2({
  planType, groupName, leaderName,
  totalAmount, setTotalAmount,
  participants, setParticipants,
}: Step2Props) {
  const addParticipant = () => {
    setParticipants([
      { id: crypto.randomUUID(), name: "", phone: "", amount: 0, payment_status: "pending" },
      ...participants,
    ]);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const updateParticipant = (id: string, field: keyof Participant, value: string | number) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  if (planType === "group") {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-muted/50 border p-3">
          <p className="text-sm font-medium">{groupName || "Unnamed Group"}</p>
          <p className="text-xs text-muted-foreground">Leader Phone: {leaderName || "—"}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Total Amount (₹) *</Label>
          <Input
            type="number"
            min={0}
            value={totalAmount || ""}
            onChange={(e) => setTotalAmount(Number(e.target.value))}
            placeholder="Total plan amount"
          />
        </div>
      </div>
    );
  }

  const calculatedTotal = participants.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Participants ({participants.length})</Label>
        <Button type="button" variant="outline" size="sm" onClick={addParticipant} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Add Player
        </Button>
      </div>

      {participants.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No participants added yet. Click "Add Player" to begin.</p>
      )}

      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {participants.map((p, idx) => (
          <div key={p.id} className="border rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Player {participants.length - idx}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                onClick={() => removeParticipant(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Name"
                value={p.name}
                onChange={(e) => updateParticipant(p.id, "name", e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Phone"
                value={p.phone}
                onChange={(e) => updateParticipant(p.id, "phone", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Amount (₹)"
                value={p.amount || ""}
                onChange={(e) => updateParticipant(p.id, "amount", Number(e.target.value))}
                className="h-8 text-xs"
              />
              <Select value={p.payment_status} onValueChange={(v) => updateParticipant(p.id, "payment_status", v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>

      {participants.length > 0 && (
        <div className="rounded-md bg-muted/50 border p-3 text-sm">
          <p className="font-medium">Total: ₹{calculatedTotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">
            Paid: ₹{participants.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.amount, 0).toLocaleString()} · 
            Pending: ₹{participants.filter(p => p.payment_status !== "paid").reduce((s, p) => s + p.amount, 0).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
