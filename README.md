# Delta CLI

🚀 **Advanced AI coding assistant** - A complete alternative to Claude Code with enhanced features.

Delta CLI is a powerful command-line interface that leverages cutting-edge AI models to provide intelligent coding assistance, project management, and automated code execution capabilities.

## ✨ Features

- **🤖 AI-Powered Coding Assistant**: Get intelligent code suggestions and solutions using advanced AI models
- **🔄 Auto-Execution**: Automatically execute generated code commands (toggleable)
- **📁 Project Context Awareness**: Analyzes your project structure and provides context-aware assistance
- **💬 Interactive Mode**: Chat-based interface for continuous coding assistance
- **⚙️ Configurable**: Customizable models, settings, and behavior
- **📊 Session Management**: Maintains conversation history and project state
- **🔧 Built-in Commands**: File navigation, execution, and project management tools

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- Google AI API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd delta-cli
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Make it executable:**
   ```bash
   chmod +x delta.js
   ```

4. **Global installation (optional):**
   ```bash
   node delta.js --install
   ```

### Configuration

Delta CLI automatically creates configuration files in `~/.delta-cli/`:

- **Config file**: `~/.delta-cli/config.json`
- **Session file**: `~/.delta-cli/session.json`

The API key is currently hardcoded in the script. For production use, consider using environment variables.

## 📖 Usage

### Interactive Mode

Start the interactive mode to begin chatting with Delta CLI:

```bash
node delta.js -i
# or
node delta.js --interactive
```

### Direct Commands

Execute single commands:

```bash
node delta.js "Create a React todo app with TypeScript"
node delta.js "Set up a Python FastAPI project with authentication"
```

### Command Line Options

```bash
node delta.js [options] "your request"

Options:
  -i, --interactive    Start interactive mode
  -h, --help          Show help information
  -v, --version       Show version information
  --install           Install Delta CLI globally
  --uninstall         Remove Delta CLI installation
```

## 🎯 Available Commands

### Navigation & Files
- `/pwd` - Show current directory
- `/cd <dir>` - Change directory
- `/tree` - Show directory structure
- `/read <file>` - Display file contents

### Execution
- `/run <cmd>` - Execute shell command manually
- `/toggle` - Toggle auto-execution on/off

### Conversation
- `/clear` - Clear conversation history
- `/status` - Show current status
- `/config` - Show configuration

### Model Settings
- `/model <name>` - Change Gemini model (e.g., gemini-1.5-pro)

### General
- `/help` - Show help information
- `/exit`, `/quit` - Exit Delta CLI

## 🔧 Configuration

### Model Settings

Delta CLI supports multiple AI models:
- `gemini-2.0-flash` (default)
- `gemini-1.5-pro`
- `gemini-1.5-flash`

### Auto-Execution

The auto-execution feature automatically runs generated code commands. You can toggle this behavior:
- Use `/toggle` command in interactive mode
- Modify the `autoExecute` setting in the configuration

### Project Context

Delta CLI automatically analyzes your project structure and includes relevant context in AI requests. It respects `.gitignore` patterns and focuses on important project files.

## 📁 Project Structure

```
delta-cli/
├── delta.js          # Main CLI application
├── package.json      # Project dependencies
├── package-lock.json # Dependency lock file
└── README.md         # This file
```

## 🛠️ Development

### Dependencies

- **Node.js built-in modules**: `fs`, `path`, `https`, `child_process`, `readline`, `os`, `crypto`
- **No external dependencies** - Pure Node.js implementation

### Key Components

- **DeltaCLI Class**: Main application logic
- **API Integration**: Google AI API communication
- **Command Processing**: Interactive command handling
- **File Management**: Project context and file operations
- **Session Management**: Conversation history and state persistence

## 🔒 Security Notes

- API key is currently hardcoded in the script
- For production use, consider using environment variables
- Auto-execution feature can run arbitrary commands - use with caution
- Review generated code before execution

## 📝 Examples

### Creating a New Project

```bash
δ > Create a React todo app with TypeScript
δ > /cd my-todo-app
δ > /run npm install
δ > /run npm start
```

### Working with Existing Code

```bash
δ > /read package.json
δ > Add authentication to this Express app
δ > /run npm test
```

### Model Switching

```bash
δ > /model gemini-1.5-pro
δ > /status
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the `/help` command in interactive mode
2. Review the configuration with `/config`
3. Check the project status with `/status`

## 🔄 Version History

- **v1.0.0** - Initial release with AI integration and interactive mode

---

**Delta CLI** - Making AI-powered coding assistance accessible and powerful! 🚀
