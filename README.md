# Kato Coding Buddy

A VS Code extension featuring a friendly AI coding assistant with an animated cat avatar, powered by GLHF.chat.

## Features

- Chat with an AI assistant directly in VS Code
- Cute animated cat avatar that reacts to interactions
- Simple and intuitive interface
- Secure API key storage
- Support for multiple AI models

## Setup

1. Install the extension from the VS Code marketplace
2. Get your API key from [GLHF.chat](https://glhf.chat)
3. Open VS Code settings and search for "Kato Coding Buddy"
4. Enter your GLHF.chat API key in the settings
5. Click the Heart icon in the sidebar to start chatting! 🐱

The extension will prompt you to enter your API key if it's not set when you try to use it.

## Usage

1. Open the sidebar by clicking the cat icon
2. Type your question in the input box
3. Press Enter or click "Ask" to get a response
4. Watch the cat avatar react while processing your question!

## Configuration

- Default AI model is set to Mistral
- You can change the model in settings
- Toggle between notification or panel responses

## Panel Commands

- **Set API Key Command**: Use the command ID `friendly-code-assistant.setApiKey` to set your API key for the extension.
- **Welcome Message**: If your API key is not set, a welcome message will guide you through the setup process.

## Running Locally

To run the extension locally, follow these steps:

1. **Install Dependencies**: Open your terminal and navigate to the project directory. Run the following command to install the necessary dependencies:
   ```bash
   npm install
   ```

2. **Package the Extension**: Use the Visual Studio Code Extension Manager (vsce) to package the extension. Run the following command:
   ```bash
   vsce package
   ```
   This will create a `.vsix` file in the project directory.

## Installing from VSIX

To install the extension from a `.vsix` file, follow these steps:

1. Open Visual Studio Code.
2. Open the Command Palette by pressing `Shift + Ctrl + P`.
3. Type and select `Extensions: Install from VSIX...`.
4. Select the `.vsix` file you packaged earlier.
5. After installation, open the Command Palette again by pressing `Shift + Ctrl + P`.
6. Type and select `Developer: Reload Window` to activate the extension.

## Using the Extension

Once the extension is installed and activated, click the Heart icon in the sidebar to start chatting with the AI assistant.

## Requirements

- VS Code 1.60.0 or higher
- GLHF.chat API key

## Author

Created by Haj