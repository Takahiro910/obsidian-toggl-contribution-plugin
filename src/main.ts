import { App, Plugin, PluginSettingTab, Setting, Notice } from 'obsidian';
import { TogglApiService, TimeEntry } from './toggl-api';
import { TogglCache } from './toggl-cache';
import { ContributionGraph, DayData } from './contribution-graph';

interface TogglPluginSettings {
    apiToken: string;
    workspaceId: string;
    workspaceName: string;
    cacheTimeout: number;
}

const DEFAULT_SETTINGS: TogglPluginSettings = {
    apiToken: '',
    workspaceId: '',
    workspaceName: '',
    cacheTimeout: 5
}

export default class TogglPlugin extends Plugin {
    settings: TogglPluginSettings;
    apiService: TogglApiService;
    cache: TogglCache;

    async onload() {
        await this.loadSettings();
        
        if (this.settings.apiToken) {
            this.apiService = new TogglApiService(this.settings.apiToken);
        }
        
        this.cache = new TogglCache(this.settings.cacheTimeout);
        
        // Register Settings Tab
        this.addSettingTab(new TogglSettingTab(this.app, this));
        
        // Register Code Block Processor
        this.registerMarkdownCodeBlockProcessor('toggl-graph', async (source, el, ctx) => {
            try {
                const config = this.parseCodeBlockConfig(source);
                
                if (!this.settings.apiToken || !this.settings.workspaceId) {
                    el.createEl('div', { text: 'Please configure Toggl API token and workspace in settings.' });
                    return;
                }

                // Get time entries
                const timeEntries = await this.getTimeEntriesWithCache(
                    this.settings.workspaceId,
                    config.start,
                    config.end
                );

                // Get projects
                const projects = await this.apiService.getProjects(this.settings.workspaceId);

                // Process data for the graph
                const dailyData = this.processDailyData(timeEntries, config.start, config.end);
                const maxMinutes = Math.max(...dailyData.map(d => d.minutes));

                // Create graph container
                const graphContainer = el.createDiv({ cls: 'toggl-contribution-graph' });
                
                // Render graph
                const graph = new ContributionGraph(graphContainer, dailyData, maxMinutes, projects);
                graph.render();

            } catch (error) {
                console.error('Error rendering Toggl graph:', error);
                el.createEl('div', { text: 'Error rendering Toggl graph. Check console for details.' });
            }
        });
    }

