import Dockerode from "dockerode";

export const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });

export async function createService(
  imageName: string,
  subdomain: string,
  exposedPort: number,
  labels: Record<string, string>
): Promise<string> {
  // Resolve network ID by name
  const networks = await docker.listNetworks({
    filters: JSON.stringify({ name: ["mini-dokploy_traefik-public"] }),
  });
  const networkId = networks[0]?.Id;
  if (!networkId) throw new Error("traefik-public network not found");

  const service = await docker.createService({
    Name: subdomain,
    TaskTemplate: {
      ContainerSpec: {
        Image: imageName,
      },
      Networks: [{ Target: networkId }],
    },
    Mode: { Replicated: { Replicas: 1 } },
    EndpointSpec: {},
    Labels: labels,
  });
  return service.id;
}

export async function redeployService(serviceId: string): Promise<void> {
  const service = docker.getService(serviceId);
  const inspect = await service.inspect();
  await service.update({
    ...inspect.Spec,
    version: inspect.Version.Index,
    TaskTemplate: {
      ...inspect.Spec.TaskTemplate,
      ForceUpdate: (inspect.Spec.TaskTemplate.ForceUpdate ?? 0) + 1,
    },
  });
}

export async function removeService(serviceId: string): Promise<void> {
  try {
    await docker.getService(serviceId).remove();
  } catch (e: unknown) {
  if (e instanceof Error && !e.message.includes("not found")) throw e;
}
}