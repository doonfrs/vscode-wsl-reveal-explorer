const { describe, test } = require('node:test');
const assert = require('node:assert');
const {
	NO_PATH_MAPPING,
	parseRemoteAuthority,
	wslToWindowsPath,
	mapRemotePath,
	remoteToWindowsPath,
	buildLaunchCommand,
} = require('../paths');

// Stand-in for `wsl.exe wslpath -w`: records calls and returns what the real tool would
function fakeWslpath(result = (distro, p) => `\\\\wsl.localhost\\${distro}${p.replace(/\//g, '\\')}`) {
	const calls = [];
	const run = (distro, p) => {
		calls.push([distro, p]);
		return typeof result === 'function' ? result(distro, p) : result;
	};
	run.calls = calls;
	return run;
}

function failingWslpath() {
	return () => {
		throw new Error('wsl.exe not found');
	};
}

function wsl(path, config, runWslpath) {
	return remoteToWindowsPath({ scheme: 'vscode-remote', authority: 'wsl+Ubuntu2', path }, config, runWslpath);
}

function ssh(path, config) {
	return remoteToWindowsPath({ scheme: 'vscode-remote', authority: 'ssh-remote+buildbox', path }, config);
}

describe('parseRemoteAuthority', () => {
	test('WSL distro name', () => {
		assert.deepStrictEqual(parseRemoteAuthority('wsl+Ubuntu2'), { kind: 'wsl', name: 'Ubuntu2' });
	});

	test('URL-encoded WSL distro name', () => {
		assert.deepStrictEqual(parseRemoteAuthority('wsl+Ubuntu%2022.04'), { kind: 'wsl', name: 'Ubuntu 22.04' });
	});

	test('malformed encoding is kept as-is', () => {
		assert.deepStrictEqual(parseRemoteAuthority('wsl+Bad%E0'), { kind: 'wsl', name: 'Bad%E0' });
	});

	test('Remote SSH host', () => {
		assert.deepStrictEqual(parseRemoteAuthority('ssh-remote+buildbox'), { kind: 'ssh', name: 'buildbox' });
	});

	test('other remotes and local windows', () => {
		assert.deepStrictEqual(parseRemoteAuthority('dev-container+abc'), { kind: 'other', name: 'abc' });
		assert.deepStrictEqual(parseRemoteAuthority(''), { kind: 'local', name: '' });
		assert.deepStrictEqual(parseRemoteAuthority(undefined), { kind: 'local', name: '' });
	});
});

