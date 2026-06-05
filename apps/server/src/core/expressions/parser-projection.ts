import { awsError } from "../framework.ts";
import { createTokenStream, tokenize } from "./lexer.ts";
import { formatPath, parseAttributePath, pathsOverlap } from "./paths.ts";
import type { AttributeBindings, ProjectionAST } from "./types.ts";

const failValidation = (message: string): never => {
  throw awsError("ValidationException", message, 400);
};

export const parseProjectionExpression = (
  expression: string,
  bindings: Pick<AttributeBindings, "names">,
): ProjectionAST => {
  const stream = createTokenStream(tokenize(expression));
  if (stream.peek().kind === "eof") {
    failValidation("ProjectionExpression must contain at least one attribute");
  }
  const paths = [parseAttributePath(stream, bindings)];
  while (stream.peek().kind === "comma") {
    stream.consume();
    paths.push(parseAttributePath(stream, bindings));
  }
  if (stream.peek().kind !== "eof") {
    failValidation(
      `Unexpected token '${stream.peek().text || stream.peek().kind}' in ProjectionExpression`,
    );
  }
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      if (pathsOverlap(paths[i]!, paths[j]!)) {
        failValidation(
          `Two document paths overlap with each other; must remove or rewrite one of these paths; path one: [${formatPath(paths[i]!)}], path two: [${formatPath(paths[j]!)}]`,
        );
      }
    }
  }
  return { paths };
};
