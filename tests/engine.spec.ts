import { expect, test } from '@playwright/test'

test('engine and scanner screens render', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Neural Trading Engine')
  await expect(
    page.getByRole('heading', { name: 'Precision digit analysis' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Digit scanner' }).click()
  await expect(
    page.getByRole('heading', { name: 'Scanning your chosen markets' }),
  ).toBeVisible()
})
