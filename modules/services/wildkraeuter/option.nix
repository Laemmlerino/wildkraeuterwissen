{...}: {
  neoPlugin.modules.wildkraeuter-option = {config, lib, plugin, ...}:
    with lib; with {inherit (lib.neo) mkOption mkEnableOption;}; let
      name = plugin.name "wildkraeuter";
    in {
      options.neo.services.${name} = mkOption {
        default = {};
        description = "Wildkräuter-Lernatelier";
        type = types.submodule {
          options = {
            enabled = mkEnableOption "Wildkräuter mit deinen eigenen Unterlagen lernen${plugin.label}" {rank = 0;};
            sourceDirectory = mkOption {
              type = types.str;
              default = "";
              rank = 10;
              description = "Ordner auf deinem Server mit den Skripten und den vier Köhler-Bänden. Leer lässt den bisherigen Import bestehen.";
              ui.label = "Deine Unterlagen";
            };
            tutorEnabled = mkOption {
              type = types.bool;
              default = false;
              rank = 20;
              description = "Fragen zu deinen Skripten mit dem in Hermes angemeldeten KI-Anbieter besprechen.";
              ui.label = "Lerntutor aktivieren";
            };
            port = mkOption {
              type = types.port;
              default = 8787;
              rank = 80;
              description = "Interne Verbindung. Bei einer zweiten Kopie eine andere Nummer wählen.";
              ui = {label = "Interner Port"; group = lib.neo.ui.groups.advanced;};
            };
            metricsPort = mkOption {
              type = types.port;
              default = 9477;
              rank = 81;
              description = "Interne Lernstatistik für Monitoring. Bei einer zweiten Kopie eine andere Nummer wählen.";
              ui = {label = "Statistik-Port"; group = lib.neo.ui.groups.advanced;};
            };
          }
          // lib.neo.mkReverseProxyOptions {subdomain = name; auth.publicPaths = ["^/health$"];}
          // lib.neo.mkSystemdUnits [name]
          // lib.neo.mkAppdata "${config.neo.core.volumes.appdata}/${name}"
          // lib.neo.mkServiceMeta {
            category = "Utilities";
            projectUrl = "https://github.com/Laemmlerino/wildkraeuterwissen";
            githubUrl = "https://github.com/Laemmlerino/wildkraeuterwissen";
            icon = ./icon.svg;
            tagline = "Deine Wildkräuterschule zum Üben${plugin.label}";
            description = "Lerne Pflanzen mit historischen Tafeln aus deinen Unterlagen. Übe Namen, erkenne Pflanzen und besprich deine Skripte mit einem Lerntutor.";
            notes = "Unterlagen bleiben auf deinem Server. Der optionale Tutor sendet passende Skriptauszüge an den in Hermes gewählten Anbieter. Codex in Neo unter Hermes anmelden. Lernfortschritt wird in deinem Browser gespeichert.";
            privacy = ["documents" "assistant"];
            license = {spdx = "MIT"; url = "https://opensource.org/license/mit";};
          }
          // lib.neo.mkSkillOptions {};
        };
      };
    };
}
