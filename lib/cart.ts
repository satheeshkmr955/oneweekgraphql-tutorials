import { PrismaClient } from "@prisma/client";

type findOrCreateCartArgs = {
  prisma: PrismaClient;
  id: string;
};

export async function findOrCreateCart(obj: findOrCreateCartArgs) {
  const { prisma, id } = obj;

  let cart = await prisma.cart.findUnique({
    where: {
      id,
    },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        id,
      },
    });
  }

  return cart;
}
