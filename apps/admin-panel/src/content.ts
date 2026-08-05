export const Content = {
	/* -------------------- Header -------------------- */
	"header.logo.alt": "BärGPT Logo",
	"header.navigation.help.label": "Hilfe und Tipps",
	"header.navigation.help.mobileLabel": "Hilfe",
	"header.navigation.profile": "Profil",
	"header.navigation.help.ariaLabel": "Hilfe und Tipps",
	"header.navigation.help.link": "https://hilfe.baergpt.berlin/",
	"header.navigation.profile.ariaLabel": "Zur Profil-Seite",

	/* -------------------- Icons Img Alt -------------------- */
	"chevronIcon.up.imgAlt": "Sparren nach oben",
	"chevronIcon.down.imgAlt": "Sparren nach unten",
	"arrowWhiteRightIcon.imgAlt": "Ein weißer Pfeil nach rechts",
	"arrowWhiteTopRightIcon.imgAlt": "Ein weißer Pfeil nach oben rechts",
	"eyeIcon.imgAlt": "Ein Augen-Icon",
	"eyeStruckThroughIcon.imgAlt": "Ein durchgestrichenes Augen-Icon",

	/* ---------------------- Login Form ---------------------- */
	"loginPage.h1": "Willkommen zurück",
	"loginPage.h2": "Bitte melden Sie sich an",
	"loginPage.emailLabel": "E-Mail-Adresse",
	"loginPage.passwordLabel": "Passwort",
	"loginPage.submitButton": "Anmelden",

	/* ---------------------- Unconfirmed Email ---------------------- */
	"unconfirmedEmail.h2": "Sie erhalten in Kürze eine E-Mail",
	"unconfirmedEmail.text.beforeEmail":
		"Prüfen Sie den Posteingang folgender Adresse:",
	"unconfirmedEmail.text.afterEmail": "Klicken Sie auf den Link in der E-Mail.",
	"unconfirmedEmail.p": "Keine E-Mail bekommen?",
	"unconfirmedEmail.list1.li1": "Bitte prüfen Sie auch Ihren Spam-Ordner",
	"unconfirmedEmail.list1.li2":
		"Falls nach fünf Minuten keine E-Mail angekommen ist, können Sie sie erneut senden",
	"unconfirmedEmail.resendButton": "E-Mail erneut senden",
	"unconfirmedEmail.resend.success": "E-Mail wurde versendet",

	/* ---------------------- Form/Input Validation ---------------------- */

	"form.validation.general.valueMissing": "Bitte füllen Sie dieses Feld aus.",
	"form.validation.email.typeMismatch": "Das E-Mail-Format ist falsch.",
	"form.validation.password.wrong.error": "Das Passwort ist falsch.",
	"form.validation.password.tooShort":
		"Das Passwort muss mindestens 6 Zeichen lang sein.",
	"form.validation.password.customError":
		"Die Passwörter stimmen nicht überein.",
	"form.validation.privacy.required.error":
		"Bitte stimmen Sie den Datenschutzbestimmungen zu.",
	"form.validation.invalidCredentials.error":
		"Benutzername oder Passwort inkorrekt",
	"form.validation.userBanned.error":
		"Der Benutzeraccount ist kein Administrator oder wurde gesperrt.",

	/* -------------------- Buttons -------------------- */
	//profileButton
	"profile.button.ariaLabel": "Profil öffnen",
	"profile.button.logout.ariaLabel": "Ausloggen",
	"profile.button.logout.label": "Ausloggen",

	/* ---------------------- Admin ---------------------- */
	"admin.sidebar.navigation.users": "Benutzerverwaltung",
	"admin.sidebar.navigation.baseKnowledge": "Base Knowledge",
	"admin.sidebar.navigation.productDashboard": "Product Dashboard",
	"admin.sidebar.navigation.domainAllowlist": "Domainverwaltung",
	"admin.sidebar.close": "Schließen",
	"admin.sidebar.title": "BÄRGPT Admin",
	"admin.button.link.label": "Admin-Bereich",

	/* ---------------------- Shared Table ---------------------- */
	"table.pageSizeDropdown.pageSize.label": "Anzeigen: ",
	"table.pageSizeDropdown.perTable": "pro Seite",
	"table.pageSizeDropdown.all.label": "Alle",
	"table.pagination.previousPage": "Zurück",
	"table.pagination.nextPage": "Weiter",
	"table.noResults": "Keine Ergebnisse.",

	/* ---------------------- User Table ---------------------- */
	"userTable.searchField.placeholder": "Suche nach Name oder E-Mail...",
	"userTable.statusFilterDropdown.label": "Status filtern",
	"userTable.statusFilterDropdown.all.label": "Status (alle)",
	"userTable.resultsCount.separator": "von",
	"userTable.resultsCount.label": "Benutzer:innen",
	// User Table Headers
	"userTable.tableHeader.firstName": "Vorname",
	"userTable.tableHeader.lastName": "Nachname",
	"userTable.tableHeader.email": "E-Mail",
	"userTable.tableHeader.registeredAt": "Registriert",
	"userTable.tableHeader.lastLoginAt": "Zuletzt aktiv",
	"userTable.tableHeader.inferences": "Inferenzen",
	"userTable.tableHeader.documents": "Dokumente",
	"userTable.tableHeader.status": "Status",
	"userTable.tableHeader.actions": "Bearbeiten",
	"userTable.tableHeader.actions.ariaLabel": "Benutzer bearbeiten",

	/* ---------------------- User Edit Modal ---------------------- */

	"userEditModal.title": "Benutzer bearbeiten",
	"userEditModal.form.title": "Persönliche Daten",
	"userEditModal.form.description":
		"Bearbeiten Sie die Benutzerdaten und Einstellungen",
	"userEditModal.form.titleLabel": "Titel",
	"userEditModal.form.academicTitle.placeholder": "keine Angabe",
	"userEditModal.form.academicTitle.defaultOption": "keine Angabe",
	"userEditModal.form.academicTitle.options": ["Dr.", "Prof.", "Prof. Dr."],
	"userEditModal.form.personalTitleLabel": "Anrede",
	"userEditModal.form.personalTitle.options": ["Frau", "Herr"],
	"userEditModal.form.personalTitle.placeholder": "keine Angabe",
	"userEditModal.form.personalTitle.defaultOption": "keine Angabe",
	"userEditModal.form.firstName": "Vorname",
	"userEditModal.form.firstNamePlaceholder": "Vorname eingeben",
	"userEditModal.form.lastName": "Nachname",
	"userEditModal.form.lastNamePlaceholder": "Nachname eingeben",
	"userEditModal.form.email": "E-Mail-Adresse",
	"userEditModal.form.emailPlaceholder": "E-Mail-Adresse eingeben",
	"userEditModal.form.isAdmin": "Admin",
	"userEditModal.form.button.save": "Änderungen speichern",
	"userEditModal.form.button.saved": "Änderungen gespeichert",

	"userEditModal.userInformationCard.title": "Benutzerinformationen",
	"userEditModal.userInformationCard.description":
		"Schreibgeschützte Informationen über den Benutzer",
	"userEditModal.userInformationCard.registeredAt": "Registriert seit",
	"userEditModal.userInformationCard.lastLoginAt": "Zuletzt aktiv",
	"userEditModal.userInformationCard.inferences": "Inferenzen",
	"userEditModal.userInformationCard.documents": "Dokumente",
	"userEditModal.userInformationCard.requests": "Anfragen",
	"userEditModal.userInformationCard.accountStatus": "Status",
	"userEditModal.userInformationCard.accountStatus.deactivated":
		"Deaktiviert am",
	"userEditModal.userInformationCard.resendInvite": "Erneut einladen",
	"userEditModal.userInformationCard.resendInvite.success":
		"Einladung verschickt",

	"userEditModal.dangerZoneCard.title": "Gefahrenbereich",
	"userEditModal.dangerZoneCard.description":
		"Benutzer sperren oder dauerhaft löschen",
	"userEditModal.dangerZoneCard.deleteUser.title": "Benutzer verwalten",
	"userEditModal.dangerZoneCard.deleteUser.description":
		"Benutzer sperren (reversibel) oder permanent löschen (irreversibel).",
	"userEditModal.dangerZoneCard.deleteUser.button": "Benutzer verwalten",

	"userEditModal.dangerZoneCard.unbanUser.title": "Benutzer freischalten",
	"userEditModal.dangerZoneCard.unbanUser.description":
		"Deaktivierten Benutzer wieder aktivieren und Zugang freischalten.",
	"userEditModal.dangerZoneCard.unbanUser.button": "Account freischalten",

	"userEditModal.unbanUserDialog.title": "Account freischalten",
	"userEditModal.unbanUserDialog.description.p1": "Möchten Sie den Account",
	"userEditModal.unbanUserDialog.description.p2":
		"wieder aktivieren? Der Account erhält dadurch wieder Zugang zum System.",
	"userEditModal.unbanUserDialog.button.cancel": "Abbrechen",
	"userEditModal.unbanUserDialog.button.unban": "Freischalten",

	"userEditModal.deleteUserDialog.title": "Account verwalten",
	"userEditModal.deleteUserDialog.description.p1":
		"Wählen Sie eine Aktion für:",
	"userEditModal.deleteUserDialog.ban.label": "Account sperren",
	"userEditModal.deleteUserDialog.ban.description":
		"Der Account wird gesperrt, aber alle Daten bleiben erhalten. Ein Account kann wieder freigeschaltet werden.",
	"userEditModal.deleteUserDialog.hardDelete.label": "Permanent löschen",
	"userEditModal.deleteUserDialog.hardDelete.description":
		"Der Account und alle zugehörigen Daten werden permanent gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.",
	"userEditModal.deleteUserDialog.button.cancel": "Abbrechen",
	"userEditModal.deleteUserDialog.button.confirm": "Aktion ausführen",
	"userEditModal.deleteUserDialog.button.ban": "Benutzer sperren",
	"userEditModal.deleteUserDialog.button.delete": "Permanent löschen",
	// User Edit Modal Form Validation
	"userEditModal.form.emailUpdatedSuccess":
		"E-Mail-Adresse erfolgreich aktualisiert",
	"userEditModal.form.invalidEmailError":
		"E-Mail-Format nicht zulässig. Bei Fragen support@baergpt.berlin kontaktieren.",
	"userEditModal.form.emailAlreadyInUseError":
		"Diese E-Mail-Adresse ist bereits in Verwendung.",
	"userEditModal.form.updateSuccess": "Benutzerdaten erfolgreich aktualisiert",

	/* ---------------------- Base Knowledge ---------------------- */
	// Upload PDF
	"baseKnowledge.uploadPDF.title": "PDF hochladen",
	"baseKnowledge.uploadPDF.description":
		"Lade PDF-Dokumente in die Base Knowledge hoch",
	"baseKnowledge.uploadPDF.label": "PDF-Datei",
	"baseKnowledge.uploadPDF.button.label": "PDF hochladen",
	"baseKnowledge.uploadPDF.uploadSuccess": "PDF erfolgreich hochgeladen",
	"baseKnowledge.uploadPDF.uploadError": "Fehler beim Hochladen des PDFs",
	// Uploaded PDF
	"baseKnowledge.uploadedPDF.title": "Hochgeladene PDFs",
	"baseKnowledge.uploadedPDF.description":
		"Verwalte die hochgeladenen PDF-Dokumente",
	"baseKnowledge.uploadedPDF.noDocuments": "Keine PDFs hochgeladen.",
	"baseKnowledge.uploadedPDF.item.size": "Größe:",
	"baseKnowledge.uploadedPDF.item.uploadedAt": "Hochgeladen am:",
	//fileUploadButtonStatus
	"fileUploadButtonStatus.uploading": "Dateien werden verarbeitet",
	"fileUploadButtonStatus.singleFileUploading": "Datei wird verarbeitet",
	"fileUploadButtonStatus.uploaded": "Upload erfolgreich",
	"fileUploadButtonStatus.failed": "Fehler beim Upload",
	// Delete Document Dialog
	"baseKnowledge.deleteDialog.title": "Datei löschen?",
	"baseKnowledge.deleteDialog.description":
		"Folgendes Element wirklich aus der Base Knowledge löschen?",
	"baseKnowledge.deleteDialog.deleteDocumentButton.label": "Dokument löschen",
	"baseKnowledge.deleteDialog.cancelButton.label": "Abbrechen",

	/* ---------------------- Product Dashboard ---------------------- */
	"productDashboard.error": "Es gab einen Fehler beim Laden der Daten.",

	"productDashboard.userEvolution.title": "Total Users & Daily New Users",
	"productDashboard.userEvolution.description":
		"Kumulierte Nutzer:innen (Linie) und neue Registrierungen pro Tag (Balken) in den letzten 30 Tagen.",
	"productDashboard.userEvolution.total.label": "Total Users",
	"productDashboard.userEvolution.new.label": "Daily New Users",

	"productDashboard.metricCards.dau.label": "Täglich aktive Nutzer:innen",
	"productDashboard.metricCards.dau.details": "Heute",
	"productDashboard.metricCards.wau.label": "Wöchentlich aktive Nutzer:innen",
	"productDashboard.metricCards.wau.details": "Letzte 7 Tage",
	"productDashboard.metricCards.mau.label": "Monatlich aktive Nutzer:innen",
	"productDashboard.metricCards.mau.details": "Letzte 30 Tage",

	"productDashboard.metricCards.totalChats.label": "Gesamtzahl der Chats",
	"productDashboard.metricCards.totalUserDocuments.label":
		"Gesamtzahl der Benutzerdokumente",
	"productDashboard.metricCards.averageInferencesPerUser.label":
		"Durchschnittliche Inferenzen pro Nutzer:in",
	"productDashboard.metricCards.totalMessagesWithDocuments.label":
		"Gesamtzahl der Nachrichten mit eigenen Dokumenten",
	"productDashboard.metricCards.totalMessagesWithoutDocuments.label":
		"Gesamtzahl der Nachrichten ohne eigene Dokumente",

	"productDashboard.domainsTable.title": "Domains",
	"productDashboard.domainsTable.description": "Registrierte User pro Domain.",
	"productDashboard.domainsTable.head.domain": "Domain",
	"productDashboard.domainsTable.head.users": "Users",
	"productDashboard.domainsTable.showAllButton": "Alle anzeigen",

	/* ---------------------- Add New Domain ---------------------- */
	"addNewDomain.title": "Neue Domain hinzufügen",
	"addNewDomain.description":
		"Füge eine geprüfte Berlin.de-Domain zur Allowlist hinzu, um Registrierungen von dieser Domain zu erlauben.",
	"addNewDomain.form.domain": "Domain",
	"addNewDomain.form.domainPlaceholder": "z.B. senjustv.berlin.de",
	"addNewDomain.form.button.save": "Domain hinzufügen",
	"addNewDomain.form.button.saved": "Domain hinzugefügt",
	"addNewDomain.form.validation.wildcardNotAllowed":
		"Wildcard-Muster wie *.berlin.de sind nicht erlaubt. Bitte geben Sie eine konkrete Domain ein.",
	"addNewDomain.form.validation.invalidFormat":
		"Bitte geben Sie eine gültige Domain ein (z. B. senjustv.berlin.de).",
	"addNewDomain.form.unsuccessful.error":
		"Die Domain konnte nicht hinzugefügt werden. Bitte versuchen Sie es erneut.",

	// Domain Allowlist Table Headers
	"domainAllowlistTable.tableHeader.domain": "Domain",
	"domainAllowlistTable.tableHeader.userCount": "User:innen",
	"domainAllowlistTable.tableHeader.dateAdded": "Hinzugefügt am",
	"domainAllowlistTable.tableHeader.addedBy": "Hinzugefügt von",
	"domainAllowlistTable.tableHeader.isActive": "Status",
	"domainAllowlistTable.tableHeader.lastStatusChange": "Letzte Änderung",
	"domainAllowlistTable.tableHeader.lastStatusChangeBy": "Geändert von",
	"domainAllowlistTable.tableHeader.actions": "",
	"domainAllowlistTable.tableHeader.actions.deactivate": "Deaktivieren",
	"domainAllowlistTable.tableHeader.actions.activate": "Aktivieren",
	"domainAllowlistTable.tableHeader.isActive.active": "aktiv",
	"domainAllowlistTable.tableHeader.isActive.inactive": "inaktiv",

	"domainAllowlistTable.count.label": "Domains insgesamt",
	"domainAllowlistTable.active.label": "Aktive Domains",
	"domainAllowlistTable.deactivated.label": "Deaktivierte Domains",
	"domainAllowlistTable.searchField.placeholder": "Suche nach Domain...",
	"domainAllowlistTable.statusFilterDropdown.all.label": "Alle",
	"domainAllowlistTable.statusFilterDropdown.active.label": "Aktiv",
	"domainAllowlistTable.statusFilterDropdown.inactive.label": "Inaktiv",

	"changeDomainStatusDialog.title.deactivate": "Domain deaktivieren",
	"changeDomainStatusDialog.title.activate": "Domain aktivieren",
	"changeDomainStatusDialog.description.deactivate.p1":
		"Accounts mit der Domain",
	"changeDomainStatusDialog.description.deactivate.p2": " werden deaktiviert.",
	"changeDomainStatusDialog.description.activate.p1":
		"Neue User:innen können sich wieder mit der Domain",
	"changeDomainStatusDialog.description.activate.p2":
		" registrieren. Bestehende Accounts müssen separat in der Benutzerverwaltung aktiviert werden.",
	"changeDomainStatusDialog.button.cancel": "Abbrechen",

	/* ---------------------- Add New Individual Email ---------------------- */
	"addNewIndividualEmail.title": "Neue E-Mail-Adresse hinzufügen",
	"addNewIndividualEmail.description":
		"Füge eine einzelne E-Mail-Adresse zur Allowlist hinzu, um dieser Person die Registrierung zu erlauben.",
	"addNewIndividualEmail.form.email": "E-Mail-Adresse",
	"addNewIndividualEmail.form.emailPlaceholder":
		"z.B. max.mustermann@extern.de",
	"addNewIndividualEmail.form.button.save": "E-Mail hinzufügen",
	"addNewIndividualEmail.form.button.saved": "E-Mail hinzugefügt",
	"addNewIndividualEmail.form.validation.invalidFormat":
		"Bitte geben Sie eine gültige E-Mail-Adresse ein.",
	"addNewIndividualEmail.form.emailAlreadyExistsError":
		"Diese E-Mail-Adresse ist bereits in der Allowlist.",
	"addNewIndividualEmail.form.wrongFormat": "Falsches E-Mail-Format.",
	"addNewIndividualEmail.form.unsuccessful.error":
		"Die E-Mail-Adresse konnte nicht hinzugefügt werden",

	// Individual Email Allowlist Table
	"individualEmailAllowlistTable.tableHeader.email": "E-Mail-Adresse",
	"individualEmailAllowlistTable.tableHeader.hasAccount": "Account registriert",
	"individualEmailAllowlistTable.tableHeader.dateAdded": "Hinzugefügt am",
	"individualEmailAllowlistTable.tableHeader.addedBy": "Hinzugefügt von",
	"individualEmailAllowlistTable.tableHeader.actions": "Aktionen",
	"individualEmailAllowlistTable.tableHeader.actions.remove": "Entfernen",
	"individualEmailAllowlistTable.tableHeader.hasAccount.yes": "Ja",
	"individualEmailAllowlistTable.tableHeader.hasAccount.no": "Nein",

	"individualEmailAllowlistTable.count.label": "E-Mails insgesamt",
	"individualEmailAllowlistTable.searchField.placeholder":
		"Suche nach E-Mail...",

	"removeIndividualEmailDialog.title": "E-Mail entfernen",
	"removeIndividualEmailDialog.description.withAccount": "Der Account von",
	"removeIndividualEmailDialog.description.noAccount": "Die E-Mail-Adresse",
	"removeIndividualEmailDialog.description.p2":
		"wird aus der Allowlist entfernt und der Account (falls vorhanden) wird permanent gelöscht.",
	"removeIndividualEmailDialog.button.cancel": "Abbrechen",

	"admin.sidebar.navigation.individualEmailAllowlist": "E-Mail-Verwaltung",
} as const;

export default Content;
