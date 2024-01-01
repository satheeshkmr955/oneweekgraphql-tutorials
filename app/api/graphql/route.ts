import { readFileSync } from "fs";
import { join } from "path";
import { createSchema, createYoga } from "graphql-yoga";
import type { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { GraphQLError } from "graphql";
import Stripe from "stripe";

import type { Resolvers } from "@/types";

import { findOrCreateCart } from "@/lib/cart";
import { CURRENCY_TYPES, currencyConverter } from "@/lib/currentConverter";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";

export type GraphQLContext = {
  prisma: PrismaClient;
};

export interface LineItem extends Stripe.LineItem {}

export async function createContext(): Promise<GraphQLContext> {
  return {
    prisma,
  };
}

const typeDefs = readFileSync(join(process.cwd(), "schema.graphql"), {
  encoding: "utf-8",
});

const resolvers: Resolvers = {
  Query: {
    cart: async (_, { id }, { prisma }) => {
      return findOrCreateCart({ prisma, id });
    },
  },
  Cart: {
    items: async ({ id }, _, { prisma }) => {
      const items = await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();

      return items || [];
    },
    totalItems: async ({ id }, _, { prisma }) => {
      const items = await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();

      return items?.reduce((total, item) => total + item.quantity || 1, 0) ?? 0;
    },
    subTotal: async ({ id }, _, { prisma }) => {
      const items = await prisma.cart
        .findUnique({
          where: {
            id,
          },
        })
        .items();

      const amount =
        items?.reduce(
          (total, item) => total + item.price * item.quantity || 0,
          0
        ) ?? 0;

      const formatted = currencyConverter({ amount });

      return {
        formatted,
        amount,
      };
    },
  },
  CartItem: {
    unitTotal: (item) => {
      const amount = item.price;

      const formatted = currencyConverter({ amount });

      return {
        amount,
        formatted,
      };
    },
    lineTotal: (item) => {
      const amount = item.quantity * item.price;

      const formatted = currencyConverter({ amount });

      return {
        amount,
        formatted,
      };
    },
  },
  Mutation: {
    addItem: async (_, { input }, { prisma }) => {
      const cart = await findOrCreateCart({ prisma, id: input.cartId });

      await prisma.cartItem.upsert({
        create: {
          cartId: cart.id,
          id: input.id,
          name: input.name,
          description: input.description,
          image: input.image,
          price: input.price,
          quantity: input.quantity || 1,
        },
        update: {
          quantity: {
            increment: input.quantity || 1,
          },
        },
        where: {
          id_cartId: {
            id: input.id,
            cartId: cart.id,
          },
        },
      });

      return cart;
    },
    removeItem: async (_, { input }, { prisma }) => {
      const { cartId } = await prisma.cartItem.delete({
        where: {
          id_cartId: {
            id: input.id,
            cartId: input.cartId,
          },
        },
        select: {
          cartId: true,
        },
      });

      return findOrCreateCart({ prisma, id: cartId });
    },
    increaseCartItem: async (_, { input }, { prisma }) => {
      const { cartId } = await prisma.cartItem.update({
        data: {
          quantity: {
            increment: 1,
          },
        },
        where: {
          id_cartId: {
            id: input.id,
            cartId: input.cartId,
          },
        },
        select: {
          cartId: true,
        },
      });

      return findOrCreateCart({ prisma, id: cartId });
    },
    decreaseCartItem: async (_, { input }, { prisma }) => {
      const { cartId, quantity } = await prisma.cartItem.update({
        data: {
          quantity: {
            decrement: 1,
          },
        },
        where: {
          id_cartId: {
            id: input.id,
            cartId: input.cartId,
          },
        },
        select: {
          cartId: true,
          quantity: true,
        },
      });

      if (quantity < 0) {
        await prisma.cartItem.delete({
          where: {
            id_cartId: {
              id: input.id,
              cartId: input.cartId,
            },
          },
        });
      }

      return findOrCreateCart({ prisma, id: cartId });
    },
    createCheckoutSession: async (_, { input }, { prisma }) => {
      const { cartId } = input;

      const cart = await prisma.cart.findUnique({
        where: {
          id: cartId,
        },
      });

      if (!cart) {
        throw new GraphQLError("Invalid cart");
      }

      const cartItems = await prisma.cart
        .findUnique({
          where: {
            id: cartId,
          },
        })
        .items();

      if (!cartItems || cartItems.length === 0) {
        throw new GraphQLError("Cart is empty");
      }

      const line_items: LineItem[] = cartItems.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: CURRENCY_TYPES.USD.toLocaleLowerCase(),
          unit_amount: item.price,
          product_data: {
            name: item.name,
            description: item.description || undefined,
            images: item.image ? [item.image] : [],
          },
        },
      }));

      const session = await stripe.checkout.sessions.create({
        line_items,
        mode: "payment",
        metadata: {
          cartId: cartId,
        },
        success_url:
          "http://localhost:3000/thankyou?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "http://localhost:3000/cart?cancelled=true",
      });

      return {
        id: session.id,
        url: session.url,
      };
    },
  },
};

const schema = createSchema({
  typeDefs: typeDefs,
  resolvers: resolvers,
});

const { handleRequest } = createYoga({
  graphqlEndpoint: "/graphql",
  schema,
  fetchAPI: {
    Request: NextRequest,
    Response: NextResponse,
  },
  context: createContext(),
});

export { handleRequest as GET, handleRequest as POST };
