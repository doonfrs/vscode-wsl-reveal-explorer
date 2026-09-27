// Checks the generated paths against the real machine: real `wsl.exe wslpath`, real drives, and
// that every resolved folder exists. Runs only under Windows Node started from a WSL share, e.g.
//   powershell.exe -Command "Set-Location '\\wsl.localhost\Ubuntu2\home\me\vscode-wsl-reveal-explorer'; node --test 'test/*.test.js'"
// Set REVEAL_OPEN=1 to also open one Explorer window the same way the extension does.
const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { remoteToWindowsPath, buildLaunchCommand, runWslpath } = require('../paths');

const projectRoot = path.resolve(__dirname, '..');
const share = process.platform === 'win32' && projectRoot.match(/^\\\\(wsl\.localhost|wsl\$)\\([^\\]+)(\\.*)$/i);
const skip = share ? false : 'needs Windows Node running from a \\\\wsl.localhost or \\\\wsl$ path';

const distro = share && share[2];
const linuxRoot = share && share[3].replace(/\\/g, '/');
const packageJson = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');

function wsl(linuxPath, config = {}, run = runWslpath) {
	return remoteToWindowsPath({ scheme: 'vscode-remote', authority: `wsl+${distro}`, path: linuxPath }, config, run);
}

function ssh(remotePath, pathMappings) {
	return remoteToWindowsPath({ scheme: 'vscode-remote', authority: 'ssh-remote+buildbox', path: remotePath }, { pathMappings });
}

// The resolved folder must be this very checkout, not just any existing folder
function assertIsProjectRoot(winPath) {
	assert.ok(fs.existsSync(winPath), `${winPath} does not exist`);
	assert.strictEqual(fs.readFileSync(path.join(winPath, 'package.json'), 'utf8'), packageJson, `${winPath} is not this project`);
}

function assertFolder(winPath, expected) {
	assert.strictEqual(winPath, expected);
	assert.ok(fs.statSync(winPath).isDirectory(), `${winPath} is not a folder`);
}

describe('on this machine', { skip }, () => {
	test('WSL folder resolves through real wslpath', () => {
		const winPath = wsl(linuxRoot);
		assert.strictEqual(winPath.toLowerCase(), `\\\\wsl.localhost\\${distro}${share[3]}`.toLowerCase());
		assertIsProjectRoot(winPath);
	});

	test('WSL folder resolves through the \\\\wsl$ fallback when wslpath fails', () => {
		const winPath = wsl(linuxRoot, {}, () => {
			throw new Error('simulated failure');
		});
		assert.strictEqual(winPath, `\\\\wsl$\\${distro}${share[3]}`);
		assertIsProjectRoot(winPath);
	});

	test('configured distro name resolves', () => {
		const winPath = wsl(linuxRoot, { defaultDistributionName: distro });
		assert.strictEqual(winPath, `\\\\wsl$\\${distro}${share[3]}`);
		assertIsProjectRoot(winPath);
	});

	test('/mnt/c folders open on the C: drive', () => {
		assertFolder(wsl('/mnt/c/Users'), 'C:\\Users');
		assertFolder(wsl('/mnt/c/Program Files'), 'C:\\Program Files');
		assertFolder(wsl('/mnt/c'), 'C:\\');
	});

	test('real wslpath agrees with the /mnt shortcut', () => {
		assert.strictEqual(runWslpath(distro, '/mnt/c/Users'), 'C:\\Users');
	});

	test('Remote SSH Linux-style mapping resolves to a real share', () => {
		const projectsShare = path.dirname(projectRoot);
		const winPath = ssh(`/srv/code/${path.basename(projectRoot)}`, { '/srv/code': projectsShare });
		assertIsProjectRoot(winPath);
	});

	test('Remote SSH issue #4 style drive mappings resolve to real folders', () => {
		const mappings = { 'D:\\': 'C:\\Users', 'E:\\': 'C:\\Windows' };
		assertFolder(ssh('/d:/Public', mappings), 'C:\\Users\\Public');
		assertFolder(ssh('/e:/System32', mappings), 'C:\\Windows\\System32');
		assertFolder(ssh('/d:/', mappings), 'C:\\Users');
	});

	test('opens Explorer on the project folder', { skip: process.env.REVEAL_OPEN !== '1' && 'set REVEAL_OPEN=1 to open a window' }, async () => {
		const launch = buildLaunchCommand(wsl(linuxRoot));
		const child = spawn(launch.file, launch.args, launch.options);
		await new Promise((resolve, reject) => {
			child.on('spawn', resolve);
			child.on('error', reject);
		});
		child.unref();
	});
});
