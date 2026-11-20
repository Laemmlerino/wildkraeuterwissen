{...}: {
  neoPlugin.modules.wildkraeuter = {config, lib, pkgs, plugin, ...}: let
    name = plugin.name "wildkraeuter";
    cfg = config.neo.services.${name};
    appdata = "${config.neo.core.volumes.appdata}/${name}";
    python = pkgs.python3.withPackages (ps: [ps.pymupdf ps.prometheus-client]);
    hermes = config.neo.services.hermes;
    neo = config.neo.services.neo;
    domain = config.neo.services.swag.domain;
    localTutor = cfg.localTutorModel != "";
    useHermes = cfg.tutorEnabled && !localTutor;
    tutorReady = useHermes && hermes.enabled && neo.enabled;
  in {
    config = lib.mkIf cfg.enabled (lib.mkMerge [
      (lib.neo.mkDockerToLocalhostForward cfg.port)
      {
        assertions = [
          {assertion = !useHermes || (hermes.enabled && neo.enabled && lib.neo.isSet hermes.gatewayToken); message = "${name}: activate Hermes and Neo web, and generate a Hermes gateway token before enabling the tutor.";}
        ];
        systemd.tmpfiles.rules = ["d ${appdata} 0700 homeserver homeserver -"];
        systemd.services.${name} = {
          description = "Wildkräuter-Lernatelier${plugin.label}";
          wantedBy = ["multi-user.target"];
          after = ["network.target"];
          environment = {
            WILDKRAEUTER_DATA = appdata;
            PORT = toString cfg.port;
            NEO_UI_URL = if domain == null then "" else "https://${neo.subdomain}.${domain}";
          } // lib.optionalAttrs (cfg.auth.enabled && config.neo.services.tinyauth.enabled) {
            WILDKRAEUTER_LIBRARY_UPLOAD = "1";
          } // lib.optionalAttrs localTutor {
            WILDKRAEUTER_LOCAL_MODEL = cfg.localTutorModel;
          } // lib.optionalAttrs tutorReady {
            HERMES_URL = "http://127.0.0.1:${toString hermes.gatewayPort}";
            HERMES_KEY_FILE = "%d/hermes-key";
          };
          preStart = lib.neo.mkEnsureDirs config [appdata] + lib.optionalString (cfg.sourceDirectory != "") ''
            ${python}/bin/python ${../../..}/tools/import_sources.py ${lib.escapeShellArg cfg.sourceDirectory} ${lib.escapeShellArg appdata}
          '';
          serviceConfig = {
            User = "homeserver";
            Group = "homeserver";
            ExecStart = "${python}/bin/python ${../../..}/app/server.py";
            Restart = "on-failure";
            RestartSec = 5;
            UMask = "0077";
            ReadWritePaths = [appdata];
            NoNewPrivileges = true;
            PrivateTmp = true;
            ProtectSystem = "strict";
            ProtectHome = "read-only";
          } // lib.optionalAttrs tutorReady {
            LoadCredential = ["hermes-key:${config.neo.core.secrets.templates."${name}-hermes-key".path}"];
          };
        };
        neo.core.secrets.templates."${name}-hermes-key" = lib.mkIf tutorReady {
          content = hermes.gatewayToken;
          owner = "root";
          group = "root";
          mode = "0400";
          restartUnits = ["${name}.service"];
        };
      }
    ]);
  };
}
