import type { FeatureDictionary } from "../translations";

export const onboardingDict: FeatureDictionary = {
  sv: {
    // Progress / navigation
    "onboarding.progressStep": "Steg {step} av 3",
    "onboarding.back": "Tillbaka",
    "onboarding.continue": "Fortsätt",
    "onboarding.finish": "Slutför",
    "onboarding.creating": "Skapar...",

    // Step 1 — Organization
    "onboarding.step1Title": "Skapa din organisation",
    "onboarding.step1Desc": "Berätta lite om ditt företag så kommer vi igång",
    "onboarding.orgNameLabel": "Organisationsnamn",
    "onboarding.orgNamePlaceholder": "Mitt företag AB",
    "onboarding.websiteLabel": "Webbplats",
    "onboarding.websitePlaceholder": "https://exempel.se",
    "onboarding.logoLabel": "Logotyp",

    // Step 2 — Sender
    "onboarding.step2Title": "Konfigurera din e-post",
    "onboarding.step2Desc": "Ställ in hur dina utskick visas för mottagarna",
    "onboarding.senderNameLabel": "Avsändarnamn",
    "onboarding.senderNamePlaceholder": "Mitt företag",
    "onboarding.senderNameHint": "Namnet som visas som avsändare i dina mejl",
    "onboarding.senderEmailLabel": "Avsändaradress",
    "onboarding.senderEmailPlaceholder": "noreply@dittforetag.se",
    "onboarding.senderEmailHint": "Lämna tomt för att använda standardadressen tills vidare",
    "onboarding.previewLabel": "Förhandsgranskning",
    "onboarding.previewFallbackOrg": "Ditt företag",

    // Step 3 — Industry & service
    "onboarding.step3Title": "Vad erbjuder ni?",
    "onboarding.step3Desc": "Det hjälper oss att anpassa systemet efter er verksamhet",
    "onboarding.chooseIndustryLabel": "Välj bransch",
    "onboarding.serviceDescLabel": "Beskriv er tjänst",
    "onboarding.serviceDescPlaceholder": "Berätta kort vad ni erbjuder och vilka ni hjälper...",
    "onboarding.serviceDescHint": "Används för att skräddarsy förslag och innehåll",

    // Industry templates
    "onboarding.industryTelephonyLabel": "Telefoni",
    "onboarding.industryTelephonyDesc": "Växel, mobilabonnemang och telefonilösningar för företag",
    "onboarding.industryFleetLabel": "Fordon & flotta",
    "onboarding.industryFleetDesc": "Fordonsdata, leasing och hantering av fordonsflottor",
    "onboarding.industryItLabel": "IT & teknik",
    "onboarding.industryItDesc": "IT-tjänster, support och tekniska lösningar",
    "onboarding.industryWebLabel": "Webb & marknadsföring",
    "onboarding.industryWebDesc": "Webbdesign, SEO och digital marknadsföring",
    "onboarding.industryOtherLabel": "Annat",
    "onboarding.industryOtherDesc": "Något annat – berätta gärna mer nedan",

    // Toasts
    "onboarding.toastOrgNameRequiredTitle": "Organisationsnamn krävs",
    "onboarding.toastOrgNameRequiredDesc": "Ange ett namn för din organisation för att fortsätta",
    "onboarding.toastWelcomeTitle": "Välkommen!",
    "onboarding.toastWelcomeDesc": "{name} har skapats. Nu kör vi!",
    "onboarding.toastErrorTitle": "Något gick fel",
    "onboarding.toastErrorDesc": "Kunde inte slutföra installationen. Försök igen.",
  },
  en: {
    // Progress / navigation
    "onboarding.progressStep": "Step {step} of 3",
    "onboarding.back": "Back",
    "onboarding.continue": "Continue",
    "onboarding.finish": "Finish",
    "onboarding.creating": "Creating...",

    // Step 1 — Organization
    "onboarding.step1Title": "Create your organization",
    "onboarding.step1Desc": "Tell us a little about your company to get started",
    "onboarding.orgNameLabel": "Organization name",
    "onboarding.orgNamePlaceholder": "My Company Inc.",
    "onboarding.websiteLabel": "Website",
    "onboarding.websitePlaceholder": "https://example.com",
    "onboarding.logoLabel": "Logo",

    // Step 2 — Sender
    "onboarding.step2Title": "Configure your email",
    "onboarding.step2Desc": "Set how your emails appear to recipients",
    "onboarding.senderNameLabel": "Sender name",
    "onboarding.senderNamePlaceholder": "My Company",
    "onboarding.senderNameHint": "The name shown as the sender in your emails",
    "onboarding.senderEmailLabel": "Sender address",
    "onboarding.senderEmailPlaceholder": "noreply@yourcompany.com",
    "onboarding.senderEmailHint": "Leave blank to use the default address for now",
    "onboarding.previewLabel": "Preview",
    "onboarding.previewFallbackOrg": "Your company",

    // Step 3 — Industry & service
    "onboarding.step3Title": "What do you offer?",
    "onboarding.step3Desc": "This helps us tailor the system to your business",
    "onboarding.chooseIndustryLabel": "Choose industry",
    "onboarding.serviceDescLabel": "Describe your service",
    "onboarding.serviceDescPlaceholder": "Briefly describe what you offer and who you help...",
    "onboarding.serviceDescHint": "Used to tailor suggestions and content",

    // Industry templates
    "onboarding.industryTelephonyLabel": "Telephony",
    "onboarding.industryTelephonyDesc": "Switchboards, mobile plans and telephony solutions for businesses",
    "onboarding.industryFleetLabel": "Vehicles & fleet",
    "onboarding.industryFleetDesc": "Vehicle data, leasing and fleet management",
    "onboarding.industryItLabel": "IT & technology",
    "onboarding.industryItDesc": "IT services, support and technical solutions",
    "onboarding.industryWebLabel": "Web & marketing",
    "onboarding.industryWebDesc": "Web design, SEO and digital marketing",
    "onboarding.industryOtherLabel": "Other",
    "onboarding.industryOtherDesc": "Something else – feel free to tell us more below",

    // Toasts
    "onboarding.toastOrgNameRequiredTitle": "Organization name required",
    "onboarding.toastOrgNameRequiredDesc": "Enter a name for your organization to continue",
    "onboarding.toastWelcomeTitle": "Welcome!",
    "onboarding.toastWelcomeDesc": "{name} has been created. Let's go!",
    "onboarding.toastErrorTitle": "Something went wrong",
    "onboarding.toastErrorDesc": "Could not complete the setup. Please try again.",
  },
  es: {
    // Progress / navigation
    "onboarding.progressStep": "Paso {step} de 3",
    "onboarding.back": "Atrás",
    "onboarding.continue": "Continuar",
    "onboarding.finish": "Finalizar",
    "onboarding.creating": "Creando...",

    // Step 1 — Organization
    "onboarding.step1Title": "Crea tu organización",
    "onboarding.step1Desc": "Cuéntanos un poco sobre tu empresa para empezar",
    "onboarding.orgNameLabel": "Nombre de la organización",
    "onboarding.orgNamePlaceholder": "Mi Empresa S.L.",
    "onboarding.websiteLabel": "Sitio web",
    "onboarding.websitePlaceholder": "https://ejemplo.com",
    "onboarding.logoLabel": "Logotipo",

    // Step 2 — Sender
    "onboarding.step2Title": "Configura tu correo",
    "onboarding.step2Desc": "Define cómo aparecen tus correos para los destinatarios",
    "onboarding.senderNameLabel": "Nombre del remitente",
    "onboarding.senderNamePlaceholder": "Mi Empresa",
    "onboarding.senderNameHint": "El nombre que se muestra como remitente en tus correos",
    "onboarding.senderEmailLabel": "Dirección del remitente",
    "onboarding.senderEmailPlaceholder": "noreply@tuempresa.com",
    "onboarding.senderEmailHint": "Déjalo en blanco para usar la dirección predeterminada por ahora",
    "onboarding.previewLabel": "Vista previa",
    "onboarding.previewFallbackOrg": "Tu empresa",

    // Step 3 — Industry & service
    "onboarding.step3Title": "¿Qué ofreces?",
    "onboarding.step3Desc": "Esto nos ayuda a adaptar el sistema a tu negocio",
    "onboarding.chooseIndustryLabel": "Elige un sector",
    "onboarding.serviceDescLabel": "Describe tu servicio",
    "onboarding.serviceDescPlaceholder": "Describe brevemente qué ofreces y a quién ayudas...",
    "onboarding.serviceDescHint": "Se usa para personalizar sugerencias y contenido",

    // Industry templates
    "onboarding.industryTelephonyLabel": "Telefonía",
    "onboarding.industryTelephonyDesc": "Centralitas, planes móviles y soluciones de telefonía para empresas",
    "onboarding.industryFleetLabel": "Vehículos y flotas",
    "onboarding.industryFleetDesc": "Datos de vehículos, leasing y gestión de flotas",
    "onboarding.industryItLabel": "IT y tecnología",
    "onboarding.industryItDesc": "Servicios de IT, soporte y soluciones técnicas",
    "onboarding.industryWebLabel": "Web y marketing",
    "onboarding.industryWebDesc": "Diseño web, SEO y marketing digital",
    "onboarding.industryOtherLabel": "Otro",
    "onboarding.industryOtherDesc": "Otra cosa – cuéntanos más a continuación",

    // Toasts
    "onboarding.toastOrgNameRequiredTitle": "Nombre de organización obligatorio",
    "onboarding.toastOrgNameRequiredDesc": "Introduce un nombre para tu organización para continuar",
    "onboarding.toastWelcomeTitle": "¡Bienvenido!",
    "onboarding.toastWelcomeDesc": "{name} se ha creado. ¡Vamos!",
    "onboarding.toastErrorTitle": "Algo salió mal",
    "onboarding.toastErrorDesc": "No se pudo completar la configuración. Inténtalo de nuevo.",
  },
};
