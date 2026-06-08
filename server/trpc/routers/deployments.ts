import { z } from "zod";
import { router, publicProcedure } from "../router";
import { db } from "../../db/client";
import { deployments } from "../../db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { buildAndDeploy } from "../../docker/build";
import { removeService, redeployService } from "../../docker/service";

export const deploymentsRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(deployments).all();
  }),

  create: publicProcedure
    .input(z.object({
      repoUrl:        z.string().url(),
      dockerfilePath: z.string().default("Dockerfile"),
      exposedPort:    z.number().int().min(1).max(65535),
      customLabels: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, '');
      const subdomain = `app-${id}`;
      await db.insert(deployments).values({
        id,
        name: subdomain,
        repoUrl: input.repoUrl,
        dockerfilePath: input.dockerfilePath,
        exposedPort: input.exposedPort,
        subdomain,
        status: "pending",
      });
      buildAndDeploy(id).catch(console.error); // fire and forget
      return { id, subdomain };
    }),

  redeploy: publicProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    const [dep] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.id));
    if (!dep) throw new Error("Deployment not found");
    if (!dep.serviceId) throw new Error("No service found, deploy first");
    await db.update(deployments)
      .set({ status: "deploying" })
      .where(eq(deployments.id, input.id));
    await redeployService(dep.serviceId);
    await db.update(deployments)
      .set({ status: "running" })
      .where(eq(deployments.id, input.id));
    return { ok: true };
  }),

  remove: publicProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ input }) => {
    const [dep] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, input.id));
    if (dep?.serviceId) await removeService(dep.serviceId);
    await db.delete(deployments)
      .where(eq(deployments.id, input.id));
    return { ok: true };
  }),
});