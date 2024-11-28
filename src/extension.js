const vscode = require('vscode');

class SidebarProvider {
    constructor(context) {
        this._view = null;
        this._context = context;
        this._currentAnimation = 'nap';  // Start with napping
        this._useNotifications = true; // Default to notifications
        const config = vscode.workspace.getConfiguration('friendlyCodeAssistant');
        this._currentModel = config.get('model') || 'gpt-3.5-turbo'; // Load saved model or use default
        this._placeholderApiKey = ''; // Default placeholder API key is empty
        const apiKey = config.get('apiKey') || this._placeholderApiKey; // Initialize with an empty key by default
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'media')]
        };

        this._updateContent();

        webviewView.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.command) {
                    case 'askAI':
                        await this._handleAIQuestion(message.question);
                        break;
                    case 'setupApiKey':
                        await this._setupApiKey();
                        break;
                    case 'selectModel':
                        await this._selectModel();
                        break;
                    case 'toggleNotifications':
                        await this._toggleNotifications();
                        break;
                    case 'explainCode':
                        await this._explainSelectedCode();
                        break;
                    case 'suggestFix':
                        await this._suggestCodeFix();
                        break;
                    case 'wakeUp':
                        this._setAnimation('idle');
                        break;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
                this._setAnimation('idle');
            }
        });
    }

    async _setupApiKey() {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your API Key',
            password: true,
            placeHolder: 'Enter API key...',
            validateInput: text => {
                if (!text?.trim()) {
                    return 'API key cannot be empty';
                }
                return null;
            }
        });

        if (apiKey) {
            await vscode.workspace.getConfiguration('friendlyCodeAssistant').update(
                'apiKey',
                apiKey,
                vscode.ConfigurationTarget.Global // Save globally
            );
            this._setAnimation('happy');
            vscode.window.showInformationMessage('✨ API Key saved globally! You can now chat with your AI assistant.');
            setTimeout(() => this._setAnimation('nap'), 2000);
        }
    }

    async _selectModel() {
        const model = await vscode.window.showInputBox({
            prompt: 'Enter the model name (e.g., gpt-3.5-turbo)',
            placeHolder: 'Enter model name...',
            value: this._currentModel,
            validateInput: text => {
                if (!text?.trim()) {
                    return 'Model name cannot be empty';
                }
                return null;
            }
        });

        if (model) {
            this._currentModel = model;
            await vscode.workspace.getConfiguration().update(
                'friendlyCodeAssistant.model',
                model,
                true
            );
            vscode.window.showInformationMessage(`🤖 Model changed to: ${model}`);
        }
    }

    async _toggleNotifications() {
        this._useNotifications = !this._useNotifications;
        vscode.window.showInformationMessage(
            this._useNotifications ? 
            '🔔 Using notification popups for responses' : 
            '📄 Using panels for responses'
        );
    }

    async _explainSelectedCode() {
        const editor = vscode.window.activeTextEditor;
        
        // Check if editor is open and text is selected
        if (!editor) {
            throw new Error('No code selected. Please select some code first!');
        }
    
        const selection = editor.selection;
        const text = editor.document.getText(selection);
    
        if (!text) {
            throw new Error('Please select the code you want me to explain!');
        }
    
        this._setAnimation('working');
    
        try {
            // Request a concise explanation from the AI
            const response = await this._getAIResponse(
                `Explain this code clearly and succinctly, focusing on its main purpose and functionality:
                \`\`\`\n${text}\n\`\`\``,
                true
            );
    
            if (this._useNotifications) {
                // Format the explanation before displaying it
                const formattedExplanation = this._formatExplanation(response);
    
                // Display the explanation in a clean notification
                vscode.window.showInformationMessage(`💡 Code Explanation:\n${formattedExplanation}`);
            } else {
                // Use the webview panel to display the explanation if notifications are off
                const panel = vscode.window.createWebviewPanel(
                    'codeExplanation',
                    '💡 Code Explanation',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );
    
                panel.webview.html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { padding: 15px; font-family: var(--vscode-font-family); }
                            .explanation { line-height: 1.5; font-size: 14px; }
                        </style>
                    </head>
                    <body>
                        <div class="explanation">${response.replace(/\n/g, '<br>')}</div>
                    </body>
                    </html>
                `;
            }
        } finally {
            this._setAnimation('nap');
        }
    }
    
    // Helper function to clean and format the explanation for notifications
    _formatExplanation(explanation) {
        // Clean the explanation by trimming and removing excess spaces
        const lines = explanation.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        return lines.join('\n• ');  // Concatenate lines as bullet points
    }
    
    
    async _suggestCodeFix() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            throw new Error('No code selected. Please select some code first!');
        }
    
        const selection = editor.selection;
        const text = editor.document.getText(selection);
        const language = editor.document.languageId;
    
        if (!text) {
            throw new Error('Please select the code you want me to improve!');
        }
    
        this._setAnimation('working');
    
        try {
            const response = await this._getAIResponse(
                `You are a code improvement expert. Analyze this ${language} code and provide improvements:
                1. Start with "ISSUES:" followed by a bullet-point list of main issues (maximum 3 points).
                2. Then "IMPROVEMENTS:" with bullet points of specific, actionable fixes (e.g., optimizations, error handling, refactoring suggestions).
                3. Finally, provide the complete improved code after "FIXED CODE:"
                Focus on improving readability, performance, and maintainability, while maintaining the original functionality.
                
                Original code:
                \`\`\`${language}\n${text}\n\`\`\``,
                true
            );
    
            // Parse response sections
            const sections = response.split(/ISSUES:|IMPROVEMENTS:|FIXED CODE:/i);
            const issues = sections[1]?.trim() || 'No issues found! Please review your code for potential issues.';
            const improvements = sections[2]?.trim() || 'No specific improvements suggested! Consider checking variable names, performance, and code readability.';
            const fixedCode = sections[3]?.trim() || 'No fix provided. Ensure the AI properly analyzed and fixed the issues.';
    
            const formattedFixedCode = this._sanitizeCode(fixedCode);
    
            if (this._useNotifications) {
                const message = `🔍 Issues Found: \n${issues}\n\n💡 Improvements: \n${improvements}`;
                vscode.window.showInformationMessage(message);
    
                const result = await vscode.window.showInformationMessage(
                    '🔧 Apply the suggested fixes?',
                    'Apply',
                    'Cancel'
                );
    
                if (result === 'Apply') {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, formattedFixedCode);
                    });
                    this._setAnimation('happy');
                    vscode.window.showInformationMessage('✨ Code fix applied!');
                }
            } else {
                const panel = vscode.window.createWebviewPanel(
                    'codeSuggestion',
                    '🔧 Code Improvement',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );
    
                panel.webview.html = this._getCodeFixHtml(issues, improvements, formattedFixedCode, language);
    
                panel.webview.onDidReceiveMessage(async message => {
                    if (message.command === 'applyFix') {
                        await editor.edit(editBuilder => {
                            editBuilder.replace(selection, message.code);
                        });
                        this._setAnimation('happy');
                        vscode.window.showInformationMessage('✨ Code fix applied!');
                    }
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        } finally {
            this._setAnimation('nap');
        }
    }
    
    // This function sanitizes the code to avoid any markdown formatting issues (like ` ``` `)
    _sanitizeCode(code) {
        return code.replace(/```[a-z]+\n/g, '').replace(/\n```/g, '').trim();
    }
    
    // This function generates HTML for the panel view
    _getCodeFixHtml(issues, improvements, fixedCode, language) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Code Improvement</title>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 10px; }
                    .section { margin-bottom: 15px; }
                    .title { font-weight: bold; margin-bottom: 5px; }
                    .code { background: var(--vscode-editor-background); padding: 10px; border-radius: 5px; }
                    button { margin-top: 15px; padding: 8px 16px; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="section">
                    <div class="title">🔍 Issues Found:</div>
                    <div>${issues.replace(/\n/g, '<br>')}</div>
                </div>
                <div class="section">
                    <div class="title">💡 Improvements:</div>
                    <div>${improvements.replace(/\n/g, '<br>')}</div>
                </div>
                <div class="section">
                    <div class="title">✨ Fixed Code:</div>
                    <pre class="code">${fixedCode}</pre>
                </div>
                <button id="applyFix">Apply Fix</button>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('applyFix').addEventListener('click', () => {
                        vscode.postMessage({ command: 'applyFix', code: ${JSON.stringify(fixedCode)} });
                    });
                </script>
            </body>
            </html>
        `;
    }
    
    

    async _handleAIQuestion(question) {
        const config = vscode.workspace.getConfiguration('friendlyCodeAssistant');
        let apiKey = config.get('apiKey') || this._placeholderApiKey; // Use placeholder if no key is set

        if (!apiKey) {
            this._setAnimation('idle');
            await this._setupApiKey();
            return;
        }
    
        try {
            if (question.toLowerCase().includes('meow')) {
                this._setAnimation('happy');
                const responses = [
                    "Meow! 😺 I'm happy to help!",
                    "Purr... that's my favorite word! 🐱",
                    "Meow meow! Ready to code! 😸",
                    "Did someone say meow? I'm all ears! 😺"
                ];
                vscode.window.showInformationMessage(responses[Math.floor(Math.random() * responses.length)]);
                setTimeout(() => this._setAnimation('nap'), 3000);
                return;
            }
    
            this._setAnimation('working');
            const response = await this._getAIResponse(question, false);
            
            if (this._useNotifications) {
                vscode.window.showInformationMessage('🐱 ' + response);
            } else {
                const panel = vscode.window.createWebviewPanel(
                    'aiResponse',
                    '🐱 AI Response',
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );
    
                panel.webview.html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { 
                                padding: 15px; 
                                font-family: var(--vscode-font-family);
                                line-height: 1.5;
                            }
                            code {
                                background: var(--vscode-editor-background);
                                padding: 2px 5px;
                                border-radius: 3px;
                            }
                        </style>
                    </head>
                    <body>
                        ${response.replace(/\n/g, '<br>')}
                    </body>
                    </html>
                `;
            }
            
            setTimeout(() => this._setAnimation('nap'), 1000);
        } catch (error) {
            this._setAnimation('idle');
            throw error;
        }
    }
    

    async _getAIResponse(prompt, isCodeRelated = false) {
        const config = vscode.workspace.getConfiguration('friendlyCodeAssistant');
        let apiKey = config.get('apiKey') || this._placeholderApiKey; // Use placeholder if no key is set
    
        if (!apiKey) {
            throw new Error('Please set your API key first');
        }
    
        try {
            // Refined system prompt for clear, concise responses
            const systemPrompt = isCodeRelated
                ? 'You are a professional coding assistant. Provide concise, direct, and actionable advice on coding tasks or issues. Focus on key concepts and functionality.'
                : 'You are a helpful assistant. Provide brief, clear responses to the user\'s questions. Avoid unnecessary details and keep it professional.';
    
            const requestBody = {
                model: this._currentModel.startsWith('hf:') ? this._currentModel : `hf:${this._currentModel}`,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.5,  // Lower temperature for direct responses
                max_tokens: 150,  // Shorter responses
                stream: false
            };
    
            console.log('Making API request:', {
                url: 'https://glhf.chat/api/openai/v1/chat/completions',
                model: requestBody.model,
                messageCount: requestBody.messages.length
            });
    
            const response = await fetch('https://glhf.chat/api/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
    
            if (!response.ok) {
                const error = await response.json();
                console.error('API Error Response:', error);
                throw new Error(error.error?.message || 'API request failed');
            }
    
            const data = await response.json();
            if (!data.choices?.[0]?.message?.content) {
                console.error('Unexpected API Response:', data);
                throw new Error('Unexpected API response format');
            }
    
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API Error:', error);
            throw new Error(`AI request failed: ${error.message}`);
        }
    }
    
    

    _setAnimation(state) {
        this._currentAnimation = state;
        if (this._view) {
            this._view.webview.postMessage({ command: 'updateAnimation', state });
            
            // Return to napping after other animations
            if (state !== 'nap' && state !== 'idle') {
                setTimeout(() => {
                    this._setAnimation('nap');
                }, state === 'happy' ? 2000 : 1000);
            }
        }
    }

    _updateContent() {
        if (!this._view) return;

        const mediaPath = vscode.Uri.joinPath(this._context.extensionUri, 'media');
        const getGifPath = (name) => {
            let fileName;
            switch (name) {
                case 'nap':
                    fileName = 'nap.gif';  // Default state - sleeping cat
                    break;
                case 'idle':
                    fileName = 'cat-idle.gif';  // Awake and attentive
                    break;
                case 'working':
                    fileName = 'cat-thinking.gif';  // When processing
                    break;
                case 'happy':
                    fileName = 'cat-happy.gif';  // After success
                    break;
                default:
                    fileName = 'nap.gif';
            }
            return this._view.webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, fileName)).toString();
        };

        const gifs = {
            nap: getGifPath('nap'),
            idle: getGifPath('idle'),
            working: getGifPath('working'),
            happy: getGifPath('happy')
        };

        this._view.webview.html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        font-family: var(--vscode-font-family);
                        width: 100%;
                        box-sizing: border-box;
                        overflow-x: hidden;
                    }
                    .avatar-box {
                        width: min(300px, 90%);
                        height: min(300px, 90vw);
                        margin: 10px auto;
                        border: 2px solid var(--vscode-editor-foreground);
                        border-radius: 8px;
                        padding: 10px;
                        background: var(--vscode-editor-background);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        overflow: hidden;
                        position: relative;
                        box-sizing: border-box;
                        cursor: pointer;
                        user-select: none;
                        -webkit-user-select: none;
                    }
                    .avatar-box:hover {
                        border-color: var(--vscode-button-background);
                    }
                    .avatar {
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                        image-rendering: pixelated;
                    }
                    .chat-container {
                        width: min(400px, 95%);
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        margin: 0 auto;
                    }
                    .button-container {
                        display: flex;
                        justify-content: center;
                        gap: 6px;
                        margin-bottom: 8px;
                        flex-wrap: wrap;
                    }
                    .input-container {
                        display: flex;
                        gap: 6px;
                        flex-wrap: wrap;
                    }
                    input {
                        flex: 1;
                        min-width: 150px;
                        padding: 6px 12px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 4px;
                        font-size: 13px;
                    }
                    button {
                        padding: 6px 12px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        white-space: nowrap;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        min-width: fit-content;
                    }
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .debug-info {
                        margin-top: 8px;
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        text-align: center;
                        width: 100%;
                    }
                    @media (max-width: 300px) {
                        .button-container {
                            flex-direction: column;
                            align-items: stretch;
                        }
                        .input-container {
                            flex-direction: column;
                        }
                        button {
                            width: 100%;
                            justify-content: center;
                        }
                        input {
                            width: 100%;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="avatar-box">
                    <img id="avatar" src="${gifs.nap}" class="avatar" alt="AI Assistant">
                </div>
                <div class="chat-container">
                    <div class="button-container">
                        <button onclick="setupApiKey()">🔑 Set API Key</button>
                        <button onclick="selectModel()">🤖 Model</button>
                        <button onclick="toggleNotifications()"> 🔄Outputs</button>
                    </div>
                    <div class="button-container">
                        <button onclick="explainCode()">💡 Explain Code</button>
                        <button onclick="suggestFix()">🔧 Fix Code</button>
                    </div>
                    <div class="input-container">
                        <input type="text" id="question" placeholder="Ask me anything...">
                        <button onclick="askAI()">Ask</button>
                    </div>
                </div>
                <div id="debug-info" class="debug-info"></div>
                <script>
                    const vscode = acquireVsCodeApi();
                    let currentAnimation = 'nap';
                    let wakeTimeout = null;
                    const gifs = ${JSON.stringify(gifs)};
                    const avatarBox = document.querySelector('.avatar-box');
                    const avatar = document.getElementById('avatar');

                    // Wake up the cat when clicked
                    if (avatarBox) {
                        avatarBox.onclick = () => {
                            if (currentAnimation === 'nap') {
                                updateAnimation('idle');
                                vscode.postMessage({ command: 'wakeUp' });
                                if (wakeTimeout) clearTimeout(wakeTimeout);
                                wakeTimeout = setTimeout(() => {
                                    updateAnimation('nap');
                                    vscode.postMessage({ command: 'updateAnimation', state: 'nap' });
                                }, 3000);
                            }
                        };
                    }

                    function updateAnimation(state) {
                        currentAnimation = state;
                        if (avatar) {
                            avatar.src = gifs[state];
                        }
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateAnimation':
                                updateAnimation(message.state);
                                break;
                        }
                    });

                    // Handle Enter key in input
                    document.getElementById('question').addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            askAI();
                        }
                    });

                    function setupApiKey() {
                        vscode.postMessage({ command: 'setupApiKey' });
                    }

                    function selectModel() {
                        vscode.postMessage({ command: 'selectModel' });
                    }

                    function toggleNotifications() {
                        vscode.postMessage({ command: 'toggleNotifications' });
                    }

                    function explainCode() {
                        vscode.postMessage({ command: 'explainCode' });
                    }

                    function suggestFix() {
                        vscode.postMessage({ command: 'suggestFix' });
                    }

                    function askAI() {
                        const question = document.getElementById('question').value;
                        if (question.trim()) {
                            vscode.postMessage({ 
                                command: 'askAI',
                                question: question
                            });
                            document.getElementById('question').value = '';
                        }
                    }

                    avatar.onload = () => {
                        updateDebugInfo('Avatar loaded: ' + currentAnimation);
                    };
                    avatar.onerror = (e) => {
                        updateDebugInfo('Error loading avatar: ' + e.message);
                    };
                </script>
            </body>
            </html>
        `;
    }
}
function activate(context) {
    const sidebarProvider = new SidebarProvider(context);
    
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('friendly-code-assistant-sidebar', sidebarProvider)
    );

    // Register the command to set the API key
    context.subscriptions.push(
        vscode.commands.registerCommand('friendly-code-assistant.setApiKey', () => {
            sidebarProvider._setupApiKey();
        })
    );

    // Show a welcome message with setup instructions if API key is not set
    const config = vscode.workspace.getConfiguration('friendlyCodeAssistant');
    if (!config.get('apiKey')) {
        vscode.window.showInformationMessage(
            '😺 Welcome to Friendly Code Assistant! Set up your API key to get started.',
            'Set API Key'
        ).then(selection => {
            if (selection === 'Set API Key') {
                vscode.commands.executeCommand('friendly-code-assistant.setApiKey');
            }
        });
    }

    // Call the random cheering function at the end of the activation if you want it triggered just once.
    randomCheerMessages();
}

// Function to display random cheer or motivational messages
function randomCheerMessages() {
    const messages = [
        "🎉 Keep up the great work!",
        "💧 Don't forget to drink some water!",
        "🧘‍♂️ Take a break and relax for a while!",
        "✨ You're doing amazing, keep going!",
        "🌱 Don't forget to stretch, it's good for you!",
        "💪 You got this, keep coding!"
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    // Display random message in the IDE (notifications)
    vscode.window.showInformationMessage(randomMessage);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
