import React, { useState, useEffect, useCallback } from "react";
import { Box } from "ink";
import { Header } from "./Header.js";
import { Output, OutputEntry, OutputEntryType } from "./Output.js";
import { Prompt } from "./Prompt.js";
import { startWatcher, getInitialCommandCount } from "../watcher.js";
import { getVersion } from "../version.js";
import { getProjectName } from "../../packageJson.js";
import * as path from "path";

const VERSION = getVersion();

export interface DevModeProps {
  commandsDirectory: string;
  generatedFile: string;
  entryPoint: string;
}

export function DevMode({ commandsDirectory, generatedFile, entryPoint }: DevModeProps) {
  // Get CLI name from package.json (falls back to "cli")
  const cliName = getProjectName();

  const [commandCount, setCommandCount] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [entries, setEntries] = useState<OutputEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Counter for unique entry IDs
  const entryIdRef = React.useRef(0);

  // Add an entry to the output
  const addEntry = useCallback((type: OutputEntryType, content: string) => {
    const id = entryIdRef.current++;
    setEntries((prev) => [
      ...prev,
      { id, type, content, timestamp: new Date() },
    ]);
  }, []);

  // Clear all entries (Ctrl+L)
  const clearEntries = useCallback(() => {
    setEntries([]);
  }, []);

  // Execute a command by spawning the user's entry point
  const executeCommand = useCallback(
    async (input: string) => {
      // Add command to history
      setHistory((prev) => [...prev, input]);

      // Add command to output (show with cliName prefix)
      addEntry("command", `${cliName} ${input}`);

      setIsExecuting(true);

      try {
        const cwd = process.cwd();
        const entryPath = path.resolve(cwd, entryPoint);

        // Parse input to argv
        const argv = parseInputToArgv(input);

        // Spawn: bun run <entry> <args...>
        const proc = Bun.spawn(["bun", "run", entryPath, ...argv], {
          cwd,
          stdout: "pipe",
          stderr: "pipe",
          env: process.env,
        });

        // Capture output
        const stdout = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        await proc.exited;

        if (stdout.trim()) {
          addEntry("result", stdout.trim());
        }
        if (stderr.trim()) {
          addEntry("error", stderr.trim());
        }
      } catch (error) {
        addEntry("error", (error as Error).message);
      } finally {
        setIsExecuting(false);
      }
    },
    [addEntry, entryPoint, cliName]
  );

  // Start file watcher for scaffolding and regeneration
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const init = async () => {
      // Get initial command count
      const count = await getInitialCommandCount(commandsDirectory);
      setCommandCount(count);

      // Start watcher - it handles scaffolding and regeneration
      cleanup = startWatcher({
        commandsDirectory,
        generatedFile,
        onCommandsChanged: (count) => {
          setCommandCount(count);
        },
        onWatchEvent: () => {
          // Silent - each command spawn will pick up latest changes
        },
        onError: (error) => {
          addEntry("error", error.message);
        },
      });
    };

    init();

    return () => {
      if (cleanup) cleanup();
    };
  }, [commandsDirectory, generatedFile, addEntry]);

  return (
    <Box flexDirection="column" height="100%">
      <Header
        version={VERSION}
        commandsDirectory={commandsDirectory}
        commandCount={commandCount}
      />
      <Box flexDirection="column" flexGrow={1}>
        <Output entries={entries} />
      </Box>
      <Prompt
        onSubmit={executeCommand}
        onClear={clearEntries}
        history={history}
        disabled={isExecuting}
        cliName={cliName}
      />
    </Box>
  );
}

/**
 * Parse input string to argv array
 * Handles quoted strings
 */
function parseInputToArgv(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (char === " " || char === "\t") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    args.push(current);
  }

  return args;
}
