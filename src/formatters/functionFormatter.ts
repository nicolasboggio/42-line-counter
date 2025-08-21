// src/formatters/functionFormatter.ts

export interface FormatOptions {
    removeComments?: boolean;
    normalizeWhitespace?: boolean;
    removeEmptyLines?: boolean;
    preserveIndentation?: boolean;
    formatCFunctions?: boolean;
}

export class FunctionFormatter {
    
    private static readonly DEFAULT_OPTIONS: FormatOptions = {
        removeComments: true,
        normalizeWhitespace: true,
        removeEmptyLines: true,
        preserveIndentation: false,
        formatCFunctions: true
    };

    public static preprocessForCounting(code: string, options: FormatOptions = {}): string {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        let processedCode = code;

        if (opts.formatCFunctions) {
            processedCode = this.formatCFunctions(processedCode);
        }

        if (opts.removeComments) {
            processedCode = this.removeComments(processedCode);
        }

        if (opts.normalizeWhitespace) {
            processedCode = this.normalizeWhitespace(processedCode);
        }

        if (opts.removeEmptyLines) {
            processedCode = this.removeEmptyLines(processedCode);
        }

        return processedCode;
    }

    public static formatCFunctions(code: string): string {
        const lines = code.split('\n');
        const result: string[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || 
                trimmedLine.startsWith('*') || trimmedLine === '' ||
                trimmedLine.startsWith('#')) {
                result.push(line);
                continue;
            }
            
            if (this.isFunctionSignatureWithBrace(line)) {
                const formatted = this.formatFunctionLine(line);
                result.push(...formatted);
            }
            else if (this.isEmptyBraceBlock(line)) {
                const formatted = this.formatEmptyBraceBlock(line);
                result.push(...formatted);
            }
            else if (this.hasClosingBraceWithContent(line)) {
                const formatted = this.formatClosingBraceLine(line);
                result.push(...formatted);
            }
            else {
                result.push(line);
            }
        }
        