describe('WSL paths', () => {
	test('home folder goes through wslpath with the distro from the authority', () => {
		const run = fakeWslpath();
		assert.strictEqual(wsl('/home/me/project', {}, run), '\\\\wsl.localhost\\Ubuntu2\\home\\me\\project');
		assert.deepStrictEqual(run.calls, [['Ubuntu2', '/home/me/project']]);
	});

	test('wslpath output is used verbatim (custom automount root)', () => {
		const run = fakeWslpath('C:\\Users\\me');
		assert.strictEqual(wsl('/c/Users/me', {}, run), 'C:\\Users\\me');
	});

	test('/mnt/<drive> opens the Windows drive without calling wslpath', () => {
		const run = fakeWslpath();
		assert.strictEqual(wsl('/mnt/c/Users/me/Workspace/docs/plans', {}, run), 'C:\\Users\\me\\Workspace\\docs\\plans');
		assert.strictEqual(wsl('/mnt/d', {}, run), 'D:\\');
		assert.strictEqual(wsl('/mnt/D/Data', {}, run), 'D:\\Data');
		assert.deepStrictEqual(run.calls, []);
	});

	test('paths with spaces are left intact', () => {
		assert.strictEqual(wsl('/mnt/c/Program Files/My App', {}, fakeWslpath()), 'C:\\Program Files\\My App');
		assert.strictEqual(
			wsl('/home/me/my project', {}, failingWslpath()),
			'\\\\wsl$\\Ubuntu2\\home\\me\\my project'
		);
	});

	test('/mnt without a single drive letter is a normal Linux path', () => {
		assert.strictEqual(wsl('/mnt/data/x', {}, failingWslpath()), '\\\\wsl$\\Ubuntu2\\mnt\\data\\x');
		assert.strictEqual(wsl('/mnt', {}, failingWslpath()), '\\\\wsl$\\Ubuntu2\\mnt');
	});

	test('configured distro overrides detection and skips wslpath', () => {
		const run = fakeWslpath();
		assert.strictEqual(
			wsl('/home/me', { defaultDistributionName: '  Ubuntu-22.04 ' }, run),
			'\\\\wsl$\\Ubuntu-22.04\\home\\me'
		);
		assert.deepStrictEqual(run.calls, []);
	});

	test('configured distro does not affect /mnt drives', () => {
		assert.strictEqual(wsl('/mnt/c/x', { defaultDistributionName: 'Debian' }, fakeWslpath()), 'C:\\x');
	});

	test('falls back to \\\\wsl$ when wslpath throws or returns nothing', () => {
		assert.strictEqual(wsl('/home/me', {}, failingWslpath()), '\\\\wsl$\\Ubuntu2\\home\\me');
		assert.strictEqual(wsl('/home/me', {}, fakeWslpath('')), '\\\\wsl$\\Ubuntu2\\home\\me');
		assert.strictEqual(wsl('/home/me', {}), '\\\\wsl$\\Ubuntu2\\home\\me');
	});

	test('root folder', () => {
		assert.strictEqual(wsl('/', {}, failingWslpath()), '\\\\wsl$\\Ubuntu2');
	});

	test('legacy custom pathPrefix keeps the old layout', () => {
		const run = fakeWslpath();
		assert.strictEqual(
			wsl('/home/me', { pathPrefix: '\\\\wsl.localhost', defaultDistributionName: 'Ubuntu2' }, run),
			'\\\\wsl.localhost\\Ubuntu2\\home\\me'
		);
		assert.strictEqual(wsl('/home/me', { pathPrefix: '\\\\server\\share\\' }, run), '\\\\server\\share\\home\\me');
		assert.deepStrictEqual(run.calls, []);
	});

	test('pathPrefix equal to the default (even with a trailing slash) is not "custom"', () => {
		assert.strictEqual(wsl('/mnt/c/x', { pathPrefix: '\\\\wsl$\\' }, fakeWslpath()), 'C:\\x');
	});

	test('wslToWindowsPath defaults to Ubuntu when no distro is known', () => {
		assert.strictEqual(wslToWindowsPath('/home/me'), '\\\\wsl$\\Ubuntu\\home\\me');
	});

	test('pathMappings are ignored in WSL windows', () => {
		assert.strictEqual(
			wsl('/home/me', { pathMappings: { '/home': '\\\\server\\home' } }, failingWslpath()),
			'\\\\wsl$\\Ubuntu2\\home\\me'
		);
	});
});

