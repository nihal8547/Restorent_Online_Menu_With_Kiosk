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
        { categoryId: starters.id, name: "Chicken 65", description: "Spicy fried chicken with curry leaves", price: 18.0, photoUrl: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500&auto=format&fit=crop&q=70" },
        { categoryId: starters.id, name: "Veg Spring Roll", description: "Crispy rolls with sweet chili dip", price: 12.0, photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=70" },
        { categoryId: mains.id, name: "Chicken Biriyani", description: "Hyderabadi style fragrant basmati rice", price: 25.0, photoUrl: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=70" },
        { categoryId: mains.id, name: "Butter Chicken", description: "Creamy tomato butter gravy with naan", price: 28.0, photoUrl: "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=500&auto=format&fit=crop&q=70" },
        { categoryId: mains.id, name: "Veg Fried Rice", description: "Wok tossed vegetables and jasmine rice", price: 16.0, photoUrl: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=500&auto=format&fit=crop&q=70" },
        { categoryId: drinks.id, name: "Fresh Lime", description: "Sweet & salty refreshing soda", price: 6.0, photoUrl: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=70" },
        { categoryId: drinks.id, name: "Mango Juice", description: "Fresh alphonsa mango pulp shake", price: 8.0, photoUrl: "https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=70" },
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
