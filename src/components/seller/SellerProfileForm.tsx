import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";

export type CompanyForm = "enskild_firma" | "aktiebolag" | "extern_tjanst";

export interface SellerProfileValues {
  first_name: string;
  last_name: string;
  applabbet_email: string;
  external_email: string;
  address: string;
  postal_code: string;
  city: string;
  personnummer: string;
  company_form: CompanyForm | "";
  external_service_name: string;
}

export const EMPTY_SELLER_PROFILE: SellerProfileValues = {
  first_name: "",
  last_name: "",
  applabbet_email: "",
  external_email: "",
  address: "",
  postal_code: "",
  city: "",
  personnummer: "",
  company_form: "",
  external_service_name: "",
};

const REQUIRED: (keyof SellerProfileValues)[] = [
  "first_name",
  "last_name",
  "applabbet_email",
  "external_email",
  "address",
  "postal_code",
  "city",
  "personnummer",
  "company_form",
];

interface Props {
  initial: SellerProfileValues;
  saving: boolean;
  submitLabel: string;
  onSave: (values: SellerProfileValues) => void;
  /** When set, the applabbet email is locked (prefilled from the login). */
  lockApplabbetEmail?: boolean;
}

export function SellerProfileForm({ initial, saving, submitLabel, onSave, lockApplabbetEmail }: Props) {
  const [form, setForm] = useState<SellerProfileValues>(initial);

  const set = (key: keyof SellerProfileValues, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSave = REQUIRED.every((k) => String(form[k]).trim().length > 0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Namn *">
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
        </Field>
        <Field label="Efternamn *">
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        </Field>
      </div>

      <Field label="Applabbet-epost *">
        <Input
          type="email"
          value={form.applabbet_email}
          onChange={(e) => set("applabbet_email", e.target.value)}
          readOnly={lockApplabbetEmail}
          className={lockApplabbetEmail ? "bg-muted cursor-not-allowed" : undefined}
        />
      </Field>

      <Field label="E-post utanför Applabbet *">
        <Input
          type="email"
          value={form.external_email}
          onChange={(e) => set("external_email", e.target.value)}
          placeholder="t.ex. namn@gmail.com"
        />
      </Field>

      <Field label="Adress *">
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Postnummer *">
          <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
        </Field>
        <Field label="Postort *">
          <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
      </div>

      <Field label="Personnummer *">
        <Input
          value={form.personnummer}
          onChange={(e) => set("personnummer", e.target.value)}
          placeholder="ÅÅÅÅMMDD-XXXX"
        />
      </Field>

      <div className="space-y-2">
        <Label className="text-sm">Bolagsform *</Label>
        <RadioGroup
          value={form.company_form}
          onValueChange={(v) => set("company_form", v)}
          className="gap-2"
        >
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="enskild_firma" /> Enskild firma
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="aktiebolag" /> Aktiebolag
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <RadioGroupItem value="extern_tjanst" /> Extern tjänst (t.ex. frilans/Finans)
          </label>
        </RadioGroup>
      </div>

      {form.company_form === "extern_tjanst" && (
        <Field label="Vilken extern tjänst? (valfritt)">
          <Input
            value={form.external_service_name}
            onChange={(e) => set("external_service_name", e.target.value)}
            placeholder="t.ex. Frilans Finans"
          />
        </Field>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={() => onSave(form)} disabled={!canSave || saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sparar…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
