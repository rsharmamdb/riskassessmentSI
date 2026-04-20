/**
 * Singleton MongoDB client for local persistence.
 *
 * Connects to a local MongoDB instance at mongodb://localhost:27017/risksi.
 * Collections:
 *   - assessments  — full wizard state (input, artifacts, triagePaste, report)
 *   - caseAnalyses — case analysis workflow state
 */

import { MongoClient, type Db } from "mongodb";

const MONGO_URI = process.env.RISKSI_MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = "risksi";

let _client: MongoClient | null = null;
let _db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (_db) return _db;
  _client = new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 3_000,
    connectTimeoutMS: 3_000,
  });
  await _client.connect();
  _db = _client.db(DB_NAME);
  return _db;
}

export async function getCollection<T extends Document = Document>(name: string) {
  const db = await getDb();
  return db.collection<T>(name);
}
