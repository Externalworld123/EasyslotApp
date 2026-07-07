import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Upload, ClipboardPaste, Download, CheckCircle, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ParsedCenter {
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  valid: boolean;
  error?: string;
}

const generateSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

function parseCsvRows(text: string): ParsedCenter[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return [];

  // Detect header row
  const firstLine = lines[0].toLowerCase();
  const hasHeader = firstLine.includes("name") || firstLine.includes("city");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Support comma or tab separated
    const cols = line.includes("\t") ? line.split("\t") : line.split(",");
    const [name, city, address, phone, email] = cols.map((c) => c?.trim().replace(/^"|"$/g, "") || "");

    if (!name) return { name, city, address, phone, email, valid: false, error: "Name is required" };
    if (!city) return { name, city, address, phone, email, valid: false, error: "City is required" };

    return { name, city, address, phone, email, valid: true };
  });
}

const CSV_TEMPLATE = "Name,City,Address,Phone,Email\nSports Arena,Mumbai,123 Main St,+91 98765 43210,info@arena.com\nTurf Zone,Delhi,456 Park Road,,";

export default function BulkCenterImport({ orgId }: { orgId?: string }) {
  const [mode, setMode] = useState<"upload" | "paste">("paste");
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ParsedCenter[]>([]);
  const [step, setStep] = useState<"input" | "preview">("input");
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsvRows(text);
      setParsed(rows);
      setStep("preview");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePaste = () => {
    if (!pasteText.trim()) { toast.error("Paste some data first"); return; }
    const rows = parseCsvRows(pasteText);
    setParsed(rows);
    setStep("preview");
  };

  const validRows = parsed.filter((r) => r.valid);
  const invalidRows = parsed.filter((r) => !r.valid);

  const importMutation = useMutation({
    mutationFn: async () => {
      const inserts = validRows.map((r) => ({
        name: r.name,
        city: r.city,
        address: r.address || null,
        phone: r.phone || null,
        email: r.email || null,
        organization_id: orgId || null,
        slug: generateSlug(r.name) + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      }));
      const { error } = await supabase.from("centers").insert(inserts);
      if (error) throw error;
      return inserts.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} center${count !== 1 ? "s" : ""} imported successfully`);
      queryClient.invalidateQueries({ queryKey: ["sa-centers"] });
      queryClient.invalidateQueries({ queryKey: ["public-discover"] });
      setParsed([]);
      setPasteText("");
      setStep("input");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "centers_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (step === "preview") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground">Preview Import</h3>
            <p className="text-xs text-muted-foreground">
              {validRows.length} valid · {invalidRows.length} invalid of {parsed.length} total
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setStep("input"); setParsed([]); }}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
        </div>

        {invalidRows.length > 0 && (
          <Card className="border-destructive/30">
            <CardContent className="p-3 space-y-1">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" /> {invalidRows.length} row(s) with errors (will be skipped)
              </p>
              {invalidRows.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  Row: "{r.name || "(empty)"}" — {r.error}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="rounded-xl border overflow-auto max-h-[300px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">City</th>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Address</th>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Phone</th>
                <th className="text-left p-2 text-xs font-medium text-muted-foreground">Email</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((r, i) => (
                <tr key={i} className={r.valid ? "" : "bg-destructive/5"}>
                  <td className="p-2">
                    {r.valid ? <CheckCircle className="h-4 w-4 text-success" /> : <AlertCircle className="h-4 w-4 text-destructive" />}
                  </td>
                  <td className="p-2 font-medium">{r.name || "—"}</td>
                  <td className="p-2 text-muted-foreground">{r.city || "—"}</td>
                  <td className="p-2 text-muted-foreground text-xs">{r.address || "—"}</td>
                  <td className="p-2 text-muted-foreground text-xs">{r.phone || "—"}</td>
                  <td className="p-2 text-muted-foreground text-xs">{r.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button onClick={() => importMutation.mutate()} disabled={validRows.length === 0 || importMutation.isPending}
          className="w-full">
          {importMutation.isPending ? "Importing..." : `Import ${validRows.length} Center${validRows.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Bulk Import Centers</h3>
          <p className="text-xs text-muted-foreground">Add multiple centers via CSV file or paste</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" /> CSV Template
        </Button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button variant={mode === "paste" ? "default" : "outline"} size="sm" onClick={() => setMode("paste")}
          className="rounded-full">
          <ClipboardPaste className="h-4 w-4 mr-1" /> Paste Data
        </Button>
        <Button variant={mode === "upload" ? "default" : "outline"} size="sm" onClick={() => setMode("upload")}
          className="rounded-full">
          <Upload className="h-4 w-4 mr-1" /> Upload CSV
        </Button>
      </div>

      {mode === "paste" ? (
        <div className="space-y-3">
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Name, City, Address, Phone, Email\nSports Arena, Mumbai, 123 Main St, +91 98765 43210, info@arena.com\nTurf Zone, Delhi, 456 Park Road, ,"}
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Format: Name, City, Address, Phone, Email</Badge>
            <Badge variant="outline" className="text-xs">Tab or comma separated</Badge>
          </div>
          <Button onClick={handlePaste} disabled={!pasteText.trim()}>
            Preview Import
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFileUpload} />
          <Card
            className="border-dashed border-2 cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Click to upload CSV file</p>
                <p className="text-xs text-muted-foreground mt-1">Supports .csv, .tsv, .txt files</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
