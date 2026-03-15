# filerouter-cli

> **⚠️ Work in Progress**  
> This project is under active development. APIs may change without notice. Not recommended for production use yet.

A file-based routing framework for building CLI applications with TypeScript. Inspired by [TanStack Router](https://tanstack.com/router) conventions.

## Features

- **File-based routing** - Define commands using file system structure
- **TypeScript-first** - Full type inference for params, args, and context
- **Zod validation** - Schema-based validation for arguments and parameters
- **Middleware support** - Add authentication, logging, or any custom logic
- **Layouts** - Wrap commands with shared logic using pathless layouts
- **Splat routes** - Capture remaining arguments with `$.ts` files
- **Auto-generation** - Generate route tree from file structure
- **Hot reload** - Development mode with `bun --hot`
- **Bun-native** - Built for Bun runtime with shell integration

## Installation

```bash
bun add filerouter-cli zod
```

## Quick Start

The fastest way to get started is using the `init` command:

```bash
bunx filerouter-cli init my-cli
cd my-cli
bun install
bun run generate
bun run start --help
```

This creates a ready-to-use project with example commands.

### Manual Setup

If you prefer to set up manually, create your project structure:

```
my-cli/
├── commands/
│   ├── index.ts        # Root command (my-cli)
│   ├── auth.ts         # my-cli auth
│   ├── list/
│   │   ├── index.ts    # my-cli list
│   │   └── $projectId.ts # my-cli list <projectId>
│   └── add/
│       └── $.ts        # my-cli add <packages...>
├── main.ts
└── package.json
```

### Creating Commands

```typescript
// commands/auth.ts
import { createFileCommand } from "filerouter-cli";
import { z } from "zod";

export const Command = createFileCommand("/auth")({
  description: "Authenticate with the service",
  validateArgs: z.object({
    token: z.string().optional().describe("Auth token"),
  }),
  aliases: {
    token: ["t"],
  },
  handler: async ({ args }) => {
    if (args.token) {
      return `Authenticated with token: ${args.token}`;
    }
    return "Please provide a token with --token or -t";
  },
});
```

### Generate the route tree

```bash
bunx filerouter-cli generate
```

This creates `commandsTree.gen.ts` with all your routes.

### Main entry point

```typescript
// main.ts
import { createCommandsRouter, ParseError, CommandNotFoundError } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

const router = createCommandsRouter({
  commandsTree,
  cliName: "my-cli",
});

async function main() {
  try {
    const route = parseRoute(process.argv);
    await router.run(route);
  } catch (error) {
    if (error instanceof ParseError || error instanceof CommandNotFoundError) {
      console.error(`Error: ${error.message}`);
      console.log(`\n${error.help}`);
      process.exit(1);
    }
    throw error;
  }
}

main();
```

### Run your CLI

```bash
bun run main.ts auth --token abc123
# Output: Authenticated with token: abc123

bun run main.ts --help
# Shows all available commands
```

## File Conventions

| File Pattern | Route | Description |
|--------------|-------|-------------|
| `index.ts` | `/` | Root/index command |
| `auth.ts` | `/auth` | Static route |
| `list/index.ts` | `/list` | Nested index |
| `$projectId.ts` | `/$projectId` | Dynamic parameter |
| `list/$projectId.ts` | `/list/$projectId` | Nested dynamic |
| `$.ts` | `/$` | Splat (captures all remaining) |
| `add/$.ts` | `/add/$` | Nested splat |
| `_auth/route.ts` | `/_auth` | Pathless layout |
| `_auth/protected.ts` | `/_auth/protected` | Layout child |

## Command Configuration

```typescript
export const Command = createFileCommand("/path")({
  // Required
  description: "Command description for help text",
  handler: async (ctx) => { /* ... */ },
  
  // Optional
  validateArgs: z.object({ /* Zod schema for flags */ }),
  validateParams: z.object({ /* Zod schema for path params */ }),
  paramsDescription: { paramName: "Description" },
  aliases: { flagName: ["a", "alias"] },
  middleware: [authMiddleware, logMiddleware],
  onError: (error) => `Error: ${error.message}`,
});
```

## Handler Context

```typescript
handler: async ({ args, params, context, $, redirect, outlet, rawArgs }) => {
  // args - Validated command flags
  // params - Validated path parameters (or _splat for splat routes)
  // context - User-provided shared context
  // $ - Bun shell (Bun.$)
  // redirect - Navigate to another command
  // outlet - For layouts: child command output (Promise)
  // rawArgs - Original argv array
}
```

## Dynamic Parameters

```typescript
// commands/users/$userId.ts
export const Command = createFileCommand("/users/$userId")({
  description: "Get user details",
  paramsDescription: {
    userId: "The user ID to look up",
  },
  handler: async ({ params }) => {
    // params.userId is typed as string
    return `User: ${params.userId}`;
  },
});
```

```bash
my-cli users 123
# Output: User: 123
```

## Splat Routes

Capture all remaining arguments:

```typescript
// commands/install/$.ts
export const Command = createFileCommand("/install/$")({
  description: "Install packages",
  validateArgs: z.object({
    dev: z.boolean().default(false).describe("Install as dev dependency"),
  }),
  aliases: { dev: ["D"] },
  paramsDescription: {
    _splat: "Packages to install",
  },
  handler: async ({ args, params }) => {
    // params._splat is typed as string[]
    const packages = params._splat;
    const flag = args.dev ? "--save-dev" : "--save";
    return `Installing: ${packages.join(", ")} (${flag})`;
  },
});
```

```bash
my-cli install -D typescript react zod
# Output: Installing: typescript, react, zod (--save-dev)
```

## Pathless Layouts

Wrap commands with shared logic without affecting the URL:

```typescript
// commands/_auth/route.ts
export const Command = createFileCommand("/_auth")({
  description: "Auth layout",
  handler: async ({ outlet, context }) => {
    // Check authentication
    if (!context.user) {
      return "Please login first";
    }
    // Render child command
    const childOutput = await outlet;
    return `[Authenticated]\n${childOutput}`;
  },
});

// commands/_auth/dashboard.ts
export const Command = createFileCommand("/_auth/dashboard")({
  description: "User dashboard",
  handler: async () => "Dashboard content",
});
```

```bash
my-cli dashboard  # Note: "_auth" is not in the command
# Output: [Authenticated]
#         Dashboard content
```

## Middleware

```typescript
import { createGuard } from "filerouter-cli";

// Simple guard
const authGuard = createGuard(
  (ctx) => ctx.isAuthenticated,
  () => { throw new Error("Unauthorized"); }
);

// Custom middleware
const logMiddleware = async (ctx, next) => {
  console.log("Before command");
  await next();
  console.log("After command");
};

export const Command = createFileCommand("/protected")({
  description: "Protected command",
  middleware: [logMiddleware, authGuard],
  handler: async () => "Secret content",
});
```

## Router Configuration

```typescript
const router = createCommandsRouter({
  commandsTree,
  cliName: "my-cli",
  context: {
    // Shared context available to all commands
    db: database,
    user: currentUser,
  },
  defaultOnError: (error) => {
    console.error("Error:", error.message);
  },
});
```

## CLI Commands

### Initialize a new project

```bash
bunx filerouter-cli init <project-name> [options]
  -n, --name <name>    CLI name (default: project name)
```

Creates a new project with:
- `commands/` directory with example commands
- `main.ts` entry point
- `package.json` with scripts
- `tsconfig.json` configured for Bun

### Generate routes

```bash
bunx filerouter-cli generate [options]
  -c, --commands <path>  Commands directory (default: ./commands)
  -o, --output <path>    Output file (default: ./commandsTree.gen.ts)
  -n, --name <name>      CLI name for help text
```

### Development mode

```bash
bunx filerouter-cli dev [options]
  -c, --commands <path>  Commands directory (default: ./commands)
  -o, --output <path>    Output file (default: ./commandsTree.gen.ts)
```

Watches for file changes and regenerates routes automatically.

### Shell completion

```bash
bunx filerouter-cli completion <shell>
```

Generates shell completion scripts for bash, zsh, or fish.

```bash
# Bash
eval "$(filerouter-cli completion bash)"

# Zsh
eval "$(filerouter-cli completion zsh)"

# Fish
filerouter-cli completion fish > ~/.config/fish/completions/filerouter-cli.fish
```

## Example Project Structure

```
my-cli/
├── commands/
│   ├── index.ts              # my-cli
│   ├── auth.ts               # my-cli auth
│   ├── config/
│   │   ├── index.ts          # my-cli config
│   │   ├── get.ts            # my-cli config get
│   │   └── set.ts            # my-cli config set
│   ├── projects/
│   │   ├── index.ts          # my-cli projects
│   │   ├── $projectId.ts     # my-cli projects <id>
│   │   └── create.ts         # my-cli projects create
│   ├── _admin/
│   │   ├── route.ts          # Admin layout (auth check)
│   │   └── users.ts          # my-cli users (protected)
│   └── install/
│       └── $.ts              # my-cli install <packages...>
├── commandsTree.gen.ts       # Auto-generated
├── main.ts
├── package.json
└── tsconfig.json
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "types": ["bun-types"]
  }
}
```

## Requirements

- [Bun](https://bun.sh) >= 1.0.0
- TypeScript >= 5.0
- Zod >= 3.0

## License

MIT
