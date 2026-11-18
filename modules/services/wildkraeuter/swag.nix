{...}: {
  neoPlugin.modules.wildkraeuter-swag = {config, lib, plugin, ...}: let
    name = plugin.name "wildkraeuter";
    cfg = config.neo.services.${name};
  in {
    config.neo.services.${name}.proxyConf = lib.mkDefault (lib.neo.mkSubdomainProxyConf {
      inherit config cfg;
      maxBodySize = "1024m";
      proxyPass = "http://host.docker.internal:${toString cfg.port}/";
    });
  };
}
