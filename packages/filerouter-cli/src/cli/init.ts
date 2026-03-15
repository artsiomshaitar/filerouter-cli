import * as fs from "fs";
import * as path from "path";

export interface InitOptions {
  projectName: string;
  cliName?: string;
}

/**
 * Initialize a new filerouter-cli project
 */
export async function runInit(options: InitOptions): Promise<void> {
  const { projectName, cliName = projectName } = options;
  const projectDir = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (fs.existsSync(projectDir)) {
    const stats = fs.statSync(projectDir);
    if (stats.isDirectory()) {
      const files = fs.readdirSync(projectDir);
      if (files.length > 0) {
        console.error(`Error: Directory "${projectName}" already exists and is not empty.`);
        process.exit(1);
      }
    } else {
      console.error(`Error: "${projectName}" already exists and is not a directory.`);
      process.exit(1);
    }
  }

  console.log(`Creating new filerouter-cli project: ${projectName}\n`);

  // Create project structure
  const dirs = [
    projectDir,
    path.join(projectDir, "commands"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate files
  const files: Array<{ path: string; content: string }> = [
    {
      path: path.join(projectDir, "package.json"),
      content: generatePackageJson(projectName, cliName),
    },
    {
      path: path.join(projectDir, "tsconfig.json"),
      content: generateTsConfig(),
    },
    {
      path: path.join(projectDir, "main.ts"),
      content: generateMainTs(cliName),
    },
    {
      path: path.join(projectDir, "commands", "index.ts"),
      content: generateIndexCommand(cliName),
    },
    {
      path: path.join(projectDir, "commands", "hello.ts"),
      content: generateHelloCommand(),
    },
    {
      path: path.join(projectDir, ".gitignore"),
      content: generateGitignore(),
    },
  ];

  for (const file of files) {
    fs.writeFileSync(file.path, file.content);
    console.log(`  Created ${path.relative(process.cwd(), file.path)}`);
  }

  console.log(`
Done! To get started:

  cd ${projectName}
  bun install
  bun run generate
  bun run start --help

Happy coding!
`);
}

function generatePackageJson(projectName: string, cliName: string): string {
  const pkg = {
    name: projectName,
    version: "0.1.0",
    type: "module",
    bin: {
      [cliName]: "./main.ts",
    },
    scripts: {
      start: "bun run main.ts",
      dev: "bunx filerouter-cli dev",
      generate: "bunx filerouter-cli generate",
      build: "bun build ./main.ts --outdir ./dist --target node",
    },
    dependencies: {
      "filerouter-cli": "^0.1.0",
      zod: "^3.23.0",
    },
    devDependencies: {
      "bun-types": "latest",
      typescript: "^5.0.0",
    },
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: "ESNext",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmit: true,
      types: ["bun-types"],
    },
    include: ["**/*.ts"],
    exclude: ["node_modules", "dist"],
  };
  return JSON.stringify(config, null, 2) + "\n";
}

function generateMainTs(cliName: string): string {
  return `#!/usr/bin/env bun
import { createCommandsRouter, ParseError, CommandNotFoundError } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

const router = createCommandsRouter({
  commandsTree,
  cliName: "${cliName}",
  // Add shared context here:
  // context: { db: database, config: appConfig },
});

async function main() {
  try {
    const route = parseRoute(process.argv);
    await router.run(route);
  } catch (error) {
    if (error instanceof ParseError) {
      console.error(\`Error: \${error.message}\`);
      console.log(\`\\n\${error.help}\`);
      process.exit(1);
    }

    if (error instanceof CommandNotFoundError) {
      console.error(\`Error: \${error.message}\`);
      console.log(\`\\n\${error.help}\`);
      process.exit(1);
    }

    // Unknown error
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

main();
`;
}

function generateIndexCommand(cliName: string): string {
  return `import { createFileCommand } from "filerouter-cli";

// ${cliName}
// Root command - shown when user runs the CLI without arguments

export const Command = createFileCommand("/")({
  description: "Welcome to ${cliName}",
  handler: async () => {
    return \`
${cliName} - A CLI built with filerouter-cli

Run '${cliName} --help' to see available commands.
\`.trim();
  },
});
`;
}

function generateHelloCommand(): string {
  return `import { createFileCommand } from "filerouter-cli";
import { z } from "zod";

// my-cli hello
// Example command with arguments

export const Command = createFileCommand("/hello")({
  description: "Say hello to someone",
  validateArgs: z.object({
    name: z.string().default("World").describe("Name to greet"),
    excited: z.boolean().default(false).describe("Add excitement!"),
  }),
  aliases: {
    name: ["n"],
    excited: ["e"],
  },
  handler: async ({ args }) => {
    const greeting = \`Hello, \${args.name}\`;
    return args.excited ? \`\${greeting}!!!\` : \`\${greeting}.\`;
  },
});
`;
}

function generateGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# Generated files
commandsTree.gen.ts

# Bun
bun.lockb

# OS
.DS_Store

# IDE
.idea/
.vscode/
*.swp
*.swo
`;
}
