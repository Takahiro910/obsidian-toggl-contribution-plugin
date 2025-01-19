import { TimeEntry, Project, Client } from './toggl-api';

export interface DayData {
    date: Date;
    minutes: number;
    entries: {
        original: TimeEntry;
        jst: {
            start: Date;
            description: string;
            duration: number;
            project_id: number;
        };
    }[];
}

interface FilterOptions {
    projectId?: number;
}

export class ContributionGraph {
    private readonly CELL_SIZE = 10;
    private readonly CELL_PADDING = 2;
    private readonly WEEKS_IN_ROW = 53;
    private readonly DAYS_IN_WEEK = 7;
    private colorLevels = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
    private currentFilter: FilterOptions = {};
    private projects: Project[] = [];

    constructor(
        private container: HTMLElement,
        private data: DayData[],
        private maxMinutes: number,
        projects: Project[]
    ) {
        this.projects = projects;
    }

    render() {
        this.container.empty();
        
        // フィルターコントロールの作成
        const filterContainer = this.container.createDiv({ cls: 'contribution-filters' });
        this.createFilterControls(filterContainer);

        // グラフコンテナの作成
        const graphContainer = this.container.createDiv({ cls: 'contribution-graph-container' });
        this.renderGraph(graphContainer);
    }

    private createFilterControls(container: HTMLElement) {
        const wrapper = container.createDiv({ cls: 'contribution-filter-wrapper' });

        // プロジェクト選択
        const projectSelect = wrapper.createEl('select', { cls: 'contribution-filter' });
        
        // 現在の選択状態を確認
        const currentProjectId = this.currentFilter.projectId?.toString() || '';

        // オプションの追加
        const allProjectsOption = projectSelect.createEl('option', { 
            text: 'All Projects', 
            value: '' 
        });
        allProjectsOption.selected = currentProjectId === '';

        this.projects.forEach(project => {
            const option = projectSelect.createEl('option', {
                text: project.name,
                value: project.id.toString()
            });
            option.selected = project.id.toString() === currentProjectId;
        });

        // イベントリスナー
        projectSelect.addEventListener('change', (e) => {
            const select = e.target as HTMLSelectElement;
            this.currentFilter.projectId = select.value ? parseInt(select.value) : undefined;
            
            // 選択状態を更新
            Array.from(select.options).forEach(opt => {
                opt.selected = opt.value === select.value;
            });
            
            this.rerender();
        });

        // スタイルの適用
        wrapper.style.marginBottom = '10px';
        projectSelect.style.padding = '4px';
        projectSelect.style.borderRadius = '4px';
    }

    // private filterData(): DayData[] {
    //     return this.data.map(day => ({
    //         ...day,
    //         entries: day.entries.filter(entry => {
    //             const matchesProject = !this.currentFilter.projectId || entry.jst.project_id === this.currentFilter.projectId;
    //             return matchesProject;
    //         }),
    //         minutes: 0 // This will be recalculated below
    //     })).map(day => ({
    //         ...day,
    //         minutes: day.entries.reduce((total, entry) => {
    //             let duration = entry.jst.duration;
    //             if (duration < 0) {
    //                 duration = Math.floor(Date.now() / 1000) + duration;
    //             }
    //             return total + Math.floor(duration / 60);
    //         }, 0)
    //     }));
    // }

    private filterData(): DayData[] {
        return this.data.map(day => {
            const filteredEntries = day.entries.filter(entry => {
                const matchesProject = !this.currentFilter.projectId || entry.jst.project_id === this.currentFilter.projectId;
                return matchesProject;
            });
    
            const minutes = filteredEntries.reduce((total, entry) => {
                let duration = entry.jst.duration;
                if (duration < 0) {
                    duration = Math.floor(Date.now() / 1000) + duration;
                }
                return total + Math.floor(duration / 60);
            }, 0);
    
            return {
                ...day,
                entries: filteredEntries,
                minutes: minutes
            };
        });
    }

