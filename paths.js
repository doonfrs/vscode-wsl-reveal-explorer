// Path conversion used by the extension. Kept free of the vscode API so it can be unit tested
// with plain Node, and free of the platform-specific path module so results are the same on
// Linux and Windows.
const { execFileSync } = require('child_process');

const DEFAULT_PREFIX = '\\\\wsl$';
const NO_PATH_MAPPING = 'NO_PATH_MAPPING';

/**
 * Split a VS Code remote authority such as "wsl+Ubuntu2" or "ssh-remote+myhost".
 * @param {string} authority
 */
function parseRemoteAuthority(authority) {
	if (!authority) {
		return { kind: 'local', name: '' };
	}

	const plus = authority.indexOf('+');
	const type = plus === -1 ? authority : authority.slice(0, plus);
	const name = plus === -1 ? '' : safeDecode(authority.slice(plus + 1));

	if (type === 'wsl') {
		return { kind: 'wsl', name };
	}
	if (type === 'ssh-remote') {
		return { kind: 'ssh', name };
	}
	return { kind: 'other', name };
}

/**
 * Convert a path inside a WSL distro to a path Windows Explorer can open.
 * @param {string} linuxPath
 * @param {{ distro?: string, configuredDistro?: string, pathPrefix?: string, runWslpath?: Function }} options
 */
function wslToWindowsPath(linuxPath, { distro, configuredDistro, pathPrefix, runWslpath } = {}) {
	const prefix = normalizePrefix(pathPrefix);
	const configured = (configuredDistro || '').trim();
	const relative = toBackslashes(linuxPath.replace(/^\/+/, ''));

	// Custom prefix: keep the legacy "prefix\[distro\]path" layout
	if (prefix !== DEFAULT_PREFIX) {
		return joinUnc(prefix, configured, relative);
	}

	// Windows drive mounted in WSL: /mnt/c/foo -> C:\foo
	const driveMatch = linuxPath.match(/^\/mnt\/([a-zA-Z])(\/.*)?$/);
	if (driveMatch) {
		return `${driveMatch[1].toUpperCase()}:\\${toBackslashes((driveMatch[2] || '').slice(1))}`;
	}

	if (configured) {
		return joinUnc(prefix, configured, relative);
	}

	// Let WSL convert the path itself (handles custom mount roots)
	if (runWslpath && distro) {
		try {
			const result = runWslpath(distro, linuxPath);
			if (result) {
				return result;
			}
		} catch (error) {
			console.log('wslpath failed, falling back to manual conversion:', error.message);
		}
	}

	return joinUnc(prefix, distro || 'Ubuntu', relative);
}

/**
 * Find the longest pathMappings entry that contains remotePath and swap its prefix.
 * Keys are remote paths ("D:\\", "/home/me/projects"), values are Windows paths ("\\\\host\\proj1").
 * Returns null when no entry matches.
 * @param {string} remotePath
 * @param {Record<string, string>} mappings
 */
function mapRemotePath(remotePath, mappings) {
	if (!mappings || typeof mappings !== 'object') {
		return null;
	}

	const target = normalizeRemotePath(remotePath);
	let best = null;

	for (const [from, to] of Object.entries(mappings)) {
		if (typeof from !== 'string' || !from.trim() || typeof to !== 'string' || !to.trim()) {
			continue;
		}

		const key = normalizeRemotePath(from.trim());

		// Windows paths compare case-insensitively, Linux paths do not
		const ignoreCase = isDrivePath(key);
		const a = ignoreCase ? target.toLowerCase() : target;
		const b = ignoreCase ? key.toLowerCase() : key;

		// Match whole path segments only: /home/me/proj must not match /home/me/project
		if (a !== b && !a.startsWith(b + '/')) {
			continue;
		}

		if (!best || key.length > best.key.length) {
			best = { key, to };
		}
	}

	if (!best) {
		return null;
	}

	const rest = target.slice(best.key.length).replace(/^\/+/, '');
	const base = toBackslashes(best.to.trim()).replace(/\\+$/, '');

	if (!rest) {
		// A bare drive letter means "current directory on that drive", so keep the root slash
		return isDrivePath(base) && base.length === 2 ? `${base}\\` : base;
	}
	return `${base}\\${toBackslashes(rest)}`;
}

