import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ---- Staff users ----
  const password = await bcrypt.hash("admin123", 10);
  const staffPassword = await bcrypt.hash("staff123", 10);

  const users = [
    { name: "Administrator", username: "admin", role: "ADMIN", passwordHash: password },
    { name: "Kitchen Screen", username: "kitchen", role: "KITCHEN", passwordHash: staffPassword },
    { name: "Cashier", username: "cashier", role: "CASHIER", passwordHash: staffPassword },
    { name: "Waiter One", username: "waiter", role: "WAITER", passwordHash: staffPassword },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { username: u.username }, update: {}, create: u });
  }

  // ---- Menu ----
  const existing = await prisma.category.count();
  if (existing === 0) {
    const starters = await prisma.category.create({ data: { name: "Starters", sortOrder: 1 } });
    const mains = await prisma.category.create({ data: { name: "Main Course", sortOrder: 2 } });
    const drinks = await prisma.category.create({ data: { name: "Beverages", sortOrder: 3 } });

    await prisma.menuItem.createMany({
      data: [
        { categoryId: starters.id, name: "Chicken 65", description: "Spicy fried chicken", price: 18.0 },
        { categoryId: starters.id, name: "Veg Spring Roll", description: "Crispy rolls", price: 12.0 },
        { categoryId: mains.id, name: "Chicken Biriyani", description: "Hyderabadi style", price: 25.0 },
        { categoryId: mains.id, name: "Butter Chicken", description: "With naan", price: 28.0 },
        { categoryId: mains.id, name: "Veg Fried Rice", description: "Wok tossed", price: 16.0 },
        { categoryId: drinks.id, name: "Fresh Lime", description: "Sweet / salt", price: 6.0 },
        { categoryId: drinks.id, name: "Mango Juice", description: "Fresh", price: 8.0 },
      ],
    });
  }

  // ---- Tables ----
  const tableCount = await prisma.restaurantTable.count();
  if (tableCount === 0) {
    for (let i = 1; i <= 8; i++) {
      await prisma.restaurantTable.create({ data: { tableNo: String(i) } });
    }
  }

  console.log("Seed complete.");
  console.log("Logins:  admin/admin123, kitchen/staff123, cashier/staff123, waiter/staff123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
