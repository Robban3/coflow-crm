import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Car, 
  Phone, 
  RefreshCw, 
  ExternalLink, 
  AlertCircle,
  Clock,
  Building2,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PhoneNumber {
  number: string;
  operator: string | null;
  type: string | null;
}

interface Vehicle {
  model: string;
  regNumber: string | null;
  color: string | null;
  type: string | null;
  year: number | null;
}

interface FleetData {
  id: string;
  lead_id: string;
  org_number: string | null;
  vehicle_count: number | null;
  vehicles: Vehicle[];
  phone_subscription_count: number | null;
  phone_numbers: PhoneNumber[];
  phone_operator: string | null;
  leasing_company: string | null;
  source_url: string | null;
  fetched_at: string;
  raw_data: unknown;
}

interface FleetDataSectionProps {
  leadId: string;
  orgNumber: string | null;
  companyName: string | null;
  onOrgNumberFound?: (orgNumber: string) => void;
  onOrgNumberChange?: () => void;
}

export function FleetDataSection({ 
  leadId, 
  orgNumber, 
  companyName,
  onOrgNumberFound,
  onOrgNumberChange 
}: FleetDataSectionProps) {
  const { toast } = useToast();
  const organizationId = useOrganizationId();
  const [fleetData, setFleetData] = useState<FleetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isLookingUpOrg, setIsLookingUpOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVehicles, setShowVehicles] = useState(false);
  const [showPhones, setShowPhones] = useState(false);

  useEffect(() => {
    fetchStoredData();
  }, [leadId]);

  const fetchStoredData = async () => {
    setIsLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('lead_fleet_data')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (queryError) throw queryError;
      
      if (data) {
        // Parse JSON fields safely
        const parsed: FleetData = {
          ...data,
          vehicles: Array.isArray(data.vehicles) ? (data.vehicles as unknown as Vehicle[]) : [],
          phone_numbers: Array.isArray(data.phone_numbers) ? (data.phone_numbers as unknown as PhoneNumber[]) : [],
        };
        setFleetData(parsed);
      }
    } catch (err) {
      console.error('Error fetching fleet data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupOrgNumber = async () => {
    if (!companyName) {
      toast({
        title: "Saknar företagsnamn",
        description: "Företagsnamn krävs för att söka org-nummer",
        variant: "destructive",
      });
      return;
    }

    setIsLookingUpOrg(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('lookup-org-number', {
        body: { companyName },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        toast({
          title: "Inget org-nummer hittades",
          description: data.error || "Kunde inte hitta organisationsnummer",
          variant: "destructive",
        });
        return;
      }

      // Update the lead with the found org number
      const { error: updateError } = await supabase
        .from('leads')
        .update({ org_number: data.orgNumber })
        .eq('id', leadId);

      if (updateError) throw updateError;

      toast({
        title: "Org-nummer hittat!",
        description: `${data.orgNumber} har sparats`,
      });

      onOrgNumberFound?.(data.orgNumber);
      onOrgNumberChange?.();

    } catch (err) {
      console.error('Error looking up org number:', err);
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel';
      toast({
        title: "Fel vid sökning",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLookingUpOrg(false);
    }
  };

  const handleFetchData = async () => {
    if (!orgNumber && !companyName) {
      toast({
        title: "Saknar sökterm",
        description: "Ange org-nummer eller företagsnamn för att söka",
        variant: "destructive",
      });
      return;
    }

    setIsFetching(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: fnError } = await supabase.functions.invoke('fetch-fleet-data', {
        body: { 
          orgNumber: orgNumber || null,
          companyName: companyName || null,
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setError(data.error || 'Kunde inte hämta data');
        toast({
          title: "Ingen data hittades",
          description: data.error || "Kunde inte hämta fordons- eller telefonidata",
          variant: "destructive",
        });
        return;
      }

      // Upsert the fleet data including new fields
      const fleetDataPayload = {
        lead_id: leadId,
        org_number: orgNumber || null,
        vehicle_count: data.data.vehicleCount,
        vehicles: data.data.vehicles || [],
        phone_subscription_count: data.data.phoneSubscriptionCount,
        phone_numbers: data.data.phoneNumbers || [],
        phone_operator: data.data.phoneOperator,
        leasing_company: data.data.leasingCompany,
        source_url: data.data.sourceUrl,
        raw_data: data.data.rawData,
        fetched_at: new Date().toISOString(),
        fetched_by: user?.id || null,
        organization_id: organizationId,
      };

      const { error: upsertError } = await supabase
        .from('lead_fleet_data')
        .upsert(fleetDataPayload, { 
          onConflict: 'lead_id',
        });

      if (upsertError) throw upsertError;

      toast({
        title: "Data hämtad!",
        description: `${data.data.vehicleCount || 0} fordon, ${data.data.phoneNumbers?.length || 0} telefonnummer`,
      });

      await fetchStoredData();

    } catch (err) {
      console.error('Error fetching fleet data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel';
      setError(errorMessage);
      toast({
        title: "Fel vid hämtning",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsFetching(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const vehicles = fleetData?.vehicles || [];
  const phoneNumbers = fleetData?.phone_numbers || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Car className="h-4 w-4 md:h-5 md:w-5" />
              Fordonsdata & Telefoni
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Data från merinfo.se
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            variant={fleetData ? "outline" : "default"}
            onClick={handleFetchData}
            disabled={isFetching || (!orgNumber && !companyName)}
          >
            {isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {fleetData ? "Uppdatera" : "Hämta data"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && !fleetData && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Kunde inte hämta data</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!fleetData && !error && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Car className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-2">
              Ingen fordons- eller telefonidata hämtad ännu
            </p>
            {!orgNumber && companyName && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Inget org-nummer angivet
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLookupOrgNumber}
                  disabled={isLookingUpOrg}
                  className="gap-2"
                >
                  {isLookingUpOrg ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Sök org-nummer automatiskt
                </Button>
              </div>
            )}
            {!orgNumber && !companyName && (
              <p className="text-xs text-muted-foreground">
                Lägg till org-nummer eller företagsnamn för att söka
              </p>
            )}
          </div>
        )}

        {fleetData && (
          <div className="space-y-4">
            {/* Summary Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Vehicles */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Antal fordon</p>
                  <p className="text-lg font-semibold">
                    {fleetData.vehicle_count !== null ? fleetData.vehicle_count : vehicles.length || '-'}
                  </p>
                </div>
              </div>

              {/* Phone subscriptions */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Phone className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Telefonnummer</p>
                  <p className="text-lg font-semibold">
                    {fleetData.phone_subscription_count !== null ? fleetData.phone_subscription_count : phoneNumbers.length || '-'}
                  </p>
                </div>
              </div>

              {/* Operator */}
              {fleetData.phone_operator && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Operatör</p>
                    <p className="font-medium truncate">{fleetData.phone_operator}</p>
                  </div>
                </div>
              )}

              {/* Leasing company */}
              {fleetData.leasing_company && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Car className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Leasingbolag</p>
                    <p className="font-medium truncate">{fleetData.leasing_company}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Phone Numbers List */}
            {phoneNumbers.length > 0 && (
              <Collapsible open={showPhones} onOpenChange={setShowPhones}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Visa {phoneNumbers.length} telefonnummer
                    </span>
                    {showPhones ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {phoneNumbers.map((phone, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <a 
                          href={`tel:${phone.number.replace(/\s/g, '')}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {phone.number}
                        </a>
                        {phone.operator && (
                          <Badge variant="secondary" className="text-xs">
                            {phone.operator}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Vehicles List */}
            {vehicles.length > 0 && (
              <Collapsible open={showVehicles} onOpenChange={setShowVehicles}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      Visa {vehicles.length} fordon
                    </span>
                    {showVehicles ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {vehicles.map((vehicle, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/30 text-sm">
                        <div className="font-medium">{vehicle.model}</div>
                        <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                          {vehicle.regNumber && (
                            <Badge variant="outline" className="font-mono">
                              {vehicle.regNumber}
                            </Badge>
                          )}
                          {vehicle.color && <span>{vehicle.color}</span>}
                          {vehicle.type && <span>• {vehicle.type}</span>}
                          {vehicle.year && <span>• {vehicle.year}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>
                  Hämtad {format(new Date(fleetData.fetched_at), "d MMM yyyy, HH:mm", { locale: sv })}
                </span>
              </div>
              {fleetData.source_url && (
                <a 
                  href={fleetData.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Källa
                </a>
              )}
              {fleetData.org_number && (
                <Badge variant="outline" className="text-[10px]">
                  Org: {fleetData.org_number}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
