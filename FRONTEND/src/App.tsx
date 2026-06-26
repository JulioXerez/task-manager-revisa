import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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

const API_URL = import.meta.env.VITE_API_URL ?? ''


const priorityLabels: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

const formatDateBR = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all')
  const [form, setForm] = useState<TaskForm>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedOverColumn, setDraggedOverColumn] = useState<TaskStatus | null>(null)

  const handleDragStart = (event: React.DragEvent, taskId: number) => {
    event.dataTransfer.setData('text/plain', taskId.toString())
  }

  const handleDragOver = (event: React.DragEvent, status: TaskStatus) => {
    event.preventDefault()
    setDraggedOverColumn(status)
  }

  const handleDragLeave = () => {
    setDraggedOverColumn(null)
  }

  const handleDrop = async (event: React.DragEvent, targetStatus: TaskStatus) => {
    event.preventDefault()
    setDraggedOverColumn(null)
    const taskIdStr = event.dataTransfer.getData('text/plain')
    if (!taskIdStr) return
    const taskId = Number(taskIdStr)
    if (isNaN(taskId)) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === targetStatus) return

    // Optimistic update
    setTasks((current) =>
      current.map((t) => (t.id === taskId ? { ...t, status: targetStatus, updatedAt: new Date().toISOString() } : t)),
    )

    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      })

      if (!response.ok) throw new Error('Não foi possível atualizar o status da tarefa.')
      const payload = (await response.json()) as { data: Task }
      setTasks((current) => current.map((item) => (item.id === taskId ? payload.data : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      void loadTasks(false)
    }
  }

  const toggleTaskDone = async (task: Task) => {
    const next: TaskStatus = task.status === 'done' ? 'pending' : 'done'
    // Optimistic update
    setTasks((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status: next, updatedAt: new Date().toISOString() } : t)),
    )

    try {
      const response = await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })

      if (!response.ok) throw new Error('Não foi possível atualizar o status da tarefa.')
      const payload = (await response.json()) as { data: Task }
      setTasks((current) => current.map((item) => (item.id === task.id ? payload.data : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
      void loadTasks(false)
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesPriority && matchesSearch
    })
  }, [tasks, statusFilter, priorityFilter, searchTerm])

  const stats = useMemo(() => {
    const pending = tasks.filter((task) => task.status === 'pending').length
    const in_progress = tasks.filter((task) => task.status === 'in_progress').length
    const done = tasks.filter((task) => task.status === 'done').length
    const total = tasks.length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
    const critical = tasks.filter((task) => task.priority === 'high' && task.status !== 'done').length

    return {
      pending,
      in_progress,
      done,
      total,
      completionRate,
      critical,
    }
  }, [tasks])

  const loadTasks = async (showPendingState = true) => {
    if (showPendingState) {
      setLoading(true)
    }
    setError(null)

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
    void loadTasks(false)

    const interval = window.setInterval(() => {
      void loadTasks(false)
    }, 10_000)

    return () => window.clearInterval(interval)
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

  const deleteTask = async (taskId: number) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        setError('Nao foi possivel remover a tarefa.')
        return
      }

      setTasks((current) => current.filter((task) => task.id !== taskId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.')
    }
  }

  return (
    <main className="min-h-screen bg-[#F8F9FA] text-zinc-950 antialiased font-sans pb-16">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Revisa Hub</p>
            <h1 className="mt-1 text-3xl font-extrabold text-zinc-900 tracking-tight sm:text-4xl">Gerenciador de tarefas</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-500 leading-normal">
              Organize demandas, acompanhe progresso e mantenha prioridades visíveis em um fluxo simples.
            </p>
          </div>
          <button
            className="w-fit rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-all duration-200 active:scale-95 cursor-pointer shadow-xs"
            onClick={() => void loadTasks()}
            type="button"
          >
            Atualizar
          </button>
        </header>

        {/* Rendimento e Métricas de Estudos Card Container */}
        <section className="bg-white border border-zinc-200/80 rounded-2xl p-6 shadow-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 mb-5">
            <div className="flex items-center gap-2.5">
              <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                <rect x="3" y="12" width="4" height="8" rx="1" />
                <rect x="10" y="7" width="4" height="13" rx="1" />
                <rect x="17" y="3" width="4" height="17" rx="1" />
              </svg>
              <h2 className="text-md font-bold text-zinc-900 tracking-tight">Rendimento e Métricas de Estudos</h2>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-200/80 tracking-widest uppercase">
              Telemetria Individual
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Taxa de Conclusão Card */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-zinc-100/60 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 tracking-wider block mb-3">TAXA DE CONCLUSÃO</span>
                <span className="text-4xl font-extrabold text-zinc-900">{stats.completionRate}%</span>
              </div>
              <div className="mt-6">
                <div className="w-full bg-zinc-200/70 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${stats.completionRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Fluxo de Estudos Card */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-zinc-100/60 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-zinc-400 tracking-wider block mb-3">FLUXO DE ESTUDOS</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {/* Pendente */}
                <button
                  onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                  className={`bg-white border rounded-lg p-3 text-center transition-all duration-200 hover:border-red-500 hover:shadow-xs flex flex-col items-center justify-between cursor-pointer ${
                    statusFilter === 'pending' ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-200/80'
                  }`}
                >
                  <span className="text-[10px] text-zinc-400 font-bold block mb-1">Pendente</span>
                  <span className="text-xl font-extrabold text-zinc-900">{stats.pending}</span>
                </button>
                {/* Ativo */}
                <button
                  onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
                  className={`bg-white border rounded-lg p-3 text-center transition-all duration-200 hover:border-red-500 hover:shadow-xs flex flex-col items-center justify-between cursor-pointer ${
                    statusFilter === 'in_progress' ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-200/80'
                  }`}
                >
                  <span className="text-[10px] text-zinc-400 font-bold block mb-1">Ativo</span>
                  <span className="text-xl font-extrabold text-zinc-900">{stats.in_progress}</span>
                </button>
                {/* Feito */}
                <button
                  onClick={() => setStatusFilter(statusFilter === 'done' ? 'all' : 'done')}
                  className={`bg-white border rounded-lg p-3 text-center transition-all duration-200 hover:border-red-500 hover:shadow-xs flex flex-col items-center justify-between cursor-pointer ${
                    statusFilter === 'done' ? 'border-red-500 ring-1 ring-red-500' : 'border-zinc-200/80'
                  }`}
                >
                  <span className="text-[10px] text-zinc-400 font-bold block mb-1">Feito</span>
                  <span className="text-xl font-extrabold text-zinc-900">{stats.done}</span>
                </button>
              </div>
            </div>

            {/* Estudos Críticos Card */}
            <div className="bg-[#F8F9FA] rounded-xl p-5 border border-zinc-100/60 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-zinc-400 tracking-wider block mb-3">ESTUDOS CRÍTICOS (ALTA)</span>
                <span className="text-4xl font-extrabold text-red-600">{stats.critical}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-4 leading-normal font-medium">
                Exige dedicação e priorização hoje.
              </p>
            </div>
          </div>
        </section>

        {/* Search and filter row */}
        <section className="flex flex-col sm:flex-row gap-4 justify-between items-center mt-2">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-zinc-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Pesquisar estudos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-200 text-zinc-900 rounded-full pl-11 pr-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder-zinc-400 shadow-2xs transition-all duration-200"
            />
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-sm font-semibold text-zinc-500">Prioridade:</span>
            <div className="flex bg-[#F8F9FA] border border-zinc-200/80 rounded-full p-1 gap-1">
              {(['all', 'high', 'medium', 'low'] as const).map((p) => {
                const label = p === 'all' ? 'Todas' : p === 'high' ? 'Alta' : p === 'medium' ? 'Média' : 'Baixa'
                const isActive = priorityFilter === p
                return (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-zinc-900 text-white shadow-sm'
                        : 'text-zinc-600 hover:text-zinc-955'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* Form and Tasks List Grid */}
        <section className="grid gap-6 xl:grid-cols-[300px_1fr] items-start mt-2">
          {/* Creation Form */}
          <form className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs" onSubmit={createTask}>
            <h2 className="text-md font-bold text-zinc-950">Nova tarefa</h2>

            <label className="mt-5 block text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Título
              <input
                className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder-zinc-400"
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Revisar requisitos"
                value={form.title}
              />
            </label>

            <label className="mt-4 block text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Descrição
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 placeholder-zinc-400"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Detalhes importantes da atividade"
                value={form.description}
              />
            </label>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Prioridade
                <select
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value as TaskPriority }))
                  }
                  value={form.priority}
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </label>

              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Prazo
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                  type="date"
                  value={form.dueDate}
                />
              </label>
            </div>

            <button
              className="mt-5 w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              disabled={saving || !form.title.trim()}
              type="submit"
            >
              {saving ? 'Salvando...' : 'Adicionar tarefa'}
            </button>
          </form>

          {/* Kanban Board Container */}
          <div className="min-w-0 flex flex-col">
            {/* Header section with title */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mb-6">
              <h3 className="text-2xl font-serif font-extrabold text-zinc-900 tracking-tight">
                Minhas Tarefas
              </h3>
              
              {/* Reset status filter helper if not 'all' */}
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Ver todas as colunas
                </button>
              )}
            </div>

            {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-medium mb-4">{error}</div>}

            {loading ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center text-sm text-zinc-500 font-semibold shadow-xs">
                <svg className="animate-spin h-5 w-5 mx-auto mb-3 text-zinc-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Carregando estudos...
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                {[
                  {
                    status: 'pending' as TaskStatus,
                    title: 'Pendente',
                    badgeStyle: 'bg-zinc-200 text-zinc-600',
                    emptyText: 'Nenhum estudo pendente',
                  },
                  {
                    status: 'in_progress' as TaskStatus,
                    title: 'Em Andamento',
                    badgeStyle: 'bg-red-100 text-red-600',
                    emptyText: 'Nenhum estudo em andamento',
                  },
                  {
                    status: 'done' as TaskStatus,
                    title: 'Concluída',
                    badgeStyle: 'bg-black text-white',
                    emptyText: 'Nenhum estudo concluída',
                  },
                ]
                  .filter((col) => statusFilter === 'all' || statusFilter === col.status)
                  .map((col) => {
                    const colTasks = filteredTasks.filter((t) => t.status === col.status)
                    const isDraggedOver = draggedOverColumn === col.status

                    return (
                      <div
                        key={col.status}
                        onDragOver={(e) => handleDragOver(e, col.status)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, col.status)}
                        className={`flex flex-col bg-[#F8F9FA]/40 border rounded-2xl p-4 min-h-[500px] transition-all duration-200 ${
                          isDraggedOver
                            ? 'border-red-500/50 bg-red-50/5 ring-2 ring-red-500/10'
                            : 'border-zinc-200/60'
                        }`}
                      >
                        {/* Column Header */}
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-200/50">
                          <h4 className="font-serif font-extrabold text-md text-zinc-900 tracking-tight">
                            {col.title}
                          </h4>
                          <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold ${col.badgeStyle}`}>
                            {colTasks.length}
                          </span>
                        </div>

                        {/* Tasks Stack */}
                        <div className="flex flex-col gap-3 flex-1">
                          {colTasks.length === 0 ? (
                            <div className="border-2 border-dashed border-zinc-200/60 rounded-2xl p-6 text-center my-auto bg-white/20">
                              <span className="text-[11px] text-zinc-400 font-semibold italic">
                                {col.emptyText}
                              </span>
                            </div>
                          ) : (
                            colTasks.map((task) => {
                              // Priority badge style
                              const priorityBadge = {
                                low: 'bg-zinc-400 text-white',
                                medium: 'bg-orange-500 text-white',
                                high: 'bg-red-650 text-white',
                              }

                              return (
                                <article
                                  key={task.id}
                                  className="rounded-xl border border-zinc-200 bg-white shadow-2xs hover:shadow-xs transition-all duration-200 flex flex-col justify-between min-h-[120px] overflow-hidden"
                                >
                                  {/* Drag handle — only this area is draggable */}
                                  <div
                                    draggable="true"
                                    onDragStart={(e) => handleDragStart(e, task.id)}
                                    className="p-4 pb-2 cursor-grab active:cursor-grabbing flex-1"
                                  >
                                    <h5 className="font-serif font-bold text-sm text-zinc-900 leading-tight select-none">
                                      {task.title}
                                    </h5>
                                    {task.description && (
                                      <p className="mt-2 text-xs text-zinc-500 leading-relaxed font-normal select-none">
                                        {task.description}
                                      </p>
                                    )}
                                    {task.dueDate && (
                                      <div className="inline-flex items-center gap-1.5 bg-zinc-50 text-zinc-600 border border-zinc-200 rounded-full px-2.5 py-0.5 text-[9px] font-extrabold mt-3">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                        </svg>
                                        Prazo: {formatDateBR(task.dueDate)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Actions footer — NOT draggable */}
                                  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[8px] font-extrabold tracking-wider uppercase ${priorityBadge[task.priority]}`}>
                                      {priorityLabels[task.priority]}
                                    </span>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        title="Remover tarefa"
                                        className="text-zinc-400 hover:text-red-600 transition-colors p-1 rounded cursor-pointer"
                                        onClick={() => void deleteTask(task.id)}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>

                                      <button
                                        type="button"
                                        title={task.status === 'done' ? 'Reabrir tarefa' : 'Marcar como concluída'}
                                        onClick={() => void toggleTaskDone(task)}
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                                          task.status === 'done'
                                            ? 'bg-black border-black text-white'
                                            : 'border-zinc-300 hover:border-zinc-900'
                                        }`}
                                      >
                                        {task.status === 'done' && (
                                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </article>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
