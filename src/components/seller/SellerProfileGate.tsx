import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

  // Playful nudge that pops up right where the seller clicks when they try to
  // dismiss the blocking popup by clicking outside it.
  const [nudge, setNudge] = useState<{ x: number; y: number; key: number } | null>(null);

  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => setNudge(null), 2200);
    return () => clearTimeout(timer);
  }, [nudge]);

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
    <>
    <Dialog open onOpenChange={() => { /* blocking: cannot be dismissed */ }}>
      <DialogContent
        className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto [&>button]:hidden"
        onInteractOutside={(e) => {
          e.preventDefault();
          const originalEvent = (e.detail as { originalEvent?: { clientX?: number; clientY?: number } } | undefined)?.originalEvent;
          const rawX = originalEvent?.clientX ?? window.innerWidth / 2;
          const rawY = originalEvent?.clientY ?? window.innerHeight / 2;
          // Keep the bubble inside the viewport (it's anchored above the click).
          const x = Math.min(Math.max(rawX, 12), window.innerWidth - 12);
          const y = Math.max(rawY, 64);
          setNudge({ x, y, key: (nudge?.key ?? 0) + 1 });
        }}
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

      {nudge && createPortal(
        <div
          key={nudge.key}
          className="fixed -translate-x-1/2 -translate-y-full -mt-2 pointer-events-none rounded-lg border bg-background px-4 py-2 shadow-xl text-sm font-semibold text-center whitespace-nowrap"
          style={{ left: nudge.x, top: nudge.y, zIndex: 2147483647 }}
        >
          Försök inte! Fyll i alla uppgifter!
          <br />
          <span className="text-muted-foreground">😊 Robban och Oliver 😊</span>
        </div>,
        document.body,
      )}
    </>
  );
}