    private parseCodeBlockConfig(source: string) {
        const lines = source.split('\n');
        const config: any = {
            start: new Date(),
            end: new Date()
        };

        lines.forEach(line => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key === 'start') {
                config.start = new Date(value);
            } else if (key === 'end') {
                config.end = new Date(value);
            }
        });

        return config;
    }

    private async getTimeEntriesWithCache(workspaceId: string, startDate: Date, endDate: Date) {
        const cacheKey = this.cache.generateTimeEntriesKey(workspaceId, startDate, endDate);
        let timeEntries = this.cache.get<TimeEntry[]>(cacheKey);

        if (!timeEntries) {
            timeEntries = await this.apiService.getTimeEntries(workspaceId, startDate, endDate);
            this.cache.set(cacheKey, timeEntries);
        }

        return timeEntries;
    }

    // private processDailyData(timeEntries: TimeEntry[], startDate: Date, endDate: Date): DayData[] {
    //     const dailyData: DayData[] = [];
    //     const currentDate = new Date(startDate);

    //     while (currentDate <= endDate) {
    //         // 現在の日付をYYYY-MM-DD形式で取得
    //         const currentDateStr = currentDate.toISOString().split('T')[0];

    //         const dayEntries = timeEntries.filter(entry => {
    //             // UTCのタイムスタンプを9時間進めてJSTに変換
    //             const entryStartUTC = new Date(entry.start);
    //             const entryStartJST = new Date(entryStartUTC.getTime() + (9 * 60 * 60 * 1000));
    //             const entryDateStr = entryStartJST.toISOString().split('T')[0];

    //             return entryDateStr === currentDateStr;
    //         }).map(entry => {
    //             const entryStartUTC = new Date(entry.start);
    //             const entryStartJST = new Date(entryStartUTC.getTime() + (9 * 60 * 60 * 1000));
                
    //             return {
    //                 original: entry,
    //                 jst: {
    //                     start: entryStartJST,
    //                     description: entry.description,
    //                     duration: entry.duration,
    //                     project_id: entry.project_id
    //                 }
    //             };
    //         });

    //         const totalMinutes = dayEntries.reduce((total, entry) => {
    //             let duration = entry.original.duration;
    //             if (duration < 0) {
    //                 duration = Math.floor(Date.now() / 1000) + duration;
    //             }
    //             return total + Math.floor(duration / 60);
    //         }, 0);

    //         dailyData.push({
    //             date: new Date(currentDate),
    //             minutes: totalMinutes,
    //             entries: dayEntries
    //         });

    //         currentDate.setDate(currentDate.getDate() + 1);
    //     }

    //     return dailyData;
    // }

    private processDailyData(timeEntries: TimeEntry[], startDate: Date, endDate: Date): DayData[] {
        const dailyData: DayData[] = [];
        const currentDate = new Date(startDate);
    
        while (currentDate <= endDate) {
            const currentDateStr = currentDate.toISOString().split('T')[0];
    
            // const dayEntries = timeEntries.filter(entry => {
            //     // UTCのタイムスタンプを9時間進めてJSTに変換 (ここで1回だけ実行)
            //     const entryStartJST = new Date(new Date(entry.start).getTime() + (9 * 60 * 60 * 1000));
            //     const entryDateStr = entryStartJST.toISOString().split('T')[0];
            //     return entryDateStr === currentDateStr;
            // }).map(entry => {
            //     // // フィルタリング時に変換した entryStartJST を使用する
            //     const entryStartJST = new Date(new Date(entry.start).getTime() + (9 * 60 * 60 * 1000)); 
            //     return {
            //         original: entry,
            //         jst: {
            //             start: entryStartJST,
            //             description: entry.description,
            //             duration: entry.duration,
            //             project_id: entry.project_id
            //         }
            //     };
            // });

            // const dayEntries = timeEntries.filter(entry => {
            //     // entry.start (文字列) から Date オブジェクトを生成。これはシステムのタイムゾーンで解釈される (つまりJST)
            //     const entryStartJST = new Date(entry.start);
            //     const entryDateStr = entryStartJST.toISOString().split('T')[0];
            //     return entryDateStr === currentDateStr;
            // }).map(entry => {
            //     // 同様に、システムのタイムゾーンで解釈された Date オブジェクトを生成
            //     const entryStartJST = new Date(entry.start);
            //     return {
            //         original: entry,
            //         jst: {
            //             start: entryStartJST,
            //             description: entry.description,
            //             duration: entry.duration,
            //             project_id: entry.project_id
            //         }
            //     };
            // });

            const dayEntries = timeEntries.filter(entry => {
                const entryStartJST = new Date(entry.start);
                const entryDateStr = `${entryStartJST.getFullYear()}-${(entryStartJST.getMonth() + 1).toString().padStart(2, '0')}-${entryStartJST.getDate().toString().padStart(2, '0')}`;
                return entryDateStr === currentDateStr;
            }).map(entry => {
                const entryStartJST = new Date(entry.start);
                return {
                    original: entry,
                    jst: {
                        start: entryStartJST,
                        description: entry.description,
                        duration: entry.duration,
                        project_id: entry.project_id
                    }
                };
            });
    
            const totalMinutes = dayEntries.reduce((total, entry) => {
                let duration = entry.original.duration;
                if (duration < 0) {
                    duration = Math.floor(Date.now() / 1000) + duration;
                }
                return total + Math.floor(duration / 60);
            }, 0);
    
            dailyData.push({
                date: new Date(currentDate),
                minutes: totalMinutes,
                entries: dayEntries
            });
    
            currentDate.setDate(currentDate.getDate() + 1);
        }
    
        return dailyData;
    }

    getApiService(): TogglApiService {
        if (!this.apiService && this.settings.apiToken) {
            this.apiService = new TogglApiService(this.settings.apiToken);
        }
        return this.apiService;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class TogglSettingTab extends PluginSettingTab {
    plugin: TogglPlugin;

    constructor(app: App, plugin: TogglPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // API Token Setting
        new Setting(containerEl)
            .setName('Toggl API Token')
            .setDesc('Your Toggl Track API token')
            .addText(text => text
                .setPlaceholder('Enter your API token')
                .setValue(this.plugin.settings.apiToken)
                .onChange(async (value) => {
                    this.plugin.settings.apiToken = value;
                    await this.plugin.saveSettings();
                    
                    if (value) {
                        this.plugin.apiService = new TogglApiService(value);
                        await this.loadWorkspaces();
                    }
                }));

        // Workspace Setting
        const workspaceSetting = new Setting(containerEl)
            .setName('Workspace')
            .setDesc('Select your Toggl Track workspace');

        // Create workspace dropdown
        workspaceSetting.addDropdown(async (dropdown) => {
            dropdown.selectEl.style.width = '100%';
            dropdown
                .addOption('', 'Select a workspace')
                .setValue(this.plugin.settings.workspaceId)
                .onChange(async (value) => {
                    console.log('Selected workspace ID:', value);
                    this.plugin.settings.workspaceId = value;
                    await this.plugin.saveSettings();
                });
        });

        // Load workspaces if API token exists
        if (this.plugin.settings.apiToken) {
            this.loadWorkspaces();
        }

        // Cache Timeout Setting
        new Setting(containerEl)
            .setName('Cache Timeout')
            .setDesc('Time in minutes before refreshing data from Toggl (minimum: 1)')
            .addText(text => text
                .setPlaceholder('5')
                .setValue(String(this.plugin.settings.cacheTimeout))
                .onChange(async (value) => {
                    const timeout = parseInt(value) || 5;
                    this.plugin.settings.cacheTimeout = Math.max(1, timeout);
                    await this.plugin.saveSettings();
                }));
    }

    async loadWorkspaces(): Promise<void> {
        try {
            const workspaces = await this.plugin.getApiService().fetchWorkspaces();
            console.log('Fetched workspaces:', workspaces);

            const dropdownSetting = this.containerEl.querySelector('.dropdown') as HTMLSelectElement;
            
            if (dropdownSetting) {
                // Clear existing options
                dropdownSetting.innerHTML = '';
                
                // Add placeholder option
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.text = 'Select a workspace';
                placeholder.disabled = true;
                placeholder.selected = !this.plugin.settings.workspaceId;
                dropdownSetting.appendChild(placeholder);
                
                // Add workspace options
                workspaces.forEach(workspace => {
                    const option = document.createElement('option');
                    option.value = workspace.id.toString();
                    option.text = workspace.name;
                    option.selected = this.plugin.settings.workspaceId === workspace.id.toString();
                    dropdownSetting.appendChild(option);
                });
            }
        } catch (error) {
            new Notice('Failed to load workspaces. Please check your API token.');
            console.error('Error loading workspaces:', error);
        }
    }
}