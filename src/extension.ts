import * as vscode from 'vscode';
import { FunctionFormatter } from './formatters/functionFormatter';

export function activate(context: vscode.ExtensionContext) {
    
    let disposable = vscode.commands.registerCommand('42-line-counter.countLines', () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const text = document.getText();

        if (!document.fileName.endsWith('.c') && !document.fileName.endsWith('.h')) {
            vscode.window.showWarningMessage('This extension works only with C files (.c or .h)');
            return;
        }

        try {
            
            console.log('Formatage des fonctions C...');
            const formattedText = FunctionFormatter.formatCFunctions(text);
            
            
            const modifiedText = processDocument(formattedText);

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );

            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, modifiedText);
            }).then(success => {
                if (success) {
                    
                    const analysis = FunctionFormatter.analyzeCCode(modifiedText);
                    const formatInfo = analysis.functionsFormatted === analysis.functionCount 
                        ? `✅ ${analysis.functionCount} fonction(s) formatée(s) correctement` 
                        : `⚠️ ${analysis.functionsFormatted}/${analysis.functionCount} fonction(s) formatée(s)`;
                    
                    vscode.window.showInformationMessage(
                        `Line counts updated successfully! ${formatInfo}`
                    );
                } else {
                    vscode.window.showErrorMessage('Failed to update line counts');
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error processing document: ${error}`);
        }
    });

    
    let formatDisposable = vscode.commands.registerCommand('42-line-counter.formatOnly', () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const text = document.getText();

        if (!document.fileName.endsWith('.c') && !document.fileName.endsWith('.h')) {
            vscode.window.showWarningMessage('This extension works only with C files (.c or .h)');
            return;
        }

        try {
            
            const formattedText = FunctionFormatter.formatCFunctions(text);
            
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );

            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, formattedText);
            }).then(success => {
                if (success) {
                    const analysis = FunctionFormatter.analyzeCCode(formattedText);
                    vscode.window.showInformationMessage(
                        `🎯 ${analysis.functionCount} fonction(s) formatée(s) en style Allman !`
                    );
                } else {
                    vscode.window.showErrorMessage('Failed to format functions');
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error formatting functions: ${error}`);
        }
    });
    
    let removeDisposable = vscode.commands.registerCommand('42-line-counter.removeComments', () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const text = document.getText();

        try {
            const cleanedText = removeLineCountComments(text);

            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );

            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, cleanedText);
            }).then(success => {
                if (success) {
                    vscode.window.showInformationMessage('Line count comments removed successfully!');
                } else {
                    vscode.window.showErrorMessage('Failed to remove line count comments');
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`Error removing comments: ${error}`);
        }
    });

    
    let analyzeDisposable = vscode.commands.registerCommand('42-line-counter.analyzeStyle', () => {
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
            vscode.window.showErrorMessage('No active editor found');
            return;
        }

        const document = editor.document;
        const text = document.getText();

        if (!document.fileName.endsWith('.c') && !document.fileName.endsWith('.h')) {
            vscode.window.showWarningMessage('This extension works only with C files (.c or .h)');
            return;
        }

        try {
            const analysis = FunctionFormatter.analyzeCCode(text);
            const isCompliant = FunctionFormatter.isAllmanStyleCompliant(text);
            
            const statusIcon = isCompliant ? '✅' : '❌';
            const styleStatus = isCompliant ? 'Style Allman respecté' : 'Style Allman non respecté';
            
            vscode.window.showInformationMessage(
                `📊 Code Analysis: ${analysis.functionCount} fonctions | ` +
                `${analysis.functionsFormatted} bien formatées | ` +
                `${statusIcon} ${styleStatus}`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Error analyzing code: ${error}`);
        }
    });

    context.subscriptions.push(disposable, formatDisposable, removeDisposable, analyzeDisposable);
}

function detectFunctionStart(line: string): boolean {
    const cleanLine = line.replace(/\r/g, '').trim();

    if (!cleanLine || cleanLine.startsWith('//') || cleanLine.startsWith('/*') ||
        cleanLine.startsWith('*') || cleanLine.startsWith('#')) {
        return false;
    }

    if (cleanLine.startsWith('typedef struct') || cleanLine.startsWith('typedef enum') ||
        cleanLine.startsWith('typedef union') || cleanLine.startsWith('typedef ') ||
        (cleanLine.startsWith('struct') && !cleanLine.includes('(')) ||
        (cleanLine.startsWith('enum') && !cleanLine.includes('(')) ||
        (cleanLine.startsWith('union') && !cleanLine.includes('('))) {
        return false;
    }

    if (cleanLine.endsWith(';')) {
        return false;
    }

    return isValidFunctionSignature(cleanLine);
}

function detectFunctionStartMultiline(lines: string[], startIndex: number): boolean {
    const cleanLine = lines[startIndex].replace(/\r/g, '').trim();

    if (!cleanLine || cleanLine.startsWith('//') || cleanLine.startsWith('/*') ||
        cleanLine.startsWith('*') || cleanLine.startsWith('#')) {
        return false;
    }

    if (cleanLine.startsWith('typedef struct') || cleanLine.startsWith('typedef enum') ||
        cleanLine.startsWith('typedef union') || cleanLine.startsWith('typedef ') ||
        (cleanLine.startsWith('struct') && !cleanLine.includes('(')) ||
        (cleanLine.startsWith('enum') && !cleanLine.includes('(')) ||
        (cleanLine.startsWith('union') && !cleanLine.includes('('))) {
        return false;
    }

    let fullSignature = '';
    let currentIndex = startIndex;
    let foundClosingParen = false;

    while (currentIndex < lines.length && currentIndex < startIndex + 10 && !foundClosingParen) {
        const currentLine = lines[currentIndex].replace(/\r/g, '').trim();
        
        if (currentLine.startsWith('//') || currentLine.startsWith('/*')) {
            currentIndex++;
            continue;
        }

        fullSignature += ' ' + currentLine;
        
        let parenCount = 0;
        for (let char of fullSignature) {
            if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
        }
        
        if (parenCount === 0 && fullSignature.includes('(')) {
            foundClosingParen = true;
        }
        
        currentIndex++;
    }

    if (!foundClosingParen) {
        return false;
    }

    const trimmedSignature = fullSignature.trim();
    if (trimmedSignature.endsWith(';')) {
        return false;
    }

    return isValidFunctionSignature(trimmedSignature);
}

function isValidFunctionSignature(line: string): boolean {
    const match = line.match(/(\w+)\s*\(/);
    if (!match) {
        return false;
    }

    const functionNameIndex = match.index!;
    const beforeFunction = line.substring(0, functionNameIndex).trim();
    if (!beforeFunction) {
        return false;
    }

    const invalidStarters = ['if', 'while', 'for', 'switch', 'return', 'sizeof'];
    if (invalidStarters.some(keyword => beforeFunction.endsWith(keyword))) {
        return false;
    }

    const openParenIndex = line.indexOf('(', functionNameIndex);
    if (openParenIndex === -1) {
        return false;
    }

    let parenCount = 0;
    let closeParenIndex = -1;
    
    for (let i = openParenIndex; i < line.length; i++) {
        if (line[i] === '(') {
            parenCount++;
        } else if (line[i] === ')') {
            parenCount--;
            if (parenCount === 0) {
                closeParenIndex = i;
                break;
            }
        }
    }

    if (closeParenIndex === -1) {
        return false;
    }

    const afterParams = line.substring(closeParenIndex + 1).trim();
    return afterParams === '' || afterParams.startsWith('{');
}

function processDocument(text: string): string {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const functionMatch = detectFunctionStart(line);
        const multiFunctionMatch = !functionMatch ? detectFunctionStartMultiline(lines, i) : false;

        if (functionMatch || multiFunctionMatch) {
            const functionInfo = extractFunctionBody(lines, i);

            if (functionInfo) {
                const { endLine, lineCount } = functionInfo;

                while (result.length > 0 &&
                    (isLineCountComment(result[result.length - 1]) ||
                        result[result.length - 1].trim() === '')) {
                    result.pop();
                }

                const commentPrefix = '// »»-----►';
                const comment = `${commentPrefix} Number of lines: ${lineCount}`;
                result.push(comment);

                for (let j = i; j <= endLine; j++) {
                    result.push(lines[j]);
                }

                i = endLine;
            } else {
                result.push(line);
            }
        } else {
            if (!isLineCountComment(line)) {
                result.push(line);
            }
        }
    }

    return result.join('\n');
}

function extractFunctionBody(lines: string[], startLine: number): { endLine: number; lineCount: number } | null {
    let braceCount = 0;
    let foundOpenBrace = false;
    let currentLine = startLine;

    while (currentLine < lines.length) {
        const line = lines[currentLine].replace(/\r/g, '');
        
        let inString = false;
        let inChar = false;
        let inLineComment = false;
        let inBlockComment = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = i < line.length - 1 ? line[i + 1] : '';
            
            if (!inString && !inChar && !inBlockComment && char === '/' && nextChar === '/') {
                inLineComment = true;
                i++;
                continue;
            }
            
            if (!inString && !inChar && !inLineComment && char === '/' && nextChar === '*') {
                inBlockComment = true;
                i++;
                continue;
            }
            
            if (inBlockComment && char === '*' && nextChar === '/') {
                inBlockComment = false;
                i++;
                continue;
            }
            
            if (inLineComment || inBlockComment) {
                continue;
            }
            
            if (char === '"' && !inChar) {
                if (!inString) {
                    inString = true;
                } else {
                    let escapeCount = 0;
                    let j = i - 1;
                    while (j >= 0 && line[j] === '\\') {
                        escapeCount++;
                        j--;
                    }
                    
                    if (escapeCount % 2 === 0) {
                        inString = false;
                    }
                }
                continue;
            }
            
            if (char === "'" && !inString) {
                if (!inChar) {
                    inChar = true;
                } else {
                    let escapeCount = 0;
                    let j = i - 1;
                    while (j >= 0 && line[j] === '\\') {
                        escapeCount++;
                        j--;
                    }
                    
                    if (escapeCount % 2 === 0) {
                        inChar = false;
                    }
                }
                continue;
            }
            
            if (!inString && !inChar) {
                if (char === '{') {
                    braceCount++;
                    foundOpenBrace = true;
                } else if (char === '}') {
                    braceCount--;
                    if (foundOpenBrace && braceCount === 0) {
                        const lineCount = countCodeLines(lines, startLine, currentLine);
                        return { endLine: currentLine, lineCount };
                    }
                }
            }
        }
        
        currentLine++;
        
        if (!foundOpenBrace && currentLine - startLine > 10) {
            break;
        }
    }

    return null;
}

function countCodeLines(lines: string[], startLine: number, endLine: number): number {
    let count = 0;
    let inBlockComment = false;
    let foundFirstBrace = false;

    
    
    let hasAnyCode = false;
    for (let i = startLine; i <= endLine; i++) {
        const line = lines[i].replace(/\r/g, '').trim();
        
        
        if (i === startLine) continue;
        
        
        if (line === '{' || line === '}' || line === '{ }') continue;
        
        
        if (line.startsWith('//') || line === '') continue;
        
        
        if (line.includes('/*') && line.includes('*/')) continue;
        
        
        hasAnyCode = true;
        break;
    }

    
    if (!hasAnyCode) {
        return 0;
    }

    for (let i = startLine; i <= endLine; i++) {
        let line = lines[i].replace(/\r/g, '');
        let originalLine = line.trim();

        if (!inBlockComment && originalLine.includes('/*')) {
            inBlockComment = true;
            const beforeComment = originalLine.split('/*')[0].trim();
            if (beforeComment.length > 0 && foundFirstBrace) {
                count++;
            }
            continue;
        }
        if (inBlockComment) {
            if (originalLine.includes('*/')) {
                inBlockComment = false;
                const afterComment = originalLine.split('*/')[1];
                if (afterComment && afterComment.trim().length > 0 && foundFirstBrace) {
                    count++;
                }
            }
            continue;
        }

        if (originalLine.startsWith('//')) continue;

        let codePart = originalLine;
        if (codePart.includes('//')) {
            codePart = codePart.split('//')[0].trim();
        }

        if (i === startLine) {
            if (codePart.includes('{')) {
                foundFirstBrace = true;
                if (codePart.includes('}')) {
                    const match = codePart.match(/\{([^}]*)\}/);
                    if (match) {
                        const content = match[1].trim();
                        if (content.length > 0) {
                            count = 1;
                        } else {
                            count = 0;
                        }
                    }
                    return count;
                }
                
                const afterBrace = codePart.split('{')[1];
                if (afterBrace && afterBrace.trim().length > 0) {
                    count++;
                }
            }
            continue;
        }

        if (!foundFirstBrace) {
            if (codePart.includes('{')) {
                foundFirstBrace = true;
                const afterBrace = codePart.split('{')[1];
                if (afterBrace && afterBrace.trim().length > 0) {
                    count++;
                }
            }
            continue;
        }

        if (i === endLine && codePart === '}') {
            continue;
        }

        if (originalLine.length === 0) {
            count++;
        } else if (codePart.length > 0) {
            count++;
        }
    }

    return count;
}

function isLineCountComment(line: string): boolean {
    const trimmed = line.replace(/\r/g, '').trim();
    return trimmed.startsWith('// »»-----►');
}

function removeLineCountComments(text: string): string {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    const result: string[] = [];

    for (const line of lines) {
        if (!isLineCountComment(line)) {
            result.push(line);
        }
    }

    return result.join('\n');
}

export function deactivate() {}