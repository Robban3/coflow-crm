// Lightweight i18n dictionaries. Add keys here and reference them via the
// useTranslation() hook (see LanguageProvider.tsx). The structure is flat with
// dot-namespaced keys to keep lookups simple and tree-shakeable.

export const LANGUAGES = [
  { code: "sv", label: "Svenska", flag: "🇸🇪" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: Language = "sv";

type Dict = Record<string, string>;

export const translations: Record<Language, Dict> = {
  sv: {
    // Login
    "login.welcome": "Välkommen tillbaka",
    "login.subtitle": "Logga in för att fortsätta till ditt CRM",
    "login.email": "E-postadress",
    "login.emailPlaceholder": "din@epost.se",
    "login.password": "Lösenord",
    "login.forgotPassword": "Glömt lösenord?",
    "login.submit": "Logga in",
    "login.noAccount": "Har du inget konto?",
    "login.createAccount": "Skapa ett konto",
    "login.secureFooter": "Säker inloggning med krypterad anslutning",
    "login.failedTitle": "Inloggning misslyckades",
    "login.successTitle": "Välkommen tillbaka!",
    "login.successDesc": "Du är nu inloggad.",

    // Register
    "register.title": "Skapa konto",
    "register.subtitle": "Registrera dig för att använda CRM-systemet",
    "register.newOrg": "Ny organisation",
    "register.join": "Gå med",
    "register.newOrgDesc": "Skapa en helt ny organisation och bjud in ditt team efteråt.",
    "register.inviteCode": "Inbjudningskod",
    "register.inviteInvalid": "Koden är ogiltig eller har redan använts",
    "register.name": "Namn",
    "register.namePlaceholder": "Ditt namn",
    "register.email": "E-post",
    "register.password": "Lösenord",
    "register.confirmPassword": "Bekräfta lösenord",
    "register.createOrg": "Skapa organisation",
    "register.joinOrg": "Gå med i organisation",
    "register.hasAccount": "Har du redan ett konto?",
    "register.login": "Logga in",
    "register.inviteRequiredTitle": "Inbjudningskod krävs",
    "register.inviteRequiredDesc": "Du behöver en inbjudningskod för att gå med i en organisation.",
    "register.inviteInvalidTitle": "Ogiltig inbjudningskod",
    "register.inviteInvalidDesc": "Kontrollera att koden är korrekt och fortfarande giltig.",
    "register.passwordMismatchTitle": "Lösenorden matchar inte",
    "register.passwordMismatchDesc": "Kontrollera att lösenorden är identiska.",
    "register.passwordShortTitle": "Lösenordet är för kort",
    "register.passwordShortDesc": "Lösenordet måste vara minst 6 tecken.",
    "register.createdTitle": "Konto skapat!",
    "register.joinedDesc": "Du har gått med i organisationen.",
    "register.configureDesc": "Låt oss konfigurera din organisation.",
    "register.failedTitle": "Registrering misslyckades",
    "register.unexpectedError": "Ett oväntat fel uppstod",
    "register.inviteInvalidError": "Inbjudningskoden är ogiltig",

    // Navigation (module names)
    "nav.dashboard": "Dashboard",
    "nav.customers": "Kunder",
    "nav.pipeline": "Pipeline",
    "nav.leads": "Leads",
    "nav.prospecting": "Prospektering",
    "nav.tasks": "Tasks",
    "nav.tickets": "Ärenden",
    "nav.web_analysis": "Webbanalys",
    "nav.geo_analysis": "GEO / AI-synlighet",
    "nav.outreach": "Outreach",
    "nav.outreach_pro": "Power Call",
    "nav.mail": "Mail",
    "nav.templates": "Mallar",
    "nav.offers": "Offerter (Block)",
    "nav.quotes": "Offerter",
    "nav.reports": "Rapporter",
    "nav.meetings": "Möten",
    "nav.fleet_data": "Fordonsdata & Telefoni",
    "nav.seo_intelligence": "SEO Intelligence",
    "nav.statistics": "Statistik",
    "nav.settings": "Inställningar",

    // Header
    "header.searchPlaceholder": "Sök...",

    // User menu
    "userMenu.profile": "Profil",
    "userMenu.settings": "Inställningar",
    "userMenu.signOut": "Logga ut",
    "userMenu.defaultName": "Användare",
    "userMenu.admin": "Admin",

    // Sidebar
    "sidebar.openMenu": "Öppna meny",
    "sidebar.collapse": "Minimera",
    "sidebar.settings": "Inställningar",

    // Language switcher
    "language.label": "Språk",
  },
  en: {
    // Login
    "login.welcome": "Welcome back",
    "login.subtitle": "Sign in to continue to your CRM",
    "login.email": "Email address",
    "login.emailPlaceholder": "you@email.com",
    "login.password": "Password",
    "login.forgotPassword": "Forgot password?",
    "login.submit": "Sign in",
    "login.noAccount": "Don't have an account?",
    "login.createAccount": "Create an account",
    "login.secureFooter": "Secure sign-in with an encrypted connection",
    "login.failedTitle": "Sign-in failed",
    "login.successTitle": "Welcome back!",
    "login.successDesc": "You are now signed in.",

    // Register
    "register.title": "Create account",
    "register.subtitle": "Sign up to use the CRM system",
    "register.newOrg": "New organization",
    "register.join": "Join",
    "register.newOrgDesc": "Create a brand new organization and invite your team afterwards.",
    "register.inviteCode": "Invite code",
    "register.inviteInvalid": "The code is invalid or has already been used",
    "register.name": "Name",
    "register.namePlaceholder": "Your name",
    "register.email": "Email",
    "register.password": "Password",
    "register.confirmPassword": "Confirm password",
    "register.createOrg": "Create organization",
    "register.joinOrg": "Join organization",
    "register.hasAccount": "Already have an account?",
    "register.login": "Sign in",
    "register.inviteRequiredTitle": "Invite code required",
    "register.inviteRequiredDesc": "You need an invite code to join an organization.",
    "register.inviteInvalidTitle": "Invalid invite code",
    "register.inviteInvalidDesc": "Make sure the code is correct and still valid.",
    "register.passwordMismatchTitle": "Passwords do not match",
    "register.passwordMismatchDesc": "Make sure the passwords are identical.",
    "register.passwordShortTitle": "Password too short",
    "register.passwordShortDesc": "The password must be at least 6 characters.",
    "register.createdTitle": "Account created!",
    "register.joinedDesc": "You have joined the organization.",
    "register.configureDesc": "Let's configure your organization.",
    "register.failedTitle": "Registration failed",
    "register.unexpectedError": "An unexpected error occurred",
    "register.inviteInvalidError": "The invite code is invalid",

    // Navigation (module names)
    "nav.dashboard": "Dashboard",
    "nav.customers": "Customers",
    "nav.pipeline": "Pipeline",
    "nav.leads": "Leads",
    "nav.prospecting": "Prospecting",
    "nav.tasks": "Tasks",
    "nav.tickets": "Tickets",
    "nav.web_analysis": "Web analysis",
    "nav.geo_analysis": "GEO / AI visibility",
    "nav.outreach": "Outreach",
    "nav.outreach_pro": "Power Call",
    "nav.mail": "Mail",
    "nav.templates": "Templates",
    "nav.offers": "Offers (Block)",
    "nav.quotes": "Quotes",
    "nav.reports": "Reports",
    "nav.meetings": "Meetings",
    "nav.fleet_data": "Vehicle data & Telephony",
    "nav.seo_intelligence": "SEO Intelligence",
    "nav.statistics": "Statistics",
    "nav.settings": "Settings",

    // Header
    "header.searchPlaceholder": "Search...",

    // User menu
    "userMenu.profile": "Profile",
    "userMenu.settings": "Settings",
    "userMenu.signOut": "Sign out",
    "userMenu.defaultName": "User",
    "userMenu.admin": "Admin",

    // Sidebar
    "sidebar.openMenu": "Open menu",
    "sidebar.collapse": "Collapse",
    "sidebar.settings": "Settings",

    // Language switcher
    "language.label": "Language",
  },
  es: {
    // Login
    "login.welcome": "Bienvenido de nuevo",
    "login.subtitle": "Inicia sesión para continuar a tu CRM",
    "login.email": "Correo electrónico",
    "login.emailPlaceholder": "tu@correo.com",
    "login.password": "Contraseña",
    "login.forgotPassword": "¿Olvidaste tu contraseña?",
    "login.submit": "Iniciar sesión",
    "login.noAccount": "¿No tienes una cuenta?",
    "login.createAccount": "Crear una cuenta",
    "login.secureFooter": "Inicio de sesión seguro con conexión cifrada",
    "login.failedTitle": "Error al iniciar sesión",
    "login.successTitle": "¡Bienvenido de nuevo!",
    "login.successDesc": "Has iniciado sesión.",

    // Register
    "register.title": "Crear cuenta",
    "register.subtitle": "Regístrate para usar el sistema CRM",
    "register.newOrg": "Nueva organización",
    "register.join": "Unirse",
    "register.newOrgDesc": "Crea una organización nueva e invita a tu equipo después.",
    "register.inviteCode": "Código de invitación",
    "register.inviteInvalid": "El código no es válido o ya se ha usado",
    "register.name": "Nombre",
    "register.namePlaceholder": "Tu nombre",
    "register.email": "Correo electrónico",
    "register.password": "Contraseña",
    "register.confirmPassword": "Confirmar contraseña",
    "register.createOrg": "Crear organización",
    "register.joinOrg": "Unirse a la organización",
    "register.hasAccount": "¿Ya tienes una cuenta?",
    "register.login": "Iniciar sesión",
    "register.inviteRequiredTitle": "Se requiere código de invitación",
    "register.inviteRequiredDesc": "Necesitas un código de invitación para unirte a una organización.",
    "register.inviteInvalidTitle": "Código de invitación no válido",
    "register.inviteInvalidDesc": "Comprueba que el código sea correcto y siga siendo válido.",
    "register.passwordMismatchTitle": "Las contraseñas no coinciden",
    "register.passwordMismatchDesc": "Comprueba que las contraseñas sean idénticas.",
    "register.passwordShortTitle": "Contraseña demasiado corta",
    "register.passwordShortDesc": "La contraseña debe tener al menos 6 caracteres.",
    "register.createdTitle": "¡Cuenta creada!",
    "register.joinedDesc": "Te has unido a la organización.",
    "register.configureDesc": "Vamos a configurar tu organización.",
    "register.failedTitle": "Error en el registro",
    "register.unexpectedError": "Se produjo un error inesperado",
    "register.inviteInvalidError": "El código de invitación no es válido",

    // Navigation (module names)
    "nav.dashboard": "Panel",
    "nav.customers": "Clientes",
    "nav.pipeline": "Embudo",
    "nav.leads": "Leads",
    "nav.prospecting": "Prospección",
    "nav.tasks": "Tareas",
    "nav.tickets": "Tickets",
    "nav.web_analysis": "Análisis web",
    "nav.geo_analysis": "GEO / visibilidad IA",
    "nav.outreach": "Outreach",
    "nav.outreach_pro": "Power Call",
    "nav.mail": "Correo",
    "nav.templates": "Plantillas",
    "nav.offers": "Ofertas (Bloques)",
    "nav.quotes": "Presupuestos",
    "nav.reports": "Informes",
    "nav.meetings": "Reuniones",
    "nav.fleet_data": "Datos de vehículos y telefonía",
    "nav.seo_intelligence": "SEO Intelligence",
    "nav.statistics": "Estadísticas",
    "nav.settings": "Ajustes",

    // Header
    "header.searchPlaceholder": "Buscar...",

    // User menu
    "userMenu.profile": "Perfil",
    "userMenu.settings": "Ajustes",
    "userMenu.signOut": "Cerrar sesión",
    "userMenu.defaultName": "Usuario",
    "userMenu.admin": "Admin",

    // Sidebar
    "sidebar.openMenu": "Abrir menú",
    "sidebar.collapse": "Minimizar",
    "sidebar.settings": "Ajustes",

    // Language switcher
    "language.label": "Idioma",
  },
};
