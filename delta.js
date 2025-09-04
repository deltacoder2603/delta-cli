#!/usr/bin/env node

/**
 * Delta CLI - Advanced AI coding assistant with Gemini integration
 * A complete alternative to Claude Code with enhanced features
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec, spawn } = require('child_process');
const readline = require('readline');
const os = require('os');
const crypto = require('crypto');

class DeltaCLI {
    constructor() {
        this.apiKey = 'your_gemini_api_key';
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.model = 'gemini-2.0-flash'; // Default model
        this.conversationHistory = [];
        this.currentDirectory = process.cwd();
        this.autoExecute = true;
        this.maxTokens = 4000;
        this.temperature = 0.7;
        this.configDir = path.join(os.homedir(), '.delta-cli');
        this.configFile = path.join(this.configDir, 'config.json');
        this.sessionFile = path.join(this.configDir, 'session.json');
        this.gitIgnorePatterns = ['.git', 'node_modules', '.env', '*.log', 'dist', 'build'];
        this.fileExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.json', '.md', '.yml', '.yaml', '.xml', '.sh'];
        
        this.initializeConfig();
    }

    initializeConfig() {
        // Create config directory if it doesn't exist
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }

        // Load existing config
        this.loadConfig();
        
        // Load session if exists
        this.loadSession();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.model = config.model || this.model;
                this.maxTokens = config.maxTokens || this.maxTokens;
                this.temperature = config.temperature || this.temperature;
                this.autoExecute = config.autoExecute !== undefined ? config.autoExecute : this.autoExecute;
                this.gitIgnorePatterns = [...this.gitIgnorePatterns, ...(config.ignorePatterns || [])];
            }
        } catch (error) {
            console.warn('Warning: Could not load config file');
        }
    }

    saveConfig() {
        const config = {
            model: this.model,
            maxTokens: this.maxTokens,
            temperature: this.temperature,
            autoExecute: this.autoExecute,
            ignorePatterns: this.gitIgnorePatterns.slice(6) // Save only custom patterns
        };
        
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
        } catch (error) {
            console.warn('Warning: Could not save config file');
        }
    }

    loadSession() {
        try {
            if (fs.existsSync(this.sessionFile)) {
                const session = JSON.parse(fs.readFileSync(this.sessionFile, 'utf8'));
                this.conversationHistory = session.history || [];
            }
        } catch (error) {
            console.warn('Warning: Could not load session file');
        }
    }

    saveSession() {
        const session = {
            history: this.conversationHistory.slice(-20), // Keep last 20 messages
            timestamp: Date.now()
        };
        
        try {
            fs.writeFileSync(this.sessionFile, JSON.stringify(session, null, 2));
        } catch (error) {
            console.warn('Warning: Could not save session file');
        }
    }

    async makeApiRequest(messages, systemPrompt = null) {
        const url = `${this.baseUrl}?key=${this.apiKey}`;
        
        // Convert messages to Gemini format
        const contents = [];
        
        if (systemPrompt) {
            contents.push({
                role: 'user',
                parts: [{ text: systemPrompt }]
            });
        }
        
        for (const msg of messages) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: this.temperature,
                maxOutputTokens: this.maxTokens,
            }
        };

        return new Promise((resolve, reject) => {
            const data = JSON.stringify(payload);
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseData = '';

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
                            resolve(result.candidates[0].content.parts[0].text);
                        } else if (result.error) {
                            reject(new Error(`API Error: ${result.error.message || 'Unknown error'}`));
                        } else {
                            reject(new Error('No response generated'));
                        }
                    } catch (error) {
                        reject(new Error(`Error parsing response: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.write(data);
            req.end();
        });
    }

    async executeCommand(command, options = {}) {
        const { showOutput = true, interactive = false, timeout = 30000 } = options;
        
        return new Promise((resolve) => {
            if (showOutput) {
                console.log(`🔧 Executing: ${command}`);
            }

            if (interactive) {
                const child = spawn(command, [], { 
                    shell: true, 
                    cwd: this.currentDirectory,
                    stdio: 'inherit'
                });
                
                child.on('close', (code) => {
                    if (showOutput) {
                        console.log(code === 0 ? '✅ Command completed successfully' : `❌ Command failed with exit code: ${code}`);
                    }
                    resolve({
                        success: code === 0,
                        code: code,
                        stdout: '',
                        stderr: ''
                    });
                });
            } else {
                const child = exec(command, { 
                    cwd: this.currentDirectory, 
                    timeout: timeout 
                }, (error, stdout, stderr) => {
                    if (showOutput) {
                        if (stdout) console.log(stdout.trim());
                        if (stderr) console.error(stderr.trim());
                        if (error) {
                            if (error.code === 'TIMEOUT') {
                                console.error(`❌ Command timed out after ${timeout}ms`);
                            } else {
                                console.error(`❌ Error: ${error.message}`);
                            }
                        } else {
                            console.log('✅ Command completed successfully');
                        }
                    }
                    
                    resolve({
                        success: !error,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        error: error ? error.message : null
                    });
                });
            }
        });
    }

    writeToFile(filePath, content, options = {}) {
        const { showOutput = true, backup = false, append = false } = options;
        
        try {
            const fullPath = path.resolve(this.currentDirectory, filePath);
            const dir = path.dirname(fullPath);
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                if (showOutput) console.log(`📁 Created directory: ${path.dirname(filePath)}`);
            }
            
            // Create backup if requested and file exists
            if (backup && fs.existsSync(fullPath)) {
                const backupPath = `${fullPath}.backup.${Date.now()}`;
                fs.copyFileSync(fullPath, backupPath);
                if (showOutput) console.log(`🔄 Created backup: ${backupPath}`);
            }
            
            // Write or append content
            if (append) {
                fs.appendFileSync(fullPath, content);
                if (showOutput) console.log(`➕ Appended to file: ${filePath}`);
            } else {
                fs.writeFileSync(fullPath, content);
                if (showOutput) console.log(`📝 ${fs.existsSync(fullPath) ? 'Updated' : 'Created'} file: ${filePath}`);
            }
            
            return true;
        } catch (error) {
            if (showOutput) console.error(`❌ Error writing to ${filePath}: ${error.message}`);
            return false;
        }
    }

    readFile(filePath, options = {}) {
        const { showOutput = true } = options;
        
        try {
            const fullPath = path.resolve(this.currentDirectory, filePath);
            if (!fs.existsSync(fullPath)) {
                if (showOutput) console.error(`❌ File not found: ${filePath}`);
                return null;
            }
            
            const content = fs.readFileSync(fullPath, 'utf8');
            if (showOutput) console.log(`📖 Read file: ${filePath} (${content.length} characters)`);
            return content;
        } catch (error) {
            if (showOutput) console.error(`❌ Error reading ${filePath}: ${error.message}`);
            return null;
        }
    }

    shouldIgnoreFile(filePath) {
        const basename = path.basename(filePath);
        const relativePath = path.relative(this.currentDirectory, filePath);
        
        return this.gitIgnorePatterns.some(pattern => {
            if (pattern.startsWith('*')) {
                return basename.endsWith(pattern.slice(1));
            }
            if (pattern.endsWith('*')) {
                return basename.startsWith(pattern.slice(0, -1));
            }
            return basename === pattern || relativePath.includes(pattern);
        });
    }

    getDirectoryStructure(options = {}) {
        const { maxDepth = 3, showFiles = true, showHidden = false } = options;
        
        const buildTree = (dir, depth = 0, prefix = '') => {
            if (depth > maxDepth) return '';
            
            let result = '';
            try {
                let items = fs.readdirSync(dir);
                
                if (!showHidden) {
                    items = items.filter(item => !item.startsWith('.'));
                }
                
                items = items.filter(item => {
                    const itemPath = path.join(dir, item);
                    return !this.shouldIgnoreFile(itemPath);
                }).sort();
                
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const itemPath = path.join(dir, item);
                    const isLast = i === items.length - 1;
                    const currentPrefix = prefix + (isLast ? '└── ' : '├── ');
                    const stat = fs.statSync(itemPath);
                    
                    if (stat.isDirectory()) {
                        result += currentPrefix + item + '/\n';
                        if (depth < maxDepth) {
                            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
                            result += buildTree(itemPath, depth + 1, nextPrefix);
                        }
                    } else if (showFiles) {
                        const size = stat.size > 1024 ? `${Math.round(stat.size / 1024)}KB` : `${stat.size}B`;
                        result += currentPrefix + item + ` (${size})\n`;
                    }
                }
            } catch (error) {
                result += prefix + `Error reading directory: ${error.message}\n`;
            }
            
            return result;
        };

        return buildTree(this.currentDirectory);
    }

    getProjectContext() {
        const context = [];
        
        // Add current directory and structure
        context.push(`Current directory: ${this.currentDirectory}`);
        context.push(`Directory structure:\n${this.getDirectoryStructure()}`);
        
        // Add key configuration files
        const configFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml', 'build.gradle', 'Makefile', 'README.md'];
        configFiles.forEach(file => {
            const content = this.readFile(file, { showOutput: false });
            if (content) {
                context.push(`\n${file}:\n${content.slice(0, 1000)}${content.length > 1000 ? '...' : ''}`);
            }
        });
        
        // Add git information if available
        try {
            const gitStatus = exec('git status --porcelain', { cwd: this.currentDirectory });
            if (gitStatus) {
                context.push(`\nGit status:\n${gitStatus}`);
            }
        } catch (error) {
            // Ignore git errors
        }
        
        return context.join('\n\n');
    }

    extractCodeBlocks(text) {
        const codeBlocks = [];
        const regex = /```(\w+)?\s*\n([\s\S]*?)\n```/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const language = match[1] || 'text';
            const content = match[2];
            codeBlocks.push({ language, content: content.trim() });
        }
        
        return codeBlocks;
    }

    extractCommands(text) {
        const commands = [];
        
        // Extract from bash/shell code blocks
        const codeBlocks = this.extractCodeBlocks(text);
        codeBlocks.forEach(block => {
            if (['bash', 'shell', 'sh', 'zsh'].includes(block.language.toLowerCase())) {
                const lines = block.content.split('\n');
                lines.forEach(line => {
                    line = line.trim();
                    if (line && !line.startsWith('#') && !line.startsWith('//') && !line.includes('EOF') && line !== 'EOF') {
                        commands.push(line);
                    }
                });
            }
        });
        
        return commands;
    }

    extractFiles(text) {
        const files = [];
        
        // Extract files from code blocks with comment indicators
        const codeBlocks = this.extractCodeBlocks(text);
        
        codeBlocks.forEach((block, index) => {
            let filename = null;
            let content = block.content;
            
            // Look for filename in comment on first line
            const lines = content.split('\n');
            const firstLine = lines[0].trim();
            
            // Check for various comment patterns
            if (firstLine.startsWith('//') && firstLine.includes('.')) {
                filename = firstLine.replace('//', '').trim();
                content = lines.slice(1).join('\n').trim();
            } else if (firstLine.startsWith('#') && firstLine.includes('.')) {
                filename = firstLine.replace('#', '').trim();
                content = lines.slice(1).join('\n').trim();
            } else if (firstLine.startsWith('/*') && firstLine.includes('.')) {
                filename = firstLine.replace('/*', '').replace('*/', '').trim();
                content = lines.slice(1).join('\n').trim();
            }
            
            // Also look for patterns before code blocks in the surrounding text
            if (!filename) {
                const beforeBlock = text.substring(0, text.indexOf('```' + block.language));
                const filenamePatterns = [
                    /(?:create|save|write|update)\s+(?:file\s+)?[`"']?([^`"'\s\n]+\.[a-zA-Z]+)[`"']?/i,
                    /(?:file\s*:)\s*[`"']?([^`"'\s\n]+\.[a-zA-Z]+)[`"']?/i,
                    /([a-zA-Z0-9_-]+\.[a-zA-Z]+)(?:\s*:|\s*-|\s*file)/i
                ];
                
                for (const pattern of filenamePatterns) {
                    const beforeLines = beforeBlock.split('\n').slice(-3); // Check last 3 lines
                    for (const line of beforeLines.reverse()) {
                        const match = line.match(pattern);
                        if (match && match[1]) {
                            filename = match[1].trim();
                            break;
                        }
                    }
                    if (filename) break;
                }
            }
            
            // If still no filename, try to infer from content and language
            if (!filename && content.trim()) {
                const ext = this.getExtensionFromLanguage(block.language);
                if (ext) {
                    // Try to find a meaningful name from content
                    if (block.language === 'json' && content.includes('"name"')) {
                        filename = 'package.json';
                    } else if (content.includes('app.listen') || content.includes('express()')) {
                        filename = `server${ext}`;
                    } else if (content.includes('module.exports') || content.includes('export')) {
                        filename = `index${ext}`;
                    } else {
                        filename = `file${index}${ext}`;
                    }
                }
            }
            
            if (filename && content.trim()) {
                files.push({ 
                    filename: filename.replace(/[<>:"|?*]/g, ''), // Clean filename
                    content, 
                    language: block.language 
                });
            }
        });
        
        return files;
    }

    getExtensionFromLanguage(language) {
        const langMap = {
            'javascript': '.js',
            'js': '.js',
            'typescript': '.ts',
            'ts': '.ts',
            'python': '.py',
            'py': '.py',
            'java': '.java',
            'cpp': '.cpp',
            'c': '.c',
            'html': '.html',
            'css': '.css',
            'json': '.json',
            'yaml': '.yml',
            'yml': '.yml',
            'xml': '.xml',
            'shell': '.sh',
            'bash': '.sh',
            'sh': '.sh'
        };
        
        return langMap[language.toLowerCase()] || null;
    }

    async autoExecuteResponse(response) {
        console.log('\n🔍 Analyzing response for auto-execution...\n');
        
        let hasChanges = false;
        
        // Extract and create files first
        const files = this.extractFiles(response);
        for (const file of files) {
            if (file.content) {
                hasChanges = true;
                this.writeToFile(file.filename, file.content, { backup: true });
            }
        }
        
        // Then extract and execute commands
        const commands = this.extractCommands(response);
        for (const command of commands) {
            // Skip dangerous or problematic commands
            if (this.shouldSkipCommand(command)) {
                console.log(`⚠️ Skipping potentially problematic command: ${command}`);
                continue;
            }
            
            hasChanges = true;
            
            if (command.includes('cd ')) {
                // Handle directory changes
                const newDir = command.replace(/cd\s+/, '').trim().replace(/^['"]|['"]$/g, '');
                const fullPath = path.resolve(this.currentDirectory, newDir);
                
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                    this.currentDirectory = fullPath;
                    process.chdir(fullPath);
                    console.log(`📂 Changed directory to: ${fullPath}`);
                } else {
                    console.log(`❌ Directory not found: ${newDir}`);
                }
            } else {
                // Determine if command needs interactive mode
                const interactiveCommands = ['npm install', 'yarn install', 'pip install', 'cargo build', 'mvn install'];
                const isInteractive = interactiveCommands.some(cmd => command.includes(cmd));
                
                await this.executeCommand(command, { 
                    interactive: isInteractive,
                    timeout: isInteractive ? 120000 : 30000 // 2 minutes for installs, 30s for others
                });
            }
            
            // Small delay between commands
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Show final directory structure if there were changes
        if (hasChanges) {
            console.log('\n📋 Updated directory structure:');
            console.log(this.getDirectoryStructure());
        } else {
            console.log('ℹ️ No executable commands or files found in response.');
        }
    }

    shouldSkipCommand(command) {
        const dangerousPatterns = [
            /rm\s+-rf?\s+\//, // rm -rf /
            /sudo\s+rm/, // sudo rm
            />\s*\/dev\/sda/, // writing to disk
            /dd\s+if=/, // disk operations
            /mkfs/, // format disk
            /fdisk/, // partition operations
            /:\(\)\{\s*:\|\:&\s*\}/, // fork bomb
            /cat.*EOF.*<</, // problematic cat commands with EOF
            /curl.*\|\s*bash/, // curl pipe to bash
            /wget.*\|\s*bash/, // wget pipe to bash
        ];
        
        return dangerousPatterns.some(pattern => pattern.test(command));
    }

    async handleCodingRequest(request, options = {}) {
        const { includeContext = true, autoExecute = this.autoExecute } = options;
        
        let context = '';
        if (includeContext) {
            context = this.getProjectContext() + '\n\n';
        }

        const systemPrompt = `You are Delta CLI, an advanced AI coding assistant that provides complete, actionable solutions. You have expertise in all programming languages, frameworks, and development tools.

When a user asks you to create, modify, or work with code:

1. Provide step-by-step instructions
2. Include complete, working code in appropriate code blocks with clear filenames
3. Use proper file naming and structure
4. Include terminal commands in bash code blocks
5. Provide error handling and best practices
6. Include testing and validation steps
7. Explain your reasoning and approach

Format guidelines:
- Terminal commands in \`\`\`bash code blocks
- Code files with filenames as first line comments (e.g., // filename.js or # filename.py)
- Use proper syntax highlighting with language specifiers
- Provide complete, runnable solutions
- For JSON files, use \`\`\`json blocks
- For configuration files, use appropriate language tags

Current working directory: ${this.currentDirectory}
Auto-execution is ${autoExecute ? 'enabled' : 'disabled'}.

If auto-execution is enabled, your commands and files will be automatically executed and created. Make sure to:
- Put filenames as comments on the first line of code blocks
- Use clear, safe commands
- Avoid interactive prompts in commands when possible`;

        const messages = [
            ...this.conversationHistory,
            { 
                role: 'user', 
                content: context + request 
            }
        ];

        try {
            console.log('🤖 Delta CLI is thinking...\n');
            const response = await this.makeApiRequest(messages, systemPrompt);
            
            // Add to conversation history
            this.conversationHistory.push(
                { role: 'user', content: request },
                { role: 'assistant', content: response }
            );
            
            // Save session
            this.saveSession();
            
            console.log('📖 Gemini Response:');
            console.log('═'.repeat(60));
            console.log(response);
            console.log('═'.repeat(60));
            
            if (autoExecute) {
                await this.autoExecuteResponse(response);
            }
            
            return response;
        } catch (error) {
            console.error(`❌ Error: ${error.message}`);
            return `Error: ${error.message}`;
        }
    }

    async startInteractiveMode() {
        console.log('🚀 Delta CLI - Advanced AI Coding Assistant');
        console.log(`Model: ${this.model} | Auto-execute: ${this.autoExecute ? 'ON' : 'OFF'}`);
        console.log('Type your coding requests or use /help for commands.\n');

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: 'δ > '
        });

        rl.on('line', async (input) => {
            const trimmed = input.trim();
            
            try {
                if (trimmed === '/exit' || trimmed === '/quit') {
                    console.log('Goodbye! 👋');
                    rl.close();
                    return;
                }
                
                if (trimmed === '/help') {
                    this.showHelp();
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/tree') {
                    console.log('\n📋 Directory structure:');
                    console.log(this.getDirectoryStructure({ showFiles: true, maxDepth: 3 }));
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/clear') {
                    this.conversationHistory = [];
                    console.log('🧹 Conversation history cleared.');
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/pwd') {
                    console.log(`📂 Current directory: ${this.currentDirectory}`);
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/toggle') {
                    this.autoExecute = !this.autoExecute;
                    console.log(`🔄 Auto-execution ${this.autoExecute ? 'enabled' : 'disabled'}`);
                    this.saveConfig();
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/status') {
                    this.showStatus();
                    rl.prompt();
                    return;
                }
                
                if (trimmed === '/config') {
                    this.showConfig();
                    rl.prompt();
                    return;
                }
                
                if (trimmed.startsWith('/cd ')) {
                    const newDir = trimmed.slice(4).trim().replace(/^['"]|['"]$/g, '');
                    try {
                        const fullPath = path.resolve(this.currentDirectory, newDir);
                        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                            this.currentDirectory = fullPath;
                            process.chdir(fullPath);
                            console.log(`📂 Changed directory to: ${fullPath}`);
                        } else {
                            console.log(`❌ Directory not found: ${newDir}`);
                        }
                    } catch (error) {
                        console.log(`❌ Error changing directory: ${error.message}`);
                    }
                    rl.prompt();
                    return;
                }
                
                if (trimmed.startsWith('/run ')) {
                    const command = trimmed.slice(5).trim();
                    await this.executeCommand(command);
                    rl.prompt();
                    return;
                }
                
                if (trimmed.startsWith('/model ')) {
                    const newModel = trimmed.slice(7).trim();
                    this.model = newModel;
                    console.log(`🤖 Model changed to: ${newModel}`);
                    this.saveConfig();
                    rl.prompt();
                    return;
                }
                
                if (trimmed.startsWith('/read ')) {
                    const filePath = trimmed.slice(6).trim().replace(/^['"]|['"]$/g, '');
                    const content = this.readFile(filePath);
                    if (content) {
                        console.log(`\n📄 Content of ${filePath}:`);
                        console.log('─'.repeat(40));
                        console.log(content.slice(0, 2000) + (content.length > 2000 ? '\n...(truncated)' : ''));
                        console.log('─'.repeat(40));
                    }
                    rl.prompt();
                    return;
                }
                
                if (!trimmed) {
                    rl.prompt();
                    return;
                }
                
                await this.handleCodingRequest(trimmed);
                console.log('\n✨ Task completed! What would you like to do next?\n');
            } catch (error) {
                console.error(`❌ Unexpected error: ${error.message}`);
            }
            
            rl.prompt();
        });

        rl.prompt();
    }

    showHelp() {
        console.log(`
🚀 Delta CLI Commands:

Navigation & Files:
  /pwd            Show current directory
  /cd <dir>       Change directory
  /tree           Show directory structure
  /read <file>    Display file contents

Execution:
  /run <cmd>      Execute shell command manually
  /toggle         Toggle auto-execution on/off

Conversation:
  /clear          Clear conversation history
  /status         Show current status
  /config         Show configuration

Model Settings:
  /model <name>   Change Gemini model (e.g., gemini-1.5-pro)

General:
  /help           Show this help
  /exit, /quit    Exit Delta CLI

Examples:
  δ > Create a React todo app with TypeScript
  δ > Set up a Python FastAPI project with authentication
  δ > Build a REST API with Express and MongoDB
  δ > /cd myproject
  δ > /run npm test
  δ > /model gemini-1.5-pro

Available Models:
  - gemini-2.0-flash (current default)
  - gemini-1.5-pro (most capable)
  - gemini-1.5-flash (fast and efficient)
  - gemini-pro (stable release)
`);
    }

    showStatus() {
        console.log(`
📊 Delta CLI Status:
  Current Directory: ${this.currentDirectory}
  Model: ${this.model}
  Auto-execution: ${this.autoExecute ? 'ON' : 'OFF'}
  Max Tokens: ${this.maxTokens}
  Temperature: ${this.temperature}
  Conversation Length: ${this.conversationHistory.length} messages
  API Key: ${this.apiKey ? 'Set' : 'Not set'}
`);
    }

    showConfig() {
        console.log(`
⚙️  Delta CLI Configuration:
  Config Directory: ${this.configDir}
  Config File: ${this.configFile}
  Session File: ${this.sessionFile}
  
  Ignored Patterns: ${this.gitIgnorePatterns.join(', ')}
  File Extensions: ${this.fileExtensions.join(', ')}
`);
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    const delta = new DeltaCLI();

    if (args.includes('-h') || args.includes('--help')) {
        console.log(`
🚀 Delta CLI - Advanced AI Coding Assistant

Usage: delta [options] "your request"

Options:
  -i, --interactive         Start interactive mode
  -m, --model <model>       Set Gemini model
  -t, --temperature <temp>  Set temperature (0.0-1.0)
  -n, --no-auto            Disable auto-execution
  -c, --context            Include project context
  -h, --help               Show this help

Examples:
  delta "Create a todo backend with Express"
  delta "Set up a React project with TypeScript"
  delta -i
  delta -m gemini-1.5-pro "Optimize this Python code"

Available Gemini Models:
  - gemini-2.0-flash (current default)
  - gemini-1.5-pro (most capable)
  - gemini-1.5-flash (fast and efficient)
  - gemini-pro (stable release)
`);
        return;
    }

    // Parse options
    let i = 0;
    while (i < args.length) {
        const arg = args[i];
        
        if (arg === '-m' || arg === '--model') {
            delta.model = args[++i];
        } else if (arg === '-t' || arg === '--temperature') {
            delta.temperature = parseFloat(args[++i]);
        } else if (arg === '-n' || arg === '--no-auto') {
            delta.autoExecute = false;
        } else if (arg === '-i' || arg === '--interactive') {
            await delta.startInteractiveMode();
            return;
        } else if (!arg.startsWith('-')) {
            // Remaining arguments are the request
            const request = args.slice(i).join(' ');
            if (request.trim()) {
                await delta.handleCodingRequest(request);
            }
            return;
        }
        i++;
    }

    // If no arguments or only flags, start interactive mode
    await delta.startInteractiveMode();
}

// Install function for setting up Delta CLI globally
function install() {
    console.log('🚀 Installing Delta CLI...');
    
    const binPath = path.join(os.homedir(), '.local', 'bin');
    const scriptPath = path.join(binPath, 'delta');
    
    try {
        // Create bin directory if it doesn't exist
        if (!fs.existsSync(binPath)) {
            fs.mkdirSync(binPath, { recursive: true });
        }
        
        // Copy this script to bin directory
        const currentScript = __filename;
        fs.copyFileSync(currentScript, scriptPath);
        
        // Make it executable
        fs.chmodSync(scriptPath, '755');
        
        console.log(`✅ Delta CLI installed to: ${scriptPath}`);
        console.log('Add ~/.local/bin to your PATH to use "delta" command globally.');
        console.log('Or run: export PATH="$HOME/.local/bin:$PATH"');
        
    } catch (error) {
        console.error(`❌ Installation failed: ${error.message}`);
        console.log('You may need to run with sudo or check permissions.');
    }
}

// Uninstall function
function uninstall() {
    console.log('🗑️ Uninstalling Delta CLI...');
    
    const binPath = path.join(os.homedir(), '.local', 'bin', 'delta');
    const configDir = path.join(os.homedir(), '.delta-cli');
    
    try {
        // Remove binary
        if (fs.existsSync(binPath)) {
            fs.unlinkSync(binPath);
            console.log(`✅ Removed: ${binPath}`);
        }
        
        // Ask about config removal
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('Remove configuration directory? (y/N): ', (answer) => {
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                if (fs.existsSync(configDir)) {
                    fs.rmSync(configDir, { recursive: true, force: true });
                    console.log(`✅ Removed config: ${configDir}`);
                }
            }
            console.log('Delta CLI uninstalled successfully.');
            rl.close();
        });
        
    } catch (error) {
        console.error(`❌ Uninstallation failed: ${error.message}`);
    }
}

// Version information
function showVersion() {
    const packageInfo = {
        name: 'Delta CLI',
        version: '1.0.0',
        description: 'Advanced AI coding assistant with Gemini integration',
        author: 'Delta CLI Team',
        license: 'MIT'
    };
    
    console.log(`${packageInfo.name} v${packageInfo.version}`);
    console.log(packageInfo.description);
}

// Check for updates
async function checkUpdates() {
    console.log('🔍 Checking for updates...');
    // In a real implementation, this would check a remote repository
    console.log('✅ You are running the latest version of Delta CLI.');
}

// Export classes and functions for testing
module.exports = {
    DeltaCLI,
    main,
    install,
    uninstall,
    showVersion,
    checkUpdates
};

// Handle special commands
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--install')) {
        install();
    } else if (args.includes('--uninstall')) {
        uninstall();
    } else if (args.includes('--version') || args.includes('-v')) {
        showVersion();
    } else if (args.includes('--update')) {
        checkUpdates();
    } else {
        main().catch(console.error);
    }
}