        return result.join('\n');
    }
    
    private static hasClosingBraceWithContent(line: string): boolean {
        const trimmed = line.trim();
        
        if (!trimmed.endsWith('}')) {
            return false;
        }
        
        if (trimmed === '}') {
            return false;
        }
        
        if (trimmed === '{}') {
            return false;
        }
        
        const contentBeforeBrace = trimmed.substring(0, trimmed.length - 1).trim();
        return contentBeforeBrace.length > 0;
    }
    
    private static formatClosingBraceLine(line: string): string[] {
        const trimmed = line.trim();
        
        const contentBeforeBrace = trimmed.substring(0, trimmed.length - 1).trim();
        
        const originalIndent = line.match(/^\s*/)?.[0] || '';
        
        let closingBraceIndent = originalIndent;
        if (originalIndent.endsWith('\t')) {
            closingBraceIndent = originalIndent.substring(0, originalIndent.length - 1);
        } else if (originalIndent.endsWith('    ')) {
            closingBraceIndent = originalIndent.substring(0, originalIndent.length - 4);
        } else if (originalIndent.length > 0) {
            closingBraceIndent = originalIndent.substring(0, originalIndent.length - 1);
        }
        
        return [
            originalIndent + contentBeforeBrace,
            closingBraceIndent + '}'
        ];
    }
    
    private static isEmptyBraceBlock(line: string): boolean {
        const trimmed = line.trim();
        
        const emptyBracePattern = /^\{\s*\}$/;
        return emptyBracePattern.test(trimmed);
    }
    
    private static formatEmptyBraceBlock(line: string): string[] {
        const originalIndent = line.match(/^\s*/)?.[0] || '';
        
        return [
            originalIndent + '{',
            originalIndent + '}'
        ];
    }
    
    private static isFunctionSignatureWithBrace(line: string): boolean {
        const trimmed = line.trim();
        
        if (!trimmed.includes('{')) {
            return false;
        }
        
        if (trimmed === '{' || trimmed.startsWith('{')) {
            return false;
        }
        
        if (!trimmed.includes('(') || !trimmed.includes(')')) {
            return false;
        }
        
        const openParenIndex = trimmed.indexOf('(');
        const closeParenIndex = trimmed.indexOf(')', openParenIndex);
        const braceIndex = trimmed.indexOf('{');
        
        if (closeParenIndex === -1 || braceIndex === -1 || closeParenIndex >= braceIndex) {
            return false;
        }
        
        const beforeParen = trimmed.substring(0, openParenIndex).trim();
        const words = beforeParen.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) {
            return false;
        }
        
        const lastWord = words[words.length - 1];
        const controlKeywords = ['if', 'while', 'for', 'switch', 'return', 'sizeof'];
        
        return !controlKeywords.includes(lastWord);
    }
    
    private static formatFunctionLine(line: string): string[] {
        const trimmed = line.trim();
        const openBraceIndex = trimmed.indexOf('{');
        
        if (openBraceIndex === -1) {
            return [line];
        }
        
        const signature = trimmed.substring(0, openBraceIndex).trim();
        
        const afterBrace = trimmed.substring(openBraceIndex + 1);
        
        const originalIndent = line.match(/^\s*/)?.[0] || '';
        
        const result: string[] = [];
        
        result.push(originalIndent + signature);
        
        if (afterBrace.trim() === '') {
            result.push(originalIndent + '{');
        } else if (afterBrace.trim() === '}') {
            result.push(originalIndent + '{');
            result.push(originalIndent + '}');
        } else {
            result.push(originalIndent + '{');
            
            if (afterBrace.includes('}')) {
                const lastBraceIndex = afterBrace.lastIndexOf('}');
                const content = afterBrace.substring(0, lastBraceIndex).trim();
                const afterCloseBrace = afterBrace.substring(lastBraceIndex + 1).trim();
                
                if (content) {
                    const statements = content.split(';').filter(s => s.trim());
                    
                    statements.forEach(statement => {
                        if (statement.trim()) {
                            result.push(originalIndent + '\t' + statement.trim() + ';');
                        }
                    });
                }
                
                let closingBraceIndent = originalIndent;
                result.push(closingBraceIndent + '}');
                
                if (afterCloseBrace) {
                    result.push(originalIndent + afterCloseBrace);
                }
            } else {
                result.push(originalIndent + '\t' + afterBrace.trim());
            }
        }
        
        return result;
    }

    public static formatSingleCFunction(functionCode: string): string {
        let formatted = functionCode.trim();
        
        const lines = formatted.split('\n');
        const signatureLine = lines[0];
        
        if (signatureLine.includes('{')) {
            const [signature, ...rest] = signatureLine.split('{');
            const bodyContent = rest.join('{') + '\n' + lines.slice(1).join('\n');
            
            formatted = `${signature.trim()}\n{${bodyContent}`;
        }
        
        return formatted;
    }

    public static removeComments(code: string): string {
        return code
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/<!--[\s\S]*?-->/g, '');
    }

    public static normalizeWhitespace(code: string): string {
        return code
            .replace(/[ \t]+/g, ' ')
            .replace(/\r\n|\r/g, '\n')
            .replace(/[ \t]+$/gm, '');
    }

    public static removeEmptyLines(code: string): string {
        return code
            .split('\n')
            .filter(line => line.trim().length > 0)
            .join('\n');
    }

    public static countSignificantLines(code: string): number {
        const processedCode = this.preprocessForCounting(code);
        return processedCode.split('\n').length;
    }

    public static analyzeCode(code: string): {
        totalLines: number;
        codeLines: number;
        commentLines: number;
        emptyLines: number;
    } {
        const lines = code.split('\n');
        let codeLines = 0;
        let commentLines = 0;
        let emptyLines = 0;

        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.length === 0) {
                emptyLines++;
            } else if (this.isCommentLine(trimmedLine)) {
                commentLines++;
            } else {
                codeLines++;
            }
        }

        return {
            totalLines: lines.length,
            codeLines,
            commentLines,
            emptyLines
        };
    }

    public static analyzeCCode(code: string): {
        totalLines: number;
        codeLines: number;
        commentLines: number;
        emptyLines: number;
        functionCount: number;
        functionsFormatted: number;
    } {
        const basicAnalysis = this.analyzeCode(code);
        
        const lines = code.split('\n');
        let functionCount = 0;
        let functionsFormatted = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('//') || line.startsWith('/*') || 
                line.startsWith('*') || line === '' || line.startsWith('#')) {
                continue;
            }
            
            if (this.isFunctionSignature(line)) {
                functionCount++;
                
                if (!line.includes('{')) {
                    if (i + 1 < lines.length && lines[i + 1].trim() === '{') {
                        functionsFormatted++;
                    }
                } else {
                }
            }
        }
        
        return {
            ...basicAnalysis,
            functionCount,
            functionsFormatted
        };
    }
    
    private static isFunctionSignature(line: string): boolean {
        const trimmed = line.trim();
        
        if (!trimmed.includes('(') || !trimmed.includes(')')) {
            return false;
        }
        
        const controlKeywords = ['if', 'while', 'for', 'switch', 'return', 'sizeof', 'printf', 'write'];
        for (const keyword of controlKeywords) {
            if (trimmed.startsWith(keyword + ' ') || trimmed.startsWith(keyword + '(')) {
                return false;
            }
        }
        
        if (!trimmed.includes(' ') && trimmed.includes('(')) {
            return false;
        }
        
        const functionPattern = /^[\s\w*]*\s+\w+\s*\([^)]*\)\s*\{?$/;
        return functionPattern.test(trimmed);
    }

    public static isAllmanStyleCompliant(code: string): boolean {
        const analysis = this.analyzeCCode(code);
        return analysis.functionCount === analysis.functionsFormatted;
    }

    private static isCommentLine(line: string): boolean {
        return line.startsWith('//') || 
               line.startsWith('/*') || 
               line.startsWith('*') ||
               line.startsWith('<!--');
    }
}