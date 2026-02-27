const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { endpoints, components } = require("./openapi/contract-definitions.cjs");

const ROOT = process.cwd();
const API_ROUTES_DIR = path.join(ROOT, "apps", "api", "src", "app", "api");
const OUTPUT_PATHS = [
  path.join(ROOT, "docs", "api-contract", "openapi.json"),
  path.join(ROOT, "apps", "api", "public", "openapi.json"),
];

const METHOD_ORDER = ["get", "post", "put", "patch", "delete", "options"];

function routeFileToOpenApiPath(routeFilePath) {
  const relative = path.relative(API_ROUTES_DIR, routeFilePath).split(path.sep).join("/");
  const routePath = relative.replace(/\/route\.ts$/, "");
  const withPathParams = routePath.replace(/\[([^\]]+)\]/g, "{$1}");
  return `/api/${withPathParams}`;
}

function walkRouteFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

function extractMethods(sourceText) {
  const methods = new Set();
  const regex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s*\(/g;
  let match = regex.exec(sourceText);
  while (match) {
    methods.add(match[1].toLowerCase());
    match = regex.exec(sourceText);
  }
  return [...methods];
}

function buildDiscoveredOperations() {
  const routeFiles = walkRouteFiles(API_ROUTES_DIR);
  const operations = [];

  for (const routeFile of routeFiles) {
    const source = fs.readFileSync(routeFile, "utf8");
    const methods = extractMethods(source);
    const openApiPath = routeFileToOpenApiPath(routeFile);
    for (const method of methods) {
      operations.push({
        key: `${method.toUpperCase()} ${openApiPath}`,
        method,
        path: openApiPath,
        sourceFile: path.relative(ROOT, routeFile).split(path.sep).join("/"),
      });
    }
  }

  return operations.sort((a, b) => a.key.localeCompare(b.key));
}

function buildDefinedOperations() {
  return endpoints.map((endpoint) => ({
    key: `${endpoint.method.toUpperCase()} ${endpoint.path}`,
    method: endpoint.method.toLowerCase(),
    path: endpoint.path,
  }));
}

function ensureCoverage(discovered, defined) {
  const discoveredKeys = new Set(discovered.map((op) => op.key));
  const definedKeys = new Set(defined.map((op) => op.key));
  const duplicates = [];
  const seen = new Set();

  for (const op of defined) {
    if (seen.has(op.key)) duplicates.push(op.key);
    seen.add(op.key);
  }

  const missingDefinitions = discovered.filter((op) => !definedKeys.has(op.key));
  const staleDefinitions = defined.filter((op) => !discoveredKeys.has(op.key));

  if (duplicates.length || missingDefinitions.length || staleDefinitions.length) {
    const lines = ["OpenAPI contract coverage check failed."];

    if (duplicates.length) {
      lines.push("", "Duplicate endpoint definitions:");
      for (const op of duplicates) lines.push(`  - ${op}`);
    }

    if (missingDefinitions.length) {
      lines.push("", "Missing definitions for route handlers:");
      for (const op of missingDefinitions) {
        lines.push(`  - ${op.key} (${op.sourceFile})`);
      }
    }

    if (staleDefinitions.length) {
      lines.push("", "Definitions without a matching route handler:");
      for (const op of staleDefinitions) lines.push(`  - ${op.key}`);
    }

    throw new Error(lines.join("\n"));
  }
}

function createOperationId(method, pathValue) {
  const cleaned = pathValue
    .replace(/^\/api\//, "")
    .replace(/[{}]/g, "")
    .replace(/\//g, "_")
    .replace(/-/g, "_");
  return `${method}_${cleaned}`;
}

function createDocument() {
  const discovered = buildDiscoveredOperations();
  const defined = buildDefinedOperations();
  ensureCoverage(discovered, defined);

  const tagDescriptions = {
    auth: "Authentication and session identity endpoints",
    profile: "User profile management",
    friends: "Friend graph and requests",
    restaurants: "Restaurant discovery",
    sessions: "Group swiping sessions and results",
    health: "Operational health checks",
  };

  const paths = {};
  const sortedEndpoints = [...endpoints].sort((a, b) => {
    if (a.path === b.path) {
      return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
    }
    return a.path.localeCompare(b.path);
  });

  for (const endpoint of sortedEndpoints) {
    if (!paths[endpoint.path]) paths[endpoint.path] = {};
    paths[endpoint.path][endpoint.method] = {
      operationId: createOperationId(endpoint.method, endpoint.path),
      summary: endpoint.summary,
      tags: endpoint.tags,
      parameters: endpoint.parameters,
      requestBody: endpoint.requestBody,
      responses: endpoint.responses,
      security: endpoint.auth === false ? [] : [{ BearerAuth: [] }],
    };
  }

  const document = {
    openapi: "3.0.3",
    info: {
      title: "BiteBuddy API",
      version: "1.0.0",
      description:
        "Generated from route coverage + contract definitions in scripts/openapi/contract-definitions.cjs.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: Object.keys(tagDescriptions).map((name) => ({
      name,
      description: tagDescriptions[name],
    })),
    components,
    paths,
    "x-generatorHash": crypto
      .createHash("sha256")
      .update(JSON.stringify({ endpoints, components }))
      .digest("hex"),
  };

  return document;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const check = args.has("--check");
  const stdout = args.has("--stdout");
  const document = createDocument();
  const serialized = JSON.stringify(document, null, 2) + "\n";

  if (stdout) {
    process.stdout.write(serialized);
    return;
  }

  if (check) {
    for (const outputPath of OUTPUT_PATHS) {
      if (!fs.existsSync(outputPath)) {
        throw new Error(
          `Missing ${path.relative(ROOT, outputPath)}. Run npm run api:contract:generate.`
        );
      }
      const current = fs.readFileSync(outputPath, "utf8");
      if (current !== serialized) {
        throw new Error(
          `${path.relative(
            ROOT,
            outputPath
          )} is out of date. Run npm run api:contract:generate and commit the result.`
        );
      }
    }
    console.log("API contract is up to date.");
    return;
  }

  for (const outputPath of OUTPUT_PATHS) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, serialized, "utf8");
    console.log(`Generated ${path.relative(ROOT, outputPath)}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
