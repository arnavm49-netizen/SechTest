import { prisma } from "../src/lib/db";
import { ensure_demo_super_admin, seed_demo_dataset } from "./seed";

async function main() {
  const organization_count = await prisma.organization.count();

  if (organization_count > 0) {
    const admin_user = await ensure_demo_super_admin({ reset_password: true });
    console.log(`Bootstrap refreshed demo login for ${admin_user?.email ?? "the default tenant"}.`);
    return;
  }

  console.log("No organization data found. Seeding the demo dataset.");
  await seed_demo_dataset({ purge_existing: false });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
