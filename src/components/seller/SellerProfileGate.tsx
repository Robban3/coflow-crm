import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { SellerProfileForm, EMPTY_SELLER_PROFILE, type SellerProfileValues } from "./SellerProfileForm";

// Mandatory, non-dismissable first-login popup for sellers. Mounted once in
// AppLayout; only renders when a seller has no profile yet.
export function SellerProfileGate() {
  const { user } = useAuth();
  const { needsSellerProfile, saving, save } = useSellerProfile();
  const { toast } = useToast();

  if (!needsSellerProfile) return null;

  const initial: SellerProfileValues = {
    ...EMPTY_SELLER_PROFILE,
    applabbet_email: user?.email ?? "",
  };

  const handleSave = async (values: SellerProfileValues) => {
    const { error } = await save(values);
    if (error) {
      toast({ title: "Kunde inte spara", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Tack!", description: "Dina uppgifter är sparade." });
  };

  return (
    <Dialog open onOpenChange={() => { /* blocking: cannot be dismissed */ }}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Välkommen! Fyll i dina uppgifter</DialogTitle>
          <DialogDescription>
            Innan du fortsätter behöver vi dina uppgifter. De är privata och syns bara
            för dig och administratörer. Du kan ändra dem senare under Inställningar.
          </DialogDescription>
        </DialogHeader>
        <SellerProfileForm
          initial={initial}
          saving={saving}
          submitLabel="Spara och fortsätt"
          onSave={handleSave}
          lockApplabbetEmail
        />
      </DialogContent>
    </Dialog>
  );
}
