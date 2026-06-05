import { awsError } from "../framework.ts";
import { resolveValue } from "./bindings.ts";
import { createTokenStream, tokenize } from "./lexer.ts";
import type { TokenStream } from "./lexer.ts";
import { parseAttributePath, pathsOverlap, formatPath } from "./paths.ts";
import type {
  AddActionAST,
  AttributeBindings,
  AttributePath,
  DeleteActionAST,
  Operand,
  RemoveActionAST,
  SetActionAST,
  SetValueAST,
  UpdateAST,
  UpdateSection,
} from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

const parseOperandForSet = (
  stream: TokenStream,
  bindings: AttributeBindings,
): Operand => {
  const head = stream.peek();
  if (head.kind === "valueRef") {
    stream.consume();
    const value = resolveValue(head.text, bindings);
    return { kind: "value", ref: head.text, value };
  }
  if (head.kind === "ident" || head.kind === "nameRef") {
    const path = parseAttributePath(stream, bindings);
    return { kind: "path", path };
  }
  return failValidation(
    `Expected an operand in SET expression but found '${head.text || head.kind}'`,
  );
};

const parseSetValue = (
  stream: TokenStream,
  bindings: AttributeBindings,
): SetValueAST => {
  const head = stream.peek();
  if (head.kind === "ident" && stream.peek(1).kind === "lparen") {
    if (head.text === "if_not_exists") {
      stream.consume();
      stream.expect("lparen", "expected '(' after if_not_exists");
      const path = parseAttributePath(stream, bindings);
      stream.expect("comma", "expected ',' in if_not_exists");
      const def = parseSetValue(stream, bindings);
      stream.expect("rparen", "expected ')' after if_not_exists");
      return { kind: "if_not_exists", path, default: def };
    }
    if (head.text === "list_append") {
      stream.consume();
      stream.expect("lparen", "expected '(' after list_append");
      const left = parseSetValue(stream, bindings);
      stream.expect("comma", "expected ',' in list_append");
      const right = parseSetValue(stream, bindings);
      stream.expect("rparen", "expected ')' after list_append");
      return { kind: "list_append", left, right };
    }
    return failValidation(`Unknown function '${head.text}' in SET expression`);
  }
  const left = parseOperandForSet(stream, bindings);
  const next = stream.peek();
  if (next.kind === "plus") {
    stream.consume();
    const right = parseOperandForSet(stream, bindings);
    return { kind: "plus", left, right };
  }
  if (next.kind === "minus") {
    stream.consume();
    const right = parseOperandForSet(stream, bindings);
    return { kind: "minus", left, right };
  }
  return { kind: "operand", operand: left };
};

const parseSetSection = (
  stream: TokenStream,
  bindings: AttributeBindings,
): SetActionAST[] => {
  const actions: SetActionAST[] = [];
  while (true) {
    const target = parseAttributePath(stream, bindings);
    stream.expect("eq", "expected '=' in SET action");
    const value = parseSetValue(stream, bindings);
    actions.push({ kind: "set", target, value });
    if (stream.peek().kind !== "comma") break;
    stream.consume();
  }
  return actions;
};

const parseRemoveSection = (
  stream: TokenStream,
  bindings: AttributeBindings,
): RemoveActionAST[] => {
  const actions: RemoveActionAST[] = [];
  while (true) {
    const target = parseAttributePath(stream, bindings);
    actions.push({ kind: "remove", target });
    if (stream.peek().kind !== "comma") break;
    stream.consume();
  }
  return actions;
};

const parseAddSection = (
  stream: TokenStream,
  bindings: AttributeBindings,
): AddActionAST[] => {
  const actions: AddActionAST[] = [];
  while (true) {
    const target = parseAttributePath(stream, bindings);
    const valTok = stream.peek();
    if (valTok.kind !== "valueRef") {
      failValidation("ADD expects a value reference as the second operand");
    }
    stream.consume();
    actions.push({
      kind: "add",
      target,
      value: {
        kind: "value",
        ref: valTok.text,
        value: resolveValue(valTok.text, bindings),
      },
    });
    if (stream.peek().kind !== "comma") break;
    stream.consume();
  }
  return actions;
};

const parseDeleteSection = (
  stream: TokenStream,
  bindings: AttributeBindings,
): DeleteActionAST[] => {
  const actions: DeleteActionAST[] = [];
  while (true) {
    const target = parseAttributePath(stream, bindings);
    const valTok = stream.peek();
    if (valTok.kind !== "valueRef") {
      failValidation("DELETE expects a value reference as the second operand");
    }
    stream.consume();
    actions.push({
      kind: "delete",
      target,
      value: {
        kind: "value",
        ref: valTok.text,
        value: resolveValue(valTok.text, bindings),
      },
    });
    if (stream.peek().kind !== "comma") break;
    stream.consume();
  }
  return actions;
};

const SECTION_TOKEN_TO_VERB = {
  kwSet: "SET",
  kwRemove: "REMOVE",
  kwAdd: "ADD",
  kwDelete: "DELETE",
} as const;

const collectAllTargets = (
  sections: UpdateSection[],
): { target: AttributePath; label: string }[] => {
  const out: { target: AttributePath; label: string }[] = [];
  for (const section of sections) {
    for (const action of section.actions) {
      out.push({ target: action.target, label: formatPath(action.target) });
    }
  }
  return out;
};

export const parseUpdateExpression = (
  expression: string,
  bindings: AttributeBindings,
): UpdateAST => {
  const stream = createTokenStream(tokenize(expression));
  const sections: UpdateSection[] = [];
  const seenVerbs = new Set<string>();
  while (true) {
    const head = stream.peek();
    if (head.kind === "eof") break;
    const verb =
      SECTION_TOKEN_TO_VERB[head.kind as keyof typeof SECTION_TOKEN_TO_VERB];
    if (verb === undefined) {
      failValidation(
        `Expected SET, REMOVE, ADD or DELETE but found '${head.text || head.kind}'`,
      );
    }
    if (seenVerbs.has(verb)) {
      failValidation(`'${verb}' section cannot appear more than once`);
    }
    seenVerbs.add(verb);
    stream.consume();
    if (verb === "SET") {
      sections.push({ verb, actions: parseSetSection(stream, bindings) });
    } else if (verb === "REMOVE") {
      sections.push({ verb, actions: parseRemoveSection(stream, bindings) });
    } else if (verb === "ADD") {
      sections.push({ verb, actions: parseAddSection(stream, bindings) });
    } else {
      sections.push({ verb, actions: parseDeleteSection(stream, bindings) });
    }
  }
  if (sections.length === 0) {
    failValidation("UpdateExpression must contain at least one clause");
  }
  const targets = collectAllTargets(sections);
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      if (pathsOverlap(targets[i]!.target, targets[j]!.target)) {
        failValidation(
          `Two document paths overlap with each other; must remove or rewrite one of these paths; path one: [${targets[i]!.label}], path two: [${targets[j]!.label}]`,
        );
      }
    }
  }
  return { sections };
};
