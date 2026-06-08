import { simpleGit } from "simple-git";
import { execa } from "execa";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { db } from "../db/client";
import { deployments } from "../db/schema";
import { eq } from "drizzle-orm";
import { createService } from "./service";
import { traefikLabels } from "./labels";

async function setStatus(id: string, status: string) {
  await db.update(deployments).set({ status }).where(eq(deployments.id, id));
}

export async function buildAndDeploy(id: string) {
  // 1. Fetch deployment record
  const [dep] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, id));

  if (!dep) throw new Error(`Deployment ${id} not found`);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `dokploy-${id}-`));

  try {
    // 2. Clone repo
    await setStatus(id, "cloning");
    console.log(`[${id}] Cloning ${dep.repoUrl} into ${tmpDir}`);
    await simpleGit().clone(dep.repoUrl, tmpDir);

    // 3. Build image
    await setStatus(id, "building");
    const imageName = `mini-dokploy/${dep.subdomain.toLowerCase()}:latest`;
    const dockerfilePath = path.join(tmpDir, dep.dockerfilePath);
    console.log(`[${id}] Building image ${imageName}`);
    await execa("docker", [
      "build",
      "-t", imageName,
      "-f", dockerfilePath,
      tmpDir,
    ], { stdio: "inherit" });

    // 4. Create or update swarm service
    await setStatus(id, "deploying");
    const labels = traefikLabels(dep.subdomain, dep.exposedPort);
    console.log(`[${id}] Creating service ${dep.subdomain}`);
    const serviceId = await createService(
      imageName,
      dep.subdomain,
      dep.exposedPort,
      labels
    );

    // 5. Mark running
    await db.update(deployments)
      .set({ status: "running", serviceId })
      .where(eq(deployments.id, id));

    console.log(`[${id}] Live at http://${dep.subdomain}.127.0.0.1.sslip.io`);
  } catch (err) {
    console.error(`[${id}] Build failed:`, err);
    await setStatus(id, "failed");
  } finally {
    // 6. Cleanup tmp dir
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}