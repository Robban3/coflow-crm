import { useTranslation } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { type DocumentBlock, type ArticleTableBlockConfig, type ArticleRow } from "./types";
import { calculateRowTotal } from "./totals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileText } from "lucide-react";
import { ProductPicker } from "@/components/quotes/ProductPicker";

interface Props {
  block: DocumentBlock;
  readOnly?: boolean;
  structureLocked?: boolean;
  onChange?: (config: DocumentBlock["config"]) => void;
}

function newRow(): ArticleRow {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    qty: 1,
    unit: "st",
    unit_price: 0,
    discount: 0,
    vat_rate: 25,
  };
}

export function ArticleTableBlockRenderer({ block, readOnly, onChange }: Props) {
  const { t } = useTranslation();
  const config = block.config as ArticleTableBlockConfig;
  const rows = config.rows || [];
  const [showProductPicker, setShowProductPicker] = useState(false);

  const updateRow = (idx: number, partial: Partial<ArticleRow>) => {
    const updated = rows.map((r, i) => (i === idx ? { ...r, ...partial } : r));
    onChange?.({ ...config, rows: updated });
  };

  const addRow = () => {
    onChange?.({ ...config, rows: [...rows, newRow()] });
  };

  const removeRow = (idx: number) => {
    onChange?.({ ...config, rows: rows.filter((_, i) => i !== idx) });
  };

  const handleProductSelect = (product: { name: string; description: string | null; unit_price: number; unit: string; vat_rate: number }) => {
    const row: ArticleRow = {
      id: crypto.randomUUID(),
      title: product.name,
      description: product.description || "",
      qty: 1,
      unit: product.unit,
      unit_price: product.unit_price,
      discount: 0,
      vat_rate: product.vat_rate,
    };
    onChange?.({ ...config, rows: [...rows, row] });
    setShowProductPicker(false);
  };

  const subtotal = rows.reduce((sum, r) => sum + calculateRowTotal(r), 0);
  const vatTotal = config.show_vat
    ? rows.reduce(
        (sum, r) => sum + calculateRowTotal(r) * ((r.vat_rate || 0) / 100),
        0
      )
    : 0;

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-2 font-medium text-muted-foreground">{t("quotes.colDescription")}</th>
              <th className="py-2 px-2 font-medium text-muted-foreground w-16 text-right">{t("quotes.colQuantity")}</th>
              <th className="py-2 px-2 font-medium text-muted-foreground w-16 text-center">{t("quotes.colUnit")}</th>
              <th className="py-2 px-2 font-medium text-muted-foreground w-24 text-right">{t("quotes.colUnitPrice")}</th>
              <th className="py-2 px-2 font-medium text-muted-foreground w-16 text-right">{t("quotes.colDiscountShort")}</th>
              {config.show_vat && (
                <th className="py-2 px-2 font-medium text-muted-foreground w-16 text-right">{t("quotes.vat")}</th>
              )}
              <th className="py-2 px-2 font-medium text-muted-foreground w-24 text-right">{t("quotes.colTotal")}</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b border-border/50">
                <td className="py-1.5 pr-2">
                  {readOnly ? (
                    <div>
                      <div className="font-medium">{row.title}</div>
                      {row.description && (
                        <div className="text-xs text-muted-foreground">{row.description}</div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Input
                        value={row.title}
                        placeholder={t("templates.artTitle")}
                        className="h-7 text-sm"
                        onChange={(e) => updateRow(idx, { title: e.target.value })}
                      />
                      <Input
                        value={row.description}
                        placeholder={t("templates.artDescOptional")}
                        className="h-7 text-xs"
                        onChange={(e) => updateRow(idx, { description: e.target.value })}
                      />
                    </div>
                  )}
                </td>
                <td className="py-1.5 px-2 text-right">
                  {readOnly ? (
                    row.qty
                  ) : (
                    <Input
                      type="number"
                      value={row.qty}
                      className="h-7 text-sm text-right w-16"
                      onChange={(e) => updateRow(idx, { qty: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 text-center">
                  {readOnly ? (
                    row.unit
                  ) : (
                    <Input
                      value={row.unit}
                      className="h-7 text-sm text-center w-16"
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 text-right">
                  {readOnly ? (
                    `${row.unit_price.toLocaleString("sv-SE")} kr`
                  ) : (
                    <Input
                      type="number"
                      value={row.unit_price}
                      className="h-7 text-sm text-right w-24"
                      onChange={(e) => updateRow(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                </td>
                <td className="py-1.5 px-2 text-right">
                  {readOnly ? (
                    row.discount ? `${row.discount}%` : "–"
                  ) : (
                    <Input
                      type="number"
                      value={row.discount}
                      className="h-7 text-sm text-right w-16"
                      onChange={(e) => updateRow(idx, { discount: parseFloat(e.target.value) || 0 })}
                    />
                  )}
                </td>
                {config.show_vat && (
                  <td className="py-1.5 px-2 text-right">
                    {readOnly ? (
                      `${row.vat_rate}%`
                    ) : (
                      <Input
                        type="number"
                        value={row.vat_rate}
                        className="h-7 text-sm text-right w-16"
                        onChange={(e) => updateRow(idx, { vat_rate: parseFloat(e.target.value) || 0 })}
                      />
                    )}
                  </td>
                )}
                <td className="py-1.5 px-2 text-right font-medium">
                  {calculateRowTotal(row).toLocaleString("sv-SE")} kr
                </td>
                {!readOnly && (
                  <td className="py-1.5 pl-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5 mr-1" /> {t("quotes.addRow")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowProductPicker(true)}>
            <FileText className="h-3.5 w-3.5 mr-1" /> {t("quotes.fromCatalog")}
          </Button>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <div className="text-sm space-y-1 text-right">
          <div className="flex justify-between gap-8">
            <span className="text-muted-foreground">{t("quotes.subtotalColon")}</span>
            <span className="font-medium">{subtotal.toLocaleString("sv-SE")} kr</span>
          </div>
          {config.show_vat && (
            <div className="flex justify-between gap-8">
              <span className="text-muted-foreground">{t("quotes.vatColon")}</span>
              <span className="font-medium">{Math.round(vatTotal * 100 / 100).toLocaleString("sv-SE")} kr</span>
            </div>
          )}
          <div className="flex justify-between gap-8 border-t border-border pt-1">
            <span className="font-semibold">{t("quotes.totalColon")}</span>
            <span className="font-bold">{(subtotal + vatTotal).toLocaleString("sv-SE")} kr</span>
          </div>
        </div>
      </div>

      {showProductPicker && (
        <ProductPicker
          onSelect={handleProductSelect}
          onClose={() => setShowProductPicker(false)}
        />
      )}
    </div>
  );
}
