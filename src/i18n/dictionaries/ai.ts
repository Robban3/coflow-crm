import type { FeatureDictionary } from "../translations";

export const aiDict: FeatureDictionary = {
  sv: {
    // Suggested prompts
    "ai.prompt.findCarpentersTitle": "Hitta snickare",
    "ai.prompt.findCarpenters": "Hitta 10 snickare i Stockholm",
    "ai.prompt.searchHairdressersTitle": "Sök frisörer",
    "ai.prompt.searchHairdressers": "Sök efter frisörer i Göteborg som saknar hemsida",
    "ai.prompt.mailStatsTitle": "Mail-statistik",
    "ai.prompt.mailStats": "Visa statistik över mail jag skickat",
    "ai.prompt.openedMailTitle": "Öppnade mail",
    "ai.prompt.openedMail": "Vilka leads har öppnat mail?",
    "ai.prompt.leadsWithoutSiteTitle": "Leads utan hemsida",
    "ai.prompt.leadsWithoutSite": "Hämta leads som saknar hemsida",

    // Errors / toasts
    "ai.error.loadConversation": "Kunde inte ladda konversation",
    "ai.error.deleteConversation": "Kunde inte radera konversation",
    "ai.toast.conversationDeleted": "Konversation raderad",
    "ai.error.generic": "Något gick fel",
    "ai.fallback.noResponse": "Jag kunde inte generera ett svar.",
    "ai.fallback.error": "Tyvärr uppstod ett fel. Försök igen.",

    // Header
    "ai.header.history": "Historik",
    "ai.header.title": "AI Agent",
    "ai.header.historySubtitle": "Tidigare konversationer",
    "ai.header.subtitle": "Leads, analyser & outreach",
    "ai.header.beta": "Beta",
    "ai.header.showHistory": "Visa historik",
    "ai.header.newChat": "Ny chatt",

    // History view
    "ai.history.empty": "Ingen historik ännu",
    "ai.history.untitled": "Ny konversation",

    // Empty / messages
    "ai.empty.heading": "Vad kan jag hjälpa dig med?",
    "ai.empty.desc": "Jag kan söka leads, analysera hemsidor och ge insikter.",
    "ai.message.actions": "Åtgärder:",
    "ai.message.thinking": "Tänker...",

    // Input
    "ai.input.placeholder": "Skriv ditt uppdrag...",
    "ai.input.autosave": "Konversation sparas automatiskt",
  },
  en: {
    "ai.prompt.findCarpentersTitle": "Find carpenters",
    "ai.prompt.findCarpenters": "Find 10 carpenters in Stockholm",
    "ai.prompt.searchHairdressersTitle": "Search hairdressers",
    "ai.prompt.searchHairdressers": "Search for hairdressers in Gothenburg without a website",
    "ai.prompt.mailStatsTitle": "Mail statistics",
    "ai.prompt.mailStats": "Show statistics for emails I've sent",
    "ai.prompt.openedMailTitle": "Opened mail",
    "ai.prompt.openedMail": "Which leads have opened emails?",
    "ai.prompt.leadsWithoutSiteTitle": "Leads without a website",
    "ai.prompt.leadsWithoutSite": "Fetch leads that don't have a website",

    "ai.error.loadConversation": "Could not load conversation",
    "ai.error.deleteConversation": "Could not delete conversation",
    "ai.toast.conversationDeleted": "Conversation deleted",
    "ai.error.generic": "Something went wrong",
    "ai.fallback.noResponse": "I couldn't generate a response.",
    "ai.fallback.error": "Sorry, an error occurred. Please try again.",

    "ai.header.history": "History",
    "ai.header.title": "AI Agent",
    "ai.header.historySubtitle": "Previous conversations",
    "ai.header.subtitle": "Leads, analyses & outreach",
    "ai.header.beta": "Beta",
    "ai.header.showHistory": "Show history",
    "ai.header.newChat": "New chat",

    "ai.history.empty": "No history yet",
    "ai.history.untitled": "New conversation",

    "ai.empty.heading": "What can I help you with?",
    "ai.empty.desc": "I can search leads, analyze websites and provide insights.",
    "ai.message.actions": "Actions:",
    "ai.message.thinking": "Thinking...",

    "ai.input.placeholder": "Type your request...",
    "ai.input.autosave": "Conversation is saved automatically",
  },
  es: {
    "ai.prompt.findCarpentersTitle": "Encontrar carpinteros",
    "ai.prompt.findCarpenters": "Encuentra 10 carpinteros en Estocolmo",
    "ai.prompt.searchHairdressersTitle": "Buscar peluquerías",
    "ai.prompt.searchHairdressers": "Busca peluquerías en Gotemburgo que no tengan sitio web",
    "ai.prompt.mailStatsTitle": "Estadísticas de correo",
    "ai.prompt.mailStats": "Muestra estadísticas de los correos que he enviado",
    "ai.prompt.openedMailTitle": "Correos abiertos",
    "ai.prompt.openedMail": "¿Qué leads han abierto correos?",
    "ai.prompt.leadsWithoutSiteTitle": "Leads sin sitio web",
    "ai.prompt.leadsWithoutSite": "Obtén leads que no tienen sitio web",

    "ai.error.loadConversation": "No se pudo cargar la conversación",
    "ai.error.deleteConversation": "No se pudo eliminar la conversación",
    "ai.toast.conversationDeleted": "Conversación eliminada",
    "ai.error.generic": "Algo salió mal",
    "ai.fallback.noResponse": "No pude generar una respuesta.",
    "ai.fallback.error": "Lo siento, se produjo un error. Inténtalo de nuevo.",

    "ai.header.history": "Historial",
    "ai.header.title": "Agente IA",
    "ai.header.historySubtitle": "Conversaciones anteriores",
    "ai.header.subtitle": "Leads, análisis y outreach",
    "ai.header.beta": "Beta",
    "ai.header.showHistory": "Ver historial",
    "ai.header.newChat": "Nuevo chat",

    "ai.history.empty": "Aún no hay historial",
    "ai.history.untitled": "Nueva conversación",

    "ai.empty.heading": "¿En qué puedo ayudarte?",
    "ai.empty.desc": "Puedo buscar leads, analizar sitios web y ofrecer información.",
    "ai.message.actions": "Acciones:",
    "ai.message.thinking": "Pensando...",

    "ai.input.placeholder": "Escribe tu solicitud...",
    "ai.input.autosave": "La conversación se guarda automáticamente",
  },
};
