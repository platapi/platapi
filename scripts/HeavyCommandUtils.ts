export function tokenizeNodeOptions(value?: string): string[] {
    if (!value) {
        return [];
    }

    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of value) {
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === " " && !inQuotes) {
            if (current) {
                parts.push(current);
                current = "";
            }
            continue;
        }

        current += char;
    }

    if (current) {
        parts.push(current);
    }

    return parts;
}

export function hasMaxOldSpaceSize(args: string[]) {
    return args.some(arg => /^--max[-_]old[-_]space[-_]size(?:=|$)/.test(arg));
}

export function getDefaultHeapSize(env: NodeJS.ProcessEnv = process.env, nodeVersion: string = process.versions.node) {
    const configuredHeap = env.PLATAPI_MAX_OLD_SPACE_SIZE;
    if (configuredHeap) {
        return configuredHeap;
    }

    const majorNodeVersion = Number(nodeVersion.split(".")[0]);
    return majorNodeVersion >= 22 ? "4096" : undefined;
}

export function buildBuildCommandArgs(options: { config: string; minify: boolean; sourcemap: boolean }) {
    return ["--config", options.config, ...(options.sourcemap ? ["--sourcemap"] : []), ...(options.minify ? [] : ["--no-minify"])];
}

export function getHeavyCommandExecArgs(options: {
    processExecArgv?: string[];
    maxOldSpaceSize?: string | number;
    nodeOptions?: string;
    scriptArgs: string[];
    scriptPath: string;
    tsxCliPath: string;
}) {
    const userNodeOptions = tokenizeNodeOptions(options.nodeOptions);
    const execArgv = [...userNodeOptions];

    if (options.maxOldSpaceSize && !hasMaxOldSpaceSize([...(options.processExecArgv ?? process.execArgv), ...userNodeOptions])) {
        execArgv.unshift(`--max-old-space-size=${options.maxOldSpaceSize}`);
    }

    return [...execArgv, options.tsxCliPath, options.scriptPath, ...options.scriptArgs];
}
