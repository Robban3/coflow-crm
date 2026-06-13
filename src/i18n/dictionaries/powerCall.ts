import type { FeatureDictionary } from "../translations";

export const powerCallDict: FeatureDictionary = {
  sv: {
    // Lists page
    "powerCall.lists.title": "Ringlistor",
    "powerCall.lists.subtitle": "Köer av leads för Power Call-sessioner",
    "powerCall.lists.newList": "Ny lista",
    "powerCall.lists.emptyTitle": "Inga listor ännu",
    "powerCall.lists.emptyDesc": "Skapa din första ringlista för att starta Power Call-sessioner",
    "powerCall.lists.createList": "Skapa lista",
    "powerCall.lists.shared": "Delad",
    "powerCall.lists.createdAt": "Skapad {date}",
    "powerCall.lists.call": "Ringa",
    "powerCall.lists.sourceStatic": "Statisk lista",
    "powerCall.lists.sourceFilter": "Dynamisk (filter)",
    "powerCall.lists.sourceImport": "Import",

    // Lists page — create dialog
    "powerCall.lists.dialogTitle": "Ny ringlista",
    "powerCall.lists.nameLabel": "Namn *",
    "powerCall.lists.namePlaceholder": "T.ex. Restauranger Stockholm",
    "powerCall.lists.descriptionLabel": "Beskrivning",
    "powerCall.lists.descriptionPlaceholder": "Valfri beskrivning...",
    "powerCall.lists.typeLabel": "Typ",
    "powerCall.lists.typeStaticOption": "Statisk lista (välj leads manuellt)",
    "powerCall.lists.typeFilterOption": "Dynamisk (filtrerade leads)",
    "powerCall.lists.typeImportOption": "Import",
    "powerCall.lists.shareWithTeam": "Dela med teamet",
    "powerCall.lists.shareWithTeamDesc": "Alla i organisationen kan se och använda listan",
    "powerCall.lists.cancel": "Avbryt",

    // Lists page — toasts & confirms
    "powerCall.lists.toastCreated": "Lista skapad",
    "powerCall.lists.toastError": "Fel",
    "powerCall.lists.toastCreateFailed": "Kunde inte skapa lista",
    "powerCall.lists.confirmDelete": "Ta bort listan?",
    "powerCall.lists.toastDeleteFailed": "Kunde inte ta bort listan",
    "powerCall.lists.toastDeleted": "Lista borttagen",

    // Session — start screen
    "powerCall.session.title": "Power Call",
    "powerCall.session.startSubtitle": "Ring leads effektivt, ett i taget.",
    "powerCall.session.selectListLabel": "Välj lista (valfritt)",
    "powerCall.session.allActiveLeads": "Alla aktiva leads",
    "powerCall.session.startSession": "Starta session",
    "powerCall.session.back": "Tillbaka",

    // Session — done screen
    "powerCall.session.doneTitle": "Session klar!",
    "powerCall.session.doneCount": "Du har ringt {count} leads i denna session.",
    "powerCall.session.doneNoMore": "Inga fler leads att ringa just nu.",
    "powerCall.session.end": "Avsluta",
    "powerCall.session.restart": "Starta om",

    // Session — header bar
    "powerCall.session.active": "Session aktiv",
    "powerCall.session.callsBadge": "{count} samtal",
    "powerCall.session.preparingNext": "Förbereder nästa…",
    "powerCall.session.nextReady": "Nästa lead: redo ✓",
    "powerCall.session.nextPreparing": "Nästa förbereds",

    // Session — main content states
    "powerCall.session.loadingNext": "Laddar nästa lead…",
    "powerCall.session.noLeads": "Inga leads att ringa",
    "powerCall.session.unknownCompany": "Okänt företag",
    "powerCall.session.callAction": "Ring",
    "powerCall.session.phoneMissing": "Telefon saknas",

    // Session — scores & analysis
    "powerCall.session.scorePerformance": "Prestanda",
    "powerCall.session.scoreSeo": "SEO",
    "powerCall.session.scoreGeo": "GEO",
    "powerCall.session.generatingAnalysis": "Genererar analys…",
    "powerCall.session.generateAnalysis": "Generera analys",
    "powerCall.session.openLeadCard": "Öppna leadkort",

    // Session — outreach panel
    "powerCall.session.outreach": "Outreach",
    "powerCall.session.noMailSent": "Inget mail skickat",
    "powerCall.session.opened": "Öppnad",
    "powerCall.session.openedTimes": "Öppnad {count}x",

    // Session — call history panel
    "powerCall.session.callHistory": "Samtalshistorik",
    "powerCall.session.noPreviousCalls": "Inga tidigare samtal",

    // Session — pitch
    "powerCall.session.pitchTitle": "Samtalsmanus",
    "powerCall.session.pitchGeneric": "Generiskt",
    "powerCall.session.geoSummary": "GEO-sammanfattning",

    // Session — outcome buttons
    "powerCall.session.registerOutcome": "Registrera utfall",
    "powerCall.session.skip": "Hoppa över",

    // Session — outcome dialog
    "powerCall.session.logOutcome": "Logga utfall — {company}",
    "powerCall.session.note": "Notering",
    "powerCall.session.notInterestedPlaceholder": "Anledning...",
    "powerCall.session.answeredPlaceholder": "Kort sammanfattning av samtalet",
    "powerCall.session.notePlaceholder": "Notering...",
    "powerCall.session.scheduleFollowUp": "Schemalägg uppföljning",
    "powerCall.session.dateLabel": "Datum *",
    "powerCall.session.timeLabel": "Tid",
    "powerCall.session.cancel": "Avbryt",
    "powerCall.session.save": "Spara",
    "powerCall.session.saveAndNext": "Spara & nästa",

    // Session — toasts
    "powerCall.session.toastError": "Fel",
    "powerCall.session.toastStartFailed": "Kunde inte starta session",
    "powerCall.session.toastSaved": "Sparat",
    "powerCall.session.toastSaveFailed": "Kunde inte spara utfall",
    "powerCall.session.toastSkipFailed": "Kunde inte hoppa över",
    "powerCall.session.toastAnalysis": "Analys",
    "powerCall.session.analysisNoWebsite": "Lead saknar webbplats — analys ej tillämplig",
    "powerCall.session.analysisStarted": "Analys startad — poller efter resultat…",
    "powerCall.session.toastAnalysisDone": "Analys klar",
    "powerCall.session.analysisPitchUpdated": "Samtalsmanus uppdaterat",
    "powerCall.session.toastAnalysisFailed": "Analys misslyckades",

    // Session — task title & pitch text
    "powerCall.session.callbackTaskTitle": "Återkoppla: {company}",
    "powerCall.session.taskLeadFallback": "Lead",
    "powerCall.session.pitchCompanyFallback": "företaget",
    "powerCall.session.pitchNoAnalysisOpening": "Öppning: \"Hej, jag heter [namn] och ringer från [företag]. Jag har tittat lite på {name}.\"",
    "powerCall.session.pitchNoAnalysisObservation": "Observation: \"Vi ser ofta att företag i er bransch kan attrahera 2–4 nya kunder per månad när hemsidan är snabb och tydlig.\"",
    "powerCall.session.pitchNoAnalysisQuestion": "Fråga: \"Hur ser det ut för er idag – är ni nöjda med antalet nya kunder som hemsidan genererar?\"",
    "powerCall.session.pitchNoAnalysisCta": "CTA: \"Vill du att jag skickar ett kostnadsfritt analysunderlag, eller passar det med 15 minuter nu/snart?\"",
    "powerCall.session.pitchPerfNote": "Hemsidans laddningstid är under genomsnittet ({score}/100)",
    "powerCall.session.pitchGeoNote": "AI-synligheten är låg ({score}/100) – de syns dåligt i AI-sökmotorer",
    "powerCall.session.pitchAnalysisFallbackObs": "Vi har analyserat er digitala närvaro",
    "powerCall.session.pitchAnalysisOpening": "Öppning: \"Hej, jag heter [namn] och ringer från [företag]. Vi analyserar hemsidor för företag i er bransch.\"",
    "powerCall.session.pitchAnalysisObservation": "Observation: \"{obs}.\"",
    "powerCall.session.pitchAnalysisQuestion": "Fråga: \"Hur viktigt är det för er att synas online och generera leads via hemsidan just nu?\"",
    "powerCall.session.pitchAnalysisCta": "CTA: \"Vill du att jag skickar er en gratis rapport, eller passar det med 15 minuter nu för en snabb genomgång?\"",

    // Leaderboard widget
    "powerCall.leaderboard.title": "Leaderboard — förra månaden",
    "powerCall.leaderboard.generate": "Generera",
    "powerCall.leaderboard.emptyAdmin": "Klicka \"Generera\" för att skapa månadens leaderboard.",
    "powerCall.leaderboard.emptyUser": "Inget leaderboard för förra månaden.",
    "powerCall.leaderboard.meetings": "{count} möten",
    "powerCall.leaderboard.unknown": "Okänd",
    "powerCall.leaderboard.toastUpdated": "Leaderboard uppdaterat",
    "powerCall.leaderboard.toastUpdatedDesc": "Snapshot för {month} genererad",
    "powerCall.leaderboard.toastError": "Fel",
    "powerCall.leaderboard.toastFailed": "Kunde inte generera snapshot",
    "powerCall.session.summaryPlaceholder": "Kort sammanfattning av samtalet",
    "powerCall.session.generatingAnalysis": "Genererar analys…",
    "powerCall.session.generateAnalysis": "Generera analys",
  },
  en: {
    // Lists page
    "powerCall.lists.title": "Call lists",
    "powerCall.lists.subtitle": "Queues of leads for Power Call sessions",
    "powerCall.lists.newList": "New list",
    "powerCall.lists.emptyTitle": "No lists yet",
    "powerCall.lists.emptyDesc": "Create your first call list to start Power Call sessions",
    "powerCall.lists.createList": "Create list",
    "powerCall.lists.shared": "Shared",
    "powerCall.lists.createdAt": "Created {date}",
    "powerCall.lists.call": "Call",
    "powerCall.lists.sourceStatic": "Static list",
    "powerCall.lists.sourceFilter": "Dynamic (filter)",
    "powerCall.lists.sourceImport": "Import",

    // Lists page — create dialog
    "powerCall.lists.dialogTitle": "New call list",
    "powerCall.lists.nameLabel": "Name *",
    "powerCall.lists.namePlaceholder": "E.g. Restaurants Stockholm",
    "powerCall.lists.descriptionLabel": "Description",
    "powerCall.lists.descriptionPlaceholder": "Optional description...",
    "powerCall.lists.typeLabel": "Type",
    "powerCall.lists.typeStaticOption": "Static list (pick leads manually)",
    "powerCall.lists.typeFilterOption": "Dynamic (filtered leads)",
    "powerCall.lists.typeImportOption": "Import",
    "powerCall.lists.shareWithTeam": "Share with the team",
    "powerCall.lists.shareWithTeamDesc": "Everyone in the organization can see and use the list",
    "powerCall.lists.cancel": "Cancel",

    // Lists page — toasts & confirms
    "powerCall.lists.toastCreated": "List created",
    "powerCall.lists.toastError": "Error",
    "powerCall.lists.toastCreateFailed": "Could not create list",
    "powerCall.lists.confirmDelete": "Delete the list?",
    "powerCall.lists.toastDeleteFailed": "Could not delete the list",
    "powerCall.lists.toastDeleted": "List deleted",

    // Session — start screen
    "powerCall.session.title": "Power Call",
    "powerCall.session.startSubtitle": "Call leads efficiently, one at a time.",
    "powerCall.session.selectListLabel": "Choose list (optional)",
    "powerCall.session.allActiveLeads": "All active leads",
    "powerCall.session.startSession": "Start session",
    "powerCall.session.back": "Back",

    // Session — done screen
    "powerCall.session.doneTitle": "Session complete!",
    "powerCall.session.doneCount": "You have called {count} leads in this session.",
    "powerCall.session.doneNoMore": "No more leads to call right now.",
    "powerCall.session.end": "Finish",
    "powerCall.session.restart": "Restart",

    // Session — header bar
    "powerCall.session.active": "Session active",
    "powerCall.session.callsBadge": "{count} calls",
    "powerCall.session.preparingNext": "Preparing next…",
    "powerCall.session.nextReady": "Next lead: ready ✓",
    "powerCall.session.nextPreparing": "Next being prepared",

    // Session — main content states
    "powerCall.session.loadingNext": "Loading next lead…",
    "powerCall.session.noLeads": "No leads to call",
    "powerCall.session.unknownCompany": "Unknown company",
    "powerCall.session.callAction": "Call",
    "powerCall.session.phoneMissing": "Phone missing",

    // Session — scores & analysis
    "powerCall.session.scorePerformance": "Performance",
    "powerCall.session.scoreSeo": "SEO",
    "powerCall.session.scoreGeo": "GEO",
    "powerCall.session.generatingAnalysis": "Generating analysis…",
    "powerCall.session.generateAnalysis": "Generate analysis",
    "powerCall.session.openLeadCard": "Open lead card",

    // Session — outreach panel
    "powerCall.session.outreach": "Outreach",
    "powerCall.session.noMailSent": "No email sent",
    "powerCall.session.opened": "Opened",
    "powerCall.session.openedTimes": "Opened {count}x",

    // Session — call history panel
    "powerCall.session.callHistory": "Call history",
    "powerCall.session.noPreviousCalls": "No previous calls",

    // Session — pitch
    "powerCall.session.pitchTitle": "Call script",
    "powerCall.session.pitchGeneric": "Generic",
    "powerCall.session.geoSummary": "GEO summary",

    // Session — outcome buttons
    "powerCall.session.registerOutcome": "Log outcome",
    "powerCall.session.skip": "Skip",

    // Session — outcome dialog
    "powerCall.session.logOutcome": "Log outcome — {company}",
    "powerCall.session.note": "Note",
    "powerCall.session.notInterestedPlaceholder": "Reason...",
    "powerCall.session.answeredPlaceholder": "Brief summary of the call",
    "powerCall.session.notePlaceholder": "Note...",
    "powerCall.session.scheduleFollowUp": "Schedule follow-up",
    "powerCall.session.dateLabel": "Date *",
    "powerCall.session.timeLabel": "Time",
    "powerCall.session.cancel": "Cancel",
    "powerCall.session.save": "Save",
    "powerCall.session.saveAndNext": "Save & next",

    // Session — toasts
    "powerCall.session.toastError": "Error",
    "powerCall.session.toastStartFailed": "Could not start session",
    "powerCall.session.toastSaved": "Saved",
    "powerCall.session.toastSaveFailed": "Could not save outcome",
    "powerCall.session.toastSkipFailed": "Could not skip",
    "powerCall.session.toastAnalysis": "Analysis",
    "powerCall.session.analysisNoWebsite": "Lead has no website — analysis not applicable",
    "powerCall.session.analysisStarted": "Analysis started — polling for results…",
    "powerCall.session.toastAnalysisDone": "Analysis done",
    "powerCall.session.analysisPitchUpdated": "Call script updated",
    "powerCall.session.toastAnalysisFailed": "Analysis failed",

    // Session — task title & pitch text
    "powerCall.session.callbackTaskTitle": "Follow up: {company}",
    "powerCall.session.taskLeadFallback": "Lead",
    "powerCall.session.pitchCompanyFallback": "the company",
    "powerCall.session.pitchNoAnalysisOpening": "Opening: \"Hi, my name is [name] and I'm calling from [company]. I've taken a look at {name}.\"",
    "powerCall.session.pitchNoAnalysisObservation": "Observation: \"We often see that companies in your industry can attract 2–4 new customers per month when the website is fast and clear.\"",
    "powerCall.session.pitchNoAnalysisQuestion": "Question: \"How does it look for you today – are you happy with the number of new customers your website generates?\"",
    "powerCall.session.pitchNoAnalysisCta": "CTA: \"Would you like me to send a free analysis report, or does 15 minutes now/soon work for you?\"",
    "powerCall.session.pitchPerfNote": "The website's load time is below average ({score}/100)",
    "powerCall.session.pitchGeoNote": "AI visibility is low ({score}/100) – they show up poorly in AI search engines",
    "powerCall.session.pitchAnalysisFallbackObs": "We have analyzed your digital presence",
    "powerCall.session.pitchAnalysisOpening": "Opening: \"Hi, my name is [name] and I'm calling from [company]. We analyze websites for companies in your industry.\"",
    "powerCall.session.pitchAnalysisObservation": "Observation: \"{obs}.\"",
    "powerCall.session.pitchAnalysisQuestion": "Question: \"How important is it for you to be visible online and generate leads through your website right now?\"",
    "powerCall.session.pitchAnalysisCta": "CTA: \"Would you like me to send you a free report, or does 15 minutes now work for a quick walkthrough?\"",

    // Leaderboard widget
    "powerCall.leaderboard.title": "Leaderboard — last month",
    "powerCall.leaderboard.generate": "Generate",
    "powerCall.leaderboard.emptyAdmin": "Click \"Generate\" to create this month's leaderboard.",
    "powerCall.leaderboard.emptyUser": "No leaderboard for last month.",
    "powerCall.leaderboard.meetings": "{count} meetings",
    "powerCall.leaderboard.unknown": "Unknown",
    "powerCall.leaderboard.toastUpdated": "Leaderboard updated",
    "powerCall.leaderboard.toastUpdatedDesc": "Snapshot for {month} generated",
    "powerCall.leaderboard.toastError": "Error",
    "powerCall.leaderboard.toastFailed": "Could not generate snapshot",
    "powerCall.session.summaryPlaceholder": "Short summary of the call",
    "powerCall.session.generatingAnalysis": "Generating analysis…",
    "powerCall.session.generateAnalysis": "Generate analysis",
  },
  es: {
    // Lists page
    "powerCall.lists.title": "Listas de llamadas",
    "powerCall.lists.subtitle": "Colas de leads para sesiones de Power Call",
    "powerCall.lists.newList": "Nueva lista",
    "powerCall.lists.emptyTitle": "Aún no hay listas",
    "powerCall.lists.emptyDesc": "Crea tu primera lista de llamadas para iniciar sesiones de Power Call",
    "powerCall.lists.createList": "Crear lista",
    "powerCall.lists.shared": "Compartida",
    "powerCall.lists.createdAt": "Creada {date}",
    "powerCall.lists.call": "Llamar",
    "powerCall.lists.sourceStatic": "Lista estática",
    "powerCall.lists.sourceFilter": "Dinámica (filtro)",
    "powerCall.lists.sourceImport": "Importación",

    // Lists page — create dialog
    "powerCall.lists.dialogTitle": "Nueva lista de llamadas",
    "powerCall.lists.nameLabel": "Nombre *",
    "powerCall.lists.namePlaceholder": "P. ej. Restaurantes Estocolmo",
    "powerCall.lists.descriptionLabel": "Descripción",
    "powerCall.lists.descriptionPlaceholder": "Descripción opcional...",
    "powerCall.lists.typeLabel": "Tipo",
    "powerCall.lists.typeStaticOption": "Lista estática (elegir leads manualmente)",
    "powerCall.lists.typeFilterOption": "Dinámica (leads filtrados)",
    "powerCall.lists.typeImportOption": "Importación",
    "powerCall.lists.shareWithTeam": "Compartir con el equipo",
    "powerCall.lists.shareWithTeamDesc": "Todos en la organización pueden ver y usar la lista",
    "powerCall.lists.cancel": "Cancelar",

    // Lists page — toasts & confirms
    "powerCall.lists.toastCreated": "Lista creada",
    "powerCall.lists.toastError": "Error",
    "powerCall.lists.toastCreateFailed": "No se pudo crear la lista",
    "powerCall.lists.confirmDelete": "¿Eliminar la lista?",
    "powerCall.lists.toastDeleteFailed": "No se pudo eliminar la lista",
    "powerCall.lists.toastDeleted": "Lista eliminada",

    // Session — start screen
    "powerCall.session.title": "Power Call",
    "powerCall.session.startSubtitle": "Llama a leads de forma eficiente, uno por uno.",
    "powerCall.session.selectListLabel": "Elegir lista (opcional)",
    "powerCall.session.allActiveLeads": "Todos los leads activos",
    "powerCall.session.startSession": "Iniciar sesión",
    "powerCall.session.back": "Atrás",

    // Session — done screen
    "powerCall.session.doneTitle": "¡Sesión completada!",
    "powerCall.session.doneCount": "Has llamado a {count} leads en esta sesión.",
    "powerCall.session.doneNoMore": "No hay más leads para llamar ahora mismo.",
    "powerCall.session.end": "Finalizar",
    "powerCall.session.restart": "Reiniciar",

    // Session — header bar
    "powerCall.session.active": "Sesión activa",
    "powerCall.session.callsBadge": "{count} llamadas",
    "powerCall.session.preparingNext": "Preparando el siguiente…",
    "powerCall.session.nextReady": "Siguiente lead: listo ✓",
    "powerCall.session.nextPreparing": "Preparando el siguiente",

    // Session — main content states
    "powerCall.session.loadingNext": "Cargando el siguiente lead…",
    "powerCall.session.noLeads": "No hay leads para llamar",
    "powerCall.session.unknownCompany": "Empresa desconocida",
    "powerCall.session.callAction": "Llamar",
    "powerCall.session.phoneMissing": "Falta el teléfono",

    // Session — scores & analysis
    "powerCall.session.scorePerformance": "Rendimiento",
    "powerCall.session.scoreSeo": "SEO",
    "powerCall.session.scoreGeo": "GEO",
    "powerCall.session.generatingAnalysis": "Generando análisis…",
    "powerCall.session.generateAnalysis": "Generar análisis",
    "powerCall.session.openLeadCard": "Abrir ficha del lead",

    // Session — outreach panel
    "powerCall.session.outreach": "Outreach",
    "powerCall.session.noMailSent": "No se ha enviado correo",
    "powerCall.session.opened": "Abierto",
    "powerCall.session.openedTimes": "Abierto {count}x",

    // Session — call history panel
    "powerCall.session.callHistory": "Historial de llamadas",
    "powerCall.session.noPreviousCalls": "No hay llamadas anteriores",

    // Session — pitch
    "powerCall.session.pitchTitle": "Guion de llamada",
    "powerCall.session.pitchGeneric": "Genérico",
    "powerCall.session.geoSummary": "Resumen GEO",

    // Session — outcome buttons
    "powerCall.session.registerOutcome": "Registrar resultado",
    "powerCall.session.skip": "Omitir",

    // Session — outcome dialog
    "powerCall.session.logOutcome": "Registrar resultado — {company}",
    "powerCall.session.note": "Nota",
    "powerCall.session.notInterestedPlaceholder": "Motivo...",
    "powerCall.session.answeredPlaceholder": "Breve resumen de la llamada",
    "powerCall.session.notePlaceholder": "Nota...",
    "powerCall.session.scheduleFollowUp": "Programar seguimiento",
    "powerCall.session.dateLabel": "Fecha *",
    "powerCall.session.timeLabel": "Hora",
    "powerCall.session.cancel": "Cancelar",
    "powerCall.session.save": "Guardar",
    "powerCall.session.saveAndNext": "Guardar y siguiente",

    // Session — toasts
    "powerCall.session.toastError": "Error",
    "powerCall.session.toastStartFailed": "No se pudo iniciar la sesión",
    "powerCall.session.toastSaved": "Guardado",
    "powerCall.session.toastSaveFailed": "No se pudo guardar el resultado",
    "powerCall.session.toastSkipFailed": "No se pudo omitir",
    "powerCall.session.toastAnalysis": "Análisis",
    "powerCall.session.analysisNoWebsite": "El lead no tiene sitio web — análisis no aplicable",
    "powerCall.session.analysisStarted": "Análisis iniciado — sondeando resultados…",
    "powerCall.session.toastAnalysisDone": "Análisis completado",
    "powerCall.session.analysisPitchUpdated": "Guion de llamada actualizado",
    "powerCall.session.toastAnalysisFailed": "El análisis falló",

    // Session — task title & pitch text
    "powerCall.session.callbackTaskTitle": "Hacer seguimiento: {company}",
    "powerCall.session.taskLeadFallback": "Lead",
    "powerCall.session.pitchCompanyFallback": "la empresa",
    "powerCall.session.pitchNoAnalysisOpening": "Apertura: \"Hola, me llamo [nombre] y llamo de [empresa]. He echado un vistazo a {name}.\"",
    "powerCall.session.pitchNoAnalysisObservation": "Observación: \"A menudo vemos que las empresas de tu sector pueden atraer de 2 a 4 nuevos clientes al mes cuando el sitio web es rápido y claro.\"",
    "powerCall.session.pitchNoAnalysisQuestion": "Pregunta: \"¿Cómo va para vosotros hoy? ¿Estáis contentos con el número de nuevos clientes que genera vuestra web?\"",
    "powerCall.session.pitchNoAnalysisCta": "CTA: \"¿Quieres que te envíe un informe de análisis gratuito, o te vienen bien 15 minutos ahora/pronto?\"",
    "powerCall.session.pitchPerfNote": "El tiempo de carga del sitio web está por debajo de la media ({score}/100)",
    "powerCall.session.pitchGeoNote": "La visibilidad en IA es baja ({score}/100) – aparecen poco en los motores de búsqueda de IA",
    "powerCall.session.pitchAnalysisFallbackObs": "Hemos analizado vuestra presencia digital",
    "powerCall.session.pitchAnalysisOpening": "Apertura: \"Hola, me llamo [nombre] y llamo de [empresa]. Analizamos sitios web para empresas de vuestro sector.\"",
    "powerCall.session.pitchAnalysisObservation": "Observación: \"{obs}.\"",
    "powerCall.session.pitchAnalysisQuestion": "Pregunta: \"¿Qué importancia tiene para vosotros ser visibles online y generar leads a través de la web ahora mismo?\"",
    "powerCall.session.pitchAnalysisCta": "CTA: \"¿Quieres que te envíe un informe gratuito, o te vienen bien 15 minutos ahora para un repaso rápido?\"",

    // Leaderboard widget
    "powerCall.leaderboard.title": "Clasificación — mes pasado",
    "powerCall.leaderboard.generate": "Generar",
    "powerCall.leaderboard.emptyAdmin": "Haz clic en \"Generar\" para crear la clasificación de este mes.",
    "powerCall.leaderboard.emptyUser": "No hay clasificación del mes pasado.",
    "powerCall.leaderboard.meetings": "{count} reuniones",
    "powerCall.leaderboard.unknown": "Desconocido",
    "powerCall.leaderboard.toastUpdated": "Clasificación actualizada",
    "powerCall.leaderboard.toastUpdatedDesc": "Snapshot de {month} generado",
    "powerCall.leaderboard.toastError": "Error",
    "powerCall.leaderboard.toastFailed": "No se pudo generar el snapshot",
    "powerCall.session.summaryPlaceholder": "Resumen breve de la llamada",
    "powerCall.session.generatingAnalysis": "Generando análisis…",
    "powerCall.session.generateAnalysis": "Generar análisis",
  },
};
</content>
</invoke>
