export type AttributeValue = Record<string, unknown>;

export type AttributeBindings = {
  names: Record<string, string>;
  values: Record<string, AttributeValue>;
};

export type TokenKind =
  | "ident"
  | "nameRef"
  | "valueRef"
  | "int"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "dot"
  | "eq"
  | "ne"
  | "lt"
  | "le"
  | "gt"
  | "ge"
  | "plus"
  | "minus"
  | "kwSet"
  | "kwRemove"
  | "kwAdd"
  | "kwDelete"
  | "kwBetween"
  | "kwIn"
  | "kwAnd"
  | "kwOr"
  | "kwNot"
  | "eof";

export type Token = { kind: TokenKind; text: string; start: number };

export type PathStep =
  | { kind: "field"; name: string }
  | { kind: "index"; index: number };

export type AttributePath = {
  root: string;
  steps: PathStep[];
};

export type Operand =
  | { kind: "path"; path: AttributePath }
  | { kind: "value"; ref: string; value: AttributeValue }
  | { kind: "size"; path: AttributePath };

export type AttributeTypeCode =
  | "S"
  | "SS"
  | "N"
  | "NS"
  | "B"
  | "BS"
  | "BOOL"
  | "NULL"
  | "L"
  | "M";

export type ConditionAST =
  | {
      kind: "cmp";
      op: "=" | "<>" | "<" | "<=" | ">" | ">=";
      left: Operand;
      right: Operand;
    }
  | { kind: "between"; target: Operand; low: Operand; high: Operand }
  | { kind: "in"; target: Operand; list: Operand[] }
  | { kind: "and"; left: ConditionAST; right: ConditionAST }
  | { kind: "or"; left: ConditionAST; right: ConditionAST }
  | { kind: "not"; expr: ConditionAST }
  | {
      kind: "fn";
      name: "attribute_exists" | "attribute_not_exists";
      path: AttributePath;
    }
  | {
      kind: "fn";
      name: "attribute_type";
      path: AttributePath;
      typeCode: AttributeTypeCode;
    }
  | { kind: "fn"; name: "begins_with"; path: AttributePath; prefix: Operand }
  | { kind: "fn"; name: "contains"; path: AttributePath; operand: Operand };

export type SetValueAST =
  | { kind: "operand"; operand: Operand }
  | { kind: "plus"; left: Operand; right: Operand }
  | { kind: "minus"; left: Operand; right: Operand }
  | { kind: "if_not_exists"; path: AttributePath; default: SetValueAST }
  | { kind: "list_append"; left: SetValueAST; right: SetValueAST };

export type SetActionAST = {
  kind: "set";
  target: AttributePath;
  value: SetValueAST;
};
export type RemoveActionAST = { kind: "remove"; target: AttributePath };
export type AddActionAST = {
  kind: "add";
  target: AttributePath;
  value: Operand;
};
export type DeleteActionAST = {
  kind: "delete";
  target: AttributePath;
  value: Operand;
};

export type UpdateSection =
  | { verb: "SET"; actions: SetActionAST[] }
  | { verb: "REMOVE"; actions: RemoveActionAST[] }
  | { verb: "ADD"; actions: AddActionAST[] }
  | { verb: "DELETE"; actions: DeleteActionAST[] };

export type UpdateAST = { sections: UpdateSection[] };

export type ProjectionAST = { paths: AttributePath[] };

export type RangePredicateAST =
  | { kind: "cmp"; op: "=" | "<" | "<=" | ">" | ">="; value: Operand }
  | { kind: "between"; low: Operand; high: Operand }
  | { kind: "begins_with"; prefix: Operand };

export type KeyConditionAST = {
  hash: { path: AttributePath; value: Operand };
  range?: { path: AttributePath; predicate: RangePredicateAST };
};

export type KeyConditionResult = {
  hash: { attribute: string; value: AttributeValue };
  range?:
    | {
        attribute: string;
        op: "=" | "<" | "<=" | ">" | ">=";
        value: AttributeValue;
      }
    | {
        attribute: string;
        op: "BETWEEN";
        lo: AttributeValue;
        hi: AttributeValue;
      }
    | { attribute: string; op: "begins_with"; prefix: AttributeValue };
};
