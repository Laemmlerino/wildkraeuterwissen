{...}: {
  neoPlugin.modules.wildkraeuter-monitoring = {config, lib, plugin, ...}: let
    name = plugin.name "wildkraeuter";
    cfg = config.neo.services.${name};
  in {
    config = lib.mkIf cfg.enabled {
      systemd.services.${name}.environment = lib.mkIf config.neo.monitoring.collecting {
        NEO_METRICS_PORT = toString cfg.metricsPort;
      };
      neo.monitoring.apps.${name} = {
        metrics.main.address = "127.0.0.1:${toString cfg.metricsPort}";
        dashboards.overview = {
          title = "Wildkräuterschule${plugin.label}";
          panels = with lib.neo.grafana.app;
            features {service = name;}
            ++ llm {service = name;}
            ++ web {service = name;}
            ++ errors {service = name; containers = []; units = [name];};
        };
        alerts = lib.neo.monitoring.appAlerts {
          service = name;
          label = "Wildkräuterschule${plugin.label}";
          units = [name];
          llm = cfg.tutorEnabled;
        };
      };
    };
  };
}
