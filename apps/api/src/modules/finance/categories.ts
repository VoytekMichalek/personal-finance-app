import { categorySchema } from "@finance/shared";
import { prisma } from "../../lib/db.js";
import { HttpError } from "../../lib/errors.js";
export async function saveCategory(input: unknown, id?: string) {
  const data = categorySchema.parse(input);
  return prisma.$transaction(async (tx) => {
    // Serialize hierarchy edits so concurrent reparenting cannot create cycles.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164232)");
    const current = id ? await tx.category.findUnique({ where: { id } }) : null;
    if (id && !current) throw new HttpError(404, "Category not found.");
    if (data.parentId) {
      const parent = await tx.category.findUnique({
        where: { id: data.parentId },
      });
      if (
        !parent ||
        parent.archived ||
        parent.parentId ||
        parent.kind !== data.kind ||
        parent.id === id
      )
        throw new HttpError(
          400,
          "Choose an active top-level category of the same type.",
        );
      if (id && (await tx.category.count({ where: { parentId: id } })))
        throw new HttpError(
          409,
          "A category with subcategories cannot become a subcategory.",
        );
    }
    if (
      id &&
      current?.kind !== data.kind &&
      ((await tx.transaction.count({ where: { categoryId: id } })) ||
        (await tx.budget.count({ where: { categoryId: id } })) ||
        (await tx.schedule.count({ where: { categoryId: id } })) ||
        (await tx.rule.count({ where: { categoryId: id } })) ||
        (await tx.category.count({ where: { parentId: id } })))
    )
      throw new HttpError(
        409,
        "Create a new category to change the type of one already used.",
      );
    if (id && data.archived)
      await tx.category.updateMany({
        where: { parentId: id },
        data: { archived: true },
      });
    return id
      ? tx.category.update({ where: { id }, data })
      : tx.category.create({ data });
  });
}
export async function removeCategory(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(87164232)");
    if (await tx.category.count({ where: { parentId: id } }))
      throw new HttpError(
        409,
        "Remove or move subcategories first, or archive this category.",
      );
    if (
      (await tx.transaction.count({ where: { categoryId: id } })) ||
      (await tx.schedule.count({ where: { categoryId: id } })) ||
      (await tx.budget.count({ where: { categoryId: id } })) ||
      (await tx.rule.count({ where: { categoryId: id } }))
    )
      throw new HttpError(
        409,
        "This category is used. Archive it to preserve your history.",
      );
    await tx.category.delete({ where: { id } });
    return { ok: true };
  });
}
