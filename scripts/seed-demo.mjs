import { randomUUID } from "node:crypto";
import { today, shiftMonth, monthEnd } from "../packages/shared/dist/index.js";

export async function seedDemo(db, users) {
  const current = today(),
    currentMonth = current.slice(0, 7);
  const first = shiftMonth(currentMonth, -5);
  const owner =
    users.find((user) => user.state === "active")?.id ?? "household";
  const other = users.find((user) => user.id !== owner)?.id ?? "household";
  const categories = await db.category.findMany();
  const category = (name) => {
    const value = categories.find(
      (item) =>
        item.name === name &&
        item.kind === (name === "Salary" ? "income" : "expense"),
    );
    if (!value) throw new Error(`Missing starter category: ${name}`);
    return value.id;
  };
  const everyday = await db.account.create({
    data: {
      name: "Demo · Everyday",
      type: "bank",
      institution: "Demo Bank",
      owner: "household",
      openingDate: first + "-01",
      openingBalanceCents: 600000n,
    },
  });
  const savings = await db.account.create({
    data: {
      name: "Demo · Savings",
      type: "bank",
      institution: "Demo Bank",
      owner,
      openingDate: first + "-01",
      openingBalanceCents: 1200000n,
    },
  });
  const card = await db.account.create({
    data: {
      name: "Demo · Credit card",
      type: "credit",
      institution: "Demo Bank",
      owner: other,
      openingDate: first + "-01",
      openingBalanceCents: -45000n,
    },
  });
  const allowance = {
    Groceries: 100000,
    Dining: 20000,
    Home: 240000,
    Transport: 25000,
    Utilities: 30000,
    Health: 15000,
    Subscriptions: 20000,
  };
  for (const [name, amountCents] of Object.entries(allowance))
    await db.budget.create({
      data: {
        categoryId: category(name),
        month: first,
        endMonth: shiftMonth(currentMonth, 5),
        amountCents: BigInt(amountCents),
      },
    });
  await db.budgetOverride.create({
    data: {
      categoryId: category("Groceries"),
      month: currentMonth,
      amountCents: 120000n,
    },
  });
  await db.budget.create({
    data: {
      categoryId: category("Travel"),
      month: shiftMonth(currentMonth, -1),
      endMonth: shiftMonth(currentMonth, -1),
      amountCents: 60000n,
    },
  });
  const scheduleDefinitions = [
    ["Rent", "Home", 240000, 1, false],
    ["Streaming and music", "Subscriptions", 5000, 1, true],
    ["Cloud, phone apps and memberships", "Subscriptions", 10000, 15, true],
    ["Electricity and internet", "Utilities", 23000, 24, false],
    ["Health cover", "Health", 11000, 25, false],
  ];
  const schedules = [];
  for (const [
    name,
    categoryName,
    amountCents,
    day,
    subscription,
  ] of scheduleDefinitions)
    schedules.push(
      await db.schedule.create({
        data: {
          name,
          kind: "expense",
          accountId: everyday.id,
          categoryId: category(categoryName),
          amountCents: BigInt(amountCents),
          owner: "household",
          startDate: `${first}-${String(day).padStart(2, "0")}`,
          frequency: "monthly",
          subscription,
          provider: subscription ? "Demo provider" : "",
        },
      }),
    );
  const incomes = await Promise.all(
    [
      ["Monthly salary", 470000n, owner, "01"],
      ["Second household salary", 430000n, other, "15"],
    ].map(([name, amountCents, person, day]) =>
      db.schedule.create({
        data: {
          name,
          kind: "income",
          accountId: everyday.id,
          categoryId: category("Salary"),
          amountCents,
          owner: person,
          startDate: first + "-" + day,
          frequency: "monthly",
        },
      }),
    ),
  );
  const records = [];
  const add = (
    month,
    day,
    kind,
    amountCents,
    description,
    categoryName,
    patch = {},
  ) => {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    if (date > current || date > monthEnd(month)) return;
    records.push({
      accountId: everyday.id,
      owner: "household",
      date,
      kind,
      amountCents: BigInt(amountCents),
      description,
      categoryId: categoryName ? category(categoryName) : null,
      notes: "Fictional demo transaction",
      ...patch,
    });
  };
  const split = (
    month,
    categoryName,
    total,
    count,
    descriptions,
    monthIndex,
  ) => {
    const availableDays =
      month === currentMonth ? Number(current.slice(-2)) : 28;
    for (let index = 0; index < count; index++) {
      const cents = Math.floor(total / count) + (index < total % count ? 1 : 0);
      add(
        month,
        1 + Math.floor((index * availableDays) / count),
        "expense",
        -cents,
        descriptions[index % descriptions.length],
        categoryName,
        {
          owner:
            index % 3 === 0 ? owner : index % 3 === 1 ? other : "household",
          accountId:
            monthIndex % 2 && categoryName === "Dining" ? card.id : everyday.id,
        },
      );
    }
  };
  for (let index = 0; index < 6; index++) {
    const month = shiftMonth(first, index);
    split(
      month,
      "Groceries",
      [78000, 92000, 101000, 87000, 108000, 34000][index],
      10,
      ["Woolworths", "Aldi weekly shop", "Fruit and veg market"],
      index,
    );
    split(
      month,
      "Dining",
      [16000, 24000, 21000, 19000, 26000, 23000][index],
      5,
      ["Weekend brunch", "Family dinner", "Coffee and lunch"],
      index,
    );
    split(
      month,
      "Transport",
      [16000, 22000, 19000, 27000, 21000, 7500][index],
      4,
      ["Fuel", "Public transport", "Parking"],
      index,
    );
    for (const schedule of schedules) {
      const day = Number(schedule.startDate.slice(-2));
      add(
        month,
        day,
        "expense",
        -Number(schedule.amountCents),
        schedule.name,
        null,
        {
          categoryId: schedule.categoryId,
          scheduleId: schedule.id,
          occurrenceDate: `${month}-${String(day).padStart(2, "0")}`,
        },
      );
    }
    for (const income of incomes)
      add(
        month,
        Number(income.startDate.slice(-2)),
        "income",
        Number(income.amountCents),
        income.name,
        "Salary",
        {
          owner: income.owner,
          scheduleId: income.id,
          occurrenceDate: month + income.startDate.slice(7),
        },
      );
    add(
      month,
      Math.min(3, month === currentMonth ? Number(current.slice(-2)) : 3),
      "refund",
      2500,
      "Grocery return",
      "Groceries",
    );
    add(
      month,
      2,
      "expense",
      -(index === 5 ? 8500 : 3500 + index * 1000),
      "Home and garden purchase",
      "Shopping",
    );
    add(month, 2, "expense", -1900, "Unsorted card purchase", null);
    if (index === 4)
      add(month, 18, "expense", -45000, "Weekend away", "Travel");
    for (const day of [2, 16]) {
      const group = randomUUID();
      add(month, day, "transfer", -100000, "Move to savings", null, {
        transferGroupId: group,
      });
      add(month, day, "transfer", 100000, "Move to savings", null, {
        accountId: savings.id,
        transferGroupId: group,
      });
    }
  }
  await db.transaction.createMany({ data: records });
}
