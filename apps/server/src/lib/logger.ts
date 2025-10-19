type LogLevel = "debug" | "info" | "warn" | "error";

type LogMethod = (message: string, meta?: Record<string, unknown>) => void;

export type Logger = Record<LogLevel, LogMethod>;

const consoleMethod: Record<LogLevel, typeof console.log> = {
	debug: console.debug.bind(console),
	info: console.info.bind(console),
	warn: console.warn.bind(console),
	error: console.error.bind(console),
};

export function createLogger(requestId: string): Logger {
	const format = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
		const payload = meta ? { requestId, ...meta } : { requestId };
		consoleMethod[level](`[${level.toUpperCase()}] ${message}`, payload);
	};

	return {
		debug: (message, meta) => format("debug", message, meta),
		info: (message, meta) => format("info", message, meta),
		warn: (message, meta) => format("warn", message, meta),
		error: (message, meta) => format("error", message, meta),
	};
}
