import * as vscode from 'coc.nvim';
import { lint, minimumVersion, version } from './buf';
import { isError } from './errors';
import { parseLines, Warning } from './parser';
import { format, less } from './version';

export function activate(context: vscode.ExtensionContext) {
  const binaryPath = vscode.workspace.getConfiguration('buf')!.get<string>('binaryPath');
  if (binaryPath === undefined) {
    vscode.window.showErrorMessage('buf binary path was not set');
    return;
  }

  const binaryVersion = version(binaryPath);
  if (isError(binaryVersion)) {
    vscode.window.showInformationMessage(`Failed to get buf version: ${binaryVersion.errorMessage}`);
  } else {
    if (less(binaryVersion, minimumVersion)) {
      vscode.window.showErrorMessage(
        `This version of vscode-buf requires at least version ${format(minimumVersion)} of buf.
          You are current on version ${format(binaryVersion)}.`,
        'Go to download page'
      );
      return;
    }
    // Don't check for latest version right now,
    // adds a lot of overhead to keep updated
    /*
    if (less(binaryVersion, latestVersion)) {
      vscode.window
        .showInformationMessage(
          `A new version of buf is available (${format(latestVersion)}).`,
          "Go to download page"
        )
        .then((selection: string | undefined) => {
          if (selection === undefined || selection !== "Go to download page") {
            return;
          }
          vscode.env.openExternal(vscode.Uri.parse(downloadPage));
        });
    }
    */
  }

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('vscode-buf.lint');
  const doLint = (document: vscode.TextDocument) => {
    if (!document.uri.endsWith('.proto')) {
      return;
    }

    if (vscode.workspace.workspaceFolders === undefined) {
      vscode.window.showErrorMessage('workspace folders was undefined');
      return;
    }
    if (vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('workspace folders was not set');
      return;
    }
    const uri = vscode.workspace.workspaceFolders[0].uri;

    const binaryPath = vscode.workspace.getConfiguration('buf')!.get<string>('binaryPath');
    if (binaryPath === undefined) {
      vscode.window.showErrorMessage('buf binary path was not set');
      return;
    }

    const lines = lint(binaryPath, document.uri.replace('file://', ''), uri.replace('file://', ''));
    if (isError(lines)) {
      if (lines.errorMessage.includes('ENOENT')) {
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
    const diagnostics = warnings.map((error: Warning): vscode.Diagnostic => {
      // VSC lines and columns are 0 indexed, so we need to subtract
      const range = vscode.Range.create(
        error.start_line - 1,
        error.start_column - 1,
        error.end_line - 1,
        error.end_column - 1
      );
      return vscode.Diagnostic.create(range, `${error.message} (${error.type})`, vscode.DiagnosticSeverity.Warning);
    });
    diagnosticCollection.set(document.uri, diagnostics);
  };

  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doLint));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doLint));
  context.subscriptions.push(
    vscode.commands.registerCommand('buf.lint', async () => {
      const currentDoc = await vscode.workspace.document;
      const doc = vscode.workspace.textDocuments.find((doc) => doc.uri.toString() === currentDoc.uri.toString());
      if (doc == undefined) {
        return
      }
      doLint(doc);
    })
    // vscode.commands.registerCommand(
    //   "buf.lint",
    //   (textEditor: vscode.TextEditor) => {
    //     doLint(textEditor.document);
    //   }
    // )
  );
}

// Nothing to do for now
export function deactivate() { }
