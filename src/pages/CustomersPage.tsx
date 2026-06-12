import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Building2, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/LanguageProvider";

const statusColors: Record<string, string> = {
  lead: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  prospect: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  churned: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const statusLabelKeys: Record<string, string> = {
  lead: "customers.statusLead",
  prospect: "customers.statusProspect",
  active: "customers.statusActive",
  inactive: "customers.statusInactive",
  churned: "customers.statusChurned",
};

interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  lead_id?: string | null;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const customerIds = (data || []).map((c: any) => c.id);
      const { data: leads } = await supabase
        .from("leads")
        .select("id, converted_to_customer_id")
        .in("converted_to_customer_id", customerIds);

      const leadMap = new Map<string, string>();
      if (leads) {
        for (const l of leads) {
          if (l.converted_to_customer_id) leadMap.set(l.converted_to_customer_id, l.id);
        }
      }

      return (data || []).map((c: any) => ({ ...c, lead_id: leadMap.get(c.id) || null })) as Customer[];
    },
  });

  const filtered = customers.filter((c) => {
    const matchesSearch = !searchQuery ||
      c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout title={t("customers.title")}>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("customers.title")}</h2>
            <p className="text-sm md:text-base text-muted-foreground">{t("customers.subtitle")}</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("customers.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder={t("customers.statusFilter")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("customers.statusAll")}</SelectItem>
                  <SelectItem value="active">{t("customers.statusActive")}</SelectItem>
                  <SelectItem value="prospect">{t("customers.statusProspect")}</SelectItem>
                  <SelectItem value="inactive">{t("customers.statusInactive")}</SelectItem>
                  <SelectItem value="churned">{t("customers.statusChurned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {customers.length === 0 ? t("customers.noneTitle") : t("customers.noMatchTitle")}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {customers.length === 0 ? t("customers.noneDesc") : t("customers.noMatchDesc")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customers.colCompany")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("customers.colContact")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("customers.colEmail")}</TableHead>
                    <TableHead>{t("customers.colStatus")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("customers.colCreated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { if (customer.lead_id) navigate(`/leads/${customer.lead_id}`); }}
                    >
                      <TableCell className="font-medium">{customer.company_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{customer.contact_name || "-"}</TableCell>
                      <TableCell className="hidden md:table-cell">{customer.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[customer.status] || ""}>{statusLabelKeys[customer.status] ? t(statusLabelKeys[customer.status]) : customer.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {format(new Date(customer.created_at), "d MMM yyyy", { locale: dateLocale })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
