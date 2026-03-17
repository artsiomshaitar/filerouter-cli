import { Box, Text, useInput } from "ink";
import { useState } from "react";

export interface PromptProps {
  onSubmit: (input: string) => void;
  onClear?: () => void;
  history: string[];
  disabled?: boolean;
  cliName: string;
}

export function Prompt({ onSubmit, onClear, history, disabled = false, cliName }: PromptProps) {
  const [input, setInput] = useState("");
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cursorOffset, setCursorOffset] = useState(0);

  useInput(
    (inputChar, key) => {
      if (disabled) return;

      // Enter: submit command
      if (key.return) {
        if (input.trim()) {
          onSubmit(input.trim());
          setInput("");
          setHistoryIndex(-1);
          setCursorOffset(0);
        }
        return;
      }

      // Up arrow: previous history
      if (key.upArrow) {
        if (history.length > 0) {
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          const historyItem = history[history.length - 1 - newIndex];
          if (historyItem) {
            setInput(historyItem);
            setCursorOffset(0);
          }
        }
        return;
      }

      // Down arrow: next history
      if (key.downArrow) {
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          const historyItem = history[history.length - 1 - newIndex];
          if (historyItem) {
            setInput(historyItem);
            setCursorOffset(0);
          }
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput("");
          setCursorOffset(0);
        }
        return;
      }

      // Backspace: delete character
      if (key.backspace || key.delete) {
        if (input.length > 0) {
          const pos = input.length - cursorOffset;
          if (pos > 0) {
            setInput(input.slice(0, pos - 1) + input.slice(pos));
          }
        }
        return;
      }

      // Left arrow
      if (key.leftArrow) {
        setCursorOffset(Math.min(cursorOffset + 1, input.length));
        return;
      }

      // Right arrow
      if (key.rightArrow) {
        setCursorOffset(Math.max(cursorOffset - 1, 0));
        return;
      }

      // Ctrl+C is handled by Ink/Node
      if (key.ctrl && inputChar === "c") {
        return;
      }

      // Ctrl+U: clear line
      if (key.ctrl && inputChar === "u") {
        setInput("");
        setCursorOffset(0);
        return;
      }

      // Ctrl+L: clear screen
      if (key.ctrl && inputChar === "l") {
        onClear?.();
        return;
      }

      // Regular character input
      if (inputChar && !key.ctrl && !key.meta) {
        const pos = input.length - cursorOffset;
        setInput(input.slice(0, pos) + inputChar + input.slice(pos));
      }
    },
    { isActive: !disabled },
  );

  // Render cursor by inserting a visible marker
  const renderInputWithCursor = () => {
    const pos = input.length - cursorOffset;
    const before = input.slice(0, pos);
    const cursor = input[pos] || " ";
    const after = input.slice(pos + 1);

    return (
      <>
        <Text>{before}</Text>
        <Text backgroundColor="white" color="black">
          {cursor}
        </Text>
        <Text>{after}</Text>
      </>
    );
  };

  return (
    <Box>
      <Text color="green" bold>
        {">"} {cliName}{" "}
      </Text>
      {renderInputWithCursor()}
    </Box>
  );
}