describe('mapRemotePath', () => {
	// The exact setup from issue #4
	const issueMappings = {
		'D:\\': '\\\\host\\proj1',
		'E:\\': '\\\\host\\proj2',
	};

	test('issue #4: Windows remote drives map to different shares', () => {
		assert.strictEqual(mapRemotePath('/d:/src/app', issueMappings), '\\\\host\\proj1\\src\\app');
		assert.strictEqual(mapRemotePath('/e:/data/2024', issueMappings), '\\\\host\\proj2\\data\\2024');
	});

	test('issue #4: drive root itself', () => {
		assert.strictEqual(mapRemotePath('/d:/', issueMappings), '\\\\host\\proj1');
		assert.strictEqual(mapRemotePath('/d:', issueMappings), '\\\\host\\proj1');
	});

	test('drive letters and Windows paths match case-insensitively', () => {
		assert.strictEqual(mapRemotePath('/D:/Src', issueMappings), '\\\\host\\proj1\\Src');
		assert.strictEqual(
			mapRemotePath('/c:/users/me/code', { 'C:\\Users\\Me': '\\\\pc\\me' }),
			'\\\\pc\\me\\code'
		);
	});

	test('keys may use forward slashes or omit the trailing slash', () => {
		assert.strictEqual(mapRemotePath('/d:/src', { 'd:/': '\\\\host\\proj1' }), '\\\\host\\proj1\\src');
		assert.strictEqual(mapRemotePath('/d:/src', { 'D:': '\\\\host\\proj1' }), '\\\\host\\proj1\\src');
	});

	test('backslash input (fsPath style) is accepted', () => {
		assert.strictEqual(mapRemotePath('d:\\src\\app', issueMappings), '\\\\host\\proj1\\src\\app');
	});

	test('no matching drive returns null', () => {
		assert.strictEqual(mapRemotePath('/f:/x', issueMappings), null);
	});

	test('Linux remote folder', () => {
		assert.strictEqual(
			mapRemotePath('/home/me/projects/site/src', { '/home/me/projects': '\\\\server\\projects' }),
			'\\\\server\\projects\\site\\src'
		);
	});

	test('Linux paths are case-sensitive', () => {
		assert.strictEqual(mapRemotePath('/Home/me', { '/home/me': '\\\\server\\me' }), null);
	});

	test('exact match returns the mapped path itself', () => {
		assert.strictEqual(mapRemotePath('/home/me/projects', { '/home/me/projects/': '\\\\server\\projects\\' }), '\\\\server\\projects');
	});

	test('matches whole segments only', () => {
		assert.strictEqual(mapRemotePath('/home/me/project', { '/home/me/proj': '\\\\server\\proj' }), null);
		assert.strictEqual(mapRemotePath('/d:/srcx', { 'D:\\src': '\\\\host\\src' }), null);
	});

	test('longest key wins regardless of order', () => {
		const mappings = {
			'/home/me/projects/big': '\\\\fast\\big',
			'/': '\\\\server\\root',
			'/home/me': '\\\\server\\me',
		};
		assert.strictEqual(mapRemotePath('/home/me/projects/big/src', mappings), '\\\\fast\\big\\src');
		assert.strictEqual(mapRemotePath('/home/me/notes', mappings), '\\\\server\\me\\notes');
		assert.strictEqual(mapRemotePath('/var/log', mappings), '\\\\server\\root\\var\\log');
	});

	test('"/" catches Linux paths but not Windows drives', () => {
		assert.strictEqual(mapRemotePath('/opt/app', { '/': '\\\\server\\root' }), '\\\\server\\root\\opt\\app');
		assert.strictEqual(mapRemotePath('/d:/app', { '/': '\\\\server\\root' }), null);
	});

	test('mapped values may use forward slashes, spaces or a trailing slash', () => {
		assert.strictEqual(mapRemotePath('/srv/app', { '/srv': '//nas/share/' }), '\\\\nas\\share\\app');
		assert.strictEqual(mapRemotePath('/srv/my app', { '/srv': '\\\\nas\\My Share' }), '\\\\nas\\My Share\\my app');
	});

	test('mapping to a local drive root keeps the root slash', () => {
		assert.strictEqual(mapRemotePath('/d:/', { 'D:\\': 'Z:\\' }), 'Z:\\');
		assert.strictEqual(mapRemotePath('/d:/x', { 'D:\\': 'Z:\\' }), 'Z:\\x');
	});

	test('blank and non-string entries are ignored', () => {
		const mappings = { '': '\\\\bad\\empty', '/srv': '  ', '/opt': 42, '/home': '\\\\server\\home' };
		assert.strictEqual(mapRemotePath('/srv/x', mappings), null);
		assert.strictEqual(mapRemotePath('/opt/x', mappings), null);
		assert.strictEqual(mapRemotePath('/home/x', mappings), '\\\\server\\home\\x');
	});

	test('missing or invalid settings return null', () => {
		assert.strictEqual(mapRemotePath('/home/x', undefined), null);
		assert.strictEqual(mapRemotePath('/home/x', {}), null);
		assert.strictEqual(mapRemotePath('/home/x', 'nope'), null);
	});
});

