import { test, expect, type Page } from '@playwright/test'
async function seededGame(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('wordlab:game'))
      localStorage.setItem(
        'wordlab:game',
        JSON.stringify({
          version: 1,
          data: {
            settings: { length: 5, spelling: 'combined', difficulty: 'common' },
            stats: {},
            session: {
              id: 'fixture',
              settings: { length: 5, spelling: 'combined', difficulty: 'common' },
              answer: 'apple',
              maxAttempts: 6,
              input: '',
              guesses: [],
              status: 'playing',
            },
          },
        }),
      )
  })
  await page.goto('/')
  await expect(page.getByRole('status').first()).toContainText('A fresh word')
}
test('complete game, invalid guesses, keyboard, statistics, new settings and reload', async ({
  page,
}) => {
  await seededGame(page)
  await page.keyboard.type('zzzzz')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').first()).toContainText('not in this dictionary')
  await expect(page.getByText('6 attempts left')).toBeVisible()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('eagle')
  await page.keyboard.press('Enter')
  await expect(page.locator('.board-row').first().locator('.state-2')).toHaveCount(2)
  await page.keyboard.type('apple')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').first()).toContainText('Beautifully done')
  await expect(page.locator('.stats')).toContainText('100%')
  await page.reload()
  await expect(page.getByRole('status').first()).toContainText('Beautifully done')
  await page.getByRole('combobox', { name: 'Word length', exact: true }).selectOption('12')
  await expect(page.locator('.board-row').first().locator('.tile')).toHaveCount(5)
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.locator('.board-row').first().locator('.tile')).toHaveCount(12)
  await expect(page.getByText('6 attempts left')).toBeVisible()
})
test('on-screen keys restore physical input after settings without stealing keyboard activation', async ({
  page,
}) => {
  await seededGame(page)
  const board = page.getByRole('group', { name: 'Guess board', exact: true })
  const letterA = page.getByRole('button', { name: 'a', exact: true })
  // Enter still activates a focused virtual key, retaining focus for keyboard navigation.
  await letterA.focus()
  await page.keyboard.press('Enter')
  await expect(letterA).toBeFocused()
  await expect(page.locator('.board-row').first()).toHaveText('a')
  await page.keyboard.press('Backspace')

  const length = page.getByRole('combobox', { name: 'Word length', exact: true })
  await length.focus()
  await length.selectOption('6')
  await letterA.click()
  await expect(board).toBeFocused()
  await page.keyboard.type('b')
  await expect(page.locator('.board-row').first()).toHaveText('ab')

  const spelling = page.getByRole('combobox', { name: 'Spelling', exact: true })
  await spelling.focus()
  await spelling.selectOption('us')
  await page.getByRole('button', { name: 'Backspace', exact: true }).click()
  await expect(board).toBeFocused()
  await page.keyboard.type('pple')
  const vocabulary = page.getByRole('combobox', { name: 'Vocabulary', exact: true })
  await vocabulary.focus()
  await vocabulary.selectOption('standard')
  await page.getByRole('button', { name: 'Enter', exact: true }).click()
  await expect(board).toBeFocused()
  await expect(page.locator('.game-message')).toContainText('One and done')
  await expect(length).toHaveValue('6')
  await expect(spelling).toHaveValue('us')
  await expect(vocabulary).toHaveValue('standard')
})
test('submitted guesses announce positional feedback without announcing each typed letter', async ({
  page,
}) => {
  await seededGame(page)
  const status = page.locator('.game-message')
  const summary = status.locator('.sr-only')
  await expect(summary).toBeEmpty()
  await expect(status).toHaveAttribute('aria-live', 'polite')
  await expect(status).toHaveAttribute('aria-atomic', 'true')
  await page.keyboard.type('eagle')
  await page.keyboard.press('Enter')
  const first =
    'Guess 1: EAGLE. Position 1: E, Absent; Position 2: A, Present elsewhere; Position 3: G, Absent; Position 4: L, Correct position; Position 5: E, Correct position.'
  await expect(summary).toHaveText(first)
  await expect(status).toContainText('5 attempts left')
  await page.keyboard.type('crane')
  await expect(summary).toHaveText(first)
  await page.keyboard.press('Enter')
  await expect(summary).toContainText('Guess 2: CRANE.')
  await page.keyboard.type('crane')
  await page.keyboard.press('Enter')
  await expect(summary).toContainText('Guess 3: CRANE.')
  await page.keyboard.type('zzzzz')
  await page.keyboard.press('Enter')
  await expect(status).toContainText('not in this dictionary')
  await expect(summary).toBeEmpty()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace')
  await page.keyboard.type('apple')
  await page.keyboard.press('Enter')
  await expect(summary).toContainText('Guess 4: APPLE.')
  await expect(status).toContainText('You found it')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(summary).toBeEmpty()
})
test('solver strips invalid characters, preserves the caret, and saves the displayed word', async ({
  page,
}) => {
  await seededGame(page)
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'Guess 1', exact: true })
  await input.fill('12345')
  await expect(input).toHaveValue('')
  await input.pressSequentially('apple')
  await expect(input).toHaveValue('apple')
  await input.fill('a 1!')
  await expect(input).toHaveValue('a')
  await input.pressSequentially('pple')
  await expect(input).toHaveValue('apple')
  // Reject an edit that leaves the stored word unchanged, without moving the caret to the end.
  await input.press('Home')
  await input.press('ArrowRight')
  await input.press('1')
  await expect(input).toHaveValue('apple')
  expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(1)
  await input.fill('  A-P P!L3E  ')
  await expect(input).toHaveValue('apple')
  await input.pressSequentially('extra')
  await expect(input).toHaveValue('apple')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('wordlab:solver')!).data)
  expect(saved.rows[0].word).toBe('apple')
  await expect(page.locator('.feedback-tile > .tile-letter')).toHaveText(['a', 'p', 'p', 'l', 'e'])
  await page.reload()
  await expect(input).toHaveValue('apple')
})
test('loss reveals answer, prevents later guesses, and restart clears the board', async ({
  page,
}) => {
  await seededGame(page)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.type('crane')
    await page.keyboard.press('Enter')
  }
  await expect(page.getByRole('status').first()).toContainText('The word was APPLE')
  await expect(page.getByRole('button', { name: 'Enter', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.locator('.board .revealed')).toHaveCount(0)
  // Mix on-screen and physical input after starting a new puzzle.
  await page.getByRole('button', { name: 'a', exact: true }).click()
  await page.keyboard.type('pple')
  await expect(page.locator('.board-row').first()).toContainText('apple')
  await page.keyboard.press('Enter')
  await expect(page.locator('.board-row').first().locator('.revealed')).toHaveCount(5)
})
test('multi-row solver, live corrections, row insertion, independent tabs, persistence and reset', async ({
  page,
}) => {
  await seededGame(page)
  await page.keyboard.type('cr')
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  await expect(page.locator('.candidate-total strong')).not.toHaveText('—')
  await page.getByRole('textbox', { name: 'Guess 1', exact: true }).fill('apple')
  const firstTiles = page.locator('.solver-row').first().locator('.feedback-tile')
  for (let i = 0; i < 5; i++) {
    await firstTiles.nth(i).click()
    await firstTiles.nth(i).click()
  }
  await expect(page.locator('.candidate-total strong')).toHaveText('1')
  await expect(page.locator('.candidate-list')).toHaveText('apple')
  await page.getByRole('button', { name: 'Add row after row 1', exact: true }).click()
  await page.getByRole('textbox', { name: 'Guess 2', exact: true }).fill('crane')
  await expect(page.locator('.candidate-total strong')).toHaveText('0')
  await expect(page.getByText('Some clues conflict')).toBeVisible()
  // CRANE vs APPLE: grey, grey, yellow, grey, green.
  const secondTiles = page.locator('.solver-row').nth(1).locator('.feedback-tile')
  await secondTiles.nth(2).click()
  await secondTiles.nth(4).click()
  await secondTiles.nth(4).click()
  await expect(page.locator('.candidate-total strong')).toHaveText('1')
  await page.getByRole('button', { name: 'Add row after row 1', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Guess 3', exact: true })).toHaveValue('crane')
  await page.getByRole('textbox', { name: 'Guess 2', exact: true }).fill('a')
  await expect(page.locator('.candidate-total strong')).toHaveText('1')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Guess 3', exact: true })).toHaveValue('crane')
  await page.getByRole('tab', { name: 'Wordle', exact: true }).click()
  await expect(page.locator('.board-row').first()).toContainText('cr')
  await expect(page.getByRole('region', { name: 'Recommended guesses' })).not.toBeVisible()
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  await page.getByRole('button', { name: 'Reset solver' }).click()
  await expect(page.locator('.solver-row')).toHaveCount(1)
  await expect(page.getByRole('textbox', { name: 'Guess 1', exact: true })).toHaveValue('')
  await page.getByRole('tab', { name: 'Wordle', exact: true }).click()
  await expect(page.locator('.board-row').first()).toContainText('cr')
})
test('hard-mode recommendations honor hints for every strategy and survive reload', async ({ page }) => {
  await seededGame(page)
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Solver' })
  await panel.getByRole('combobox', { name: 'Spelling', exact: true }).selectOption('us')
  await page.getByRole('textbox', { name: 'Guess 1', exact: true }).fill('audio')
  const tiles = page.locator('.solver-row').first().locator('.feedback-tile')
  await tiles.nth(2).click()
  await tiles.nth(3).click()
  await expect(page.locator('.candidate-total strong')).toHaveText('120')
  const hardMode = page.getByRole('checkbox', { name: 'Hard mode — use revealed hints' })
  await hardMode.check()
  await expect(page.locator('.calculation-note')).toContainText('hard-mode guesses')
  await expect(page.locator('.recommendation')).toHaveCount(5)
  for (const word of await page.locator('.recommendation strong').allTextContents()) {
    expect(word).toContain('d')
    expect(word).toContain('i')
  }
  await expect(page.locator('.candidate-total strong')).toHaveText('120')

  // Turn D green, then ensure each strategy fixes it in the third position and keeps I.
  await tiles.nth(2).click()
  for (const strategy of ['frequency', 'entropy', 'expected', 'minimax']) {
    await panel.getByRole('combobox', { name: 'Strategy', exact: true }).selectOption(strategy)
    await expect(page.locator('.recommendation')).toHaveCount(5)
    for (const word of await page.locator('.recommendation strong').allTextContents()) {
      expect(word[2]).toBe('d')
      expect(word).toContain('i')
    }
  }
  const constrained = await page.locator('.recommendation strong').allTextContents()
  await page.reload()
  await expect(hardMode).toBeChecked()
  await expect(page.locator('.recommendation strong')).toHaveText(constrained)
  await hardMode.uncheck()
  await expect(page.locator('.calculation-note')).not.toContainText('hard-mode guesses')
  await expect(page.locator('.recommendation')).toHaveCount(5)
  expect(await page.locator('.recommendation strong').allTextContents()).not.toEqual(constrained)
})
test('worker remains responsive, discards stale calculations, and suggestions await feedback', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Solver' })
  await panel.getByRole('combobox', { name: 'Word length', exact: true }).selectOption('8')
  await panel.getByRole('combobox', { name: 'Vocabulary', exact: true }).selectOption('all')
  await panel.getByRole('combobox', { name: 'Strategy', exact: true }).selectOption('minimax')
  const delay = await page.evaluate(async () => {
    let max = 0,
      previous = performance.now()
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 16))
      const now = performance.now()
      max = Math.max(max, now - previous)
      previous = now
    }
    return max
  })
  expect(delay).toBeLessThan(250)
  await panel.getByRole('combobox', { name: 'Word length', exact: true }).selectOption('3')
  await expect(page.locator('.candidate-total strong')).toHaveText('1,149')
  await expect(page.locator('.recommendation')).toHaveCount(5)
  const before = await page.locator('.candidate-total strong').textContent()
  await page.locator('.recommendation button').first().click()
  await expect(page.getByText('Awaiting feedback;', { exact: false })).toBeVisible()
  await expect(page.locator('.candidate-total strong')).toHaveText(before!)
  test.info().annotations.push({ type: 'worker-heartbeat-ms', description: String(delay) })
})
test('mobile twelve-letter board and dark theme fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 })
  await seededGame(page)
  await page.getByRole('combobox', { name: 'Word length', exact: true }).selectOption('12')
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(page.locator('.board-row').first().locator('.tile')).toHaveCount(12)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Switch to dark theme' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  await page
    .getByRole('tabpanel', { name: 'Solver' })
    .getByRole('combobox', { name: 'Word length', exact: true })
    .selectOption('12')
  await page.getByRole('textbox', { name: 'Guess 1', exact: true }).fill('conversation')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
test('long solver rows have large numbered tiles at phone and tablet widths', async ({ page }) => {
  await seededGame(page)
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Solver' })
  const length = panel.getByRole('combobox', { name: 'Word length', exact: true })
  const feedback = page.getByRole('group', { name: 'Feedback for guess 1', exact: true })
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 850 })
    for (const letters of [7, 8, 9, 10, 11, 12]) {
      await length.selectOption(String(letters))
      const tiles = feedback.getByRole('button')
      await expect(tiles).toHaveCount(letters)
      const bounds = await tiles.evaluateAll((elements) => elements.map((element) => {
        const rect = element.getBoundingClientRect()
        const position = element.querySelector('.tile-position')!
        return {
          x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          position: position.textContent,
          numbered: getComputedStyle(position).display !== 'none',
        }
      }))
      const columns = Math.ceil(letters / 2)
      for (const [i, tile] of bounds.entries()) {
        expect(tile.width).toBeGreaterThanOrEqual(40)
        expect(tile.height).toBeGreaterThanOrEqual(44)
        expect(tile.position).toBe(String(i + 1))
        expect(tile.numbered).toBe(true)
        expect(tile.y).toBeCloseTo(bounds[i < columns ? 0 : columns].y)
      }
      expect(bounds[columns].y).toBeGreaterThan(bounds[0].y)
      expect(bounds[columns].x).toBeCloseTo(bounds[0].x)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await length.selectOption('5')
    const shortRows = await feedback.getByRole('button').evaluateAll(elements =>
      new Set(elements.map(element => element.getBoundingClientRect().y)).size,
    )
    expect(shortRows).toBe(1)
    await expect(feedback.locator('.tile-position').first()).toBeHidden()
  }
})
test('wrapped feedback keeps letter positions and keyboard navigation in order', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 })
  await seededGame(page)
  await page.getByRole('tab', { name: 'Solver', exact: true }).click()
  await page.getByRole('tabpanel', { name: 'Solver' })
    .getByRole('combobox', { name: 'Word length', exact: true }).selectOption('12')
  await page.getByRole('textbox', { name: 'Guess 1', exact: true }).fill('conversation')
  const feedback = page.getByRole('group', { name: 'Feedback for guess 1', exact: true })
  const tiles = feedback.getByRole('button')
  await tiles.nth(5).focus()
  await page.keyboard.press('Tab')
  await expect(tiles.nth(6)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(tiles.nth(6)).toHaveAccessibleName('Row 1, letter 7, s: Present elsewhere. Click to cycle.')
  await tiles.nth(11).click()
  await expect(tiles.nth(11)).toHaveAccessibleName('Row 1, letter 12, n: Present elsewhere. Click to cycle.')
  await tiles.nth(11).focus()
  await page.keyboard.press('Enter')
  await expect(tiles.nth(11)).toHaveAccessibleName('Row 1, letter 12, n: Correct position. Click to cycle.')
  await expect(tiles.nth(0)).toHaveAccessibleName('Row 1, letter 1, c: Absent. Click to cycle.')
  await page.reload()
  await expect(tiles.nth(6)).toHaveAccessibleName('Row 1, letter 7, s: Present elsewhere. Click to cycle.')
  await expect(tiles.nth(11)).toHaveAccessibleName('Row 1, letter 12, n: Correct position. Click to cycle.')
})
test('tabs work with arrows and dictionary failures explain how to recover', async ({ page }) => {
  await page.route('**/generated/5.json*', (route) =>
    route.request().resourceType() === 'fetch' ? route.abort() : route.continue(),
  )
  await page.goto('/')
  await expect(page.getByRole('status').first()).toContainText('Could not load')
  await page.getByRole('tab', { name: 'Wordle', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Solver', exact: true })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Solver', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})
