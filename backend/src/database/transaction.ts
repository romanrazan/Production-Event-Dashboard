import { DataSource, EntityManager } from "typeorm";

/** PostgreSQL errors that are safe to retry because the whole transaction rolled back. */
const RETRYABLE_CODES = new Set([
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "23505", // unique_violation from a race the advisory locks did not cover
]);

/**
 * Runs work in a READ COMMITTED transaction and retries transient failures.
 *
 * Correctness comes from transaction-scoped advisory locks taken before any read:
 * under READ COMMITTED every statement after the lock sees rows committed by the
 * previous lock holder. (SERIALIZABLE would freeze the snapshot before the lock wait.)
 * Database constraints remain the final guard; a violation rolls back and retries.
 */
export async function runWithRetry<T>(
  dataSource: DataSource,
  work: (manager: EntityManager) => Promise<T>,
  attempts = 5,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await dataSource.transaction("READ COMMITTED", work);
    } catch (error) {
      const code = (error as { code?: string; driverError?: { code?: string } }).code
        ?? (error as { driverError?: { code?: string } }).driverError?.code;
      if (!code || !RETRYABLE_CODES.has(code) || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt + Math.floor(Math.random() * 15)));
    }
  }
}
