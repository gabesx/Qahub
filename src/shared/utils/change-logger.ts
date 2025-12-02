import { prisma } from '../infrastructure/database';
import { logger } from './logger';
import { Prisma } from '@prisma/client';

export enum ChangeType {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
}

export interface ChangeLogOptions {
  userId?: bigint;
  transactionId?: string;
  source?: string;
}

/**
 * Log a database change to the change_log table
 * This is used for Change Data Capture (CDC) and replication
 */
export async function logChange(
  tableName: string,
  recordId: bigint,
  changeType: ChangeType,
  oldValues: any = null,
  newValues: any = null,
  options: ChangeLogOptions = {}
): Promise<void> {
  try {
    await prisma.changeLog.create({
      data: {
        tableName,
        recordId,
        changeType: changeType as any, // Prisma enum
        oldValues: oldValues ? (oldValues === Prisma.JsonNull ? Prisma.JsonNull : oldValues) : null,
        newValues: newValues ? (newValues === Prisma.JsonNull ? Prisma.JsonNull : newValues) : null,
        changedBy: options.userId || null,
        transactionId: options.transactionId || null,
        source: options.source || 'api',
      },
    });
  } catch (error) {
    // Don't throw - change logging should not break the main operation
    logger.error(`Failed to log change for ${tableName}:${recordId}:`, error);
  }
}

/**
 * Log an insert operation
 */
export async function logInsert(
  tableName: string,
  recordId: bigint,
  newValues: any,
  options: ChangeLogOptions = {}
): Promise<void> {
  await logChange(tableName, recordId, ChangeType.INSERT, null, newValues, options);
}

/**
 * Log an update operation
 */
export async function logUpdate(
  tableName: string,
  recordId: bigint,
  oldValues: any,
  newValues: any,
  options: ChangeLogOptions = {}
): Promise<void> {
  await logChange(tableName, recordId, ChangeType.UPDATE, oldValues, newValues, options);
}

/**
 * Log a delete operation
 */
export async function logDelete(
  tableName: string,
  recordId: bigint,
  oldValues: any,
  options: ChangeLogOptions = {}
): Promise<void> {
  await logChange(tableName, recordId, ChangeType.DELETE, oldValues, null, options);
}

/**
 * Helper to extract changed fields between old and new values
 */
export function extractChangedFields(oldValues: any, newValues: any): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};

  if (!oldValues || !newValues) {
    return changes;
  }

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Deep comparison for objects/arrays
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { old: oldVal, new: newVal };
    }
  }

  return changes;
}

/**
 * Helper to sanitize values for change logging (remove sensitive fields)
 */
export function sanitizeForChangeLog(values: any, sensitiveFields: string[] = ['password', 'token', 'secret']): any {
  if (!values || typeof values !== 'object') {
    return values;
  }

  const sanitized = { ...values };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

