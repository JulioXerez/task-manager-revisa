import cors from '@fastify/cors'
import Fastify from 'fastify'
import { taskRepository, type TaskInput, type TaskPriority, type TaskStatus } from './database.js'

const statuses: TaskStatus[] = ['pending', 'in_progress', 'done']
const priorities: TaskPriority[] = ['low', 'medium', 'high']

const app = Fastify({
  logger: true,
})

await app.register(cors, {
  origin: true,
})

const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode })

const isTaskStatus = (value: unknown): value is TaskStatus =>
  typeof value === 'string' && statuses.includes(value as TaskStatus)

const isTaskPriority = (value: unknown): value is TaskPriority =>
  typeof value === 'string' && priorities.includes(value as TaskPriority)

const parseTaskInput = (body: unknown, partial = false): TaskInput => {
  if (!body || typeof body !== 'object') {
    throw httpError(400, 'Corpo da requisicao invalido.')
  }

  const input = body as Record<string, unknown>
  const title = typeof input.title === 'string' ? input.title.trim() : undefined
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const status = input.status === undefined ? undefined : input.status
  const priority = input.priority === undefined ? undefined : input.priority
  const dueDate = input.dueDate === undefined || input.dueDate === null ? null : String(input.dueDate)

  if (!partial && !title) throw httpError(400, 'Titulo e obrigatorio.')
  if (title !== undefined && title.length === 0) throw httpError(400, 'Titulo e obrigatorio.')
  if (status !== undefined && !isTaskStatus(status)) throw httpError(400, 'Status invalido.')
  if (priority !== undefined && !isTaskPriority(priority)) throw httpError(400, 'Prioridade invalida.')

  return {
    ...(title !== undefined ? { title } : {}),
    ...(input.description !== undefined ? { description } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(input.dueDate !== undefined ? { dueDate } : {}),
  }
}

const parseId = (value: unknown) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Id invalido.')
  return id
}

app.get('/health', async () => ({
  status: 'ok',
  service: 'revisa-task-manager-api',
}))

app.get('/tasks', async (request) => {
  const query = request.query as { status?: string }
  const status = query.status

  if (status !== undefined && !isTaskStatus(status)) {
    throw httpError(400, 'Filtro de status invalido.')
  }

  return {
    data: taskRepository.list(status).map(taskRepository.mapTask),
    stats: taskRepository.stats(),
  }
})

app.get('/tasks/:id', async (request) => {
  const { id: rawId } = request.params as { id: string }
  const task = taskRepository.findById(parseId(rawId))
  if (!task) throw httpError(404, 'Tarefa nao encontrada.')
  return { data: task }
})

app.post('/tasks', async (request, reply) => {
  const input = parseTaskInput(request.body)
  const task = taskRepository.create({
    title: input.title!,
    description: input.description ?? '',
    status: input.status ?? 'pending',
    priority: input.priority ?? 'medium',
    dueDate: input.dueDate ?? null,
  })

  return reply.code(201).send({ data: task })
})

app.put('/tasks/:id', async (request) => {
  const { id: rawId } = request.params as { id: string }
  const task = taskRepository.update(parseId(rawId), parseTaskInput(request.body, true))
  if (!task) throw httpError(404, 'Tarefa nao encontrada.')
  return { data: task }
})

app.delete('/tasks/:id', async (request, reply) => {
  const { id: rawId } = request.params as { id: string }
  const deleted = taskRepository.delete(parseId(rawId))
  if (!deleted) throw httpError(404, 'Tarefa nao encontrada.')
  return reply.code(204).send()
})

const port = Number(process.env.PORT ?? 3333)
const host = process.env.HOST ?? '::'

await app.listen({ port, host })
