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
    private readonly CELL_SIZE = 16;
    private readonly CELL_PADDING = 2;
    private readonly WEEKS_IN_ROW = 53;
    private readonly DAYS_IN_WEEK = 7;
    private readonly LABEL_WIDTH = 30; // 曜日ラベル用の幅
    private readonly MONTH_LABEL_HEIGHT = 20; // 月ラベル用の高さを追加
    private readonly MONTH_LABEL_PADDING = 8; // 月ラベルとグラフの間のパディング
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

    private getDayOfWeek(date: Date): number {
        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        let day = date.getDay();
        // Convert to Monday = 0, ..., Sunday = 6
        return day === 0 ? 6 : day - 1;
    }

    private getMonthPositions(filteredData: DayData[], startDayOfWeek: number): { month: string; x: number }[] {
        const monthPositions: { month: string; x: number }[] = [];
        let currentMonth = -1;

        filteredData.forEach((dayData, index) => {
            const date = dayData.date;
            const month = date.getMonth();
            const isFirstDay = date.getDate() === 1;

            if (month !== currentMonth && isFirstDay) {
                const totalDays = index + startDayOfWeek;
                const week = Math.floor(totalDays / this.DAYS_IN_WEEK);
                const x = week * (this.CELL_SIZE + this.CELL_PADDING) + this.LABEL_WIDTH;

                const monthName = date.toLocaleString('en-US', { month: 'short' });
                monthPositions.push({ month: monthName, x });
                currentMonth = month;
            }
        });

        return monthPositions;
    }

    render() {
        this.container.empty();
        
        // フィルターコントロールの作成
        const filterContainer = this.container.createDiv({ cls: 'contribution-filters' });
        this.createFilterControls(filterContainer);

        // グラフコンテナの作成
        const scrollWrapper = this.container.createDiv({ cls: 'contribution-graph-scroll-wrapper' });
        scrollWrapper.style.overflowX = 'auto';
        scrollWrapper.style.overflowY = 'hidden';
        scrollWrapper.style.paddingBottom = '10px'; // スクロールバーのスペース確保

        const graphContainer = scrollWrapper.createDiv({ cls: 'contribution-graph-container' });
        graphContainer.style.minWidth = 'min-content'; // コンテンツの最小幅を保証

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

        // 開始日の曜日を取得（0 = Monday, ..., 6 = Sunday）
        const firstDate = filteredData[0].date;
        const startDayOfWeek = this.getDayOfWeek(firstDate);

        const width = (this.CELL_SIZE + this.CELL_PADDING) * this.WEEKS_IN_ROW + this.LABEL_WIDTH;
        const totalHeight = this.MONTH_LABEL_HEIGHT + this.MONTH_LABEL_PADDING + 
            (this.CELL_SIZE + this.CELL_PADDING) * this.DAYS_IN_WEEK;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', totalHeight.toString());
        svg.setAttribute('class', 'contribution-graph');

        // Month labels group
        const monthsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        monthsGroup.setAttribute('class', 'months');
        svg.appendChild(monthsGroup);

        // Main graph group (includes weekday labels, cells)
        const graphGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        graphGroup.setAttribute('class', 'graph');
        graphGroup.setAttribute('transform', 
            `translate(0, ${this.MONTH_LABEL_HEIGHT + this.MONTH_LABEL_PADDING})`);
        svg.appendChild(graphGroup);

        // Month labels
        const monthPositions = this.getMonthPositions(filteredData, startDayOfWeek);
        monthPositions.forEach(({ month, x }) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x.toString());
            text.setAttribute('y', (this.MONTH_LABEL_HEIGHT / 2).toString());
            text.setAttribute('fill', '#666666');
            text.setAttribute('font-size', '12px');
            text.setAttribute('font-family', 'sans-serif');
            text.setAttribute('dominant-baseline', 'middle');
            text.textContent = month;
            monthsGroup.appendChild(text);
        });

        // Weekday labels
        const weekdays = ['Mon', 'Wed', 'Fri', 'Sun'];
        const weekdayPositions = [0, 2, 4, 6];
        weekdayPositions.forEach((pos, index) => {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const yPos = pos * (this.CELL_SIZE + this.CELL_PADDING) + (this.CELL_SIZE / 2);
            text.setAttribute('x', '0');
            text.setAttribute('y', yPos.toString());
            text.setAttribute('fill', '#666666');
            text.setAttribute('font-size', '12px');
            text.setAttribute('font-family', 'sans-serif');
            text.setAttribute('text-anchor', 'start');
            text.setAttribute('alignment-baseline', 'middle');
            text.textContent = weekdays[index];
            graphGroup.appendChild(text);
        });

        // Create cells group
        const cellsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        cellsGroup.setAttribute('class', 'cells');
        cellsGroup.setAttribute('transform', `translate(${this.LABEL_WIDTH}, 0)`);
        graphGroup.appendChild(cellsGroup);

        // Render empty cells for the first week
        if (startDayOfWeek > 0) {
            for (let i = 0; i < startDayOfWeek; i++) {
                const emptyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                emptyRect.setAttribute('x', '0');
                emptyRect.setAttribute('y', (i * (this.CELL_SIZE + this.CELL_PADDING)).toString());
                emptyRect.setAttribute('width', this.CELL_SIZE.toString());
                emptyRect.setAttribute('height', this.CELL_SIZE.toString());
                emptyRect.setAttribute('rx', '2');
                emptyRect.setAttribute('ry', '2');
                emptyRect.setAttribute('fill', '#ebedf0');
                cellsGroup.appendChild(emptyRect);
            }
        }

        // Render data cells
        filteredData.forEach((dayData, index) => {
            const totalDays = index + startDayOfWeek;
            const week = Math.floor(totalDays / this.DAYS_IN_WEEK);
            const dayOfWeek = totalDays % this.DAYS_IN_WEEK;

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', (week * (this.CELL_SIZE + this.CELL_PADDING)).toString());
            rect.setAttribute('y', (dayOfWeek * (this.CELL_SIZE + this.CELL_PADDING)).toString());
            rect.setAttribute('width', this.CELL_SIZE.toString());
            rect.setAttribute('height', this.CELL_SIZE.toString());
            rect.setAttribute('rx', '2');
            rect.setAttribute('ry', '2');

            const colorIndex = this.getColorIndex(dayData.minutes, maxMinutes);
            rect.setAttribute('fill', this.colorLevels[colorIndex]);
            rect.setAttribute('data-date', dayData.date.toISOString().split('T')[0]);

            this.addHoverEvents(rect, dayData);
            cellsGroup.appendChild(rect);
        });

        container.appendChild(svg);
    }

    private addHoverEvents(rect: SVGRectElement, dayData: DayData) {
        const tooltip = this.createTooltip();
        rect.addEventListener('mouseover', (e) => {
            rect.style.stroke = '#000000';
            rect.style.strokeWidth = '1';

            tooltip.style.display = 'block';
            const rectBounds = rect.getBoundingClientRect();
            tooltip.style.left = `${rectBounds.right + 10}px`;
            tooltip.style.top = `${rectBounds.top}px`;
            tooltip.innerHTML = this.generateTooltipContent(dayData);
        });

        rect.addEventListener('mouseout', () => {
            rect.style.stroke = 'none';
            tooltip.style.display = 'none';
        });
    }

    private createTooltip(): HTMLDivElement {
        const tooltip = document.createElement('div');
        tooltip.className = 'contribution-tooltip';
        tooltip.style.position = 'fixed';
        tooltip.style.display = 'none';
        tooltip.style.backgroundColor = '#000000';
        tooltip.style.color = '#ffffff';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '3px';
        tooltip.style.fontSize = '12px';
        tooltip.style.zIndex = '1000';
        this.container.appendChild(tooltip);
        return tooltip;
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