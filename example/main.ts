#!/usr/bin/env bun
import { router } from "./commandsTree";

await router.run(process.argv).catch(() => process.exit(1));
