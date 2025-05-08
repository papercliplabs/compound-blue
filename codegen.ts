import type { CodegenConfig } from "@graphql-codegen/cli";
import "dotenv/config";

const config: CodegenConfig = {
  overwrite: true,
  ignoreNoDocuments: true,
  documents: "src/data/whisk/*.ts",
  schema: { [process.env.WHISK_API_URL!]: { headers: { Authorization: `Bearer ${process.env.WHISK_API_KEY!}` } } },
  generates: {
    "./src/generated/gql/whisk/": {
      preset: "client",
      config: {
        avoidOptionals: true,
        scalars: {
          Number: "number",
          // Add more if your schema uses other custom number types
        },
      },
    },
    "./src/generated/gql/schema.graphql": {
      plugins: ["schema-ast"],
      config: {
        includeDirectives: true,
      },
    },
  },
};

export default config;
