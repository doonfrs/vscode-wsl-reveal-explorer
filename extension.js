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
		// Original WSL logic
		if (configuredDistro && configuredDistro.trim()) {
			// Use the user-configured distribution name
			distro = configuredDistro.trim();
			console.log('Using configured distro name:', distro);
		} else {
			// Detect WSL distro name dynamically only if no configuration is set
			const { execSync } = require('child_process');
			
			try {
				// Try to get the actual distro name
				const result = execSync('cat /etc/os-release | grep "^NAME=" | cut -d= -f2 | tr -d \'"\'', { encoding: 'utf8' });
				if (result.trim()) {
					distro = result.trim();
				}
			} catch (error) {
				console.log('Could not detect distro name, using default:', distro);
			}
			
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