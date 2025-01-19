interface CacheItem<T> {
    data: T;
    timestamp: number;
}

export class TogglCache {
    private cache: Map<string, CacheItem<any>>;
    private readonly timeoutMinutes: number;

    constructor(timeoutMinutes: number) {
        this.cache = new Map();
        this.timeoutMinutes = timeoutMinutes;
    }

    get<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (!item) return null;

        const now = Date.now();
        if (now - item.timestamp > this.timeoutMinutes * 60 * 1000) {
            this.cache.delete(key);
            return null;
        }

        return item.data as T;
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear(): void {
        this.cache.clear();
    }

    generateTimeEntriesKey(workspaceId: string, startDate: Date, endDate: Date): string {
        return `timeEntries:${workspaceId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    }

    generateProjectsKey(workspaceId: string): string {
        return `projects:${workspaceId}`;
    }

    generateClientsKey(workspaceId: string): string {
        return `clients:${workspaceId}`;
    }
}