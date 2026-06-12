import type { FeatureDictionary } from "../translations";

export const ticketsDict: FeatureDictionary = {
  sv: {
    // Page
    "tickets.title": "Ärenden",
    "tickets.subtitle": "Hantera sälj- och supportärenden",
    "tickets.new": "Nytt ärende",
    "tickets.tab.kanban": "Kanban",
    "tickets.tab.list": "Lista",
    "tickets.tab.mine": "Mina ärenden",

    // Stats
    "tickets.stats.open": "Öppna ärenden",
    "tickets.stats.urgent": "Brådskande",
    "tickets.stats.thisWeek": "Denna vecka",
    "tickets.stats.avgResolveTime": "Snitt lösningstid",

    // Types
    "tickets.type.sales": "Sälj",
    "tickets.type.support": "Support",
    "tickets.type.onboarding": "Onboarding",
    "tickets.type.other": "Övrigt",

    // Priorities
    "tickets.priority.low": "Låg",
    "tickets.priority.medium": "Medium",
    "tickets.priority.high": "Hög",
    "tickets.priority.urgent": "Brådskande",

    // Statuses
    "tickets.status.new": "Nytt",
    "tickets.status.open": "Öppet",
    "tickets.status.in_progress": "Pågår",
    "tickets.status.waiting": "Väntar",
    "tickets.status.resolved": "Löst",
    "tickets.status.closed": "Stängt",

    // Card badges
    "tickets.card.overdue": "Försenat",
    "tickets.card.dueSoon": "Snart deadline",

    // List
    "tickets.list.searchPlaceholder": "Sök ärende...",
    "tickets.list.filterType": "Typ",
    "tickets.list.filterStatus": "Status",
    "tickets.list.filterPriority": "Prioritet",
    "tickets.list.allTypes": "Alla typer",
    "tickets.list.allStatuses": "Alla status",
    "tickets.list.allPriorities": "Alla",
    "tickets.list.colTicket": "Ärende",
    "tickets.list.colType": "Typ",
    "tickets.list.colStatus": "Status",
    "tickets.list.colPriority": "Prioritet",
    "tickets.list.colAssigned": "Tilldelad",
    "tickets.list.colAge": "Ålder",
    "tickets.list.empty": "Inga ärenden hittades",

    // Detail panel
    "tickets.detail.status": "Status",
    "tickets.detail.priority": "Prioritet",
    "tickets.detail.assigned": "Tilldelad",
    "tickets.detail.noAssignee": "Ingen tilldelad",
    "tickets.detail.dueDate": "Deadline: {date}",
    "tickets.detail.created": "Skapad: {date}",
    "tickets.detail.resolved": "Löst: {date}",

    // Comments
    "tickets.comments.title": "Kommentarer",
    "tickets.comments.empty": "Inga kommentarer ännu",
    "tickets.comments.placeholder": "Skriv en kommentar...",
    "tickets.comments.internalNote": "Intern anteckning",
    "tickets.comments.send": "Skicka",

    // Create dialog
    "tickets.create.dialogTitle": "Skapa nytt ärende",
    "tickets.create.titleLabel": "Titel *",
    "tickets.create.titlePlaceholder": "Beskriv ärendet kort...",
    "tickets.create.descriptionLabel": "Beskrivning",
    "tickets.create.descriptionPlaceholder": "Detaljer...",
    "tickets.create.typeLabel": "Typ",
    "tickets.create.priorityLabel": "Prioritet",
    "tickets.create.linkLabel": "Koppla till lead/kund",
    "tickets.create.linkPlaceholder": "Sök lead eller kund...",
    "tickets.create.linkNoResults": "Inga resultat",
    "tickets.create.groupLead": "Lead",
    "tickets.create.groupCustomer": "Kund",
    "tickets.create.leadPrefix": "Lead: {name}",
    "tickets.create.customerPrefix": "Kund: {name}",
    "tickets.create.unnamed": "(Namnlös)",
    "tickets.create.assignLabel": "Tilldela till",
    "tickets.create.assignPlaceholder": "Välj teammedlem",
    "tickets.create.dueDateLabel": "Deadline",
    "tickets.create.cancel": "Avbryt",
    "tickets.create.submit": "Skapa ärende",

    // Toasts
    "tickets.toast.error": "Fel",
    "tickets.toast.created": "Ärende skapat",
    "tickets.toast.createFailed": "Kunde inte skapa ärende",
    "tickets.toast.fetchFailed": "Kunde inte hämta ärenden",
    "tickets.toast.updateFailed": "Kunde inte uppdatera",
  },
  en: {
    // Page
    "tickets.title": "Tickets",
    "tickets.subtitle": "Manage sales and support tickets",
    "tickets.new": "New ticket",
    "tickets.tab.kanban": "Kanban",
    "tickets.tab.list": "List",
    "tickets.tab.mine": "My tickets",

    // Stats
    "tickets.stats.open": "Open tickets",
    "tickets.stats.urgent": "Urgent",
    "tickets.stats.thisWeek": "This week",
    "tickets.stats.avgResolveTime": "Avg. resolution time",

    // Types
    "tickets.type.sales": "Sales",
    "tickets.type.support": "Support",
    "tickets.type.onboarding": "Onboarding",
    "tickets.type.other": "Other",

    // Priorities
    "tickets.priority.low": "Low",
    "tickets.priority.medium": "Medium",
    "tickets.priority.high": "High",
    "tickets.priority.urgent": "Urgent",

    // Statuses
    "tickets.status.new": "New",
    "tickets.status.open": "Open",
    "tickets.status.in_progress": "In progress",
    "tickets.status.waiting": "Waiting",
    "tickets.status.resolved": "Resolved",
    "tickets.status.closed": "Closed",

    // Card badges
    "tickets.card.overdue": "Overdue",
    "tickets.card.dueSoon": "Due soon",

    // List
    "tickets.list.searchPlaceholder": "Search ticket...",
    "tickets.list.filterType": "Type",
    "tickets.list.filterStatus": "Status",
    "tickets.list.filterPriority": "Priority",
    "tickets.list.allTypes": "All types",
    "tickets.list.allStatuses": "All statuses",
    "tickets.list.allPriorities": "All",
    "tickets.list.colTicket": "Ticket",
    "tickets.list.colType": "Type",
    "tickets.list.colStatus": "Status",
    "tickets.list.colPriority": "Priority",
    "tickets.list.colAssigned": "Assigned",
    "tickets.list.colAge": "Age",
    "tickets.list.empty": "No tickets found",

    // Detail panel
    "tickets.detail.status": "Status",
    "tickets.detail.priority": "Priority",
    "tickets.detail.assigned": "Assigned",
    "tickets.detail.noAssignee": "No assignee",
    "tickets.detail.dueDate": "Due date: {date}",
    "tickets.detail.created": "Created: {date}",
    "tickets.detail.resolved": "Resolved: {date}",

    // Comments
    "tickets.comments.title": "Comments",
    "tickets.comments.empty": "No comments yet",
    "tickets.comments.placeholder": "Write a comment...",
    "tickets.comments.internalNote": "Internal note",
    "tickets.comments.send": "Send",

    // Create dialog
    "tickets.create.dialogTitle": "Create new ticket",
    "tickets.create.titleLabel": "Title *",
    "tickets.create.titlePlaceholder": "Briefly describe the ticket...",
    "tickets.create.descriptionLabel": "Description",
    "tickets.create.descriptionPlaceholder": "Details...",
    "tickets.create.typeLabel": "Type",
    "tickets.create.priorityLabel": "Priority",
    "tickets.create.linkLabel": "Link to lead/customer",
    "tickets.create.linkPlaceholder": "Search lead or customer...",
    "tickets.create.linkNoResults": "No results",
    "tickets.create.groupLead": "Lead",
    "tickets.create.groupCustomer": "Customer",
    "tickets.create.leadPrefix": "Lead: {name}",
    "tickets.create.customerPrefix": "Customer: {name}",
    "tickets.create.unnamed": "(Unnamed)",
    "tickets.create.assignLabel": "Assign to",
    "tickets.create.assignPlaceholder": "Select team member",
    "tickets.create.dueDateLabel": "Due date",
    "tickets.create.cancel": "Cancel",
    "tickets.create.submit": "Create ticket",

    // Toasts
    "tickets.toast.error": "Error",
    "tickets.toast.created": "Ticket created",
    "tickets.toast.createFailed": "Could not create ticket",
    "tickets.toast.fetchFailed": "Could not fetch tickets",
    "tickets.toast.updateFailed": "Could not update",
  },
  es: {
    // Page
    "tickets.title": "Tickets",
    "tickets.subtitle": "Gestiona tickets de ventas y soporte",
    "tickets.new": "Nuevo ticket",
    "tickets.tab.kanban": "Kanban",
    "tickets.tab.list": "Lista",
    "tickets.tab.mine": "Mis tickets",

    // Stats
    "tickets.stats.open": "Tickets abiertos",
    "tickets.stats.urgent": "Urgente",
    "tickets.stats.thisWeek": "Esta semana",
    "tickets.stats.avgResolveTime": "Tiempo medio de resolución",

    // Types
    "tickets.type.sales": "Ventas",
    "tickets.type.support": "Soporte",
    "tickets.type.onboarding": "Incorporación",
    "tickets.type.other": "Otro",

    // Priorities
    "tickets.priority.low": "Baja",
    "tickets.priority.medium": "Media",
    "tickets.priority.high": "Alta",
    "tickets.priority.urgent": "Urgente",

    // Statuses
    "tickets.status.new": "Nuevo",
    "tickets.status.open": "Abierto",
    "tickets.status.in_progress": "En curso",
    "tickets.status.waiting": "En espera",
    "tickets.status.resolved": "Resuelto",
    "tickets.status.closed": "Cerrado",

    // Card badges
    "tickets.card.overdue": "Atrasado",
    "tickets.card.dueSoon": "Vence pronto",

    // List
    "tickets.list.searchPlaceholder": "Buscar ticket...",
    "tickets.list.filterType": "Tipo",
    "tickets.list.filterStatus": "Estado",
    "tickets.list.filterPriority": "Prioridad",
    "tickets.list.allTypes": "Todos los tipos",
    "tickets.list.allStatuses": "Todos los estados",
    "tickets.list.allPriorities": "Todas",
    "tickets.list.colTicket": "Ticket",
    "tickets.list.colType": "Tipo",
    "tickets.list.colStatus": "Estado",
    "tickets.list.colPriority": "Prioridad",
    "tickets.list.colAssigned": "Asignado",
    "tickets.list.colAge": "Antigüedad",
    "tickets.list.empty": "No se encontraron tickets",

    // Detail panel
    "tickets.detail.status": "Estado",
    "tickets.detail.priority": "Prioridad",
    "tickets.detail.assigned": "Asignado",
    "tickets.detail.noAssignee": "Sin asignar",
    "tickets.detail.dueDate": "Fecha límite: {date}",
    "tickets.detail.created": "Creado: {date}",
    "tickets.detail.resolved": "Resuelto: {date}",

    // Comments
    "tickets.comments.title": "Comentarios",
    "tickets.comments.empty": "Aún no hay comentarios",
    "tickets.comments.placeholder": "Escribe un comentario...",
    "tickets.comments.internalNote": "Nota interna",
    "tickets.comments.send": "Enviar",

    // Create dialog
    "tickets.create.dialogTitle": "Crear nuevo ticket",
    "tickets.create.titleLabel": "Título *",
    "tickets.create.titlePlaceholder": "Describe brevemente el ticket...",
    "tickets.create.descriptionLabel": "Descripción",
    "tickets.create.descriptionPlaceholder": "Detalles...",
    "tickets.create.typeLabel": "Tipo",
    "tickets.create.priorityLabel": "Prioridad",
    "tickets.create.linkLabel": "Vincular a lead/cliente",
    "tickets.create.linkPlaceholder": "Buscar lead o cliente...",
    "tickets.create.linkNoResults": "Sin resultados",
    "tickets.create.groupLead": "Lead",
    "tickets.create.groupCustomer": "Cliente",
    "tickets.create.leadPrefix": "Lead: {name}",
    "tickets.create.customerPrefix": "Cliente: {name}",
    "tickets.create.unnamed": "(Sin nombre)",
    "tickets.create.assignLabel": "Asignar a",
    "tickets.create.assignPlaceholder": "Selecciona un miembro del equipo",
    "tickets.create.dueDateLabel": "Fecha límite",
    "tickets.create.cancel": "Cancelar",
    "tickets.create.submit": "Crear ticket",

    // Toasts
    "tickets.toast.error": "Error",
    "tickets.toast.created": "Ticket creado",
    "tickets.toast.createFailed": "No se pudo crear el ticket",
    "tickets.toast.fetchFailed": "No se pudieron obtener los tickets",
    "tickets.toast.updateFailed": "No se pudo actualizar",
  },
};
