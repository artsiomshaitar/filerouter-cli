import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useApp } from "ink";
import { Header } from "./Header.js";
import { Output, OutputEntry, OutputEntryType } from "./Output.js";
import { Prompt } from "./Prompt.js";
import { startWatcher, getInitialCommandCount } from "../watcher.js";
import { getVersion } from "../version.js";
import { ParseError, CommandNotFoundError } from "../../errors.js";
import * as path from "path";

const VERSION = getVersion();

// State persisted via globalThis across hot reloads
declare global {
  var __filerouter_dev_state: {
    history: string[];
    entries: OutputEntry[];
    entryIdCounter: number;
  } | undefined;
}

// Initialize or restore persisted state
const getPersistedState = () => {
  if (!globalThis.__filerouter_dev_state) {
    globalThis.__filerouter_dev_state = {
      history: [],
      entries: [],
      entryIdCounter: 0,
    };
  }
  return globalThis.__filerouter_dev_state;
};

export interface DevModeProps {
  commandsDirectory: string;
  generatedFile: string;
  cliName?: string;
}

export function DevMode({ commandsDirectory, generatedFile, cliName = "dev" }: DevModeProps) {
  const { exit } = useApp();
  const persistedState = getPersistedState();

  // Use persisted state for history and entries
  const [commandCount, setCommandCount] = useState(0);
  const [history, setHistory] = useState<string[]>(persistedState.history);
  const [entries, setEntries] = useState<OutputEntry[]>(persistedState.entries);
  const [isExecuting, setIsExecuting] = useState(false);

  // Sync state back to globalThis when it changes
  useEffect(() => {
    persistedState.history = history;
  }, [history]);

  useEffect(() => {
    persistedState.entries = entries;
  }, [entries]);

  // Add an entry to the output
  const addEntry = useCallback((type: OutputEntryType, content: string) => {
    const id = persistedState.entryIdCounter++;
    setEntries((prev) => [
      ...prev,
      { id, type, content, timestamp: new Date() },
    ]);
  }, []);

  // Clear all entries (Ctrl+L)
  const clearEntries = useCallback(() => {
    setEntries([]);
    persistedState.entries = [];
  }, []);

  // Execute a command - always load fresh modules (bun --hot handles invalidation)
  const executeCommand = useCallback(
    async (input: string) => {
      // Add command to history
      setHistory((prev) => [...prev, input]);

      // Add command to output
      addEntry("command", input);

      setIsExecuting(true);

      try {
        const cwd = process.cwd();
        const outputFile = path.resolve(cwd, generatedFile);

        // Dynamic import - bun --hot ensures we get fresh modules after file changes
        // No cache busting needed - bun handles module invalidation
        const treeModule = await import(outputFile);
        const { createCommandsRouter } = await import("../../router.js");

        const router = createCommandsRouter({
          commandsTree: treeModule.commandsTree,
          cliName,
        });

        // Parse the input as argv
        const argv = parseInputToArgv(input);

        // Add fake "bun" and "script" to match process.argv format
        const fullArgv = ["bun", "dev", ...argv];

        // Parse route
        const route = treeModule.parseRoute(fullArgv);

        // Execute command
        const result = await router.invoke(route);

        // Display result
        if (typeof result === "string") {
          addEntry("result", result);
        } else if (typeof result === "number") {
          addEntry("info", `Exit code: ${result}`);
        }
        // void result = no output
      } catch (error) {
        const err = error as Error;

        // For known CLI errors, show clean message + help (no stack trace)
        if (err instanceof ParseError || err instanceof CommandNotFoundError) {
          const helpText = err.help ? `\n${err.help}` : "";
          addEntry("error", `${err.message}${helpText}`);
        } else {
          // For unexpected errors, show stack trace for debugging
          const stack = err.stack || err.message;
          addEntry("error", stack);
        }
      } finally {
        setIsExecuting(false);
      }
    },
    [addEntry, generatedFile, cliName]
  );

  // Start file watcher for scaffolding and regeneration
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const init = async () => {
      // Get initial command count
      const count = await getInitialCommandCount(commandsDirectory);
      setCommandCount(count);

      // Start watcher - it handles scaffolding and regeneration
      // Bun's --hot will automatically reload modules when files change
      cleanup = startWatcher({
        commandsDirectory,
        generatedFile,
        cliName,
        onCommandsChanged: (count) => {
          setCommandCount(count);
          // No need to manually reload - bun --hot handles it
        },
        onWatchEvent: () => {
          // Silent reload (Option A)
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
  }, [commandsDirectory, generatedFile, cliName, addEntry]);

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
