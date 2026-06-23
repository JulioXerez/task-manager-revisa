import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './App.css'

type TaskStatus = 'pending' | 'in_progress' | 'done'
type TaskPriority = 'low' | 'medium' | 'high'

type Task = {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

type TaskForm = {
  title: string
  description: string
  priority: TaskPriority
  dueDate: string
}

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

const statusLabels: Record<TaskStatus | 'all', string> = {
  all: 'Todas',
  pending: 'Pendentes',
  in_progress: 'Em andamento',
  done: 'Concluidas',
}

const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
}

const nextStatus: Record<TaskStatus, TaskStatus> = {
  pending: 'in_progress',
  in_progress: 'done',
  done: 'pending',
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [form, setForm] = useState<TaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredTasks = useMemo(
    () => (statusFilter === 'all' ? tasks : tasks.filter((task) => task.status === statusFilter)),
    [statusFilter, tasks],
  )

  const stats = useMemo(
    () => ({
      pending: tasks.filter((task) => task.status === 'pending').length,
      in_progress: tasks.filter((task) => task.status === 'in_progress').length,
      done: tasks.filter((task) => task.status === 'done').length,
    }),
    [tasks],
  )

  const loadTasks = async (showPendingState = true) => {
    if (showPendingState) {
      setLoading(true)
      setError(null)
    }

    try {
      const response = await fetch(`${API_URL}/tasks`)
      if (!response.ok) throw new Error('Nao foi possivel carregar as tarefas.')
      const payload = (await response.json()) as { data: Task[] }
      setTasks(payload.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTasks(false)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const createTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.title.trim()) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          priority: form.priority,
          dueDate: form.dueDate || null,
        }),
      })

      if (!response.ok) throw new Error('Nao foi possivel criar a tarefa.')
      const payload = (await response.json()) as { data: Task }
      setTasks((current) => [payload.data, ...current])
      setForm({ title: '', description: '', priority: 'medium', dueDate: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    } finally {
      setSaving(false)
    }
  }

  const updateTaskStatus = async (task: Task) => {
    const response = await fetch(`${API_URL}/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus[task.status] }),
    })

    if (!response.ok) {
      setError('Nao foi possivel atualizar a tarefa.')
      return
    }

    const payload = (await response.json()) as { data: Task }
    setTasks((current) => current.map((item) => (item.id === task.id ? payload.data : item)))
  }

  const deleteTask = async (taskId: number) => {
    const response = await fetch(`${API_URL}/tasks/${taskId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      setError('Nao foi possivel remover a tarefa.')
      return
    }

    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">Revisa Hub</p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Gerenciador de tarefas</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Organize demandas, acompanhe progresso e mantenha prioridades visiveis em um fluxo simples.
            </p>
          </div>
          <button
            className="w-fit rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-cyan-300 hover:text-white"
            onClick={() => void loadTasks()}
            type="button"
          >
            Atualizar
          </button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {(['pending', 'in_progress', 'done'] as TaskStatus[]).map((status) => (
            <button
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300"
              key={status}
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              <span className="text-sm text-zinc-400">{statusLabels[status]}</span>
              <strong className="mt-2 block text-3xl text-white">{stats[status]}</strong>
            </button>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <form className="rounded-lg border border-white/10 bg-zinc-900 p-5" onSubmit={createTask}>
            <h2 className="text-lg font-semibold text-white">Nova tarefa</h2>

            <label className="mt-5 block text-sm font-medium text-zinc-300">
              Titulo
              <input
                className="mt-2 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Revisar requisitos"
                value={form.title}
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-zinc-300">
              Descricao
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Detalhes importantes da atividade"
                value={form.description}
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="block text-sm font-medium text-zinc-300">
                Prioridade
                <select
                  className="mt-2 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))
                  }
                  value={form.priority}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-zinc-300">
                Prazo
                <input
                  className="mt-2 w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-300"
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  type="date"
                  value={form.dueDate}
                />
              </label>
            </div>

            <button
              className="mt-5 w-full rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving || !form.title.trim()}
              type="submit"
            >
              {saving ? 'Salvando...' : 'Adicionar tarefa'}
            </button>
          </form>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap gap-2">
              {(['all', 'pending', 'in_progress', 'done'] as Array<TaskStatus | 'all'>).map((status) => (
                <button
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    statusFilter === status
                      ? 'bg-cyan-300 text-zinc-950'
                      : 'border border-white/10 bg-white/[0.03] text-zinc-300 hover:border-cyan-300'
                  }`}
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  type="button"
                >
                  {statusLabels[status]}
                </button>
              ))}
            </div>

            {error && <div className="mb-4 rounded-md border border-red-400/40 bg-red-950/50 p-3 text-sm">{error}</div>}

            <section className="grid gap-3">
              {loading ? (
                <div className="rounded-lg border border-white/10 bg-zinc-900 p-5 text-sm text-zinc-400">
                  Carregando tarefas...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-zinc-900 p-5 text-sm text-zinc-400">
                  Nenhuma tarefa encontrada para este filtro.
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <article className="rounded-lg border border-white/10 bg-zinc-900 p-5" key={task.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded bg-white/10 px-2 py-1 text-xs text-zinc-300">
                            {statusLabels[task.status]}
                          </span>
                          <span className="rounded bg-cyan-300/15 px-2 py-1 text-xs text-cyan-100">
                            {priorityLabels[task.priority]}
                          </span>
                          {task.dueDate && (
                            <span className="rounded bg-white/10 px-2 py-1 text-xs text-zinc-300">
                              Prazo: {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 break-words text-lg font-semibold text-white">{task.title}</h3>
                        {task.description && (
                          <p className="mt-2 break-words text-sm leading-6 text-zinc-400">{task.description}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          className="rounded-md border border-white/10 px-3 py-2 text-sm text-zinc-200 transition hover:border-cyan-300 hover:text-white"
                          onClick={() => void updateTaskStatus(task)}
                          type="button"
                        >
                          Mover
                        </button>
                        <button
                          className="rounded-md border border-red-400/30 px-3 py-2 text-sm text-red-200 transition hover:border-red-300 hover:text-red-100"
                          onClick={() => void deleteTask(task.id)}
                          type="button"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
