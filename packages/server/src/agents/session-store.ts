/**
 * Session Store — Cold storage for AI transcripts.
 *
 * Persists every Weaver (chat) and Loci (metaphor evaluation) session
 * to disk as JSON files. Filesystem-first, no database.
 *
 * Storage layout:
 *   data/sessions/
 *     chat/           — Weaver chat transcripts
 *       {sessionId}.json
 *     loci/           — Loci evaluation transcripts
 *       {sessionId}.json
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { log } from '../logger.js'
import type {
  WeaveSchema,
  MetaphorManifest,
  MetaphorScores,
} from '#weaver/glamour'

// ─── Paths ───────────────────────────────────────────────────────

const SESSIONS_DIR = path.resolve(process.cwd(), 'data', 'sessions')
const CHAT_DIR = path.join(SESSIONS_DIR, 'chat')
const LOCI_DIR = path.join(SESSIONS_DIR, 'loci')

/** Ensure session directories exist */
async function ensureDirs(): Promise<void> {
  await fs.mkdir(CHAT_DIR, { recursive: true })
  await fs.mkdir(LOCI_DIR, { recursive: true })
}

function generateId(): string {
  return crypto.randomUUID()
}

// ─── Chat Session Types ──────────────────────────────────────────

export interface ChatSessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    result: Record<string, unknown>
  }>
}

export interface ChatSession {
  id: string
  weaveId: string
  themeId?: string
  createdAt: string
  updatedAt: string
  messages: ChatSessionMessage[]
}

export interface ChatSessionSummary {
  id: string
  weaveId: string
  themeId?: string
  createdAt: string
  updatedAt: string
  messageCount: number
  /** First user message, truncated */
  preview: string
}

// ─── Loci Session Types ──────────────────────────────────────────

export interface LociSessionEntry {
  type: 'propose' | 'refine' | 'reevaluate'
  timestamp: string
  input: {
    schema?: WeaveSchema
    count?: number
    feedback?: string
    manifestName?: string
  }
  output: MetaphorManifest[] | MetaphorManifest | MetaphorScores
  model: string
}

export interface LociSession {
  id: string
  weaveId: string
  createdAt: string
  updatedAt: string
  entries: LociSessionEntry[]
}

// ─── Chat Session Operations ─────────────────────────────────────

export async function createChatSession(weaveId: string, themeId?: string): Promise<ChatSession> {
  await ensureDirs()

  const session: ChatSession = {
    id: generateId(),
    weaveId,
    themeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  }

  const filepath = path.join(CHAT_DIR, `${session.id}.json`)
  await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8')

  log.info({ sessionId: session.id, weaveId }, 'Chat session created')
  return session
}

export async function appendChatMessage(
  sessionId: string,
  message: ChatSessionMessage
): Promise<void> {
  const filepath = path.join(CHAT_DIR, `${sessionId}.json`)

  try {
    const content = await fs.readFile(filepath, 'utf-8')
    const session: ChatSession = JSON.parse(content)
    session.messages.push(message)
    session.updatedAt = new Date().toISOString()
    await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8')
  } catch (err: any) {
    log.error({ err, sessionId }, 'Failed to append chat message')
    throw new Error(`Session not found: ${sessionId}`)
  }
}

export async function loadChatSession(sessionId: string): Promise<ChatSession> {
  const filepath = path.join(CHAT_DIR, `${sessionId}.json`)

  try {
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as ChatSession
  } catch (err: any) {
    log.error({ err, sessionId }, 'Failed to load chat session')
    throw new Error(`Session not found: ${sessionId}`)
  }
}

export async function listChatSessions(): Promise<ChatSessionSummary[]> {
  await ensureDirs()

  try {
    const files = await fs.readdir(CHAT_DIR)
    const summaries: ChatSessionSummary[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const filepath = path.join(CHAT_DIR, file)
        const content = await fs.readFile(filepath, 'utf-8')
        const session: ChatSession = JSON.parse(content)

        const firstUserMsg = session.messages.find(m => m.role === 'user')
        const preview = firstUserMsg
          ? firstUserMsg.content.slice(0, 80) + (firstUserMsg.content.length > 80 ? '...' : '')
          : '(empty session)'

        summaries.push({
          id: session.id,
          weaveId: session.weaveId,
          themeId: session.themeId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages.length,
          preview,
        })
      } catch {
        // Skip corrupted files
      }
    }

    // Sort by most recent first
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    return summaries
  } catch {
    return []
  }
}

// ─── Loci Session Operations ─────────────────────────────────────

export async function createLociSession(weaveId: string): Promise<LociSession> {
  await ensureDirs()

  const session: LociSession = {
    id: generateId(),
    weaveId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entries: [],
  }

  const filepath = path.join(LOCI_DIR, `${session.id}.json`)
  await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8')

  log.info({ sessionId: session.id, weaveId }, 'Loci session created')
  return session
}

export async function appendLociEntry(
  sessionId: string,
  entry: LociSessionEntry
): Promise<void> {
  const filepath = path.join(LOCI_DIR, `${sessionId}.json`)

  try {
    const content = await fs.readFile(filepath, 'utf-8')
    const session: LociSession = JSON.parse(content)
    session.entries.push(entry)
    session.updatedAt = new Date().toISOString()
    await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8')
  } catch (err: any) {
    log.error({ err, sessionId }, 'Failed to append Loci entry')
    throw new Error(`Loci session not found: ${sessionId}`)
  }
}

export async function loadLociSession(sessionId: string): Promise<LociSession> {
  const filepath = path.join(LOCI_DIR, `${sessionId}.json`)

  try {
    const content = await fs.readFile(filepath, 'utf-8')
    return JSON.parse(content) as LociSession
  } catch (err: any) {
    log.error({ err, sessionId }, 'Failed to load Loci session')
    throw new Error(`Loci session not found: ${sessionId}`)
  }
}
