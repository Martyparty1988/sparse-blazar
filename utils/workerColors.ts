// Předefinované barvy pro zaměstnance
// Vibrantní, dobře rozlišitelné barvy s dobrým kontrastem
export const WORKER_COLORS = [
    '#3b82f6', '#60a5fa', '#2563eb', '#1d4ed8', '#6366f1', '#4f46e5',
    '#8b5cf6', '#a855f7', '#7c3aed', '#6d28d9', '#d946ef', '#ec4899',
    '#db2777', '#be185d', '#f43f5e', '#e11d48', '#ef4444', '#f97316',
    '#ea580c', '#f59e0b', '#d97706', '#eab308', '#ca8a04', '#84cc16',
    '#22c55e', '#10b981', '#059669', '#14b8a6', '#06b6d4', '#0891b2'
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
