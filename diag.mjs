import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 393, height: 852 }, colorScheme: 'dark' })).newPage()
const typeInto = async (which, value) => {
  await page.locator('.draft-row .cell').nth(which).click()
  await page.waitForSelector('.keypad')
  for (let i = 0; i < 6; i++) await page.locator('.key:has-text("⌫")').click()
  for (const ch of String(value)) await page.locator(`.key:text-is("${ch}")`).first().click()
  await page.locator('.sheet-commit').click()
  await page.waitForFunction(() => !document.querySelector('.keypad'))
}
await page.goto('http://localhost:5173/', { waitUntil: 'load' })
await page.evaluate(() => indexedDB.deleteDatabase('qwark'))
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.hero-action')
await page.locator('.hero-action').click()
await page.waitForSelector('.entry.routine')
await page.locator('.entry.routine:has-text("Yläkroppa") .btn').click()
await page.waitForSelector('.draft-row')
// Reproduce the screenshot: 3 working sets done plus one extra, mid-rest.
await typeInto(0, 60)
for (let i = 0; i < 4; i++) {
  if (await page.locator('.suggestion').count()) {
    await page.locator('.suggestion').click()
    await page.waitForFunction(() => !document.querySelector('.suggestion'))
  }
  await page.locator('.tick.big').click(); await page.waitForTimeout(230)
  if (await page.locator('.folded:has-text("Penkkipunnerrus")').count()) {
    await page.locator('.folded:has-text("Penkkipunnerrus") .folded-body').click()
    await page.waitForSelector('.draft-row')
  }
}
await page.waitForTimeout(300)

const m = await page.evaluate(() => {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
  const hit = (c) => c.replace(/\s/g, '') === 'rgb(91,149,255)'
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && el.tagName !== 'BODY') continue
    const s = getComputedStyle(el)
    const marks = []
    if (hit(s.backgroundColor)) marks.push('fill')
    if (hit(s.color)) marks.push('text')
    if (hit(s.borderTopColor) || hit(s.borderLeftColor)) marks.push('border')
    if (marks.length) {
      const r = el.getBoundingClientRect()
      out.push({
        what: (el.className || el.tagName).toString().split(' ')[0],
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 26),
        marks: marks.join('+'),
        area: Math.round(r.width * r.height),
      })
    }
  }
  const tick = document.querySelector('.tick.big')
  const finish = document.querySelector('.masthead .btn.solid')
  const tr = tick.getBoundingClientRect(), fr = finish.getBoundingClientRect()
  return {
    accent,
    accentElements: out.sort((a, b) => b.area - a.area),
    tick: { disabled: tick.disabled, area: Math.round(tr.width * tr.height), fill: getComputedStyle(tick).backgroundColor },
    finish: { area: Math.round(fr.width * fr.height), fill: getComputedStyle(finish).backgroundColor },
  }
})
console.log('accent token:', m.accent)
console.log(`\naccent-coloured elements on screen: ${m.accentElements.length}`)
for (const e of m.accentElements.slice(0, 12)) {
  console.log(`  ${String(e.area).padStart(6)}px²  ${e.marks.padEnd(12)} ${e.what.padEnd(18)} "${e.text}"`)
}
console.log('\nthe intended CTA vs the loudest button:')
console.log('  tick  :', JSON.stringify(m.tick))
console.log('  finish:', JSON.stringify(m.finish))
console.log('  finish is', (m.finish.area / m.tick.area).toFixed(1) + '× the area of the tick')
await browser.close()
