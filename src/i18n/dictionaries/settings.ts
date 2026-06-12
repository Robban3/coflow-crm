import type { FeatureDictionary } from "../translations";

export const settingsDict: FeatureDictionary = {
  sv: {
    // Settings page — layout & tabs
    "settings.pageTitle": "Inställningar",
    "settings.editTemplateTitle": "Redigera mall",
    "settings.tabProfile": "Profil",
    "settings.tabOutreach": "Outreach",
    "settings.tabOutreachShort": "Mail",
    "settings.tabTemplates": "Mallar",
    "settings.tabOrganization": "Organisation",
    "settings.tabOrganizationShort": "Org",
    "settings.tabReports": "Rapporter",
    "settings.tabReportsShort": "Rapp.",
    "settings.tabGeneral": "Allmänt",
    "settings.tabGeneralShort": "Mer",

    // Profile tab
    "settings.profileTitle": "Profil",
    "settings.profileDesc": "Hantera din personliga information",
    "settings.profileImage": "Profilbild",
    "settings.name": "Namn",
    "settings.namePlaceholder": "Ditt namn",
    "settings.email": "E-post",
    "settings.saveChanges": "Spara ändringar",
    "settings.profileSaveErrorTitle": "Fel",
    "settings.profileSaveErrorDesc": "Kunde inte spara profiländringar",
    "settings.profileSavedTitle": "Sparad!",
    "settings.profileSavedDesc": "Din profil har uppdaterats",

    // General tab
    "settings.generalTitle": "Allmänna inställningar",
    "settings.generalDesc": "Generella systeminställningar",
    "settings.emailNotifications": "Notifikationer via e-post",
    "settings.emailNotificationsDesc": "Få påminnelser om uppföljningar och tasks",
    "settings.weeklySummary": "Veckosammanfattning",
    "settings.weeklySummaryDesc": "Få en sammanfattning av veckans aktiviteter",

    // Common
    "settings.cancel": "Avbryt",
    "settings.error": "Fel",
    "settings.saving": "Sparar...",

    // ProfileImageUpload
    "settings.invalidFileTypeTitle": "Ogiltig filtyp",
    "settings.invalidFileTypeDesc": "Endast JPG, PNG, WebP, GIF och SVG stöds",
    "settings.fileTooLargeTitle": "Filen är för stor",
    "settings.fileTooLargeDesc": "Max filstorlek är 5MB",
    "settings.uploadedTitle": "Uppladdad!",
    "settings.avatarUpdatedDesc": "Profilbilden har uppdaterats",
    "settings.logoUpdatedDesc": "Loggan har uppdaterats",
    "settings.uploadErrorTitle": "Uppladdningsfel",
    "settings.uploadErrorDesc": "Kunde inte ladda upp bilden",
    "settings.companyLogoAlt": "Företagslogga",
    "settings.noLogo": "Ingen logga",
    "settings.uploadImage": "Ladda upp bild",
    "settings.uploadLogo": "Ladda upp logga",
    "settings.remove": "Ta bort",

    // EmailSignatureSettings — tones
    "settings.toneStandardLabel": "Standard",
    "settings.toneStandardDesc": "Balanserat och professionellt",
    "settings.toneStandardExample": `Hej,

Jag har analyserat er webbplats och noterade att SEO-poängen ligger på 45/100. Det finns goda möjligheter att förbättra er synlighet i sökmotorer.

Har ni tid för ett kort samtal om hur ni kan nå fler potentiella kunder?`,
    "settings.toneFamiliarLabel": "Familjär",
    "settings.toneFamiliarDesc": "Varmt och personligt",
    "settings.toneFamiliarExample": `Hej!

Jag tittade precis på er sajt och blev nyfiken – ni har en riktigt snygg design! Såg dock att SEO-poängen hamnade på 45/100, vilket ofta beror på tekniska smågrejer som är enkla att fixa.

Skulle vara kul att höra mer om er verksamhet – har du några minuter över?`,
    "settings.toneInformativeLabel": "Informativ",
    "settings.toneInformativeDesc": "Faktabaserat och pedagogiskt",
    "settings.toneInformativeExample": `Hej,

Efter en analys av er webbplats kan jag konstatera att SEO-poängen ligger på 45/100. Detta påverkar er synlighet i sökresultaten – studier visar att 75% av användare aldrig scrollar förbi första sidan på Google.

De främsta förbättringsområdena jag identifierade rör meta-beskrivningar och rubrikstruktur. Vill du att jag går igenom dem mer i detalj?`,
    "settings.toneDirectLabel": "Direkt",
    "settings.toneDirectDesc": "Rakt på sak, kortfattat",
    "settings.toneDirectExample": `Hej,

Analyserade er sajt – SEO: 45/100. Ni tappar sannolikt trafik.

Kan vi ta 15 min nästa vecka för att gå igenom de snabbaste förbättringarna?`,

    // EmailSignatureSettings — save toasts
    "settings.signatureSavedTitle": "Inställningar sparade",
    "settings.signatureSavedDesc": "Dina outreach-inställningar har uppdaterats",
    "settings.signatureSaveErrorDesc": "Kunde inte spara inställningarna",

    // EmailSignatureSettings — sender & signature card
    "settings.senderCardTitle": "Avsändare & signatur",
    "settings.senderCardDesc": "Anpassa hur dina outreach-mail visas för mottagaren",
    "settings.senderName": "Avsändarnamn",
    "settings.senderNamePlaceholder": "Ditt namn eller företag",
    "settings.senderNameHelp": "Detta namn visas som avsändare i mottagarens inkorg. Lämna tomt för att använda ditt fullständiga namn eller företagsnamn.",
    "settings.preview": "Förhandsgranskning:",
    "settings.senderFallbackName": "Kod & Co.",
    "settings.companyName": "Företagsnamn",
    "settings.companyNamePlaceholder": "Ditt Företag AB",
    "settings.companyWebsite": "Hemsida",
    "settings.companyWebsitePlaceholder": "https://dittforetag.se",
    "settings.companyLogo": "Företagslogga",
    "settings.emailSignature": "E-postsignatur",
    "settings.emailSignatureFallbackName": "Ditt Namn",
    "settings.emailSignatureFallbackCompany": "Företaget",
    "settings.emailSignatureHelp": "Läggs till i slutet av varje AI-genererat mail",
    "settings.emailFooter": "E-postfot (frivillig)",
    "settings.emailFooterPlaceholder": "T.ex. avregistreringslänk, företagsadress, disclaimer...",
    "settings.emailFooterHelp": "Extra text som läggs till allra sist i mailet",
    "settings.signaturePreviewLabel": "Förhandsvisning av signatur",
    "settings.signaturePreviewPlaceholder": "[AI-genererad mailtext kommer här...]",
    "settings.logoAlt": "Logotyp",
    "settings.saveSettings": "Spara inställningar",

    // EmailSignatureSettings — tone card
    "settings.toneCardTitle": "Tonalitet för AI-mail",
    "settings.toneCardDesc": "Välj hur dina AI-genererade outreach-mail ska låta",
    "settings.toneExampleLabel": "Exempel på {tone} ton:",
    "settings.toneExampleHelp": "Detta är ett exempel. Faktiska mail anpassas efter varje leads analysresultat.",
    "settings.saveTone": "Spara tonalitet",

    // ServiceProfileSettings — industry templates
    "settings.industryWebLabel": "Webbyrå / IT",
    "settings.industryWebDesc": "Hemsidor, SEO, Google Ads, webbutveckling",
    "settings.industryWebTemplate": `Vi hjälper företag att synas online genom professionella hemsidor, sökmotoroptimering (SEO) och digital marknadsföring. Våra tjänster inkluderar:

• Hemsideutveckling och design
• SEO och synlighet på Google
• Google Ads-kampanjer
• Webbanalys och optimering

Vi fokuserar på att leverera mätbara resultat som ökar synlighet och konverteringar.`,
    "settings.industryTelephonyLabel": "Telefoni / Telekom",
    "settings.industryTelephonyDesc": "Mobilabonnemang, växellösningar, företagstelefoni",
    "settings.industryTelephonyTemplate": `Vi erbjuder kostnadseffektiva telefonilösningar för företag. Våra tjänster inkluderar:

• Mobilabonnemang för företag
• Molnbaserade växellösningar
• Fast telefoni och SIP-trunking
• Samlade fakturor och förenklad administration

Vi analyserar företagets nuvarande telefonikostnader och föreslår optimerade lösningar.`,
    "settings.industryFleetLabel": "Fordonsleasing",
    "settings.industryFleetDesc": "Billeasing, fordonsflotta, företagsbilar",
    "settings.industryFleetTemplate": `Vi hjälper företag med kostnadseffektiva och flexibla leasinglösningar för fordonsflottan. Våra tjänster inkluderar:

• Operationell och finansiell leasing
• Tjänstebilar och förmånsbilar
• Elbilar och miljövänliga alternativ
• Flottatjänster och administration

Vi analyserar företagets nuvarande fordonspark och föreslår optimerade avtal.`,
    "settings.industryItLabel": "IT-tjänster / Konsulting",
    "settings.industryItDesc": "Systemutveckling, IT-support, molntjänster",
    "settings.industryItTemplate": `Vi levererar IT-tjänster som effektiviserar och säkrar verksamheten. Våra tjänster inkluderar:

• IT-support och helpdesk
• Molnlösningar och Microsoft 365
• Systemutveckling och integration
• IT-säkerhet och backup

Vi hjälper företag att fokusera på sin kärnverksamhet medan vi tar hand om IT:n.`,
    "settings.industryCustomLabel": "Egen bransch",
    "settings.industryCustomDesc": "Skriv en egen beskrivning av dina tjänster",

    // ServiceProfileSettings — toasts
    "settings.serviceProfileSavedTitle": "Tjänsteprofil sparad",
    "settings.serviceProfileSavedDesc": "Din tjänsteprofil kommer nu användas för outreach-generering",
    "settings.serviceProfileSaveErrorDesc": "Kunde inte spara tjänsteprofilen",

    // ServiceProfileSettings — card
    "settings.serviceProfileTitle": "Tjänsteprofil för Outreach",
    "settings.serviceProfileDesc": "Beskriv vad din organisation säljer så AI:n kan generera relevant outreach oavsett bransch",
    "settings.chooseIndustryTemplate": "Välj branschmall (snabbstart)",
    "settings.serviceDescription": "Tjänstebeskrivning",
    "settings.serviceDescriptionPlaceholder": "Beskriv vad din organisation säljer, era huvudtjänster, målgrupp och unika säljargument. Detta används av AI:n för att generera relevant outreach...",
    "settings.serviceDescriptionHelp": "Ju mer detaljerad beskrivning, desto bättre anpassad outreach. Nämn gärna specifika tjänster, prissättning, och vad som skiljer er från konkurrenterna.",
    "settings.aiPreviewLabel": "Förhandsvisning för AI",
    "settings.aiPreviewIntro": "AI:n kommer använda denna information vid outreach-generering:",
    "settings.industryLabel": "Bransch: {industry}",
    "settings.industryNotSelected": "Ej vald",
    "settings.serviceProfileHelpTitle": "💡 Hur används tjänsteprofilen?",
    "settings.serviceProfileHelpTelephony": "Telefoniförsäljning:",
    "settings.serviceProfileHelpTelephonyDesc": "AI:n refererar till leadens befintliga operatör och abonnemang från Fordonsdata & Telefoni-modulen",
    "settings.serviceProfileHelpFleet": "Fordonsleasing:",
    "settings.serviceProfileHelpFleetDesc": "AI:n analyserar leadens fordonsflotta och föreslår optimerade lösningar",
    "settings.serviceProfileHelpWeb": "Webbyrå:",
    "settings.serviceProfileHelpWebDesc": "AI:n använder webbanalysdata som tidigare för att pitcha SEO/Ads",
    "settings.serviceProfileHelpCustom": "Egen bransch:",
    "settings.serviceProfileHelpCustomDesc": "AI:n utgår helt från din beskrivning och anpassar efter tillgänglig leaddata",
    "settings.saveServiceProfile": "Spara tjänsteprofil",

    // OrganizationEmailSettings
    "settings.noOrgTitle": "Ingen organisation",
    "settings.noOrgDesc": "Du tillhör ingen organisation ännu.",
    "settings.orgEmailSavedTitle": "E-postinställningar sparade",
    "settings.orgEmailSavedDesc": "Organisationens e-postkonfiguration har uppdaterats.",
    "settings.orgEmailSaveErrorDesc": "Kunde inte spara e-postinställningarna",
    "settings.noOrgMembership": "Du tillhör ingen organisation.",
    "settings.orgEmailTitle": "Organisations e-postinställningar",
    "settings.orgEmailAdminOnly": "Endast administratörer kan ändra organisationens e-postinställningar.",
    "settings.senderLabel": "Avsändare:",
    "settings.notConfigured": "Ej konfigurerat",
    "settings.orgEmailDesc": "Konfigurera hur outreach-mail skickas från din organisation",
    "settings.orgSenderNamePlaceholder": "Din Organisation",
    "settings.senderAddress": "Avsändaradress",
    "settings.orgSenderEmailPlaceholder": "hej@dinorganisation.se",
    "settings.orgPreviewFallbackName": "Din Organisation",
    "settings.ownResendKey": "Egen Resend API-nyckel",
    "settings.resendConfigured": "En egen Resend API-nyckel är konfigurerad. Mail skickas från er verifierade domän.",
    "settings.resendSetupIntro": "För att skicka mail från {domain} behöver du:",
    "settings.resendSetupDomainFallback": "er egen domän",
    "settings.resendStep1": "Skapa konto på",
    "settings.resendStep2": "Verifiera din domän (DNS-poster)",
    "settings.resendStep3": "Skapa en API-nyckel",
    "settings.resendStep4": "Kontakta support för att lägga till nyckeln",
    "settings.resendDefaultNote": "Utan egen nyckel skickas mail från standardadressen noreply@resend.dev",
    "settings.saveOrgEmail": "Spara e-postinställningar",

    // TeamManagement & OrganizationDashboard — shared
    "settings.notLoggedIn": "Ej inloggad",
    "settings.inviteCreatedTitle": "Inbjudningskod skapad!",
    "settings.inviteCreatedDesc": "Koden {code} kan nu användas vid registrering",
    "settings.inviteCreateErrorDesc": "Kunde inte skapa inbjudningskod",
    "settings.fillAllFields": "Fyll i alla fält",
    "settings.userCreatedTitle": "Användare skapad!",
    "settings.userCreatedDesc": "{email} har lagts till i teamet",
    "settings.userCreateErrorDesc": "Kunde inte skapa användare",
    "settings.inviteDeleteErrorDesc": "Kunde inte ta bort inbjudningskoden",
    "settings.inviteDeletedTitle": "Inbjudningskod borttagen",
    "settings.roleAdmin": "Admin",
    "settings.roleUser": "Användare",

    // TeamManagement — team members card
    "settings.teamMembersTitle": "Teammedlemmar",
    "settings.teamMembersDesc": "Användare i din organisation",
    "settings.addUser": "Lägg till användare",

    // Invite codes card
    "settings.inviteCodesTitle": "Inbjudningskoder",
    "settings.inviteCodesDesc": "Dela koder för att låta nya användare registrera sig",
    "settings.createCode": "Skapa kod",
    "settings.noActiveInvites": "Inga aktiva inbjudningskoder",
    "settings.usesLabel": "{uses}/{max} användningar",
    "settings.inactive": "Inaktiv",

    // Add user dialog
    "settings.addUserTitle": "Lägg till användare",
    "settings.addUserDesc": "Skapa ett nytt konto för en teammedlem",
    "settings.emailRequired": "E-post *",
    "settings.emailPlaceholder": "email@företag.se",
    "settings.passwordRequired": "Lösenord *",
    "settings.passwordPlaceholder": "Minst 6 tecken",
    "settings.fullNamePlaceholder": "Förnamn Efternamn",
    "settings.role": "Roll",
    "settings.createUser": "Skapa användare",

    // Invite code dialog
    "settings.createInviteTitle": "Skapa inbjudningskod",
    "settings.createInviteDesc": "Generera en kod som nya användare kan använda vid registrering",
    "settings.numberOfUses": "Antal användningar",
    "settings.uses1": "1 användning",
    "settings.uses5": "5 användningar",
    "settings.uses10": "10 användningar",
    "settings.usesUnlimited": "Obegränsat (100)",
    "settings.generateCode": "Generera kod",

    // OrganizationDashboard — automation toasts
    "settings.autoEnrichEnabled": "Automatisk analys aktiverad",
    "settings.autoEnrichDisabled": "Automatisk analys inaktiverad",

    // OrganizationDashboard — module toggle toasts
    "settings.moduleEnabled": "Modul aktiverad",
    "settings.moduleDisabled": "Modul inaktiverad",
    "settings.moduleForUser": "{module} för användaren",
    "settings.moduleStatusErrorDesc": "Kunde inte ändra modulstatus",

    // OrganizationDashboard — role toggle toasts
    "settings.roleUpdatedTitle": "Roll uppdaterad",
    "settings.roleUpdatedDesc": "Användaren är nu {role}",
    "settings.roleAdminFull": "administratör",
    "settings.roleUserFull": "vanlig användare",
    "settings.roleChangeErrorDesc": "Kunde inte ändra roll",

    // OrganizationDashboard — org settings toasts
    "settings.orgInfoSaveErrorDesc": "Kunde inte spara organisationsuppgifter",
    "settings.orgInfoSavedTitle": "Sparat!",
    "settings.orgInfoSavedDesc": "Organisationsuppgifterna har uppdaterats",

    // OrganizationDashboard — stats bar
    "settings.statUsers": "användare",
    "settings.statAdmins": "admins",
    "settings.statActiveInvites": "aktiva inbjudningar",

    // OrganizationDashboard — tabs
    "settings.tabModules": "Moduler",
    "settings.tabMembers": "Användare",
    "settings.tabInvites": "Inbjudningar",
    "settings.tabCompanyInfo": "Företagsinfo",
    "settings.tabAutomation": "Automatisering",

    // OrganizationDashboard — modules tab
    "settings.modulePermissionsTitle": "Modulbehörigheter",
    "settings.modulePermissionsDesc": "Aktivera eller inaktivera moduler för varje användare",
    "settings.colUser": "Användare",

    // OrganizationDashboard — members tab
    "settings.membersTitle": "Användare",
    "settings.membersDesc": "Hantera teammedlemmar och roller",
    "settings.add": "Lägg till",
    "settings.colEmail": "E-post",
    "settings.colRole": "Roll",
    "settings.colAdmin": "Admin",

    // OrganizationDashboard — invites tab
    "settings.noInvitesYet": "Inga inbjudningskoder ännu",
    "settings.colCode": "Kod",
    "settings.colUses": "Användningar",
    "settings.colStatus": "Status",
    "settings.active": "Aktiv",

    // OrganizationDashboard — organization tab
    "settings.companyInfoTitle": "Företagsinformation",
    "settings.companyInfoDesc": "Uppgifter som visas i e-postsignaturer etc.",
    "settings.orgCompanyNamePlaceholder": "Mitt Företag AB",
    "settings.orgCompanyWebsitePlaceholder": "https://mittforetag.se",
    "settings.saveInfo": "Spara uppgifter",

    // OrganizationDashboard — automation tab
    "settings.automationTitle": "Automatisering",
    "settings.automationDesc": "Styr hur leads analyseras och berikas automatiskt",
    "settings.autoAnalyzeLabel": "Analysera nya leads automatiskt",
    "settings.autoAnalyzeDesc": "Kör webbanalys och skapa utskicksutkast för nya leads automatiskt. Stäng av för att spara API-anrop.",
  },
  en: {
    // Settings page — layout & tabs
    "settings.pageTitle": "Settings",
    "settings.editTemplateTitle": "Edit template",
    "settings.tabProfile": "Profile",
    "settings.tabOutreach": "Outreach",
    "settings.tabOutreachShort": "Mail",
    "settings.tabTemplates": "Templates",
    "settings.tabOrganization": "Organization",
    "settings.tabOrganizationShort": "Org",
    "settings.tabReports": "Reports",
    "settings.tabReportsShort": "Rep.",
    "settings.tabGeneral": "General",
    "settings.tabGeneralShort": "More",

    // Profile tab
    "settings.profileTitle": "Profile",
    "settings.profileDesc": "Manage your personal information",
    "settings.profileImage": "Profile picture",
    "settings.name": "Name",
    "settings.namePlaceholder": "Your name",
    "settings.email": "Email",
    "settings.saveChanges": "Save changes",
    "settings.profileSaveErrorTitle": "Error",
    "settings.profileSaveErrorDesc": "Could not save profile changes",
    "settings.profileSavedTitle": "Saved!",
    "settings.profileSavedDesc": "Your profile has been updated",

    // General tab
    "settings.generalTitle": "General settings",
    "settings.generalDesc": "General system settings",
    "settings.emailNotifications": "Email notifications",
    "settings.emailNotificationsDesc": "Get reminders about follow-ups and tasks",
    "settings.weeklySummary": "Weekly summary",
    "settings.weeklySummaryDesc": "Get a summary of the week's activities",

    // Common
    "settings.cancel": "Cancel",
    "settings.error": "Error",
    "settings.saving": "Saving...",

    // ProfileImageUpload
    "settings.invalidFileTypeTitle": "Invalid file type",
    "settings.invalidFileTypeDesc": "Only JPG, PNG, WebP, GIF and SVG are supported",
    "settings.fileTooLargeTitle": "File too large",
    "settings.fileTooLargeDesc": "Maximum file size is 5MB",
    "settings.uploadedTitle": "Uploaded!",
    "settings.avatarUpdatedDesc": "Your profile picture has been updated",
    "settings.logoUpdatedDesc": "The logo has been updated",
    "settings.uploadErrorTitle": "Upload error",
    "settings.uploadErrorDesc": "Could not upload the image",
    "settings.companyLogoAlt": "Company logo",
    "settings.noLogo": "No logo",
    "settings.uploadImage": "Upload image",
    "settings.uploadLogo": "Upload logo",
    "settings.remove": "Remove",

    // EmailSignatureSettings — tones
    "settings.toneStandardLabel": "Standard",
    "settings.toneStandardDesc": "Balanced and professional",
    "settings.toneStandardExample": `Hi,

I analyzed your website and noticed that the SEO score is at 45/100. There are good opportunities to improve your visibility in search engines.

Do you have time for a short call about how you can reach more potential customers?`,
    "settings.toneFamiliarLabel": "Familiar",
    "settings.toneFamiliarDesc": "Warm and personal",
    "settings.toneFamiliarExample": `Hi!

I just took a look at your site and got curious – you have a really nice design! I did notice the SEO score landed at 45/100, which is often due to small technical things that are easy to fix.

It would be fun to hear more about your business – do you have a few minutes to spare?`,
    "settings.toneInformativeLabel": "Informative",
    "settings.toneInformativeDesc": "Fact-based and educational",
    "settings.toneInformativeExample": `Hi,

After analyzing your website I can confirm that the SEO score is at 45/100. This affects your visibility in search results – studies show that 75% of users never scroll past the first page of Google.

The main areas for improvement I identified concern meta descriptions and heading structure. Would you like me to go through them in more detail?`,
    "settings.toneDirectLabel": "Direct",
    "settings.toneDirectDesc": "Straight to the point, concise",
    "settings.toneDirectExample": `Hi,

Analyzed your site – SEO: 45/100. You're likely losing traffic.

Can we take 15 minutes next week to go through the quickest improvements?`,

    // EmailSignatureSettings — save toasts
    "settings.signatureSavedTitle": "Settings saved",
    "settings.signatureSavedDesc": "Your outreach settings have been updated",
    "settings.signatureSaveErrorDesc": "Could not save the settings",

    // EmailSignatureSettings — sender & signature card
    "settings.senderCardTitle": "Sender & signature",
    "settings.senderCardDesc": "Customize how your outreach emails appear to the recipient",
    "settings.senderName": "Sender name",
    "settings.senderNamePlaceholder": "Your name or company",
    "settings.senderNameHelp": "This name is shown as the sender in the recipient's inbox. Leave empty to use your full name or company name.",
    "settings.preview": "Preview:",
    "settings.senderFallbackName": "Kod & Co.",
    "settings.companyName": "Company name",
    "settings.companyNamePlaceholder": "Your Company Ltd",
    "settings.companyWebsite": "Website",
    "settings.companyWebsitePlaceholder": "https://yourcompany.com",
    "settings.companyLogo": "Company logo",
    "settings.emailSignature": "Email signature",
    "settings.emailSignatureFallbackName": "Your Name",
    "settings.emailSignatureFallbackCompany": "The Company",
    "settings.emailSignatureHelp": "Added to the end of every AI-generated email",
    "settings.emailFooter": "Email footer (optional)",
    "settings.emailFooterPlaceholder": "E.g. unsubscribe link, company address, disclaimer...",
    "settings.emailFooterHelp": "Extra text added at the very end of the email",
    "settings.signaturePreviewLabel": "Signature preview",
    "settings.signaturePreviewPlaceholder": "[AI-generated email text goes here...]",
    "settings.logoAlt": "Logo",
    "settings.saveSettings": "Save settings",

    // EmailSignatureSettings — tone card
    "settings.toneCardTitle": "Tone for AI emails",
    "settings.toneCardDesc": "Choose how your AI-generated outreach emails should sound",
    "settings.toneExampleLabel": "Example of {tone} tone:",
    "settings.toneExampleHelp": "This is an example. Actual emails are tailored to each lead's analysis results.",
    "settings.saveTone": "Save tone",

    // ServiceProfileSettings — industry templates
    "settings.industryWebLabel": "Web agency / IT",
    "settings.industryWebDesc": "Websites, SEO, Google Ads, web development",
    "settings.industryWebTemplate": `We help companies get noticed online through professional websites, search engine optimization (SEO) and digital marketing. Our services include:

• Website development and design
• SEO and visibility on Google
• Google Ads campaigns
• Web analytics and optimization

We focus on delivering measurable results that increase visibility and conversions.`,
    "settings.industryTelephonyLabel": "Telephony / Telecom",
    "settings.industryTelephonyDesc": "Mobile plans, PBX solutions, business telephony",
    "settings.industryTelephonyTemplate": `We offer cost-effective telephony solutions for businesses. Our services include:

• Mobile plans for businesses
• Cloud-based PBX solutions
• Fixed telephony and SIP trunking
• Consolidated invoices and simplified administration

We analyze the company's current telephony costs and propose optimized solutions.`,
    "settings.industryFleetLabel": "Vehicle leasing",
    "settings.industryFleetDesc": "Car leasing, vehicle fleet, company cars",
    "settings.industryFleetTemplate": `We help companies with cost-effective and flexible leasing solutions for their vehicle fleet. Our services include:

• Operational and financial leasing
• Company cars and benefit cars
• Electric cars and eco-friendly alternatives
• Fleet services and administration

We analyze the company's current vehicle fleet and propose optimized agreements.`,
    "settings.industryItLabel": "IT services / Consulting",
    "settings.industryItDesc": "Systems development, IT support, cloud services",
    "settings.industryItTemplate": `We deliver IT services that streamline and secure your operations. Our services include:

• IT support and helpdesk
• Cloud solutions and Microsoft 365
• Systems development and integration
• IT security and backup

We help companies focus on their core business while we take care of the IT.`,
    "settings.industryCustomLabel": "Custom industry",
    "settings.industryCustomDesc": "Write your own description of your services",

    // ServiceProfileSettings — toasts
    "settings.serviceProfileSavedTitle": "Service profile saved",
    "settings.serviceProfileSavedDesc": "Your service profile will now be used for outreach generation",
    "settings.serviceProfileSaveErrorDesc": "Could not save the service profile",

    // ServiceProfileSettings — card
    "settings.serviceProfileTitle": "Service profile for Outreach",
    "settings.serviceProfileDesc": "Describe what your organization sells so the AI can generate relevant outreach regardless of industry",
    "settings.chooseIndustryTemplate": "Choose an industry template (quick start)",
    "settings.serviceDescription": "Service description",
    "settings.serviceDescriptionPlaceholder": "Describe what your organization sells, your main services, target audience and unique selling points. This is used by the AI to generate relevant outreach...",
    "settings.serviceDescriptionHelp": "The more detailed the description, the better tailored the outreach. Feel free to mention specific services, pricing, and what sets you apart from competitors.",
    "settings.aiPreviewLabel": "Preview for AI",
    "settings.aiPreviewIntro": "The AI will use this information when generating outreach:",
    "settings.industryLabel": "Industry: {industry}",
    "settings.industryNotSelected": "Not selected",
    "settings.serviceProfileHelpTitle": "💡 How is the service profile used?",
    "settings.serviceProfileHelpTelephony": "Telephony sales:",
    "settings.serviceProfileHelpTelephonyDesc": "The AI references the lead's existing operator and plan from the Vehicle Data & Telephony module",
    "settings.serviceProfileHelpFleet": "Vehicle leasing:",
    "settings.serviceProfileHelpFleetDesc": "The AI analyzes the lead's vehicle fleet and proposes optimized solutions",
    "settings.serviceProfileHelpWeb": "Web agency:",
    "settings.serviceProfileHelpWebDesc": "The AI uses web analytics data as before to pitch SEO/Ads",
    "settings.serviceProfileHelpCustom": "Custom industry:",
    "settings.serviceProfileHelpCustomDesc": "The AI works entirely from your description and adapts to the available lead data",
    "settings.saveServiceProfile": "Save service profile",

    // OrganizationEmailSettings
    "settings.noOrgTitle": "No organization",
    "settings.noOrgDesc": "You don't belong to any organization yet.",
    "settings.orgEmailSavedTitle": "Email settings saved",
    "settings.orgEmailSavedDesc": "The organization's email configuration has been updated.",
    "settings.orgEmailSaveErrorDesc": "Could not save the email settings",
    "settings.noOrgMembership": "You don't belong to any organization.",
    "settings.orgEmailTitle": "Organization email settings",
    "settings.orgEmailAdminOnly": "Only administrators can change the organization's email settings.",
    "settings.senderLabel": "Sender:",
    "settings.notConfigured": "Not configured",
    "settings.orgEmailDesc": "Configure how outreach emails are sent from your organization",
    "settings.orgSenderNamePlaceholder": "Your Organization",
    "settings.senderAddress": "Sender address",
    "settings.orgSenderEmailPlaceholder": "hi@yourorganization.com",
    "settings.orgPreviewFallbackName": "Your Organization",
    "settings.ownResendKey": "Own Resend API key",
    "settings.resendConfigured": "A custom Resend API key is configured. Emails are sent from your verified domain.",
    "settings.resendSetupIntro": "To send emails from {domain} you need to:",
    "settings.resendSetupDomainFallback": "your own domain",
    "settings.resendStep1": "Create an account at",
    "settings.resendStep2": "Verify your domain (DNS records)",
    "settings.resendStep3": "Create an API key",
    "settings.resendStep4": "Contact support to add the key",
    "settings.resendDefaultNote": "Without your own key, emails are sent from the default address noreply@resend.dev",
    "settings.saveOrgEmail": "Save email settings",

    // TeamManagement & OrganizationDashboard — shared
    "settings.notLoggedIn": "Not logged in",
    "settings.inviteCreatedTitle": "Invite code created!",
    "settings.inviteCreatedDesc": "The code {code} can now be used at registration",
    "settings.inviteCreateErrorDesc": "Could not create invite code",
    "settings.fillAllFields": "Fill in all fields",
    "settings.userCreatedTitle": "User created!",
    "settings.userCreatedDesc": "{email} has been added to the team",
    "settings.userCreateErrorDesc": "Could not create user",
    "settings.inviteDeleteErrorDesc": "Could not delete the invite code",
    "settings.inviteDeletedTitle": "Invite code deleted",
    "settings.roleAdmin": "Admin",
    "settings.roleUser": "User",

    // TeamManagement — team members card
    "settings.teamMembersTitle": "Team members",
    "settings.teamMembersDesc": "Users in your organization",
    "settings.addUser": "Add user",

    // Invite codes card
    "settings.inviteCodesTitle": "Invite codes",
    "settings.inviteCodesDesc": "Share codes to let new users register",
    "settings.createCode": "Create code",
    "settings.noActiveInvites": "No active invite codes",
    "settings.usesLabel": "{uses}/{max} uses",
    "settings.inactive": "Inactive",

    // Add user dialog
    "settings.addUserTitle": "Add user",
    "settings.addUserDesc": "Create a new account for a team member",
    "settings.emailRequired": "Email *",
    "settings.emailPlaceholder": "email@company.com",
    "settings.passwordRequired": "Password *",
    "settings.passwordPlaceholder": "At least 6 characters",
    "settings.fullNamePlaceholder": "First name Last name",
    "settings.role": "Role",
    "settings.createUser": "Create user",

    // Invite code dialog
    "settings.createInviteTitle": "Create invite code",
    "settings.createInviteDesc": "Generate a code that new users can use at registration",
    "settings.numberOfUses": "Number of uses",
    "settings.uses1": "1 use",
    "settings.uses5": "5 uses",
    "settings.uses10": "10 uses",
    "settings.usesUnlimited": "Unlimited (100)",
    "settings.generateCode": "Generate code",

    // OrganizationDashboard — automation toasts
    "settings.autoEnrichEnabled": "Automatic analysis enabled",
    "settings.autoEnrichDisabled": "Automatic analysis disabled",

    // OrganizationDashboard — module toggle toasts
    "settings.moduleEnabled": "Module enabled",
    "settings.moduleDisabled": "Module disabled",
    "settings.moduleForUser": "{module} for the user",
    "settings.moduleStatusErrorDesc": "Could not change module status",

    // OrganizationDashboard — role toggle toasts
    "settings.roleUpdatedTitle": "Role updated",
    "settings.roleUpdatedDesc": "The user is now {role}",
    "settings.roleAdminFull": "an administrator",
    "settings.roleUserFull": "a regular user",
    "settings.roleChangeErrorDesc": "Could not change role",

    // OrganizationDashboard — org settings toasts
    "settings.orgInfoSaveErrorDesc": "Could not save organization details",
    "settings.orgInfoSavedTitle": "Saved!",
    "settings.orgInfoSavedDesc": "The organization details have been updated",

    // OrganizationDashboard — stats bar
    "settings.statUsers": "users",
    "settings.statAdmins": "admins",
    "settings.statActiveInvites": "active invites",

    // OrganizationDashboard — tabs
    "settings.tabModules": "Modules",
    "settings.tabMembers": "Users",
    "settings.tabInvites": "Invites",
    "settings.tabCompanyInfo": "Company info",
    "settings.tabAutomation": "Automation",

    // OrganizationDashboard — modules tab
    "settings.modulePermissionsTitle": "Module permissions",
    "settings.modulePermissionsDesc": "Enable or disable modules for each user",
    "settings.colUser": "User",

    // OrganizationDashboard — members tab
    "settings.membersTitle": "Users",
    "settings.membersDesc": "Manage team members and roles",
    "settings.add": "Add",
    "settings.colEmail": "Email",
    "settings.colRole": "Role",
    "settings.colAdmin": "Admin",

    // OrganizationDashboard — invites tab
    "settings.noInvitesYet": "No invite codes yet",
    "settings.colCode": "Code",
    "settings.colUses": "Uses",
    "settings.colStatus": "Status",
    "settings.active": "Active",

    // OrganizationDashboard — organization tab
    "settings.companyInfoTitle": "Company information",
    "settings.companyInfoDesc": "Details shown in email signatures etc.",
    "settings.orgCompanyNamePlaceholder": "My Company Ltd",
    "settings.orgCompanyWebsitePlaceholder": "https://mycompany.com",
    "settings.saveInfo": "Save details",

    // OrganizationDashboard — automation tab
    "settings.automationTitle": "Automation",
    "settings.automationDesc": "Control how leads are analyzed and enriched automatically",
    "settings.autoAnalyzeLabel": "Analyze new leads automatically",
    "settings.autoAnalyzeDesc": "Run web analysis and create email drafts for new leads automatically. Turn off to save API calls.",
  },
  es: {
    // Settings page — layout & tabs
    "settings.pageTitle": "Ajustes",
    "settings.editTemplateTitle": "Editar plantilla",
    "settings.tabProfile": "Perfil",
    "settings.tabOutreach": "Outreach",
    "settings.tabOutreachShort": "Correo",
    "settings.tabTemplates": "Plantillas",
    "settings.tabOrganization": "Organización",
    "settings.tabOrganizationShort": "Org",
    "settings.tabReports": "Informes",
    "settings.tabReportsShort": "Inf.",
    "settings.tabGeneral": "General",
    "settings.tabGeneralShort": "Más",

    // Profile tab
    "settings.profileTitle": "Perfil",
    "settings.profileDesc": "Gestiona tu información personal",
    "settings.profileImage": "Foto de perfil",
    "settings.name": "Nombre",
    "settings.namePlaceholder": "Tu nombre",
    "settings.email": "Correo",
    "settings.saveChanges": "Guardar cambios",
    "settings.profileSaveErrorTitle": "Error",
    "settings.profileSaveErrorDesc": "No se pudieron guardar los cambios del perfil",
    "settings.profileSavedTitle": "¡Guardado!",
    "settings.profileSavedDesc": "Tu perfil se ha actualizado",

    // General tab
    "settings.generalTitle": "Ajustes generales",
    "settings.generalDesc": "Ajustes generales del sistema",
    "settings.emailNotifications": "Notificaciones por correo",
    "settings.emailNotificationsDesc": "Recibe recordatorios de seguimientos y tareas",
    "settings.weeklySummary": "Resumen semanal",
    "settings.weeklySummaryDesc": "Recibe un resumen de las actividades de la semana",

    // Common
    "settings.cancel": "Cancelar",
    "settings.error": "Error",
    "settings.saving": "Guardando...",

    // ProfileImageUpload
    "settings.invalidFileTypeTitle": "Tipo de archivo no válido",
    "settings.invalidFileTypeDesc": "Solo se admiten JPG, PNG, WebP, GIF y SVG",
    "settings.fileTooLargeTitle": "Archivo demasiado grande",
    "settings.fileTooLargeDesc": "El tamaño máximo de archivo es 5MB",
    "settings.uploadedTitle": "¡Subido!",
    "settings.avatarUpdatedDesc": "Tu foto de perfil se ha actualizado",
    "settings.logoUpdatedDesc": "El logo se ha actualizado",
    "settings.uploadErrorTitle": "Error de subida",
    "settings.uploadErrorDesc": "No se pudo subir la imagen",
    "settings.companyLogoAlt": "Logo de la empresa",
    "settings.noLogo": "Sin logo",
    "settings.uploadImage": "Subir imagen",
    "settings.uploadLogo": "Subir logo",
    "settings.remove": "Eliminar",

    // EmailSignatureSettings — tones
    "settings.toneStandardLabel": "Estándar",
    "settings.toneStandardDesc": "Equilibrado y profesional",
    "settings.toneStandardExample": `Hola,

He analizado vuestro sitio web y noté que la puntuación de SEO está en 45/100. Hay buenas oportunidades para mejorar vuestra visibilidad en los motores de búsqueda.

¿Tenéis tiempo para una breve llamada sobre cómo podéis llegar a más clientes potenciales?`,
    "settings.toneFamiliarLabel": "Familiar",
    "settings.toneFamiliarDesc": "Cálido y personal",
    "settings.toneFamiliarExample": `¡Hola!

Acabo de echar un vistazo a vuestro sitio y me dio curiosidad: ¡tenéis un diseño realmente bonito! Aunque vi que la puntuación de SEO quedó en 45/100, lo que suele deberse a pequeños detalles técnicos fáciles de arreglar.

Me encantaría saber más sobre vuestro negocio, ¿tienes unos minutos?`,
    "settings.toneInformativeLabel": "Informativo",
    "settings.toneInformativeDesc": "Basado en hechos y pedagógico",
    "settings.toneInformativeExample": `Hola,

Tras analizar vuestro sitio web puedo confirmar que la puntuación de SEO está en 45/100. Esto afecta a vuestra visibilidad en los resultados de búsqueda: los estudios muestran que el 75% de los usuarios nunca pasan de la primera página de Google.

Las principales áreas de mejora que identifiqué tienen que ver con las metadescripciones y la estructura de encabezados. ¿Quieres que las repase con más detalle?`,
    "settings.toneDirectLabel": "Directo",
    "settings.toneDirectDesc": "Al grano, conciso",
    "settings.toneDirectExample": `Hola,

Analicé vuestro sitio – SEO: 45/100. Probablemente estáis perdiendo tráfico.

¿Podemos dedicar 15 minutos la próxima semana para repasar las mejoras más rápidas?`,

    // EmailSignatureSettings — save toasts
    "settings.signatureSavedTitle": "Ajustes guardados",
    "settings.signatureSavedDesc": "Tus ajustes de outreach se han actualizado",
    "settings.signatureSaveErrorDesc": "No se pudieron guardar los ajustes",

    // EmailSignatureSettings — sender & signature card
    "settings.senderCardTitle": "Remitente y firma",
    "settings.senderCardDesc": "Personaliza cómo se muestran tus correos de outreach al destinatario",
    "settings.senderName": "Nombre del remitente",
    "settings.senderNamePlaceholder": "Tu nombre o empresa",
    "settings.senderNameHelp": "Este nombre se muestra como remitente en la bandeja de entrada del destinatario. Déjalo vacío para usar tu nombre completo o el nombre de la empresa.",
    "settings.preview": "Vista previa:",
    "settings.senderFallbackName": "Kod & Co.",
    "settings.companyName": "Nombre de la empresa",
    "settings.companyNamePlaceholder": "Tu Empresa S.L.",
    "settings.companyWebsite": "Sitio web",
    "settings.companyWebsitePlaceholder": "https://tuempresa.com",
    "settings.companyLogo": "Logo de la empresa",
    "settings.emailSignature": "Firma de correo",
    "settings.emailSignatureFallbackName": "Tu Nombre",
    "settings.emailSignatureFallbackCompany": "La Empresa",
    "settings.emailSignatureHelp": "Se añade al final de cada correo generado por IA",
    "settings.emailFooter": "Pie de correo (opcional)",
    "settings.emailFooterPlaceholder": "P. ej. enlace de baja, dirección de la empresa, aviso legal...",
    "settings.emailFooterHelp": "Texto adicional que se añade al final del correo",
    "settings.signaturePreviewLabel": "Vista previa de la firma",
    "settings.signaturePreviewPlaceholder": "[El texto del correo generado por IA aparecerá aquí...]",
    "settings.logoAlt": "Logotipo",
    "settings.saveSettings": "Guardar ajustes",

    // EmailSignatureSettings — tone card
    "settings.toneCardTitle": "Tono para correos de IA",
    "settings.toneCardDesc": "Elige cómo deben sonar tus correos de outreach generados por IA",
    "settings.toneExampleLabel": "Ejemplo de tono {tone}:",
    "settings.toneExampleHelp": "Esto es un ejemplo. Los correos reales se adaptan a los resultados del análisis de cada lead.",
    "settings.saveTone": "Guardar tono",

    // ServiceProfileSettings — industry templates
    "settings.industryWebLabel": "Agencia web / IT",
    "settings.industryWebDesc": "Sitios web, SEO, Google Ads, desarrollo web",
    "settings.industryWebTemplate": `Ayudamos a las empresas a destacar en internet con sitios web profesionales, optimización para motores de búsqueda (SEO) y marketing digital. Nuestros servicios incluyen:

• Desarrollo y diseño de sitios web
• SEO y visibilidad en Google
• Campañas de Google Ads
• Analítica web y optimización

Nos centramos en ofrecer resultados medibles que aumentan la visibilidad y las conversiones.`,
    "settings.industryTelephonyLabel": "Telefonía / Telecom",
    "settings.industryTelephonyDesc": "Planes móviles, centralitas, telefonía empresarial",
    "settings.industryTelephonyTemplate": `Ofrecemos soluciones de telefonía rentables para empresas. Nuestros servicios incluyen:

• Planes móviles para empresas
• Centralitas en la nube
• Telefonía fija y SIP trunking
• Facturas unificadas y administración simplificada

Analizamos los costes de telefonía actuales de la empresa y proponemos soluciones optimizadas.`,
    "settings.industryFleetLabel": "Leasing de vehículos",
    "settings.industryFleetDesc": "Leasing de coches, flota de vehículos, coches de empresa",
    "settings.industryFleetTemplate": `Ayudamos a las empresas con soluciones de leasing rentables y flexibles para su flota de vehículos. Nuestros servicios incluyen:

• Leasing operativo y financiero
• Coches de empresa y vehículos de uso mixto
• Coches eléctricos y alternativas ecológicas
• Servicios de flota y administración

Analizamos la flota de vehículos actual de la empresa y proponemos acuerdos optimizados.`,
    "settings.industryItLabel": "Servicios IT / Consultoría",
    "settings.industryItDesc": "Desarrollo de sistemas, soporte IT, servicios en la nube",
    "settings.industryItTemplate": `Ofrecemos servicios de IT que optimizan y protegen la operación. Nuestros servicios incluyen:

• Soporte IT y helpdesk
• Soluciones en la nube y Microsoft 365
• Desarrollo de sistemas e integración
• Seguridad IT y copias de seguridad

Ayudamos a las empresas a centrarse en su actividad principal mientras nosotros nos encargamos de la IT.`,
    "settings.industryCustomLabel": "Sector propio",
    "settings.industryCustomDesc": "Escribe tu propia descripción de tus servicios",

    // ServiceProfileSettings — toasts
    "settings.serviceProfileSavedTitle": "Perfil de servicio guardado",
    "settings.serviceProfileSavedDesc": "Tu perfil de servicio se usará ahora para generar outreach",
    "settings.serviceProfileSaveErrorDesc": "No se pudo guardar el perfil de servicio",

    // ServiceProfileSettings — card
    "settings.serviceProfileTitle": "Perfil de servicio para Outreach",
    "settings.serviceProfileDesc": "Describe lo que vende tu organización para que la IA pueda generar outreach relevante sea cual sea el sector",
    "settings.chooseIndustryTemplate": "Elige una plantilla de sector (inicio rápido)",
    "settings.serviceDescription": "Descripción del servicio",
    "settings.serviceDescriptionPlaceholder": "Describe lo que vende tu organización, vuestros servicios principales, público objetivo y argumentos de venta únicos. La IA lo usa para generar outreach relevante...",
    "settings.serviceDescriptionHelp": "Cuanto más detallada sea la descripción, mejor adaptado será el outreach. Menciona servicios específicos, precios y lo que os diferencia de la competencia.",
    "settings.aiPreviewLabel": "Vista previa para la IA",
    "settings.aiPreviewIntro": "La IA usará esta información al generar el outreach:",
    "settings.industryLabel": "Sector: {industry}",
    "settings.industryNotSelected": "Sin seleccionar",
    "settings.serviceProfileHelpTitle": "💡 ¿Cómo se usa el perfil de servicio?",
    "settings.serviceProfileHelpTelephony": "Venta de telefonía:",
    "settings.serviceProfileHelpTelephonyDesc": "La IA hace referencia al operador y plan actuales del lead desde el módulo Datos de vehículos y telefonía",
    "settings.serviceProfileHelpFleet": "Leasing de vehículos:",
    "settings.serviceProfileHelpFleetDesc": "La IA analiza la flota de vehículos del lead y propone soluciones optimizadas",
    "settings.serviceProfileHelpWeb": "Agencia web:",
    "settings.serviceProfileHelpWebDesc": "La IA usa los datos de análisis web como antes para presentar SEO/Ads",
    "settings.serviceProfileHelpCustom": "Sector propio:",
    "settings.serviceProfileHelpCustomDesc": "La IA parte por completo de tu descripción y se adapta a los datos disponibles del lead",
    "settings.saveServiceProfile": "Guardar perfil de servicio",

    // OrganizationEmailSettings
    "settings.noOrgTitle": "Sin organización",
    "settings.noOrgDesc": "Aún no perteneces a ninguna organización.",
    "settings.orgEmailSavedTitle": "Ajustes de correo guardados",
    "settings.orgEmailSavedDesc": "La configuración de correo de la organización se ha actualizado.",
    "settings.orgEmailSaveErrorDesc": "No se pudieron guardar los ajustes de correo",
    "settings.noOrgMembership": "No perteneces a ninguna organización.",
    "settings.orgEmailTitle": "Ajustes de correo de la organización",
    "settings.orgEmailAdminOnly": "Solo los administradores pueden cambiar los ajustes de correo de la organización.",
    "settings.senderLabel": "Remitente:",
    "settings.notConfigured": "Sin configurar",
    "settings.orgEmailDesc": "Configura cómo se envían los correos de outreach desde tu organización",
    "settings.orgSenderNamePlaceholder": "Tu Organización",
    "settings.senderAddress": "Dirección del remitente",
    "settings.orgSenderEmailPlaceholder": "hola@tuorganizacion.com",
    "settings.orgPreviewFallbackName": "Tu Organización",
    "settings.ownResendKey": "Clave API de Resend propia",
    "settings.resendConfigured": "Hay una clave API de Resend propia configurada. Los correos se envían desde vuestro dominio verificado.",
    "settings.resendSetupIntro": "Para enviar correos desde {domain} necesitas:",
    "settings.resendSetupDomainFallback": "vuestro propio dominio",
    "settings.resendStep1": "Crear una cuenta en",
    "settings.resendStep2": "Verificar tu dominio (registros DNS)",
    "settings.resendStep3": "Crear una clave API",
    "settings.resendStep4": "Contactar con soporte para añadir la clave",
    "settings.resendDefaultNote": "Sin una clave propia, los correos se envían desde la dirección predeterminada noreply@resend.dev",
    "settings.saveOrgEmail": "Guardar ajustes de correo",

    // TeamManagement & OrganizationDashboard — shared
    "settings.notLoggedIn": "No has iniciado sesión",
    "settings.inviteCreatedTitle": "¡Código de invitación creado!",
    "settings.inviteCreatedDesc": "El código {code} ya se puede usar al registrarse",
    "settings.inviteCreateErrorDesc": "No se pudo crear el código de invitación",
    "settings.fillAllFields": "Rellena todos los campos",
    "settings.userCreatedTitle": "¡Usuario creado!",
    "settings.userCreatedDesc": "{email} se ha añadido al equipo",
    "settings.userCreateErrorDesc": "No se pudo crear el usuario",
    "settings.inviteDeleteErrorDesc": "No se pudo eliminar el código de invitación",
    "settings.inviteDeletedTitle": "Código de invitación eliminado",
    "settings.roleAdmin": "Admin",
    "settings.roleUser": "Usuario",

    // TeamManagement — team members card
    "settings.teamMembersTitle": "Miembros del equipo",
    "settings.teamMembersDesc": "Usuarios de tu organización",
    "settings.addUser": "Añadir usuario",

    // Invite codes card
    "settings.inviteCodesTitle": "Códigos de invitación",
    "settings.inviteCodesDesc": "Comparte códigos para que nuevos usuarios se registren",
    "settings.createCode": "Crear código",
    "settings.noActiveInvites": "No hay códigos de invitación activos",
    "settings.usesLabel": "{uses}/{max} usos",
    "settings.inactive": "Inactivo",

    // Add user dialog
    "settings.addUserTitle": "Añadir usuario",
    "settings.addUserDesc": "Crea una cuenta nueva para un miembro del equipo",
    "settings.emailRequired": "Correo *",
    "settings.emailPlaceholder": "correo@empresa.com",
    "settings.passwordRequired": "Contraseña *",
    "settings.passwordPlaceholder": "Al menos 6 caracteres",
    "settings.fullNamePlaceholder": "Nombre Apellido",
    "settings.role": "Rol",
    "settings.createUser": "Crear usuario",

    // Invite code dialog
    "settings.createInviteTitle": "Crear código de invitación",
    "settings.createInviteDesc": "Genera un código que los nuevos usuarios puedan usar al registrarse",
    "settings.numberOfUses": "Número de usos",
    "settings.uses1": "1 uso",
    "settings.uses5": "5 usos",
    "settings.uses10": "10 usos",
    "settings.usesUnlimited": "Ilimitado (100)",
    "settings.generateCode": "Generar código",

    // OrganizationDashboard — automation toasts
    "settings.autoEnrichEnabled": "Análisis automático activado",
    "settings.autoEnrichDisabled": "Análisis automático desactivado",

    // OrganizationDashboard — module toggle toasts
    "settings.moduleEnabled": "Módulo activado",
    "settings.moduleDisabled": "Módulo desactivado",
    "settings.moduleForUser": "{module} para el usuario",
    "settings.moduleStatusErrorDesc": "No se pudo cambiar el estado del módulo",

    // OrganizationDashboard — role toggle toasts
    "settings.roleUpdatedTitle": "Rol actualizado",
    "settings.roleUpdatedDesc": "El usuario ahora es {role}",
    "settings.roleAdminFull": "administrador",
    "settings.roleUserFull": "usuario normal",
    "settings.roleChangeErrorDesc": "No se pudo cambiar el rol",

    // OrganizationDashboard — org settings toasts
    "settings.orgInfoSaveErrorDesc": "No se pudieron guardar los datos de la organización",
    "settings.orgInfoSavedTitle": "¡Guardado!",
    "settings.orgInfoSavedDesc": "Los datos de la organización se han actualizado",

    // OrganizationDashboard — stats bar
    "settings.statUsers": "usuarios",
    "settings.statAdmins": "admins",
    "settings.statActiveInvites": "invitaciones activas",

    // OrganizationDashboard — tabs
    "settings.tabModules": "Módulos",
    "settings.tabMembers": "Usuarios",
    "settings.tabInvites": "Invitaciones",
    "settings.tabCompanyInfo": "Info de empresa",
    "settings.tabAutomation": "Automatización",

    // OrganizationDashboard — modules tab
    "settings.modulePermissionsTitle": "Permisos de módulos",
    "settings.modulePermissionsDesc": "Activa o desactiva módulos para cada usuario",
    "settings.colUser": "Usuario",

    // OrganizationDashboard — members tab
    "settings.membersTitle": "Usuarios",
    "settings.membersDesc": "Gestiona miembros del equipo y roles",
    "settings.add": "Añadir",
    "settings.colEmail": "Correo",
    "settings.colRole": "Rol",
    "settings.colAdmin": "Admin",

    // OrganizationDashboard — invites tab
    "settings.noInvitesYet": "Aún no hay códigos de invitación",
    "settings.colCode": "Código",
    "settings.colUses": "Usos",
    "settings.colStatus": "Estado",
    "settings.active": "Activo",

    // OrganizationDashboard — organization tab
    "settings.companyInfoTitle": "Información de la empresa",
    "settings.companyInfoDesc": "Datos que se muestran en las firmas de correo, etc.",
    "settings.orgCompanyNamePlaceholder": "Mi Empresa S.L.",
    "settings.orgCompanyWebsitePlaceholder": "https://miempresa.com",
    "settings.saveInfo": "Guardar datos",

    // OrganizationDashboard — automation tab
    "settings.automationTitle": "Automatización",
    "settings.automationDesc": "Controla cómo se analizan y enriquecen los leads automáticamente",
    "settings.autoAnalyzeLabel": "Analizar nuevos leads automáticamente",
    "settings.autoAnalyzeDesc": "Ejecuta el análisis web y crea borradores de correo para nuevos leads automáticamente. Desactívalo para ahorrar llamadas a la API.",
  },
};
