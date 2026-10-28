import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { aBoard, aTask, fakeBoardsApi } from '@/testing/fakeBoardsApi'
import { followZone } from '@/ui/boards/dueLabel'
import { renderRoute } from '@/testing/renderWithProviders'

function logoBoard() {
  const board = aBoard({ name: 'Design', keyPrefix: 'DES' })
  const logo = aTask(board.sections[0] ?? null, { key: 'DES-1', title: 'Logo' })
  board.tasks = [logo]
  return { board, logo, boardsApi: fakeBoardsApi([board]) }
}

function last<T>(items: T[]): T {
  const item = items.at(-1)
  if (item === undefined) throw new Error('Nothing found')
  return item
}

// A picker field keeps its value in a hidden input, under its sections.
function typeIn(section: HTMLElement, value: string) {
  const input = section
    .closest('.MuiPickersTextField-root')
    ?.querySelector('input')
  if (!input) throw new Error('No field input')
  fireEvent.change(input, { target: { value } })
}

const change = (field: HTMLElement, value: string) => {
  fireEvent.change(field, { target: { value } })
}

async function openDates(
  boardId: string,
  boardsApi: ReturnType<typeof fakeBoardsApi>
) {
  renderRoute(`/boards/${boardId}`, { boardsApi })
  fireEvent.click(await screen.findByRole('button', { name: 'Logo' }))
  const panel = within(
    await screen.findByRole('dialog', { name: 'DES-1 Logo' })
  )
  fireEvent.click(panel.getByRole('button', { name: 'Edit dates' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Dates' }))
  return { panel, editor }
}

afterEach(() => {
  followZone(null)
  vi.useRealTimers()
})

describe('Dates', () => {
  it('says when a task has no dates', async () => {
    const { board, boardsApi } = logoBoard()
    renderRoute(`/boards/${board.id}`, { boardsApi })

    fireEvent.click(await screen.findByRole('button', { name: 'Logo' }))
    const panel = within(
      await screen.findByRole('dialog', { name: 'DES-1 Logo' })
    )

    expect(
      panel.getByRole('button', { name: 'Edit dates' }).closest('dd')
    ).toHaveTextContent('None')
  })

  it('picks a due day on the calendar, a time, a deadline and a duration', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-10', deadline: '2026-11-20' })
    const { panel, editor } = await openDates(board.id, boardsApi)

    fireEvent.click(editor.getByRole('gridcell', { name: '2' }))
    typeIn(editor.getByRole('spinbutton', { name: 'Hours' }), '09:30')
    fireEvent.click(editor.getByRole('checkbox', { name: /Keep this time in/ }))
    fireEvent.click(
      last(editor.getAllByRole('button', { name: /Choose date/ }))
    )
    const picker = (await screen.findAllByRole('dialog')).at(-1)
    fireEvent.click(
      within(picker ?? document.body).getByRole('gridcell', { name: '6' })
    )
    change(editor.getByRole('spinbutton', { name: 'Duration' }), '90')
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    expect(await panel.findByText('Nov 2, 2026, 09:30')).toBeVisible()
    expect(boardsApi.editTask).toHaveBeenCalledWith(board.id, logo.id, {
      startDate: null,
      dueDate: '2026-11-02',
      dueTime: '09:30',
      dueZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      deadline: '2026-11-06',
      duration: { amount: 90, unit: 'minutes' },
      recurrence: null
    })
  })

  it("starts a new due date tomorrow in the person's time zone", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
    followZone('Pacific/Kiritimati')
    const { board, logo, boardsApi } = logoBoard()
    const { editor } = await openDates(board.id, boardsApi)

    fireEvent.click(editor.getByRole('checkbox', { name: 'Due date' }))
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(boardsApi.editTask).toHaveBeenCalledWith(
        board.id,
        logo.id,
        expect.objectContaining({ dueDate: '2026-10-08' })
      )
    })
  })

  it('completes the task from the Done box beside its dates', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-02' })
    renderRoute(`/boards/${board.id}`, { boardsApi })
    fireEvent.click(await screen.findByRole('button', { name: 'Logo' }))
    const panel = within(
      await screen.findByRole('dialog', { name: 'DES-1 Logo' })
    )

    fireEvent.click(panel.getByRole('checkbox', { name: 'Done' }))

    const done = board.sections.find(each => each.category === 'completed')
    await waitFor(() => {
      expect(boardsApi.moveTask).toHaveBeenCalledWith(board.id, logo.id, {
        sectionId: done?.id
      })
    })
  })

  it('repeats a task from its completion date', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-02' })
    const { panel, editor } = await openDates(board.id, boardsApi)

    fireEvent.mouseDown(editor.getByRole('combobox', { name: 'Repeat' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Custom' }))
    change(editor.getByRole('spinbutton', { name: 'Repeat every' }), '2')
    fireEvent.click(
      editor.getByRole('checkbox', { name: 'From the completion date' })
    )
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    expect(
      await panel.findByText(/Every 2 weeks after completion/)
    ).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Dates' })).toBeNull()
    expect(boardsApi.editTask).toHaveBeenCalledWith(
      board.id,
      logo.id,
      expect.objectContaining({
        recurrence: { every: 2, unit: 'weeks', fromCompletion: true }
      })
    )
  })

  it('shows the due time on the card', async () => {
    const { board, boardsApi } = logoBoard()
    Object.assign(board.tasks[0] ?? {}, {
      dueDate: '2026-11-02',
      dueTime: '09:30'
    })
    renderRoute(`/boards/${board.id}`, { boardsApi })

    expect(
      within(
        await screen.findByRole('article', { name: 'DES-1 Logo' })
      ).getByLabelText(/due Nov 2, 2026, 09:30$/i)
    ).toBeInTheDocument()
  })

  it('picks a start date, then the due date, on the same calendar', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-10' })
    const { panel, editor } = await openDates(board.id, boardsApi)

    fireEvent.click(editor.getByRole('checkbox', { name: 'Start date' }))
    fireEvent.click(editor.getByRole('gridcell', { name: '3' }))
    fireEvent.click(editor.getByRole('gridcell', { name: '7' }))
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    expect(await panel.findByText('Nov 3 – Nov 7, 2026')).toBeVisible()
    expect(boardsApi.editTask).toHaveBeenCalledWith(
      board.id,
      logo.id,
      expect.objectContaining({
        startDate: '2026-11-03',
        dueDate: '2026-11-07'
      })
    )
  })

  it('refuses a start date after the due date', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-02' })
    const { editor } = await openDates(board.id, boardsApi)

    fireEvent.click(editor.getByRole('checkbox', { name: 'Start date' }))
    fireEvent.click(editor.getByRole('gridcell', { name: '9' }))

    expect(
      editor.getByText('The start date must come before the due date.')
    ).toBeVisible()
    expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('repeats every week from the preset list', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-02' })
    const { panel, editor } = await openDates(board.id, boardsApi)

    fireEvent.mouseDown(editor.getByRole('combobox', { name: 'Repeat' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Every week' }))
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    expect(await panel.findByText(/Every week/)).toBeVisible()
    expect(boardsApi.editTask).toHaveBeenCalledWith(
      board.id,
      logo.id,
      expect.objectContaining({
        recurrence: { every: 1, unit: 'weeks', fromCompletion: false }
      })
    )
  })

  it('sets a reminder a day before the due date', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, { dueDate: '2026-11-02', dueTime: '09:30' })
    const { editor } = await openDates(board.id, boardsApi)

    fireEvent.mouseDown(editor.getByRole('combobox', { name: 'Reminder' }))
    fireEvent.click(await screen.findByRole('option', { name: '1 day before' }))
    fireEvent.click(editor.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(boardsApi.addReminder).toHaveBeenCalledWith(board.id, logo.id, {
        beforeMinutes: 1440,
        zone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    })
  })

  it('removes every date at once', async () => {
    const { board, logo, boardsApi } = logoBoard()
    Object.assign(logo, {
      startDate: '2026-10-30',
      dueDate: '2026-11-02',
      deadline: '2026-11-06'
    })
    const { panel, editor } = await openDates(board.id, boardsApi)

    fireEvent.click(editor.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(boardsApi.editTask).toHaveBeenCalledWith(
        board.id,
        logo.id,
        expect.objectContaining({
          startDate: null,
          dueDate: null,
          deadline: null,
          recurrence: null
        })
      )
    })
    expect(
      panel.getByRole('button', { name: 'Edit dates' }).closest('dd')
    ).toHaveTextContent('None')
  })
})
