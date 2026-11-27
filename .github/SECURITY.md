# Sicherheitshinweise

## Eine Schwachstelle melden

Bitte melde mutmaßliche Sicherheitslücken per Mail an `security@baergpt.berlin` und eröffne dafür kein öffentliches Issue.

Hilfreich für die Bearbeitung sind:

- Beschreibung des Problems und der möglichen Auswirkung
- Betroffene Komponente (Frontend, Admin-Panel, Backend, Supabase) und URL
- Schritte zur Reproduktion oder ein Proof of Concept
- Falls vorhanden: ein Vorschlag zur Behebung

Wir melden uns innerhalb von 5 Werktagen zurück. Gib uns bitte angemessen Zeit, den Fehler zu beheben, bevor du ihn veröffentlichst.

## Geltungsbereich

Dieser Hinweis gilt für `www.baergpt.berlin`, `admin.baergpt.berlin`, `hilfe.baergpt.berlin` und die Backend-API.

Bitte vermeide bei Tests:

- Tests gegen Produktionsdaten
- automatisierte Scanner mit hohem Volumen
- Zugriffe auf Daten, die dir nicht gehören

Für Tests in einer eigenen Umgebung beschreibt `README_DEV.md` das lokale Setup.

## Nicht abgedeckt

- Meldungen, die ein bereits kompromittiertes Konto oder Endgerät voraussetzen
- Fehlende HTTP-Sicherheitsheader ohne nachgewiesene Auswirkung
- Denial of Service durch Ressourcenerschöpfung

## Kontakt

Maschinenlesbare Kontaktinformationen:
[https://www.baergpt.berlin/.well-known/security.txt](https://www.baergpt.berlin/.well-known/security.txt)

Hinweise zur Meldepflicht stehen in den Nutzungsbedingungen (§ 6.3):
[https://www.baergpt.berlin/terms-of-use/](https://www.baergpt.berlin/terms-of-use/)
