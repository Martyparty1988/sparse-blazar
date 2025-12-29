// Předefinované barvy pro zaměstnance
// Vibrantní, dobře rozlišitelné barvy s dobrým kontrastem
export const WORKER_COLORS = [
    '#3b82f6', // Electric Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#a855f7', // Violet
    '#84cc16', // Lime
    '#f43f5e', // Rose
    '#0ea5e9', // Sky Blue
    '#eab308', // Yellow
    '#6366f1', // Indigo
    '#22c55e', // Emerald
];

/**
 * Získá barvu pro zaměstnance
 * Pokud má worker.color, použije ji
 * Jinak přiřadí barvu podle indexu
 */
export function getWorkerColor(workerId: number, workerColor?: string, allWorkers?: { id?: number }[]): string {
    // Pokud má worker přiřazenou barvu, použij ji
    if (workerColor) {
        return workerColor;
    }

    // Jinak přiřaď barvu podle indexu
    if (allWorkers) {
        const index = allWorkers.findIndex(w => w.id === workerId);
        if (index !== -1) {
            return WORKER_COLORS[index % WORKER_COLORS.length];
        }
    }

    // Fallback: použij ID jako index
    return WORKER_COLORS[workerId % WORKER_COLORS.length];
}

/**
 * Vygeneruje náhodnou barvu z palety
 */
export function getRandomWorkerColor(): string {
    return WORKER_COLORS[Math.floor(Math.random() * WORKER_COLORS.length)];
}

/**
 * Získá světlejší variantu barvy pro pozadí
 */
export function getLighterColor(hexColor: string, opacity: number = 0.2): string {
    return `${hexColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Získá iniciály ze jména
 */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}
