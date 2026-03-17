import * as fs from "fs";
import * as path from "path";

export interface InitOptions {
  projectName: string;
}

/**
 * Initialize a new filerouter-cli project
 */
export async function runInit(options: InitOptions): Promise<void> {
  const { projectName } = options;
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
  const dirs = [projectDir, path.join(projectDir, "commands")];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate files
  const files: Array<{ path: string; content: string }> = [
    {
      path: path.join(projectDir, "package.json"),
      content: generatePackageJson(projectName),
    },
    {
      path: path.join(projectDir, "tsconfig.json"),
      content: generateTsConfig(),
    },
    {
      path: path.join(projectDir, "main.ts"),
      content: generateMainTs(),
    },
    {
      path: path.join(projectDir, "commands", "__root.ts"),
      content: generateRootCommand(),
    },
    {
      path: path.join(projectDir, "commands", "index.ts"),
      content: generateIndexCommand(),
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
  ./main.ts --help

Happy coding!
`);
}

function generatePackageJson(projectName: string): string {
  const pkg = {
    name: projectName,
    version: "0.1.0",
    type: "module",
    bin: {
      [projectName]: "./main.ts",
    },
    scripts: {
      dev: "bun filerouter-cli dev main.ts",
      generate: "bun filerouter-cli generate",
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
  return `${JSON.stringify(pkg, null, 2)}\n`;
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
  return `${JSON.stringify(config, null, 2)}\n`;
}

function generateMainTs(): string {
  return `#!/usr/bin/env bun
import { createCommandsRouter } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

const router = createCommandsRouter({
  commandsTree,
  parseRoute,
  // Add shared context here:
  // context: { db: database, config: appConfig },
});

await router.run(process.argv).catch(() => process.exit(1));
`;
}

function generateRootCommand(): string {
  return `import { createRootCommand } from "filerouter-cli";

/**
 * Application context type
 * Add shared dependencies here (logger, config, db, etc.)
 */
export interface AppContext {
  // Example:
  // logger: { info: (msg: string) => void };
  // config: { verbose: boolean };
}

/**
 * Root command - defines the CLI's context type
 * (Following TanStack Router's __root.tsx convention)
 */
export const RootCommand = createRootCommand<AppContext>()({
  description: "My CLI application",
});
`;
}

function generateIndexCommand(): string {
  return `import { createFileCommand, commandInfo } from "filerouter-cli";

// "/" command handler - shown when user runs the CLI without arguments

export const Command = createFileCommand("/")({
  description: "Welcome to the CLI",
  handler: async ({ context }) => {
    // Context is typed from AppContext in __root.ts
    // Example: context.logger.info("Running root command");
    
    const info = commandInfo("/");
    return \`
\${info.command()} - A CLI built with filerouter-cli

Run '\${info.command()} --help' to see available commands.
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
