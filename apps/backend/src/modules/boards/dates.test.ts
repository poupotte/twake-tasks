import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { aUser, startApp, type TestUser } from '../../testing/app.ts'

let api: Awaited<ReturnType<typeof startApp>>

beforeAll(async () => {
  api = await startApp()
})

afterAll(async () => {
  await api.close()
})

async function aTaskOf(owner: TestUser) {
  const board = (
    await api.as(owner).post('/boards', { name: 'Design', keyPrefix: 'DES' })
  ).json<{ id: string; sections: { id: string }[] }>()
  const task = (
    await api.as(owner).post(`/boards/${board.id}/tasks`, {
      sectionId: board.sections[0]?.id,
      title: 'Logo'
    })
  ).json<{ id: string }>()
  const edit = (body: object) =>
    api.as(owner).patch(`/boards/${board.id}/tasks/${task.id}`, body)
  const read = async () =>
    (await api.as(owner).get(`/boards/${board.id}`)).json<{
      tasks: Record<string, unknown>[]
    }>().tasks[0]
  const history = async () =>
    (
      await api.as(owner).get(`/boards/${board.id}/tasks/${task.id}/history`)
    ).json<{ entries: { field: string; to: unknown }[] }>().entries
  return { edit, read, history }
}

describe('task dates', () => {
  it('keeps a due time, floating or in a zone, a deadline and a duration', async () => {
    const { edit, read, history } = await aTaskOf(aUser())

    const floating = await edit({
      dueDate: '2026-11-02',
      dueTime: '09:30',
      deadline: '2026-11-06',
      duration: { amount: 90, unit: 'minutes' }
    })
    const afterFloating = await read()
    await edit({ dueZone: 'Europe/Paris' })
    const afterZone = await read()

    expect(floating.statusCode).toBe(204)
    expect(afterFloating).toMatchObject({
      dueDate: '2026-11-02',
      dueTime: '09:30',
      dueZone: null,
      deadline: '2026-11-06',
      duration: { amount: 90, unit: 'minutes' }
    })
    expect(afterZone).toMatchObject({
      dueTime: '09:30',
      dueZone: 'Europe/Paris'
    })
    expect(
      (await history()).map(({ field, to }) => ({ field, to }))
    ).toContainEqual({ field: 'dueDate', to: '2026-11-02 09:30 Europe/Paris' })
  })

  it('drops the time and zone along with the due date', async () => {
    const { edit, read } = await aTaskOf(aUser())
    await edit({
      dueDate: '2026-11-02',
      dueTime: '09:30',
      dueZone: 'Asia/Ho_Chi_Minh'
    })

    await edit({ dueDate: null })

    expect(await read()).toMatchObject({
      dueDate: null,
      dueTime: null,
      dueZone: null
    })
  })

  it('refuses a time without a date, an unknown zone or an empty duration', async () => {
    const { edit } = await aTaskOf(aUser())

    const timeOnly = await edit({ dueTime: '09:30' })
    const unknownZone = await edit({
      dueDate: '2026-11-02',
      dueTime: '09:30',
      dueZone: 'Mars/Olympus'
    })
    const emptyDuration = await edit({ duration: { amount: 0, unit: 'days' } })

    expect(timeOnly.statusCode).toBe(400)
    expect(timeOnly.json()).toEqual({ error: 'invalid_dates' })
    expect(unknownZone.statusCode).toBe(400)
    expect(emptyDuration.statusCode).toBe(400)
  })
  it('keeps a start date, alone or before the due date, and logs it', async () => {
    const { edit, read, history } = await aTaskOf(aUser())

    const alone = await edit({ startDate: '2026-11-03' })
    const afterAlone = await read()
    const span = await edit({ dueDate: '2026-11-07', dueTime: '17:00' })
    const afterSpan = await read()
    await edit({ startDate: null })

    expect(alone.statusCode).toBe(204)
    expect(afterAlone).toMatchObject({ startDate: '2026-11-03', dueDate: null })
    expect(span.statusCode).toBe(204)
    expect(afterSpan).toMatchObject({
      startDate: '2026-11-03',
      dueDate: '2026-11-07',
      dueTime: '17:00'
    })
    expect(await read()).toMatchObject({
      startDate: null,
      dueDate: '2026-11-07'
    })
    expect(
      (await history())
        .filter(entry => entry.field === 'startDate')
        .map(entry => entry.to)
    ).toEqual(expect.arrayContaining(['2026-11-03', null]))
  })

  it('refuses a start date after the due date', async () => {
    const { edit, read } = await aTaskOf(aUser())
    await edit({ dueDate: '2026-11-07' })

    const late = await edit({ startDate: '2026-11-08' })
    await edit({ startDate: '2026-11-03' })
    const earlyDue = await edit({ dueDate: '2026-11-01' })

    expect(late.statusCode).toBe(400)
    expect(late.json()).toEqual({ error: 'invalid_dates' })
    expect(earlyDue.statusCode).toBe(400)
    expect(await read()).toMatchObject({
      startDate: '2026-11-03',
      dueDate: '2026-11-07'
    })
  })
})
