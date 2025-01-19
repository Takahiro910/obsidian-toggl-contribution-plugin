export interface Workspace {
    id: number;
    name: string;
    organization_id: number;
}

export interface Project {
    id: number;
    workspace_id: number;
    client_id: number;
    name: string;
    active: boolean;
    color: string;
}

export interface Client {
    id: number;
    workspace_id: number;
    name: string;
    active: boolean;
}

export interface TimeEntry {
    id: number;
    workspace_id: number;
    project_id: number;
    task_id: number;
    user_id: number;
    description: string;
    start: string;
    stop: string;
    duration: number;
    client_id: number | null;
}

export interface Project {
    id: number;
    workspace_id: number;
    client_id: number;
    name: string;
    active: boolean;
    color: string;
}

export interface Client {
    id: number;
    workspace_id: number;
    name: string;
    active: boolean;
}

export class TogglApiService {
    private baseUrl = 'https://api.track.toggl.com/api/v9';
    private headers: HeadersInit;

    constructor(private apiToken: string) {
        this.headers = {
            'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`,
            'Content-Type': 'application/json'
        };
    }

    async fetchWorkspaces(): Promise<Workspace[]> {
        try {
            const response = await fetch(`${this.baseUrl}/workspaces`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const workspaces: Workspace[] = await response.json();
            return workspaces;
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            throw error;
        }
    }

    async validateToken(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/me`, {
                method: 'GET',
                headers: this.headers
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async getTimeEntries(workspaceId: string, startDate: Date, endDate: Date): Promise<TimeEntry[]> {
        try {
            const startIso = startDate.toISOString();
            const endIso = endDate.toISOString();
            
            const url = new URL(`${this.baseUrl}/me/time_entries`);
            url.searchParams.append('start_date', startIso);
            url.searchParams.append('end_date', endIso);

            console.log('Fetching time entries from:', url.toString());

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const timeEntries: TimeEntry[] = await response.json();
            console.log('Raw time entries:', timeEntries); // デバッグ用
            
            // 型の比較を確認するためのデバッグログ
            if (timeEntries.length > 0) {
                console.log('Debug workspace ID comparison:', {
                    expectedId: workspaceId,
                    expectedIdType: typeof workspaceId,
                    firstEntryId: timeEntries[0].workspace_id,
                    firstEntryIdType: typeof timeEntries[0].workspace_id,
                });
            }

            // ワークスペースIDでフィルタリング（数値型に変換して比較）
            const filteredEntries = timeEntries.filter(entry => 
                entry.workspace_id === parseInt(workspaceId, 10)
            );
            console.log('Filtered time entries:', filteredEntries); // デバッグ用

            return filteredEntries;
        } catch (error) {
            console.error('Error fetching time entries:', error);
            throw error;
        }
    }

    async getProjects(workspaceId: string): Promise<Project[]> {
        try {
            const response = await fetch(`${this.baseUrl}/workspaces/${workspaceId}/projects`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching projects:', error);
            throw error;
        }
    }

    async getClients(workspaceId: string): Promise<Client[]> {
        try {
            const response = await fetch(`${this.baseUrl}/workspaces/${workspaceId}/clients`, {
                method: 'GET',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error fetching clients:', error);
            throw error;
        }
    }
}