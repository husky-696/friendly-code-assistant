const assert = require('assert');
const vscode = require('vscode');
const myExtension = require('../extension');

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('friendly-code-assistant'));
    });

    test('Should activate', function() {
        this.timeout(1500);
        return vscode.extensions.getExtension('friendly-code-assistant')
            .activate()
            .then((api) => {
                assert.ok(true);
            });
    });
});