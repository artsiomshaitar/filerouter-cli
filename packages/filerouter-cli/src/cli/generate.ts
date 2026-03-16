import * as path from "path";
import * as fs from "fs";
import { scanCommands, generateCommandsTree } from "../generator";

export interface GenerateOptions {
  commandsDirectory: string;
  generatedFile: string;
}

export async function runGenerate(options: GenerateOptions): Promise<void> {
  const cwd = process.cwd();
  const commandsDir = path.resolve(cwd, options.commandsDirectory);
  const outputFile = path.resolve(cwd, options.generatedFile);

  console.log(`Scanning commands in: ${commandsDir}`);

  const result = await scanCommands(commandsDir);

  console.log(`Found ${result.commands.length} commands:`);
  for (const cmd of result.commands) {
    console.log(`  ${cmd.routePath} -> ${cmd.filePath}`);
  }

  const code = generateCommandsTree(result.commands, {
    commandsDirectory: options.commandsDirectory,
    generatedFile: options.generatedFile,
  });

  // Ensure directory exists
  const dir = path.dirname(outputFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputFile, code);
  console.log(`\nGenerated: ${options.generatedFile}`);
}
