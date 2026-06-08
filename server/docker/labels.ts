export function traefikLabels(
  subdomain: string,
  port: number,
  extra: Record<string, string> = {}
) {
  const host = `${subdomain}.127.0.0.1.sslip.io`;
  const base: Record<string, string> = {
    "traefik.enable": "true",
    [`traefik.http.routers.${subdomain}.rule`]: `Host(\`${host}\`)`,
    [`traefik.http.routers.${subdomain}.entrypoints`]: "web",
    [`traefik.http.services.${subdomain}.loadbalancer.server.port`]: String(port),
    "traefik.docker.network": "mini-dokploy_traefik-public",
  };
  return { ...base, ...extra };
}