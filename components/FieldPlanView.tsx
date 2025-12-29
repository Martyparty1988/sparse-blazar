
import React, { useState } from 'react';
import FieldPlan from './FieldPlan';
import TableModal from './TableModal';
import type { FieldTable } from '../types';

interface FieldPlanViewProps {
    projectId: number;
}

/**
 * Wrapper komponenta pro plánové pole
 * Spojuje FieldPlan (vizualizace) a TableModal (detail)
 */
const FieldPlanView: React.FC<FieldPlanViewProps> = ({ projectId }) => {
    const [selectedTable, setSelectedTable] = useState<FieldTable | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleTableClick = (table: FieldTable) => {
        setSelectedTable(table);
    };

    const handleCloseModal = () => {
        setSelectedTable(null);
    };

    const handleUpdate = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <>
            <FieldPlan
                key={refreshKey}
                projectId={projectId}
                onTableClick={handleTableClick}
            />

            {selectedTable && (
                <TableModal
                    table={selectedTable}
                    onClose={handleCloseModal}
                    onUpdate={handleUpdate}
                />
            )}
        </>
    );
};

export default FieldPlanView;
