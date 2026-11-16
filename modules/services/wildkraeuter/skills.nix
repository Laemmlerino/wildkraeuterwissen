{...}: {
  neoPlugin.modules.wildkraeuter-skills = {config, lib, plugin, ...}: let
    name = plugin.name "wildkraeuter";
  in {
    config.neo.services.${name}.skill.conf = lib.neo.mkServiceSkill {
      service = name;
      inherit config;
      description = "Wildkräuter aus eigenen Unterlagen lernen und den Skript-Tutor verbinden";
      tags = ["neo" "learning" "plants"];
      title = "Neo · Wildkräuterschule${plugin.label}";
      body = ''
        ## Betrieb
        - Native Einheit `${name}`, nur Loopback, hinter SWAG und tinyauth.
        - GET /health meldet ok und ready (Unterlagen importiert).
        - services.${name}.sourceDirectory benennt den Ordner mit Skripten und vier Köhler-Bänden.
        - Import bei Dienststart; Quellen und Index liegen im Appdata-Verzeichnis.
        - services.${name}.tutorEnabled nutzt den Hermes-Gateway und dessen KI-Anmeldung.
        - Codex im Neo UI unter Hermes als Anbieter wählen und anmelden. Keine Zugangsdaten im Chat abfragen.
        - Die App erteilt keine Werkzeugfreigaben. Hermes ist der gemeinsame Assistent, kein isolierter Schulungsaccount.
        - Keine externen Pflanzenbilder oder erfundenen Skriptinhalte hinzufügen.
        ## Prüfen
        Einheit ${name} aktiv; /health 200; / ohne Anmeldung 302 zu tinyauth.
        Im Browser alle Lernmodi testen; Tutor muss Fundstellen mit PDF-Seiten nennen.
      '';
    };
  };
}
