# WSL Reveal in File Explorer

![Demo](https://raw.githubusercontent.com/doonfrs/vscode-wsl-reveal-explorer/0fd24c7d76010f63be84ad18cdd9d532e3185ef0/assets/gif/intro.gif)

A VS Code extension that seamlessly opens Windows File Explorer from WSL and Remote SSH connections, allowing you to reveal files and folders in the native Windows file manager with a simple right-click.

## ☕ Support

If this extension helps you, consider supporting the development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-☕-orange.svg?style=flat-square)](https://buymeacoffee.com/doonfrs)

**Your support helps maintain and improve this extension!**


## 🚀 Features

- **Zero Configuration Required** - Works out of the box with any WSL distribution
- **Remote SSH Support** - Map remote folders (Linux or Windows hosts) to the network shares you see on Windows
- **Custom File Explorer Support** - Use your preferred file manager or stick with default Windows Explorer
- **Context Menu Integration** - Right-click any file or folder to reveal it in Windows Explorer or your custom choice
- **Automatic WSL Detection** - Dynamically detects your WSL distribution name
- **Custom Distribution Support** - Override auto-detection with your own distribution name
- **Multiple Path Mappings** - Each remote folder or drive can map to its own share
- **Reliable Path Translation** - Converts remote paths to Windows-compatible UNC paths
- **Cross-Distribution Support** - Works with Ubuntu, Debian, Alpine, and other WSL distributions

## 📋 Prerequisites

- VS Code on Windows, connected to WSL / WSL2 or to a Remote SSH host
- The extension installs into your local (Windows) VS Code, so Explorer opens on your own desktop
- For Remote SSH: the remote folders shared as network paths you can open from Windows


## 🌟 Show Your Support

If you find this extension useful:
- ⭐ **Star this repository** on GitHub
- 📝 **Leave a review** on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=doonfrs.wsl-reveal-explorer)
- ☕ **Buy me a coffee** to support development: [buymeacoffee.com/doonfrs](https://buymeacoffee.com/doonfrs)

Every star, review, and coffee means a lot and helps keep this project alive! 🚀


## 🎯 Usage

1. **Open VS Code in WSL** - Make sure you're running VS Code in WSL mode
2. **Right-click any file or folder** in the VS Code explorer panel
3. **Select "Reveal in File Explorer"** from the context menu
4. **Windows File Explorer opens** showing the selected file/folder location

That's it! No configuration needed by default.

## 🔧 How It Works

The extension runs in your local VS Code on Windows and works out the Windows path from the remote folder:
- **WSL**: reads the distribution name from the VS Code window and converts Linux paths with `wslpath` to Windows UNC format (`\\wsl.localhost\Distribution\path`), falling back to `\\wsl$\Distribution\path` if needed (or uses your custom configuration)
- **WSL**: opens Windows drive paths directly: `/mnt/c/Users/me/project` opens as `C:\Users\me\project`
- **Remote SSH**: swaps the remote folder for the Windows path you configured in `pathMappings`
- Opens the folder with `explorer.exe`, or with your custom command

## ⚙️ Configuration

### Custom WSL Distribution Name

The distribution name is detected automatically, so this is rarely needed. If you still want to force a specific name, you can override it:

1. **Via Settings UI**:
   - Open VS Code Settings (`Ctrl+,`)
   - Search for "WSL Reveal Explorer"
   - Set "Default Distribution Name" to your distribution name

2. **Via settings.json**:

   ```json
   {
     "wsl-reveal-explorer.defaultDistributionName": "Ubuntu2"
   }
   ```

**Common examples**:

- `Ubuntu2` - for secondary Ubuntu installations
- `Ubuntu-22.04` - for version-specific Ubuntu distributions
- `Debian` - for Debian distributions
- `kali-linux` - for Kali Linux distributions

**Note**: Leave this setting empty (default) to use automatic detection. This setting does not affect Windows drive paths (`/mnt/c/...`), which always open as `C:\...`.

### Path Mappings for Remote SSH

Explorer can only open a remote folder through a path Windows can reach, such as an SMB share or a mapped drive. Tell the extension which Windows path each remote folder is shared as:

```json
{
  "wsl-reveal-explorer.pathMappings": {
    "D:\\": "\\\\host\\proj1",
    "E:\\": "\\\\host\\proj2",
    "/home/me/projects": "\\\\server\\projects"
  }
}
```

With these settings:

| Remote folder | Opens in Explorer |
| --- | --- |
| `D:\src\app` (Windows host) | `\\host\proj1\src\app` |
| `E:\data` (Windows host) | `\\host\proj2\data` |
| `/home/me/projects/site` (Linux host) | `\\server\projects\site` |

**Rules**:

- Keys are remote paths, values are Windows paths. Forward slashes and trailing slashes are fine in both.
- The longest matching key wins, so you can map a whole disk and override one folder inside it.
- Keys match whole folder names only: `/home/me/proj` does not match `/home/me/project`.
- Windows remote paths (`D:\...`) ignore case, Linux remote paths do not.
- If no key matches, the extension shows an error with a shortcut to this setting.

**Tip**: put mappings for one host in that project's `.vscode/settings.json` when different hosts need different mappings.

### Path Prefix (legacy)

`wsl-reveal-explorer.pathPrefix` is the older single-prefix setting. For Remote SSH it is only used when no `pathMappings` key matches, and it puts the whole remote path under one share:

```json
{
  "wsl-reveal-explorer.pathPrefix": "\\\\server\\share"
}
```

`/home/user/project` then opens as `\\server\share\home\user\project`. Prefer `pathMappings` for new setups. In WSL windows, leave it at the default `\\wsl$`.

### Custom File Explorer

Use your preferred file manager instead of the default Windows Explorer:

1. **Via Settings UI**:
   - Open VS Code Settings (`Ctrl+,`)
   - Search for "WSL Reveal Explorer"
   - Set "Custom Command" to your preferred command

2. **Via settings.json**:

   ```json
   {
     "wsl-reveal-explorer.customCommand": "explorer.exe {path}"
   }
   ```

**Available placeholders**:
- `{path}` - The folder path to open

**Examples**:
- **Total Commander**: `"C:\\totalcmd\\TOTALCMD64.EXE /O /T {path}"`
- **FreeCommander**: `"C:\\FreeCommander XE\\FreeCommander.exe /C /T {path}"`
- **Directory Opus**: `"C:\\Program Files\\GPSoftware\\Directory Opus\\dopus.exe {path}"`
- **Q-Dir**: `"C:\\Q-Dir\\Q-Dir.exe {path}"`

**Note**: Leave this setting empty (default) to use Windows Explorer.

## 🛠️ Development

To contribute or modify this extension:

```bash
# Clone the repository
git clone <repository-url>
cd vscode-wsl-reveal-explorer

# Open in VS Code
code .

# Press F5 to run in Extension Development Host
# Test the functionality by right-clicking files in the explorer
```

### Tests

The path conversion lives in `paths.js` and has no VS Code dependency, so it runs under plain Node:

```bash
npm test
```

`test/machine.test.js` additionally checks the generated paths against your real machine (real `wslpath`, real drives, every folder must exist). It runs only under Windows Node started from the WSL share:

```powershell
Set-Location \\wsl.localhost\<Distribution>\path\to\vscode-wsl-reveal-explorer
node --test "test/*.test.js"
# Also open one Explorer window the same way the extension does:
$env:REVEAL_OPEN = "1"; node --test "test/*.test.js"
```

## 🐛 Troubleshooting

If the extension doesn't work:
1. **Ensure you're running VS Code on Windows, in WSL mode or Remote SSH**
2. **Check that the extension is installed locally**: in the Extensions view it should be listed under "Local", not under the WSL or SSH section. Reload the window after updating.
3. **Check that Windows File Explorer can access your configured paths manually**
   - For WSL: `\\wsl$\<distribution>`
   - For Remote SSH: the Windows path in your `pathMappings`

### Distribution Detection Issues

If the extension opens the wrong folder or fails to work:

1. **Check your actual WSL distribution name**:

   ```bash
   # In WSL terminal, run:
   wsl.exe -l -v
   ```

2. **Set the correct distribution name manually**:
   - Use the exact name from the command above
   - Go to VS Code Settings and search for "WSL Reveal Explorer"
   - Set "Default Distribution Name" to the correct name (e.g., `Ubuntu-22.04`, `Ubuntu2`)

3. **If you set this setting earlier as a workaround**, try clearing it first: detection now uses `wslpath` and `$WSL_DISTRO_NAME`, which report the real distribution name (e.g. `Ubuntu2`, not `Ubuntu`)

### Remote SSH Issues

For Remote SSH connections:

1. **"No path mapping matches ..."**: add the remote folder (or one of its parents) to `pathMappings`. The error shows the exact remote path to use.
2. **Explorer opens but shows an error**: paste the mapped Windows path into Explorer's address bar. If that fails too, the share itself is not reachable from Windows.
3. **Path mapping examples**:

   ```text
   Remote path: D:\src\app              (Windows host)
   Windows path: \\host\proj1\src\app
   Configuration: "pathMappings": { "D:\\": "\\\\host\\proj1" }

   Remote path: /home/user/project      (Linux host)
   Windows path: \\server\share\project
   Configuration: "pathMappings": { "/home/user": "\\\\server\\share" }
   ```

### File Explorer Issues

If your custom file explorer doesn't open:

1. **Verify the file explorer is installed** and accessible from the configured path
2. **Check the custom command syntax** - ensure it's a valid PowerShell command
3. **Test manually**: Try running the command directly in PowerShell to debug issues
4. **Use default**: Set the custom command to empty to fall back to Windows Explorer

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Feras Abdalrahman**
- GitHub: [@doonfrs](https://github.com/doonfrs)
- VS Code Marketplace: [doonfrs](https://marketplace.visualstudio.com/publishers/doonfrs)

