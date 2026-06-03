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
import { Search, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

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

  const createProduct = async () => {
    if (!newName.trim() || !organizationId || !user) return;
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
      toast.error("Kunde inte skapa produkt");
      return;
    }
    toast.success("Produkt skapad!");
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
          <DialogTitle>Välj produkt/tjänst</DialogTitle>
        </DialogHeader>

        {!showCreate ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök i katalogen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {loading ? (
                <p className="text-center py-4 text-muted-foreground text-sm">Laddar...</p>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground text-sm">Inga produkter hittades</p>
                </div>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSelect(p)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium whitespace-nowrap ml-4">
                        {p.unit_price.toLocaleString("sv-SE")} kr/{p.unit}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Skapa ny produkt
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Namn</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Produktnamn" />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Valfri beskrivning" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Pris</Label>
                <Input type="number" value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} min={0} />
              </div>
              <div>
                <Label>Enhet</Label>
                <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
              </div>
              <div>
                <Label>Moms %</Label>
                <Input type="number" value={newVat} onChange={(e) => setNewVat(Number(e.target.value))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">
                Tillbaka
              </Button>
              <Button onClick={createProduct} className="flex-1" disabled={!newName.trim()}>
                Skapa & lägg till
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