describe('Remote SSH windows', () => {
	test('issue #4 end to end', () => {
		const config = { pathMappings: { 'D:\\': '\\\\host\\proj1', 'E:\\': '\\\\host\\proj2' } };
		assert.strictEqual(ssh('/d:/src/app', config), '\\\\host\\proj1\\src\\app');
		assert.strictEqual(ssh('/e:/', config), '\\\\host\\proj2');
	});

	test('a mapping wins over the legacy pathPrefix', () => {
		const config = { pathPrefix: '\\\\server\\share', pathMappings: { '/home/me': '\\\\nas\\me' } };
		assert.strictEqual(ssh('/home/me/code', config), '\\\\nas\\me\\code');
	});

	test('legacy pathPrefix is the fallback when nothing matches', () => {
		const config = { pathPrefix: '\\\\server\\share', pathMappings: { '/home/me': '\\\\nas\\me' } };
		assert.strictEqual(ssh('/var/www', config), '\\\\server\\share\\var\\www');
		assert.strictEqual(
			ssh('/var/www', { pathPrefix: '\\\\server\\share', defaultDistributionName: 'box' }),
			'\\\\server\\share\\box\\var\\www'
		);
	});

	test('no mapping and no custom prefix is a clear error', () => {
		assert.throws(
			() => ssh('/d:/src', { pathMappings: { 'E:\\': '\\\\host\\proj2' } }),
			(error) => error.code === NO_PATH_MAPPING && error.message.includes('"d:/src"') && error.message.includes('pathMappings')
		);
		assert.throws(() => ssh('/', {}), (error) => error.code === NO_PATH_MAPPING && error.message.includes('"/"'));
	});

	test('other remote types use the same mappings', () => {
		const target = { scheme: 'vscode-remote', authority: 'dev-container+abc', path: '/workspaces/app' };
		assert.strictEqual(
			remoteToWindowsPath(target, { pathMappings: { '/workspaces': 'C:\\code' } }),
			'C:\\code\\app'
		);
	});
});

describe('local windows', () => {
	test('file URIs open their fsPath directly', () => {
		const target = { scheme: 'file', authority: '', path: '/c:/Users/me', fsPath: 'c:\\Users\\me' };
		assert.strictEqual(remoteToWindowsPath(target, { pathMappings: { 'C:\\': '\\\\x\\y' } }), 'c:\\Users\\me');
	});
});

describe('buildLaunchCommand', () => {
	test('opens Explorer directly with the path as one argument', () => {
		assert.deepStrictEqual(buildLaunchCommand('\\\\host\\proj1\\my app'), {
			file: 'explorer.exe',
			args: ['\\\\host\\proj1\\my app'],
			options: { stdio: 'ignore' },
		});
		assert.strictEqual(buildLaunchCommand('C:\\x', '   ').file, 'explorer.exe');
	});

	test('custom command runs through hidden PowerShell with {path} substituted', () => {
		assert.deepStrictEqual(buildLaunchCommand('C:\\x', 'C:\\totalcmd\\TOTALCMD64.EXE /O /T {path}'), {
			file: 'powershell.exe',
			args: ['-NoProfile', '-Command', 'C:\\totalcmd\\TOTALCMD64.EXE /O /T C:\\x'],
			options: { stdio: 'ignore', windowsHide: true },
		});
	});

	test('every {path} placeholder is replaced', () => {
		assert.strictEqual(buildLaunchCommand('C:\\x', 'app {path} --also {path}').args[2], 'app C:\\x --also C:\\x');
	});
});
