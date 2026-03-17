import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { ParseError } from "../errors";
import {
  expandAliases,
  extractBooleanFlags,
  extractValidFlags,
  formatUnknownFlagsError,
  parseRawArgs,
  suggestSimilarFlags,
  validateArgs,
  validateParams,
} from "../parser";

describe("parseRawArgs", () => {
  describe("basic flags", () => {
    it("parses --flag value", () => {
      const result = parseRawArgs(["--name", "John"]);
      expect(result.flags).toEqual({ name: "John" });
      expect(result.positional).toEqual([]);
    });

    it("parses --flag=value", () => {
      const result = parseRawArgs(["--name=John"]);
      expect(result.flags).toEqual({ name: "John" });
    });

    it("parses -f value", () => {
      const result = parseRawArgs(["-n", "John"]);
      expect(result.flags).toEqual({ n: "John" });
    });

    it("parses -f=value", () => {
      const result = parseRawArgs(["-n=John"]);
      expect(result.flags).toEqual({ n: "John" });
    });

    it("parses --no-flag (negation)", () => {
      const result = parseRawArgs(["--no-verbose"]);
      expect(result.flags).toEqual({ verbose: false });
    });

    it("parses multiple flags", () => {
      const result = parseRawArgs(["--name", "John", "--age", "30"]);
      expect(result.flags).toEqual({ name: "John", age: 30 });
    });

    it("parses mixed flag formats", () => {
      const result = parseRawArgs(["--name=John", "-a", "30", "--verbose"]);
      expect(result.flags).toEqual({ name: "John", a: 30, verbose: true });
    });
  });

  describe("boolean flags", () => {
    it("parses standalone --verbose as true", () => {
      const result = parseRawArgs(["--verbose"]);
      expect(result.flags).toEqual({ verbose: true });
    });

    it("parses boolean flag before positional with booleanFlags option", () => {
      const booleanFlags = new Set(["D", "dev"]);
      const result = parseRawArgs(["add", "-D", "typescript"], { booleanFlags });
      expect(result.flags).toEqual({ D: true });
      expect(result.positional).toEqual(["add", "typescript"]);
    });

    it("parses boolean flag with --flag before positional", () => {
      const booleanFlags = new Set(["dev"]);
      const result = parseRawArgs(["add", "--dev", "typescript"], { booleanFlags });
      expect(result.flags).toEqual({ dev: true });
      expect(result.positional).toEqual(["add", "typescript"]);
    });

    it("parses flag followed by another flag as boolean", () => {
      const result = parseRawArgs(["--verbose", "--name", "John"]);
      expect(result.flags).toEqual({ verbose: true, name: "John" });
    });

    it("parses flag at end of args as boolean", () => {
      const result = parseRawArgs(["--name", "John", "--verbose"]);
      expect(result.flags).toEqual({ name: "John", verbose: true });
    });

    it("does not treat flag as boolean without booleanFlags when followed by non-flag", () => {
      const result = parseRawArgs(["-D", "typescript"]);
      expect(result.flags).toEqual({ D: "typescript" });
      expect(result.positional).toEqual([]);
    });

    it("handles multiple boolean flags in sequence", () => {
      const booleanFlags = new Set(["D", "E"]);
      const result = parseRawArgs(["add", "-D", "-E", "package"], { booleanFlags });
      expect(result.flags).toEqual({ D: true, E: true });
      expect(result.positional).toEqual(["add", "package"]);
    });
  });

  describe("value coercion", () => {
    it('coerces "true" to boolean true', () => {
      const result = parseRawArgs(["--flag=true"]);
      expect(result.flags.flag).toBe(true);
    });

    it('coerces "false" to boolean false', () => {
      const result = parseRawArgs(["--flag=false"]);
      expect(result.flags.flag).toBe(false);
    });

    it('coerces "123" to number 123', () => {
      const result = parseRawArgs(["--count", "123"]);
      expect(result.flags.count).toBe(123);
    });

    it('coerces "3.14" to number 3.14', () => {
      const result = parseRawArgs(["--pi", "3.14"]);
      expect(result.flags.pi).toBe(3.14);
    });

    it('coerces negative numbers "-5"', () => {
      // Note: "-5" would be treated as a flag, so we use --value=-5
      const result = parseRawArgs(["--value=-5"]);
      expect(result.flags.value).toBe(-5);
    });

    it("keeps strings as strings", () => {
      const result = parseRawArgs(["--name", "hello"]);
      expect(result.flags.name).toBe("hello");
    });

    it("keeps empty string as string", () => {
      const result = parseRawArgs(["--name="]);
      expect(result.flags.name).toBe("");
    });
  });

  describe("positional arguments", () => {
    it("parses simple positionals", () => {
      const result = parseRawArgs(["foo", "bar", "baz"]);
      expect(result.positional).toEqual(["foo", "bar", "baz"]);
      expect(result.flags).toEqual({});
    });

    it("parses positionals mixed with flags", () => {
      const result = parseRawArgs(["add", "--dev", "typescript"]);
      expect(result.positional).toEqual(["add"]);
      expect(result.flags).toEqual({ dev: "typescript" });
    });

    it("parses positionals with boolean flags", () => {
      const booleanFlags = new Set(["dev"]);
      const result = parseRawArgs(["add", "--dev", "typescript", "react"], { booleanFlags });
      expect(result.positional).toEqual(["add", "typescript", "react"]);
      expect(result.flags).toEqual({ dev: true });
    });

    it("treats everything after -- as positional", () => {
      const result = parseRawArgs(["--verbose", "--", "--not-a-flag", "value"]);
      expect(result.flags).toEqual({ verbose: true });
      expect(result.positional).toEqual(["--not-a-flag", "value"]);
    });

    it("handles -- with nothing after", () => {
      const result = parseRawArgs(["--verbose", "--"]);
      expect(result.flags).toEqual({ verbose: true });
      expect(result.positional).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("handles empty argv", () => {
      const result = parseRawArgs([]);
      expect(result.flags).toEqual({});
      expect(result.positional).toEqual([]);
    });

    it("handles only flags", () => {
      const result = parseRawArgs(["--alpha", "1", "--beta", "2"]);
      expect(result.flags).toEqual({ alpha: 1, beta: 2 });
      expect(result.positional).toEqual([]);
    });

    it("handles only positionals", () => {
      const result = parseRawArgs(["foo", "bar"]);
      expect(result.flags).toEqual({});
      expect(result.positional).toEqual(["foo", "bar"]);
    });

    it("handles flag with empty value via =", () => {
      const result = parseRawArgs(["--name="]);
      expect(result.flags.name).toBe("");
    });

    it("handles short flag with empty value via =", () => {
      const result = parseRawArgs(["-n="]);
      expect(result.flags.n).toBe("");
    });

    it("handles single dash as positional", () => {
      const result = parseRawArgs(["-"]);
      expect(result.positional).toEqual(["-"]);
    });
  });

  describe("dash style validation", () => {
    it("throws error for --x (double dash with single char)", () => {
      expect(() => parseRawArgs(["--f"])).toThrow(ParseError);
      expect(() => parseRawArgs(["--f"])).toThrow("Invalid flag format: --f");
    });

    it("suggests single dash format in error message", () => {
      try {
        parseRawArgs(["--f"]);
      } catch (e) {
        expect(e).toBeInstanceOf(ParseError);
        expect((e as ParseError).help).toContain("-f");
      }
    });

    it("throws error for --x=value (double dash with single char and value)", () => {
      expect(() => parseRawArgs(["--f=test"])).toThrow(ParseError);
      expect(() => parseRawArgs(["--f=test"])).toThrow("Invalid flag format");
    });

    it("allows -f (single dash with single char)", () => {
      const result = parseRawArgs(["-f", "value"]);
      expect(result.flags).toEqual({ f: "value" });
    });

    it("allows --flag (double dash with multi char)", () => {
      const result = parseRawArgs(["--flag", "value"]);
      expect(result.flags).toEqual({ flag: "value" });
    });

    it("allows -flag (single dash with multi char)", () => {
      // Some CLIs allow this - we're lenient here
      const result = parseRawArgs(["-flag", "value"]);
      expect(result.flags).toEqual({ flag: "value" });
    });

    it("throws for --f in middle of args", () => {
      expect(() => parseRawArgs(["--name", "test", "--f"])).toThrow(ParseError);
    });

    it("throws for --f with boolean flags set", () => {
      const booleanFlags = new Set(["f"]);
      expect(() => parseRawArgs(["--f"], { booleanFlags })).toThrow(ParseError);
    });
  });
});

describe("extractBooleanFlags", () => {
  it("extracts z.boolean()", () => {
    const schema = z.object({
      verbose: z.boolean(),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
  });

  it("extracts z.boolean().optional()", () => {
    const schema = z.object({
      verbose: z.boolean().optional(),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
  });

  it("extracts z.boolean().default(false)", () => {
    const schema = z.object({
      verbose: z.boolean().default(false),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
  });

  it("extracts z.boolean().nullable()", () => {
    const schema = z.object({
      verbose: z.boolean().nullable(),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
  });

  it("extracts nested z.boolean().optional().default(true)", () => {
    const schema = z.object({
      verbose: z.boolean().optional().default(true),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
  });

  it("includes aliases for boolean flags", () => {
    const schema = z.object({
      verbose: z.boolean(),
    });
    const aliases = { verbose: ["v", "V"] };
    const flags = extractBooleanFlags(schema, aliases);
    expect(flags.has("verbose")).toBe(true);
    expect(flags.has("v")).toBe(true);
    expect(flags.has("V")).toBe(true);
  });

  it("excludes non-boolean types", () => {
    const schema = z.object({
      verbose: z.boolean(),
      name: z.string(),
      count: z.number(),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
    expect(flags.has("name")).toBe(false);
    expect(flags.has("count")).toBe(false);
  });

  it("returns empty set for undefined schema", () => {
    const flags = extractBooleanFlags(undefined);
    expect(flags.size).toBe(0);
  });

  it("returns empty set for schema without shape", () => {
    const schema = z.string();
    const flags = extractBooleanFlags(schema);
    expect(flags.size).toBe(0);
  });

  it("handles multiple boolean fields", () => {
    const schema = z.object({
      verbose: z.boolean(),
      debug: z.boolean().default(false),
      force: z.boolean().optional(),
    });
    const flags = extractBooleanFlags(schema);
    expect(flags.has("verbose")).toBe(true);
    expect(flags.has("debug")).toBe(true);
    expect(flags.has("force")).toBe(true);
  });
});

describe("validateArgs", () => {
  it("validates and returns correct args", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });
    const result = validateArgs({ name: "John", age: 30 }, schema);
    expect(result).toEqual({ name: "John", age: 30 });
  });

  it("applies defaults", () => {
    const schema = z.object({
      name: z.string(),
      verbose: z.boolean().default(false),
    });
    const result = validateArgs({ name: "John" }, schema);
    expect(result).toEqual({ name: "John", verbose: false });
  });

  it("throws ParseError for missing required field", () => {
    const schema = z.object({
      name: z.string(),
    });
    expect(() => validateArgs({}, schema)).toThrow(ParseError);
  });

  it("throws ParseError for invalid type", () => {
    const schema = z.object({
      age: z.number(),
    });
    expect(() => validateArgs({ age: "not a number" }, schema)).toThrow(ParseError);
  });

  it("expands aliases before validation", () => {
    const schema = z.object({
      verbose: z.boolean(),
    });
    const aliases = { verbose: ["v"] };
    const result = validateArgs({ v: true }, schema, aliases);
    expect(result).toEqual({ verbose: true });
  });

  it("preserves canonical name over alias", () => {
    const schema = z.object({
      verbose: z.boolean(),
    });
    const aliases = { verbose: ["v"] };
    // Both provided - canonical should win (it's already there)
    const result = validateArgs({ verbose: false, v: true }, schema, aliases);
    expect(result.verbose).toBe(false);
  });

  it("error message includes field path", () => {
    const schema = z.object({
      name: z.string(),
    });
    try {
      validateArgs({}, schema);
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).message).toContain("--name");
    }
  });
});

describe("validateParams", () => {
  it("validates string params", () => {
    const schema = z.object({
      projectId: z.string(),
    });
    const result = validateParams({ projectId: "proj_123" }, schema);
    expect(result).toEqual({ projectId: "proj_123" });
  });

  it("validates _splat as string array", () => {
    const schema = z.object({
      _splat: z.array(z.string()),
    });
    const result = validateParams({ _splat: ["foo", "bar"] }, schema);
    expect(result).toEqual({ _splat: ["foo", "bar"] });
  });

  it("throws ParseError for missing params", () => {
    const schema = z.object({
      projectId: z.string(),
    });
    expect(() => validateParams({}, schema)).toThrow(ParseError);
  });

  it("throws ParseError for invalid params", () => {
    const schema = z.object({
      count: z.number(),
    });
    expect(() => validateParams({ count: "not a number" }, schema)).toThrow(ParseError);
  });

  it("validates multiple params", () => {
    const schema = z.object({
      userId: z.string(),
      postId: z.string(),
    });
    const result = validateParams({ userId: "user_1", postId: "post_1" }, schema);
    expect(result).toEqual({ userId: "user_1", postId: "post_1" });
  });

  it("applies transforms", () => {
    const schema = z.object({
      id: z.string().transform((s) => parseInt(s, 10)),
    });
    const result = validateParams({ id: "123" }, schema);
    expect(result).toEqual({ id: 123 });
  });
});

describe("expandAliases", () => {
  it("expands single alias", () => {
    const flags = { v: true };
    const aliases = { verbose: ["v"] };
    const result = expandAliases(flags, aliases);
    expect(result).toEqual({ verbose: true });
  });

  it("expands multiple aliases to same canonical", () => {
    const flags = { v: true };
    const aliases = { verbose: ["v", "V"] };
    const result = expandAliases(flags, aliases);
    expect(result).toEqual({ verbose: true });
  });

  it("does not overwrite canonical if already present", () => {
    const flags = { verbose: false, v: true };
    const aliases = { verbose: ["v"] };
    const result = expandAliases(flags, aliases);
    expect(result.verbose).toBe(false);
    expect(result.v).toBe(true); // v is kept because verbose already exists
  });

  it("handles empty aliases", () => {
    const flags = { name: "John" };
    const result = expandAliases(flags, {});
    expect(result).toEqual({ name: "John" });
  });

  it("handles multiple canonical names", () => {
    const flags = { v: true, d: true };
    const aliases = { verbose: ["v"], debug: ["d"] };
    const result = expandAliases(flags, aliases);
    expect(result).toEqual({ verbose: true, debug: true });
  });

  it("preserves non-aliased flags", () => {
    const flags = { v: true, name: "John" };
    const aliases = { verbose: ["v"] };
    const result = expandAliases(flags, aliases);
    expect(result).toEqual({ verbose: true, name: "John" });
  });
});

describe("extractValidFlags", () => {
  it("extracts flags from schema", () => {
    const schema = z.object({
      verbose: z.boolean(),
      name: z.string(),
    });
    const flags = extractValidFlags(schema);
    expect(flags.has("verbose")).toBe(true);
    expect(flags.has("name")).toBe(true);
    expect(flags.get("verbose")?.canonical).toBe("verbose");
  });

  it("includes aliases", () => {
    const schema = z.object({
      verbose: z.boolean(),
    });
    const aliases = { verbose: ["v", "V"] };
    const flags = extractValidFlags(schema, aliases);
    expect(flags.has("verbose")).toBe(true);
    expect(flags.has("v")).toBe(true);
    expect(flags.has("V")).toBe(true);
    // All point to the same canonical name
    expect(flags.get("v")?.canonical).toBe("verbose");
    expect(flags.get("V")?.canonical).toBe("verbose");
  });

  it("returns empty map for undefined schema", () => {
    const flags = extractValidFlags(undefined);
    expect(flags.size).toBe(0);
  });

  it("returns empty map for schema without shape", () => {
    const schema = z.string();
    const flags = extractValidFlags(schema);
    expect(flags.size).toBe(0);
  });
});

describe("suggestSimilarFlags", () => {
  const schema = z.object({
    filter: z.string().optional(),
    verbose: z.boolean().optional(),
    output: z.string().optional(),
  });
  const aliases = { filter: ["f"], verbose: ["v"] };

  it("suggests prefix matches", () => {
    const validFlags = extractValidFlags(schema, aliases);

    // "fil" is a prefix of "filter"
    const result = suggestSimilarFlags("fil", validFlags);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].canonical).toBe("filter");
  });

  it("suggests single-char prefix matches", () => {
    const validFlags = extractValidFlags(schema, aliases);

    // "f" is a prefix of "filter"
    const result = suggestSimilarFlags("f", validFlags);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].canonical).toBe("filter");
  });

  it("suggests typo corrections via edit distance", () => {
    const validFlags = extractValidFlags(schema, aliases);

    // "fitler" is a typo of "filter" (transposition)
    const result = suggestSimilarFlags("fitler", validFlags);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].canonical).toBe("filter");
  });

  it("suggests verboes -> verbose (typo)", () => {
    const validFlags = extractValidFlags(schema, aliases);

    const result = suggestSimilarFlags("verboes", validFlags);
    expect(result.suggestions.length).toBe(1);
    expect(result.suggestions[0].canonical).toBe("verbose");
  });

  it("returns no suggestions for completely different flags", () => {
    const validFlags = extractValidFlags(schema, aliases);

    // "xyz" is completely different
    const result = suggestSimilarFlags("xyz", validFlags);
    expect(result.suggestions.length).toBe(0);
  });

  it("returns no suggestions for 'fu' (not a prefix of filter)", () => {
    const validFlags = extractValidFlags(schema, aliases);

    // "fu" is not a prefix of any flag and too different
    const result = suggestSimilarFlags("fu", validFlags);
    expect(result.suggestions.length).toBe(0);
  });

  it("includes aliases info in suggestions", () => {
    const validFlags = extractValidFlags(schema, aliases);

    const result = suggestSimilarFlags("fil", validFlags);
    expect(result.suggestions[0].aliases).toContain("f");
  });
});

describe("formatUnknownFlagsError", () => {
  const schema = z.object({
    filter: z.string().optional(),
    verbose: z.boolean().optional(),
  });
  const aliases = { filter: ["f"], verbose: ["v"] };

  it("formats error with suggestion for prefix match", () => {
    const validFlags = extractValidFlags(schema, aliases);
    const { message, help } = formatUnknownFlagsError(["fil"], validFlags);

    expect(message).toBe("Unknown flag: --fil");
    expect(help).toContain("Did you mean");
    expect(help).toContain("--filter");
  });

  it("formats error with available flags when no suggestions", () => {
    const validFlags = extractValidFlags(schema, aliases);
    const { message, help } = formatUnknownFlagsError(["xyz"], validFlags);

    expect(message).toBe("Unknown flag: --xyz");
    expect(help).toContain("Available flags:");
    expect(help).toContain("--filter");
    expect(help).toContain("--verbose");
  });

  it("handles multiple unknown flags", () => {
    const validFlags = extractValidFlags(schema, aliases);
    const { message } = formatUnknownFlagsError(["xyz", "abc"], validFlags);

    expect(message).toBe("Unknown flags: --xyz, --abc");
  });
});

describe("validateArgs with strictFlags", () => {
  it("throws ParseError for unknown flags when strictFlags is true (default)", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });
    const aliases = { filter: ["f"] };

    expect(() => validateArgs({ unknown: "value" }, schema, aliases)).toThrow(ParseError);

    try {
      validateArgs({ unknown: "value" }, schema, aliases);
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).code).toBe("UNKNOWN_FLAG");
      expect((e as ParseError).message).toContain("Unknown flag");
      expect((e as ParseError).message).toContain("unknown");
    }
  });

  it("suggests similar flags in error message", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });
    const aliases = { filter: ["f"] };

    try {
      validateArgs({ fil: "value" }, schema, aliases);
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).help).toContain("Did you mean");
      expect((e as ParseError).help).toContain("--filter");
    }
  });

  it("does not throw for unknown flags when strictFlags is false", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });

    // Should not throw - unknown flags are allowed
    const result = validateArgs({ unknown: "value" }, schema, undefined, { strictFlags: false });
    expect(result).toEqual({}); // Zod strips unknown keys by default
  });

  it("accepts valid flags", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });
    const aliases = { filter: ["f"] };

    // Should not throw
    const result = validateArgs({ filter: "test" }, schema, aliases);
    expect(result).toEqual({ filter: "test" });
  });

  it("accepts valid aliases", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });
    const aliases = { filter: ["f"] };

    // Should not throw - "f" is a valid alias
    const result = validateArgs({ f: "test" }, schema, aliases);
    expect(result).toEqual({ filter: "test" });
  });

  it("shows available flags when no similar flags found", () => {
    const schema = z.object({
      filter: z.string().optional(),
      verbose: z.boolean().optional(),
    });
    const aliases = { filter: ["f"], verbose: ["v"] };

    try {
      validateArgs({ xyz: "value" }, schema, aliases);
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).help).toContain("Available flags:");
      expect((e as ParseError).help).toContain("--filter");
      expect((e as ParseError).help).toContain("--verbose");
    }
  });

  it("handles multiple unknown flags", () => {
    const schema = z.object({
      filter: z.string().optional(),
    });

    try {
      validateArgs({ foo: "a", bar: "b" }, schema);
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect((e as ParseError).message).toContain("Unknown flags:");
      expect((e as ParseError).message).toContain("foo");
      expect((e as ParseError).message).toContain("bar");
    }
  });
});
