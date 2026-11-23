import { parse } from "yaml";
import { ReviewError } from "./process.js";
import { type Revision } from "./git.js";

type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function get(value: JsonObject, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

export function escapePointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function parsePointer(ref: string): string[] {
  if (!ref.startsWith("#/")) {
    throw new ReviewError("UNSUPPORTED_REFERENCE", `Use an internal JSON Pointer beginning with "#/": ${ref}`);
  }
  try {
    return decodeURIComponent(ref.slice(2)).split("/").map(segment => {
      if (/~(?![01])/.test(segment)) throw new Error("Invalid escape");
      return segment.replaceAll("~1", "/").replaceAll("~0", "~");
    });
  } catch {
    throw new ReviewError("INVALID_SPEC", `Malformed JSON Pointer: ${ref}`);
  }
}

function resolvePointer(document: JsonObject, ref: string): unknown {
  let value: unknown = document;
  for (const segment of parsePointer(ref)) {
    if (Array.isArray(value)) {
      value = /^(0|[1-9]\d*)$/.test(segment) ? value[Number(segment)] : undefined;
    } else {
      value = isObject(value) ? get(value, segment) : undefined;
    }
  }
  if (value === undefined) {
    throw new ReviewError("INVALID_SPEC", `Internal reference does not exist: ${ref}`);
  }
  return value;
}

function* objectsIn(value: unknown): Generator<JsonObject> {
  const stack = [value];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      for (const item of current) stack.push(item);
    } else if (isObject(current)) {
      yield current;
      for (const item of Object.values(current)) stack.push(item);
    }
  }
}

function referencesIn(object: JsonObject): string[] {
  const refs: string[] = [];
  for (const key of ["$ref", "$dynamicRef", "$recursiveRef"]) {
    if (!Object.hasOwn(object, key)) continue;
    const ref = object[key];
    if (typeof ref !== "string") throw new ReviewError("INVALID_SPEC", `${key} must be a string.`);
    refs.push(ref);
  }
  return refs;
}

export function parseSpec(text: string, source: Revision): JsonObject {
  let value: unknown;
  try {
    value = /\.json$/i.test(source.specPath) ? JSON.parse(text) : parse(text, { maxAliasCount: 0 });
  } catch {
    throw new ReviewError("INVALID_SPEC", `Cannot parse "${source.specPath}" at "${source.ref}". Use a self-contained YAML or JSON document without YAML aliases.`);
  }

  if (!isObject(value) || typeof value.openapi !== "string") {
    throw new ReviewError("INVALID_SPEC", `"${source.specPath}" at "${source.ref}" must declare an OpenAPI version.`);
  }
  if (!/^3\.[01]\.\d+$/.test(value.openapi)) {
    throw new ReviewError("UNSUPPORTED_VERSION", `OpenAPI ${value.openapi} is unsupported. Use 3.0.x or 3.1.x.`);
  }
  if (!isObject(value.info) || typeof value.info.title !== "string" || typeof value.info.version !== "string" ||
      (value.paths !== undefined && !isObject(value.paths)) ||
      (value.openapi.startsWith("3.0.") && !isObject(value.paths))) {
    throw new ReviewError("INVALID_SPEC", "The OpenAPI document must contain valid info and paths fields.");
  }
  for (const object of objectsIn(value)) {
    const id = get(object, "$id");
    if (typeof id === "string" && id !== "" && !id.startsWith("#")) {
      throw new ReviewError("UNSUPPORTED_REFERENCE", "Schema identifiers that change the document location are unsupported.");
    }
    for (const ref of referencesIn(object)) resolvePointer(value, ref);
  }
  return value;
}

function resolveEntry(value: unknown, pointer: string, document: JsonObject) {
  const seen = new Set<string>();
  while (isObject(value) && typeof value.$ref === "string") {
    if (seen.has(value.$ref)) throw new ReviewError("INVALID_SPEC", `Circular reference at "${pointer}".`);
    seen.add(value.$ref);
    pointer = "/" + parsePointer(value.$ref).map(escapePointer).join("/");
    value = resolvePointer(document, value.$ref);
  }
  return { value, pointer };
}

function referencedEntries(document: JsonObject, roots: unknown[]): Record<string, unknown> {
  const references = new Map<string, unknown>();
  const queue = [...roots];
  while (queue.length) {
    for (const object of objectsIn(queue.pop())) {
      for (const ref of referencesIn(object)) {
        if (references.has(ref)) continue;
        const value = resolvePointer(document, ref);
        references.set(ref, value);
        queue.push(value);
      }
    }
  }
  return Object.fromEntries(references);
}

export const methods = ["GET", "PUT", "POST", "DELETE", "OPTIONS", "HEAD", "PATCH", "TRACE"] as const;

export function inspectOperation(document: JsonObject, source: Revision, method: string, path: string) {
  const paths = document.paths;
  const pathItem = resolveEntry(isObject(paths) ? get(paths, path) : undefined, `/paths/${escapePointer(path)}`, document);
  const operationKey = method.toLowerCase();
  const operation = isObject(pathItem.value) ? get(pathItem.value, operationKey) : undefined;
  if (!isObject(pathItem.value) || !isObject(operation)) {
    throw new ReviewError("ENDPOINT_NOT_FOUND", `No operation "${method} ${path}" exists at "${source.ref}".`);
  }
  const pointer = `${pathItem.pointer}/${operationKey}`;
  const parameters = new Map<string, { value: JsonObject; pointer: string }>();
  for (const [owner, ownerPointer] of [[pathItem.value, pathItem.pointer], [operation, pointer]] as const) {
    if (owner.parameters === undefined) continue;
    if (!Array.isArray(owner.parameters)) throw new ReviewError("INVALID_SPEC", "Operation parameters must be an array.");
    owner.parameters.forEach((parameter, index) => {
      const entry = resolveEntry(parameter, `${ownerPointer}/parameters/${index}`, document);
      if (!isObject(entry.value) || typeof entry.value.name !== "string" || typeof entry.value.in !== "string") {
        throw new ReviewError("INVALID_SPEC", `Invalid OpenAPI parameter at "${entry.pointer}".`);
      }
      parameters.set(JSON.stringify([entry.value.in, entry.value.name]), { value: entry.value, pointer: entry.pointer });
    });
  }

  if (!isObject(operation.responses)) throw new ReviewError("INVALID_SPEC", `Operation responses at "${pointer}" are required.`);
  const requestBody = operation.requestBody === undefined
    ? null
    : resolveEntry(operation.requestBody, `${pointer}/requestBody`, document);
  if (requestBody && !isObject(requestBody.value)) throw new ReviewError("INVALID_SPEC", "Invalid OpenAPI request body.");
  const responses = Object.fromEntries(Object.entries(operation.responses).map(([code, response]) => {
    const entry = resolveEntry(response, `${pointer}/responses/${escapePointer(code)}`, document);
    if (!isObject(entry.value)) throw new ReviewError("INVALID_SPEC", `Invalid OpenAPI response at "${entry.pointer}".`);
    return [code, entry];
  }));

  return {
    source,
    method,
    path,
    pointer,
    operationId: typeof operation.operationId === "string" ? operation.operationId : null,
    parameters: [...parameters.values()],
    requestBody,
    responses,
    components: referencedEntries(document, [
      ...[...parameters.values()].map(parameter => parameter.value),
      requestBody?.value,
      ...Object.values(responses).map(response => response.value),
    ]),
  };
}
