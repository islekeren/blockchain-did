import Module from "node:module";
import path from "node:path";

type ModuleLoader = typeof Module._load;
type ModuleResolver = typeof Module._resolveFilename;

type PatchedGlobal = typeof globalThis & {
  __studentVerificationAliasPatched?: boolean;
  __studentVerificationOriginalResolve?: ModuleResolver;
};

const patchedGlobal = globalThis as PatchedGlobal;

if (!patchedGlobal.__studentVerificationAliasPatched) {
  const originalResolve = Module._resolveFilename;

  Module._resolveFilename = function resolveAlias(
    request,
    parent,
    isMain,
    options
  ) {
    if (typeof request === "string" && request.startsWith("@/")) {
      const resolvedRequest = path.join(
        process.cwd(),
        "src",
        request.slice(2)
      );

      return originalResolve.call(
        this,
        resolvedRequest,
        parent,
        isMain,
        options
      );
    }

    return originalResolve.call(this, request, parent, isMain, options);
  } as ModuleResolver;

  patchedGlobal.__studentVerificationAliasPatched = true;
  patchedGlobal.__studentVerificationOriginalResolve = originalResolve;
}

export function installModuleMocks(mocks: Record<string, unknown>) {
  const originalLoad = Module._load;

  Module._load = function loadWithMocks(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }

    return originalLoad.call(this, request, parent, isMain);
  } as ModuleLoader;

  return () => {
    Module._load = originalLoad;
  };
}

export function clearModule(modulePath: string) {
  const resolvedPath = modulePath.startsWith(".")
    ? path.resolve(process.cwd(), modulePath)
    : modulePath;

  delete require.cache[require.resolve(resolvedPath)];
}
