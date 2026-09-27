const vscode = require('vscode');

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

		const filePath = uri.fsPath;
		console.log('File path:', filePath);

		const { execSync } = require('child_process');
		const path = require('path');

		const dirPath = path.dirname(filePath);
		console.log('Directory path:', dirPath);
		
		const winPath = convertToWindowsPath(dirPath);
		console.log('Windows path:', winPath);

		try {
			const command = buildExplorerCommand(winPath);
			console.log('Executing command:', command);
			
			execSync(command);
			vscode.window.showInformationMessage(`Opened folder: ${winPath}`);
		} catch (error) {
			console.error('Error opening explorer:', error);
			vscode.window.showErrorMessage(`Failed to open folder: ${winPath}. Error: ${error.message}`);
		}
	});

	let testDisposable = vscode.commands.registerCommand('wsl-reveal-explorer.test', function () {
		console.log('Test command executed');
		vscode.window.showInformationMessage('Extension is working!');
	});

	context.subscriptions.push(disposable);
	context.subscriptions.push(testDisposable);
	console.log('Commands registered successfully');
}

function convertToWindowsPath(remotePath) {
	// Get configuration settings
	const config = vscode.workspace.getConfiguration('wsl-reveal-explorer');
	const configuredDistro = config.get('defaultDistributionName');
	const pathPrefix = config.get('pathPrefix') || '\\\\wsl$';

	let distro = 'Ubuntu'; // fallback default

	// Check if we're using a custom path prefix (not WSL)
	if (pathPrefix !== '\\\\wsl$') {
		// For custom path prefixes (like Remote SSH), use the configured distro or empty
		if (configuredDistro && configuredDistro.trim()) {
			distro = configuredDistro.trim();
		} else {
			distro = ''; // No distro name needed for custom paths
		}
		console.log('Using custom path prefix:', pathPrefix, 'with distro:', distro);
	} else {
		// Windows drive mounted in WSL: /mnt/c/foo -> C:\foo
		const driveMatch = remotePath.match(/^\/mnt\/([a-zA-Z])(\/.*)?$/);
		if (driveMatch) {
			const drivePath = `${driveMatch[1].toUpperCase()}:\\${(driveMatch[2] || '').slice(1).replace(/\//g, '\\')}`;
			console.log('Using Windows drive path:', drivePath);
			return drivePath;
		}

		if (configuredDistro && configuredDistro.trim()) {
			// Use the user-configured distribution name
			distro = configuredDistro.trim();
			console.log('Using configured distro name:', distro);
		} else {
			// Let WSL convert the path itself (handles distro name and custom mount roots)
			const { execFileSync } = require('child_process');

			try {
				const result = execFileSync('wslpath', ['-w', remotePath], { encoding: 'utf8' }).trim();
				if (result) {
					console.log('Using wslpath result:', result);
					return result;
				}
			} catch (error) {
				console.log('wslpath failed, falling back to manual conversion:', error.message);
			}

			distro = detectDistroName() || distro;
			console.log('Using auto-detected distro name:', distro);
		}
	}

	// Remove leading slash
	const pathWithoutSlash = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath;

	// Convert forward slashes to backslashes
	const winPath = pathWithoutSlash.replace(/\//g, '\\');

	// Compose UNC path
	if (distro) {
		return `${pathPrefix}\\${distro}\\${winPath}`;
	} else {
		// For custom paths without distro name
		return `${pathPrefix}\\${winPath}`;
	}
}

function detectDistroName() {
	// Set by WSL for every process started through wsl.exe
	if (process.env.WSL_DISTRO_NAME) {
		return process.env.WSL_DISTRO_NAME;
	}

	// VS Code WSL remote authority looks like "wsl+Ubuntu2"
	const authority = vscode.env.remoteAuthority;
	if (authority && authority.startsWith('wsl+')) {
		return decodeURIComponent(authority.slice(4));
	}

	return '';
}

function buildExplorerCommand(windowsPath) {
	const config = vscode.workspace.getConfiguration('wsl-reveal-explorer');
	const customCommand = config.get('customCommand');
	
	if (customCommand && customCommand.trim()) {
		// Use custom command with {path} placeholder replacement
		const escapedPath = windowsPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		const command = customCommand.replace('{path}', escapedPath);
		return `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "${command}"`;
	} else {
		// Use default Windows Explorer - this is the method that works reliably
		const escapedPath = windowsPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
		const command = `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "explorer.exe \\"${escapedPath}\\""`;
		return command;
	}
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
} 