# WSL Reveal in File Explorer

![Demo](https://raw.githubusercontent.com/doonfrs/vscode-wsl-reveal-explorer/0fd24c7d76010f63be84ad18cdd9d532e3185ef0/assets/gif/intro.gif)

A VS Code extension that seamlessly opens Windows File Explorer from WSL, allowing you to reveal files and folders in the native Windows file manager with a simple right-click.

## ☕ Support

If this extension helps you, consider supporting the development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-☕-orange.svg?style=flat-square)](https://buymeacoffee.com/doonfrs)

**Your support helps maintain and improve this extension!**


## 🚀 Features

- **Zero Configuration Required** - Works out of the box with any WSL distribution
- **Context Menu Integration** - Right-click any file or folder to reveal it in Windows Explorer
- **Automatic WSL Detection** - Dynamically detects your WSL distribution name
- **Custom Distribution Support** - Override auto-detection with your own distribution name
- **Reliable Path Translation** - Converts WSL paths to Windows-compatible UNC paths
- **Cross-Distribution Support** - Works with Ubuntu, Debian, Alpine, and other WSL distributions

## 📋 Prerequisites

- Windows Subsystem for Linux (WSL) or WSL2
- Visual Studio Code running in WSL mode
- PowerShell available on Windows (included by default)


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

The extension automatically:
- Detects your WSL distribution name (or uses your custom configuration)
- Converts Linux paths to Windows UNC format (`\\wsl$\Distribution\path`)
- Uses PowerShell to reliably open Windows File Explorer
- Handles path escaping and special characters

## ⚙️ Configuration

### Custom WSL Distribution Name

If automatic detection fails or you have a custom WSL distribution name, you can override it:

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

**Note**: Leave this setting empty (default) to use automatic detection.

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

## 🐛 Troubleshooting

If the extension doesn't work:
1. **Ensure you're running VS Code in WSL mode** (not Windows)
2. **Verify that PowerShell is available** on your Windows system
3. **Check that Windows File Explorer can access `\\wsl$\<distribution>` paths manually**

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

3. **Common distribution name issues**:
   - Auto-detection might return `Ubuntu` but your distribution is `Ubuntu2`
   - Version-specific names like `Ubuntu-20.04` vs `Ubuntu-22.04`
   - Custom installation names

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Feras Abdalrahman**
- GitHub: [@doonfrs](https://github.com/doonfrs)
- VS Code Marketplace: [doonfrs](https://marketplace.visualstudio.com/publishers/doonfrs)

