import { db } from './db';
import type { TimeRecord } from '../types';

/**
 * Parses table completion patterns from description text.
 * Supports Czech patterns like: "hotový stůl 28.1", "dokončil 149", "stůl IT42-5 hotový"
 * @param description The description text to parse
 * @returns Array of unique table IDs found
 */
export const parseTableCompletionPatterns = (description: string): string[] => {
  const tableCodes = new Set<string>();

  // Pattern 1: "hotový stůl X" or "hotová stůl X"
  const pattern1 = /hotov[ýá]\s+st[ůu]l\s+(\S+)/gi;
  let matches = description.matchAll(pattern1);
  for (const match of matches) {
    tableCodes.add(match[1]);
  }

  // Pattern 2: "stůl X hotový" or "stůl X hotová"
  const pattern2 = /st[ůu]l\s+(\S+)\s+hotov[ýá]/gi;
  matches = description.matchAll(pattern2);
  for (const match of matches) {
    tableCodes.add(match[1]);
  }

  // Pattern 3: "dokončil X" or "dokončen X" or "dokončeno X"
  const pattern3 = /dokonč(?:il|en|eno)\s+(?:st[ůu]l\s+)?(\S+)/gi;
  matches = description.matchAll(pattern3);
  for (const match of matches) {
    tableCodes.add(match[1]);
  }

  // Pattern 4: "X dokončen" or "X dokončeno"
  const pattern4 = /(?:st[ůu]l\s+)?(\S+)\s+dokonč(?:en|eno)/gi;
  matches = description.matchAll(pattern4);
  for (const match of matches) {
    tableCodes.add(match[1]);
  }

  // Pattern 5: "TR X" (legacy format)
  const pattern5 = /TR\s*(\d+(?:\.\d+)?)/gi;
  matches = description.matchAll(pattern5);
  for (const match of matches) {
    tableCodes.add(match[1]);
  }

  return Array.from(tableCodes);
};

/**
 * Processes time record description for NEW fieldTables system.
 * Parses completion patterns and updates fieldTables accordingly.
 * @param record The time record to process
 * @returns Number of tables updated
 */
export const processFieldTableDescription = async (record: TimeRecord): Promise<number> => {
  // 1. Try to use structured tableIds if available
  let tableCodes: string[] = [];

  if (record.tableIds && record.tableIds.length > 0) {
    tableCodes = record.tableIds;
  } else if (record.description) {
    // 2. Fallback to parsing description
    tableCodes = parseTableCompletionPatterns(record.description);
  }

  if (tableCodes.length === 0) return 0;

  let updatedCount = 0;

  try {
    await db.transaction('rw', db.fieldTables, async () => {
      for (const code of tableCodes) {
        // Find the field table in the current project
        const fieldTable = await db.fieldTables
          .where({ projectId: record.projectId, tableId: code })
          .first();

        if (fieldTable && fieldTable.id) {
          // Only update if not already completed
          if (fieldTable.status !== 'completed') {
            // Prepare assigned workers array (max 2)
            const currentWorkers = fieldTable.assignedWorkers || [];
            const updatedWorkers = [...currentWorkers, record.workerId]
              .filter((v, i, a) => a.indexOf(v) === i) // unique
              .slice(0, 2); // max 2 workers

            await db.fieldTables.update(fieldTable.id, {
              status: 'completed',
              completedAt: new Date(),
              completedBy: record.workerId,
              assignedWorkers: updatedWorkers,
            });

            updatedCount++;
            console.log(`✅ Field table "${code}" marked as completed by worker ${record.workerId}`);
          } else {
            console.log(`ℹ️ Field table "${code}" already completed, skipping`);
          }
        } else {
          console.warn(`⚠️ Field table "${code}" not found for project ID ${record.projectId}`);
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to process field table description:', error);
  }

  return updatedCount;
};

/**
 * Parses a time record's description to find solar table codes and updates their status.
 * Also assigns the worker from the record to the completed tables.
 * LEGACY: For old solarTables system. Use processFieldTableDescription for new projects.
 * @param record The time record to process.
 */
export const processRecordDescription = async (record: TimeRecord): Promise<void> => {
  if (!record.description) return;

  // Regex to find table codes like: "28", "29.1", "TR 36", "105.1"
  const tableCodeRegex = /(?:TR\s*)?(\d+(?:\.\d)?)/g;
  const matches = record.description.matchAll(tableCodeRegex);
  // Using a Set to avoid processing duplicate codes from the same description
  const tableCodes = new Set(Array.from(matches, m => m[1]));

  if (tableCodes.size === 0) return;

  try {
    await db.transaction('rw', db.solarTables, db.tableAssignments, db.tableStatusHistory, async () => {
      for (const code of tableCodes) {
        // Find the table in the current project
        const table = await db.solarTables
          .where({ projectId: record.projectId, tableCode: code })
          .first();

        if (table && table.id) {
          // 1. Update table status to completed and log history if it changed
          if (table.status !== 'completed') {
            await db.solarTables.update(table.id, { status: 'completed' });
            // Log the change to history
            await db.tableStatusHistory.add({
              tableId: table.id,
              workerId: record.workerId,
              status: 'completed',
              timestamp: new Date(),
            });
          }

          // 2. Assign the worker to the table if not already assigned
          const existingAssignment = await db.tableAssignments
            .where({ tableId: table.id, workerId: record.workerId })
            .first();

          if (!existingAssignment) {
            await db.tableAssignments.add({ tableId: table.id, workerId: record.workerId });
          }
        } else {
          console.warn(`Table with code "${code}" not found for project ID ${record.projectId}.`);
        }
      }
    });
  } catch (error) {
    console.error('Failed to process record description and update tables:', error);
  }
};
