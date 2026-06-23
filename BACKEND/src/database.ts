import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type TaskStatus = 'pending' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export type Task = {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

export type TaskInput = {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  dueDate?: string | null
}

const databasePath = resolve(process.env.DATABASE_URL ?? 'data/revisa.sqlite')
mkdirSync(dirname(databasePath), { recursive: true })

const db = new DatabaseSync(databasePath)
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
`)

const mapTask = (row: Record<string, unknown>): Task => ({
  id: Number(row.id),
  title: String(row.title),
  description: String(row.description),
  status: row.status as TaskStatus,
  priority: row.priority as TaskPriority,
  dueDate: row.due_date === null ? null : String(row.due_date),
  createdAt: String(row.created_at),
  updatedAt: String(row.updated_at),
})

export const taskRepository = {
  list(status?: TaskStatus) {
    const sql = status
      ? 'SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM tasks ORDER BY created_at DESC'
    return db.prepare(sql).all(...(status ? [status] : [])) as Record<string, unknown>[]
  },

  findById(id: number) {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined
    return row ? mapTask(row) : null
  },

  create(input: Required<TaskInput>) {
    const result = db
      .prepare(
        `INSERT INTO tasks (title, description, status, priority, due_date)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(input.title, input.description, input.status, input.priority, input.dueDate)

    return this.findById(Number(result.lastInsertRowid))
  },

  update(id: number, input: Partial<TaskInput>) {
    const current = this.findById(id)
    if (!current) return null

    const next = {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      status: input.status ?? current.status,
      priority: input.priority ?? current.priority,
      dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
    }

    db.prepare(
      `UPDATE tasks
       SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(next.title, next.description, next.status, next.priority, next.dueDate, id)

    return this.findById(id)
  },

  delete(id: number) {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    return result.changes > 0
  },

  stats() {
    const rows = db
      .prepare('SELECT status, COUNT(*) as total FROM tasks GROUP BY status')
      .all() as Array<{ status: TaskStatus; total: number }>

    return rows.reduce(
      (acc, row) => ({ ...acc, [row.status]: Number(row.total) }),
      { pending: 0, in_progress: 0, done: 0 },
    )
  },

  mapTask,
}
