import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const deployments = sqliteTable("deployments", {
  id:             text("id").primaryKey(),             // nanoid
  name:           text("name").notNull(),
  repoUrl:        text("repo_url").notNull(),
  dockerfilePath: text("dockerfile_path").notNull().default("Dockerfile"),
  exposedPort:    integer("exposed_port").notNull(),
  subdomain:      text("subdomain").notNull().unique(),
  serviceId:      text("service_id"),                  // Docker service ID
  status:         text("status").notNull().default("pending"),
  // status: pending | building | running | failed | removed
  createdAt:      integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
});