/**
 * Resolve the Windows path for a folder URI.
 * @param {{ scheme: string, authority: string, path: string, fsPath?: string }} target
 * @param {{ defaultDistributionName?: string, pathPrefix?: string, pathMappings?: Record<string, string> }} config
 * @param {Function} [runWslpath]
 */
function remoteToWindowsPath(target, config = {}, runWslpath) {
	if (target.scheme === 'file') {
		return target.fsPath;
	}

	const remote = parseRemoteAuthority(target.authority);
	const pathPrefix = normalizePrefix(config.pathPrefix);
	const configuredDistro = (config.defaultDistributionName || '').trim();

	if (remote.kind === 'wsl') {
		return wslToWindowsPath(target.path, { distro: remote.name, configuredDistro, pathPrefix, runWslpath });
	}

	const mapped = mapRemotePath(target.path, config.pathMappings);
	if (mapped) {
		return mapped;
	}

	const remotePath = normalizeRemotePath(target.path);

	// Legacy single-prefix setting for Remote SSH
	if (pathPrefix !== DEFAULT_PREFIX) {
		return joinUnc(pathPrefix, configuredDistro, toBackslashes(remotePath.replace(/^\/+/, '')));
	}

	const error = new Error(`No path mapping matches "${remotePath || '/'}". Add one in the "wsl-reveal-explorer.pathMappings" setting.`);
	error.code = NO_PATH_MAPPING;
	throw error;
}

/**
 * Describe the process that opens winPath: Explorer by default, or the user's PowerShell command.
 * @param {string} winPath
 * @param {string} [customCommand]
 */
function buildLaunchCommand(winPath, customCommand) {
	const custom = (customCommand || '').trim();

	if (custom) {
		return {
			file: 'powershell.exe',
			args: ['-NoProfile', '-Command', custom.split('{path}').join(winPath)],
			options: { stdio: 'ignore', windowsHide: true },
		};
	}

	return {
		file: 'explorer.exe',
		args: [winPath],
		options: { stdio: 'ignore' },
	};
}

/**
 * Ask a WSL distro to translate one of its paths (e.g. "\\\\wsl.localhost\\Ubuntu2\\home\\me").
 * @param {string} distro
 * @param {string} linuxPath
 */
function runWslpath(distro, linuxPath) {
	return execFileSync('wsl.exe', ['-d', distro, '-e', 'wslpath', '-w', linuxPath], {
		encoding: 'utf8',
		timeout: 5000,
		windowsHide: true,
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim();
}

function normalizeRemotePath(p) {
	let result = p.replace(/\\/g, '/');

	// VS Code writes Windows remote paths as "/d:/src"
	if (/^\/[a-zA-Z]:/.test(result)) {
		result = result.slice(1);
	}
	return result.replace(/\/+$/, '');
}

function isDrivePath(p) {
	return /^[a-zA-Z]:/.test(p);
}

function toBackslashes(p) {
	return p.replace(/\//g, '\\');
}

function normalizePrefix(prefix) {
	return (prefix || '').trim().replace(/[\\/]+$/, '') || DEFAULT_PREFIX;
}

function joinUnc(prefix, ...parts) {
	return [prefix, ...parts.filter(Boolean)].join('\\');
}

function safeDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch (error) {
		return value;
	}
}

module.exports = {
	DEFAULT_PREFIX,
	NO_PATH_MAPPING,
	parseRemoteAuthority,
	wslToWindowsPath,
	mapRemotePath,
	remoteToWindowsPath,
	buildLaunchCommand,
	runWslpath,
};
