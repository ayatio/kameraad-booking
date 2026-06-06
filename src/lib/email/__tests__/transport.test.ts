import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFile, rm } from 'fs/promises'
import path from 'path'

// Must set/unset RESEND_API_KEY before importing to control factory
const OUTBOX = path.join(process.cwd(), '.email-outbox')

const SAMPLE_MSG = {
  to: 'test@example.com',
  subject: 'Test subject',
  html: '<p>Hello</p>',
  text: 'Hello',
  type: 'confirmation',
}

describe('getTransport', () => {
  it('returns DryRunTransport when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY
    // Reset module to clear singleton
    vi.resetModules()
    const { getTransport } = await import('../transport')
    const t = getTransport()
    expect(t).toBeDefined()
    // DryRunTransport.send writes files (test below); just check it's callable
    expect(typeof t.send).toBe('function')
  })
})

describe('DryRunTransport', () => {
  beforeEach(async () => {
    delete process.env.RESEND_API_KEY
    vi.resetModules()
    // Clean up any previous outbox files
    await rm(OUTBOX, { recursive: true, force: true })
  })

  afterEach(async () => {
    await rm(OUTBOX, { recursive: true, force: true })
  })

  it('returns an id', async () => {
    const { getTransport } = await import('../transport')
    const t = getTransport()
    const result = await t.send(SAMPLE_MSG)
    expect(result.id).toMatch(/^dry-/)
  })

  it('writes a .json metadata file', async () => {
    const { getTransport } = await import('../transport')
    const t = getTransport()
    await t.send(SAMPLE_MSG)
    const files = await readFile(OUTBOX, 'utf8').catch(() => null)
    // Just ensure the directory was created
    const { readdir } = await import('fs/promises')
    const entries = await readdir(OUTBOX)
    const jsonFile = entries.find((f) => f.endsWith('.json'))
    expect(jsonFile).toBeDefined()
    const content = JSON.parse(await readFile(path.join(OUTBOX, jsonFile!), 'utf8'))
    expect(content.to).toBe('test@example.com')
    expect(content.subject).toBe('Test subject')
  })

  it('writes a .html file', async () => {
    const { getTransport } = await import('../transport')
    const t = getTransport()
    await t.send(SAMPLE_MSG)
    const { readdir } = await import('fs/promises')
    const entries = await readdir(OUTBOX)
    const htmlFile = entries.find((f) => f.endsWith('.html'))
    expect(htmlFile).toBeDefined()
    const content = await readFile(path.join(OUTBOX, htmlFile!), 'utf8')
    expect(content).toBe('<p>Hello</p>')
  })

  it('uses the type field in the filename', async () => {
    const { getTransport } = await import('../transport')
    const t = getTransport()
    await t.send({ ...SAMPLE_MSG, type: 'reminder_24h' })
    const { readdir } = await import('fs/promises')
    const entries = await readdir(OUTBOX)
    expect(entries.some((f) => f.includes('reminder_24h'))).toBe(true)
  })
})
