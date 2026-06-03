import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";

const BATCH_SIZE = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: find value by trying multiple column name variants
function getVal(r: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
  }
  const rKeys = Object.keys(r);
  for (const k of keys) {
    const found = rKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
    if (found && r[found]) return r[found];
  }
  return null;
}

function mapRow(r: Record<string, string>) {
  return {
    company_name: getVal(r, "Företagsnamn", "Foretagsnamn", "company_name", "CompanyName") || "",
    org_number: getVal(r, "Org nr", "Org.nr", "Orgnr", "org_number", "OrgNumber") || "",
    company_form: getVal(r, "Bolagsform", "company_form"),
    registration_date: getVal(r, "Reg Datum", "Reg datum", "registration_date"),
    legal_form: getVal(r, "Juridisk form", "legal_form"),
    address: getVal(r, "Adress", "address"),
    co_address: getVal(r, "C/o-adress", "Co-adress", "co_address"),
    postal_code: getVal(r, "Postnummer", "postal_code"),
    city: getVal(r, "Postort", "city"),
    country: getVal(r, "Land", "country"),
    phone: getVal(r, "Telefonnummer", "Telefon", "phone"),
    sni_codes: getVal(r, "SNI-koder", "SNI koder", "sni_codes"),
    sni_descriptions: getVal(r, "SNI-beskrivningar", "SNI beskrivningar", "sni_descriptions"),
  };
}

export function CompanyRegistryUpload() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [stats, setStats] = useState<{ total: number; inserted: number; errors: number } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setStats(null);
    setStatusText("Läser fil...");

    const text = await file.text();

    // Auto-detect delimiter
    const firstLine = text.split("\n")[0] || "";
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let detectedDelimiter = ",";
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      detectedDelimiter = ";";
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      detectedDelimiter = "\t";
    }

    console.log(`Detected delimiter: "${detectedDelimiter}" (commas: ${commaCount}, semicolons: ${semicolonCount}, tabs: ${tabCount})`);

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: detectedDelimiter,
    });

    const rows = parsed.data as Record<string, string>[];

    if (rows.length > 0) {
      console.log("First row keys:", Object.keys(rows[0]));
      console.log("First row sample:", JSON.stringify(rows[0]).substring(0, 500));
    }

    if (rows.length === 0) {
      toast({ title: "Tom fil", description: "Ingen data hittades i filen", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    // Map all rows first
    setStatusText("Bearbetar rader...");
    const mapped = rows.map(mapRow).filter(r => r.company_name && r.org_number);

    if (mapped.length === 0) {
      toast({ title: "Ingen giltig data", description: "Inga rader kunde mappas. Kontrollera kolumnnamnen.", variant: "destructive" });
      setIsUploading(false);
      return;
    }

    const totalRows = mapped.length;
    let totalInserted = 0;
    let totalErrors = 0;
    const batches = Math.ceil(totalRows / BATCH_SIZE);

    setStatusText(`Laddar upp ${totalRows.toLocaleString("sv-SE")} företag i ${batches} batchar...`);

    for (let i = 0; i < batches; i++) {
      const batch = mapped.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

      const { error } = await supabase
        .from("company_registry")
        .upsert(batch, { onConflict: "org_number" });

      if (error) {
        console.error(`Batch ${i + 1}/${batches} error:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += batch.length;
      }

      const pct = Math.round(((i + 1) / batches) * 100);
      setProgress(pct);
      setStatusText(`Batch ${i + 1}/${batches} — ${totalInserted.toLocaleString("sv-SE")} uppladdade`);

      // Yield to UI thread
      if (i < batches - 1) await delay(50);
    }

    setStats({ total: totalRows, inserted: totalInserted, errors: totalErrors });
    setStatusText("");
    setIsUploading(false);

    toast({
      title: "Uppladdning klar",
      description: `${totalInserted.toLocaleString("sv-SE")} av ${totalRows.toLocaleString("sv-SE")} företag laddades upp`,
    });

    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="h-4 w-4" />
          Ladda upp företagsregister (Admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ladda upp en CSV-fil med svenska företag. Dubbletter uppdateras automatiskt baserat på organisationsnummer.
        </p>

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            variant="outline"
          >
            <FileText className="h-4 w-4 mr-2" />
            Välj CSV-fil
          </Button>
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </div>
        )}

        {stats && (
          <div className="flex items-center gap-2 text-sm">
            {stats.errors === 0 ? (
              <CheckCircle className="h-4 w-4 text-primary" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
            <span>
              {stats.inserted.toLocaleString("sv-SE")} av {stats.total.toLocaleString("sv-SE")} företag laddades upp.
              {stats.errors > 0 && ` ${stats.errors.toLocaleString("sv-SE")} fel.`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
