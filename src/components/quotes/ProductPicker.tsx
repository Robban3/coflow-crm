import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Plus, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Product {
  id: string;
  name: string;
  description: string | null;
  unit_price: number;
  unit: string;
  vat_rate: number;
}

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
}

export function ProductPicker({ onSelect, onClose }: ProductPickerProps) {
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New product form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [newUnit, setNewUnit] = useState("st");
  const [newVat, setNewVat] = useState(25);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setProducts(
        data.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          unit_price: Number(p.unit_price),
          unit: p.unit || "st",
          vat_rate: Number(p.vat_rate) || 25,
        }))
      );
    }
    setLoading(false);
  };

  const resetForm = () => {
    setNewName("");
    setNewDesc("");
    setNewPrice(0);
    setNewUnit("st");
    setNewVat(25);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setNewName(p.name);
    setNewDesc(p.description || "");
    setNewPrice(p.unit_price);
    setNewUnit(p.unit);
    setNewVat(p.vat_rate);
    setShowCreate(true);
  };

  const deleteProduct = async (p: Product) => {
    if (!window.confirm(t("quotes.deleteConfirm", { name: p.name }))) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error(t("quotes.couldNotDeleteProduct"));
      return;
    }
    toast.success(t("quotes.productDeleted"));
    setProducts((prev) => prev.filter((x) => x.id !== p.id));
  };

  const saveProduct = async () => {
    if (!newName.trim() || !organizationId || !user) return;

    // Edit mode: update in place, refresh the list, stay in the picker.
    if (editingId) {
      const { error } = await supabase
        .from("products")
        .update({
          name: newName,
          description: newDesc || null,
          unit_price: newPrice,
          unit: newUnit,
          vat_rate: newVat,
        })
        .eq("id", editingId);

      if (error) {
        toast.error(t("quotes.couldNotSaveProduct"));
        return;
      }
      toast.success(t("quotes.productUpdated"));
      setShowCreate(false);
      setEditingId(null);
      resetForm();
      fetchProducts();
      return;
    }

    // Create mode: insert and add straight to the quote/offer.
    const { data, error } = await supabase
      .from("products")
      .insert({
        name: newName,
        description: newDesc || null,
        unit_price: newPrice,
        unit: newUnit,
        vat_rate: newVat,
        organization_id: organizationId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(t("quotes.couldNotCreateProduct"));
      return;
    }
    toast.success(t("quotes.productCreated"));
    onSelect({
      id: data.id,
      name: data.name,
      description: data.description,
      unit_price: Number(data.unit_price),
      unit: data.unit || "st",
      vat_rate: Number(data.vat_rate) || 25,
    });
  };

  const filtered = products.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{showCreate ? (editingId ? t("quotes.editProduct") : t("quotes.createNewProduct")) : t("quotes.selectProductService")}</DialogTitle>
        </DialogHeader>

        {!showCreate ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("quotes.searchCatalog")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {loading ? (
                <p className="text-center py-4 text-muted-foreground text-sm">{t("quotes.loading")}</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">{t("quotes.noProductsFound")}</p>
                </div>
              ) : (
                filtered.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 px-2 py-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <button
                      onClick={() => onSelect(p)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{p.name}</p>
                          {p.description && (
                            <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                          )}
                        </div>
                        <span className="text-sm font-medium whitespace-nowrap">
                          {p.unit_price.toLocaleString(numberLocale)} kr/{p.unit}
                        </span>
                      </div>
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      title={t("quotes.editProduct")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(p)}
                      title={t("quotes.deleteProduct")}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-background shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setEditingId(null); resetForm(); setShowCreate(true); }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("quotes.createNewProduct")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>{t("quotes.name")}</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("quotes.productName")} />
            </div>
            <div>
              <Label>{t("quotes.description")}</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t("quotes.optionalDescription")} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>{t("quotes.price")}</Label>
                <Input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} min={0} />
              </div>
              <div>
                <Label>{t("quotes.unit")}</Label>
                <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </div>
              <div>
                <Label>{t("quotes.vat")}</Label>
                <Input type="number" value={newVat} onChange={(e) => setNewVat(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); resetForm(); }} className="flex-1">
                {t("quotes.back")}
              </Button>
              <Button onClick={saveProduct} className="flex-1" disabled={!newName.trim()}>
                {editingId ? t("quotes.saveChanges") : t("quotes.createAndAdd")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
