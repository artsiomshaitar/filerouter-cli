import * as fs from "fs";
import * as path from "path";
import {
  scanCommands,
  generateCommandsTree,
  scaffoldIfEmpty,
} from "../generator";

export interface WatcherOptions {
  commandsDirectory: string;
  generatedFile: string;
  cliName: string;
  onCommandsChanged: (commandCount: number) => void;
  onWatchEvent: (message: string) => void;
  onError: (error: Error) => void;
}

export interface WatcherState {
  commandCount: number;
}

/**
 * Start watching the commands directory for changes
 * Returns a cleanup function to stop watching
 */
export function startWatcher(options: WatcherOptions): () => void {
  const {
    commandsDirectory,
    generatedFile,
    cliName,
    onCommandsChanged,
    onWatchEvent,
    onError,
  } = options;

  const cwd = process.cwd();
  const commandsDir = path.resolve(cwd, commandsDirectory);
  const outputFile = path.resolve(cwd, generatedFile);

  // Track debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 100;

  // Generate initially
  regenerate();

  // Watch directory recursively
  const watcher = fs.watch(
    commandsDir,
    { recursive: true },
    async (eventType, filename) => {
      if (!filename) return;

      const filePath = path.join(commandsDir, filename);

      // Only handle relevant file types
      if (!/\.(ts|tsx|js|jsx)$/.test(filename)) return;

      // Ignore the generated file itself
      if (filePath === outputFile) return;

      // Debounce rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        try {
          // Check if file exists (might be a delete event)
          const exists = fs.existsSync(filePath);

          if (exists && eventType === "rename") {
            // New file created - try to scaffold
            const wasScaffolded = await scaffoldIfEmpty(filePath, commandsDir);
            if (wasScaffolded) {
              onWatchEvent(`scaffolded ${filename}`);
            }
          }

          // Regenerate
          await regenerate();
          onWatchEvent(`regenerated (${eventType}: ${filename})`);
        } catch (error) {
          onError(error as Error);
        }
      }, DEBOUNCE_MS);
    }
  );

  async function regenerate() {
    try {
      const result = await scanCommands(commandsDir);

      const code = generateCommandsTree(result.commands, {
        commandsDirectory,
        generatedFile,
        cliName,
      });

      // Ensure directory exists
      const dir = path.dirname(outputFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Only write if changed
      const existing = fs.existsSync(outputFile)
        ? fs.readFileSync(outputFile, "utf-8")
        : "";

      const normalize = (s: string) => s.replace(/^\/\/ Generated at:.*$/m, "");

      if (normalize(existing) !== normalize(code)) {
        fs.writeFileSync(outputFile, code);
      }

      onCommandsChanged(result.commands.length);
    } catch (error) {
      onError(error as Error);
    }
  }

  // Return cleanup function
  return () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    watcher.close();
  };
}

/**
 * Get initial command count
 */
export async function getInitialCommandCount(
  commandsDirectory: string
): Promise<number> {
  const cwd = process.cwd();
  const commandsDir = path.resolve(cwd, commandsDirectory);

  try {
    const result = await scanCommands(commandsDir);
    return result.commands.length;
  } catch {
    return 0;
  }
}
