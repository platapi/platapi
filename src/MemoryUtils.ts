type GlobalWithGC = typeof globalThis & {
    gc?: () => void;
};

function shouldLogMemory() {
    return process.env.PLATAPI_DEBUG_MEMORY === "true" || process.env.PLATAPI_DEBUG_MEMORY === "1";
}

function formatMegabytes(bytes: number) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function collectGarbage() {
    (globalThis as GlobalWithGC).gc?.();
}

export function logMemory(label: string) {
    if (!shouldLogMemory()) {
        return;
    }

    const usage = process.memoryUsage();
    console.log(
        `[platapi:memory] ${label} rss=${formatMegabytes(usage.rss)} heapUsed=${formatMegabytes(usage.heapUsed)} heapTotal=${formatMegabytes(
            usage.heapTotal
        )}`
    );
}
