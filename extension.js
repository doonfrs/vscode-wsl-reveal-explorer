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
		
		const winPath = wslPathToWindows(dirPath);
		console.log('Windows path:', winPath);

		try {
			// Use PowerShell to open explorer - this is the method that works reliably
			const escapedPath = winPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
			const command = `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -Command "explorer.exe '\\"${escapedPath}\\"'"`;
			console.log('Executing PowerShell command:', command);
			
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

function wslPathToWindows(wslPath) {
	// Check for user-configured default distribution name first
	const config = vscode.workspace.getConfiguration('wsl-reveal-explorer');
	const configuredDistro = config.get('defaultDistributionName');
	
	let distro = 'Ubuntu'; // fallback default
	
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

	// Remove leading slash
	const pathWithoutSlash = wslPath.startsWith('/') ? wslPath.slice(1) : wslPath;

	// Convert forward slashes to backslashes
	const winPath = pathWithoutSlash.replace(/\//g, '\\');

	// Compose UNC path
	return `\\\\wsl$\\${distro}\\${winPath}`;
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
} 