    private rerender() {
        this.container.empty();
        this.render();
    }

    private renderGraph(container: HTMLElement) {
        const filteredData = this.filterData();
        const maxMinutes = Math.max(...filteredData.map(d => d.minutes));

        const width = (this.CELL_SIZE + this.CELL_PADDING) * this.WEEKS_IN_ROW;
        const height = (this.CELL_SIZE + this.CELL_PADDING) * this.DAYS_IN_WEEK;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', height.toString());
        svg.setAttribute('class', 'contribution-graph');

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'contribution-tooltip';
        tooltip.style.position = 'absolute';
        tooltip.style.display = 'none';
        tooltip.style.backgroundColor = '#000000';
        tooltip.style.color = '#ffffff';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '3px';
        tooltip.style.fontSize = '12px';
        tooltip.style.zIndex = '1000';
        container.appendChild(tooltip);

        // Generate cells
        filteredData.forEach((dayData, index) => {
            const week = Math.floor(index / this.DAYS_IN_WEEK);
            const dayOfWeek = index % this.DAYS_IN_WEEK;

            const x = week * (this.CELL_SIZE + this.CELL_PADDING);
            const y = dayOfWeek * (this.CELL_SIZE + this.CELL_PADDING);

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', x.toString());
            rect.setAttribute('y', y.toString());
            rect.setAttribute('width', this.CELL_SIZE.toString());
            rect.setAttribute('height', this.CELL_SIZE.toString());
            rect.setAttribute('rx', '2');
            rect.setAttribute('ry', '2');

            const colorIndex = this.getColorIndex(dayData.minutes, maxMinutes);
            rect.setAttribute('fill', this.colorLevels[colorIndex]);

            // Add hover events
            rect.addEventListener('mouseover', (e) => {
                const target = e.target as SVGRectElement;
                target.style.stroke = '#000000';
                target.style.strokeWidth = '1';

                tooltip.style.display = 'block';
                tooltip.style.left = `${e.pageX + 10}px`;
                tooltip.style.top = `${e.pageY + 10}px`;
                tooltip.innerHTML = this.generateTooltipContent(dayData);
            });

            rect.addEventListener('mouseout', (e) => {
                const target = e.target as SVGRectElement;
                target.style.stroke = 'none';
                tooltip.style.display = 'none';
            });

            svg.appendChild(rect);
        });

        container.appendChild(svg);
    }

    private getColorIndex(minutes: number, maxMinutes: number): number {
        if (minutes === 0) return 0;
        const percentage = minutes / maxMinutes;
        if (percentage <= 0.25) return 1;
        if (percentage <= 0.5) return 2;
        if (percentage <= 0.75) return 3;
        return 4;
    }

    private generateTooltipContent(dayData: DayData): string {
        const date = dayData.date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });

        const hours = Math.floor(dayData.minutes / 60);
        const minutes = dayData.minutes % 60;
        let content = `<strong>${date}</strong><br>`;
        content += `Total: ${hours}h ${minutes}m<br>`;
        
        if (dayData.entries.length > 0) {
            content += '<br>Entries:<br>';
            // エントリを時刻でソート
            const sortedEntries = [...dayData.entries].sort((a, b) => 
                new Date(a.jst.start).getTime() - new Date(b.jst.start).getTime()
            );
            
            sortedEntries.forEach(entry => {
                const duration = Math.floor(entry.jst.duration / 60);
                const project = this.projects.find(p => p.id === entry.jst.project_id);

                // const entryStartUTC = new Date(entry.jst.start);
                // const timeStr = entryStartUTC.toLocaleTimeString('ja-JP', {
                //     hour: '2-digit',
                //     minute: '2-digit'
                // });

                const timeStr = entry.jst.start.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                content += `- ${timeStr} ${project?.name || 'No project'}: ${entry.jst.description || 'No description'} (${duration}m)<br>`;
            });
        }
        
        return content;
    }
}