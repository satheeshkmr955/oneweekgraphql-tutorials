import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  overwrite: true,
  schema: "schema.graphql",
  generates: {
    "types.ts": {
      config: {
        mapperTypeSuffix: "Modal",
        mappers: {
          Cart: "@prisma/client#Cart",
          CartItem: "@prisma/client#CartItem",
        },
        contextType: "./app/api/graphql/route#GraphQLContext",
      },
      plugins: ["typescript", "typescript-resolvers"],
    },
  },
};

export default config;
