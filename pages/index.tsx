import { useState } from "react";
import { trpc } from "../lib/trpc";



export default function Home() {
  const [urlError, setUrlError] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [exposedPort, setExposedPort] = useState(3000);

  function isValidGitUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

  const { data: deployments, refetch } = trpc.deployments.list.useQuery(
    undefined,
    { refetchInterval: 3000 }
  );

  const create = trpc.deployments.create.useMutation({
    onSuccess: () => {
      setRepoUrl("");
      refetch();
    },
  });

  const redeploy = trpc.deployments.redeploy.useMutation({
    onSuccess: () => refetch(),
  });

  const remove = trpc.deployments.remove.useMutation({
    onSuccess: () => refetch(),
  });

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
      <h1 style={{ marginBottom: "2rem" }}>Mini-Dokploy</h1>

      {/* Create form */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1.5rem", marginBottom: "2rem" }}>
        <h2 style={{ marginTop: 0 }}>New Deployment</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input
            placeholder="Git repo URL"
            value={repoUrl}
            onChange={e => {
            setRepoUrl(e.target.value);
            setUrlError("");
            }}
            style={{
              padding: "0.5rem",
              fontSize: 14,
              borderRadius: 4,
              border: `1px solid ${urlError ? "red" : "#ccc"}`,
            }}
          />
          {urlError && (
            <span style={{ fontSize: 12, color: "red" }}>{urlError}</span>
          )}
          <input
            placeholder="Dockerfile path"
            value={dockerfilePath}
            onChange={e => setDockerfilePath(e.target.value)}
            style={{ padding: "0.5rem", fontSize: 14, borderRadius: 4, border: "1px solid #ccc" }}
          />
          <input
            type="number"
            placeholder="Exposed port"
            value={exposedPort}
            onChange={e => setExposedPort(Number(e.target.value))}
            style={{ padding: "0.5rem", fontSize: 14, borderRadius: 4, border: "1px solid #ccc" }}
          />
          <button
            onClick={() => {
              if (!isValidGitUrl(repoUrl)) {
                setUrlError("Please enter a valid Git URL (e.g. https://github.com/user/repo)");
                return;
              }
              create.mutate({ repoUrl, dockerfilePath, exposedPort });
            }}
            disabled={create.isPending || !repoUrl}
            style={{ padding: "0.5rem 1rem", cursor: "pointer", borderRadius: 4 }}
          >
            {create.isPending ? "Deploying..." : "Deploy"}
          </button>
        </div>
      </div>

      {/* Deployments table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
            <th style={{ padding: "0.5rem" }}>Subdomain</th>
            <th style={{ padding: "0.5rem" }}>Repo</th>
            <th style={{ padding: "0.5rem" }}>Status</th>
            <th style={{ padding: "0.5rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {deployments?.map(dep => (
            <tr key={dep.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "0.5rem" }}>
                <a href={`http://${dep.subdomain}.127.0.0.1.sslip.io`} target="_blank" rel="noreferrer">
                  {dep.subdomain}
                </a>
              </td>
              <td style={{ padding: "0.5rem", fontSize: 13, color: "#666" }}>
                {dep.repoUrl}
              </td>
              <td style={{ padding: "0.5rem" }}>
                <span style={{
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 12,
                  background: dep.status === "running" ? "#d4edda" : dep.status === "failed" ? "#f8d7da" : "#fff3cd",
                  color: dep.status === "running" ? "#155724" : dep.status === "failed" ? "#721c24" : "#856404",
                }}>
                  {dep.status}
                </span>
              </td>
              <td style={{ padding: "0.5rem", display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => redeploy.mutate({ id: dep.id })}
                  disabled={redeploy.isPending}
                  style={{ fontSize: 12, cursor: "pointer" }}
                >
                  Redeploy
                </button>
                <button
                  onClick={() => remove.mutate({ id: dep.id })}
                  disabled={remove.isPending}
                  style={{ fontSize: 12, cursor: "pointer", color: "red" }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {deployments?.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
                No deployments yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}