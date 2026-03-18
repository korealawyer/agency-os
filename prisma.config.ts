import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma CLI(migrate 등)는 Direct URL(5432)을 사용해야 함
    // 런타임 쿼리는 db.ts에서 DATABASE_URL(Pooler 6543)을 별도 사용
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
