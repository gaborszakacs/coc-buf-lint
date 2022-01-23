var __create = Object.create;
var __defProp = Object.defineProperty;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {get: all[name], enumerable: true});
};
var __exportStar = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __exportStar(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};

// src/extension.ts
__markAsModule(exports);
__export(exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
var vscode = __toModule(require("coc.nvim"));

// src/buf.ts
var child_process = __toModule(require("child_process"));

// src/version.ts
var versionRegexp = /^(\d+)\.(\d+).(\d+)(?:\-dev|\-rc)?(\d*)?$/;
var less = (first, second) => {
  if (first.major < second.major) {
    return true;
  }
  if (first.major === second.major && first.minor < second.minor) {
    return true;
  }
  if (first.major === second.major && first.minor === second.minor && first.patch < second.patch) {
    return true;
  }
  return first.major === second.major && first.minor === second.minor && first.patch === second.patch && checkReleaseCandidate(first.releaseCandidate, second.releaseCandidate);
};
var format = (version2) => {
  if (version2.releaseCandidate !== null) {
    return `v${version2.major}.${version2.minor}.${version2.patch}-rc${version2.releaseCandidate}`;
  }
  return `v${version2.major}.${version2.minor}.${version2.patch}`;
};
var parse = (versionString) => {
  const match = versionString.match(versionRegexp);
  if (match === null || match.length < 4) {
    return {
      errorMessage: `failed to parse version output: ${versionString}`
    };
  }
  const major = parseInt(match[1]);
  if (Number.isNaN(major)) {
    return {
      errorMessage: "failed to parse major version"
    };
  }
  const minor = parseInt(match[2]);
  if (Number.isNaN(minor)) {
    return {
      errorMessage: "failed to parse minor version"
    };
  }
  const patch = parseInt(match[3]);
  if (Number.isNaN(patch)) {
    return {
      errorMessage: "failed to parse patch version"
    };
  }
  let releaseCandidate = parseInt(match[4]);
  if (Number.isNaN(releaseCandidate)) {
    releaseCandidate = null;
  }
  return {
    major,
    minor,
    patch,
    releaseCandidate
  };
};
var checkReleaseCandidate = (firstReleaseCandidate, secondReleaseCandidate) => {
  if (firstReleaseCandidate === null) {
    return false;
  }
  if (secondReleaseCandidate === null) {
    return true;
  }
  return firstReleaseCandidate < secondReleaseCandidate;
};

// src/buf.ts
var minimumVersion = {
  major: 1,
  minor: 0,
  patch: 0,
  releaseCandidate: 6
};
var lint = (binaryPath, filePath, cwd) => {
  const output = child_process.spawnSync(binaryPath, ["lint", filePath + "#include_package_files=true", "--error-format=json"], {
    encoding: "utf-8",
    cwd
  });
  if (output.error !== void 0) {
    return {errorMessage: output.error.message};
  }
  if (output.status !== null && output.status === 0) {
    return [];
  }
  return output.stdout.trim().split("\n");
};
var version = (binaryPath) => {
  const output = child_process.spawnSync(binaryPath, ["--version"], {
    encoding: "utf-8"
  });
  if (output.error !== void 0) {
    return {errorMessage: output.error.message};
  }
  if (output.stderr.trim() !== "") {
    return parse(output.stderr.trim());
  }
  return parse(output.stdout.trim());
};

// src/errors.ts
function isError(value) {
  return value.errorMessage !== void 0;
}

// src/parser.ts
function isWarning(o) {
  return "path" in o && "type" in o && "start_line" in o && "end_line" in o && "start_column" in o && "end_column" in o && "message" in o;
}
var parseLines = (errorLines) => {
  let warnings = [];
  for (let index = 0; index < errorLines.length; index++) {
    try {
      const warning = JSON.parse(errorLines[index]);
      if (!isWarning(warning)) {
        return {
          errorMessage: `failed to parse "${errorLines[index]}" as warning`
        };
      }
      warnings.push(warning);
    } catch (error) {
      return {
        errorMessage: `failed to parse "${errorLines[index]}" as warning: ${error}`
      };
    }
  }
  return warnings;
};

// src/extension.ts
function activate(context) {
  const binaryPath = vscode.workspace.getConfiguration("buf").get("binaryPath");
  if (binaryPath === void 0) {
    vscode.window.showErrorMessage("buf binary path was not set");
    return;
  }
  const binaryVersion = version(binaryPath);
  if (isError(binaryVersion)) {
    vscode.window.showInformationMessage(`Failed to get buf version: ${binaryVersion.errorMessage}`);
  } else {
    if (less(binaryVersion, minimumVersion)) {
      vscode.window.showErrorMessage(`This version of vscode-buf requires at least version ${format(minimumVersion)} of buf.
          You are current on version ${format(binaryVersion)}.`, "Go to download page");
      return;
    }
  }
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("vscode-buf.lint");
  const doLint = (document) => {
    if (!document.uri.endsWith(".proto")) {
      return;
    }
    if (vscode.workspace.workspaceFolders === void 0) {
      vscode.window.showErrorMessage("workspace folders was undefined");
      return;
    }
    if (vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("workspace folders was not set");
      return;
    }
    const uri = vscode.workspace.workspaceFolders[0].uri;
    const binaryPath2 = vscode.workspace.getConfiguration("buf").get("binaryPath");
    if (binaryPath2 === void 0) {
      vscode.window.showErrorMessage("buf binary path was not set");
      return;
    }
    const lines = lint(binaryPath2, document.uri.replace("file://", ""), uri.replace("file://", ""));
    if (isError(lines)) {
      if (lines.errorMessage.includes("ENOENT")) {
        vscode.window.showInformationMessage(`Failed to execute buf, is it installed?`);
        return;
      }
      vscode.window.showInformationMessage(`Failed to execute 'buf check lint': ${lines}`);
      return;
    }
    const warnings = parseLines(lines);
    if (isError(warnings)) {
      vscode.window.showErrorMessage(warnings.toString());
      return;
    }
    const diagnostics = warnings.map((error) => {
      const range = vscode.Range.create(error.start_line - 1, error.start_column - 1, error.end_line - 1, error.end_column - 1);
      return vscode.Diagnostic.create(range, `${error.message} (${error.type})`, vscode.DiagnosticSeverity.Warning);
    });
    diagnosticCollection.set(document.uri, diagnostics);
  };
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doLint));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doLint));
  context.subscriptions.push(vscode.commands.registerCommand("buf.lint", async () => {
    const currentDoc = await vscode.workspace.document;
    const doc = vscode.workspace.textDocuments.find((doc2) => doc2.uri.toString() === currentDoc.uri.toString());
    if (doc == void 0) {
      return;
    }
    doLint(doc);
  }));
}
function deactivate() {
}
