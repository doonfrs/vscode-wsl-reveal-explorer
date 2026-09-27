const vscode = require('vscode');
const path = require('path');
const { spawn } = require('child_process');
const { NO_PATH_MAPPING, remoteToWindowsPath, buildLaunchCommand, runWslpath } = require('./paths');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('WSL Reveal Explorer extension is now active!');
	console.log('Extension context:', context.extensionPath);

	let disposable = vscode.commands.registerCommand('wsl-reveal-explorer.revealInExplorer', function (uri) {
		console.log('Reveal in Explorer command executed with URI:', uri);

		if (!uri) {
			vscode.window.showErrorMessage('No file selected');
			return;
		}

		// The extension runs in the local VS Code, so Explorer opens on this machine
		if (process.platform !== 'win32') {
			vscode.window.showErrorMessage('Reveal in File Explorer needs VS Code running on Windows.');
			return;
		}

		const folder = uri.with({ path: path.posix.dirname(uri.path) });
		console.log('Directory path:', folder.path);

		const config = vscode.workspace.getConfiguration('wsl-reveal-explorer');

		let winPath;
		try {
			winPath = remoteToWindowsPath(
				{ scheme: folder.scheme, authority: folder.authority, path: folder.path, fsPath: folder.fsPath },
				{
					defaultDistributionName: config.get('defaultDistributionName'),
					pathPrefix: config.get('pathPrefix'),
					pathMappings: config.get('pathMappings'),
				},
				runWslpath
			);
		} catch (error) {
			showPathError(error);
			return;
		}
		console.log('Windows path:', winPath);

		openFolder(winPath, config.get('customCommand'));
	});

	let testDisposable = vscode.commands.registerCommand('wsl-reveal-explorer.test', function () {
		console.log('Test command executed');
		vscode.window.showInformationMessage('Extension is working!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(testDisposable);
	console.log('Commands registered successfully');
}

function openFolder(winPath, customCommand) {
	const launch = buildLaunchCommand(winPath, customCommand);
	console.log('Executing command:', launch.file, launch.args);

	// explorer.exe exits with code 1 even on success, so only spawn failures count as errors
	const child = spawn(launch.file, launch.args, launch.options);
	child.on('spawn', () => {
		vscode.window.showInformationMessage(`Opened folder: ${winPath}`);
	});
	child.on('error', (error) => {
		console.error('Error opening explorer:', error);
		vscode.window.showErrorMessage(`Failed to open folder: ${winPath}. Error: ${error.message}`);
	});
	child.unref();
}

function showPathError(error) {
	console.error('Error resolving path:', error);

	if (error.code !== NO_PATH_MAPPING) {
		vscode.window.showErrorMessage(`Failed to resolve folder path. Error: ${error.message}`);
		return;
	}

	vscode.window.showErrorMessage(error.message, 'Open Settings').then((choice) => {
		if (choice === 'Open Settings') {
			vscode.commands.executeCommand('workbench.action.openSettings', 'wsl-reveal-explorer.pathMappings');
		}
	});
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}
