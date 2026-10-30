import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

let server
let api
let requests
let authEvents
let respond
const storage = new Map()
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const baseUrl = 'http://v3-api-test.invalid'
const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})

before(async () => {
  server = await createServer({
    logLevel: 'silent',
    server: { middlewareMode: true },
    define: { 'import.meta.env.VITE_V3_API_URL': JSON.stringify(baseUrl) },
  })
  api = await server.ssrLoadModule('/src/api/apiV3Client.js')
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => storage.delete(key),
    },
  })
  window.addEventListener(api.V3_AUTH_EXPIRED_EVENT, (event) => authEvents.push(event.detail))
  globalThis.fetch = async (url, options) => {
    assert.ok(url.startsWith(`${baseUrl}/api/v3/`), 'Only synthetic requests are allowed')
    requests.push({ url, options })
    return respond(url, options)
  }
})

beforeEach(() => {
  requests = []
  authEvents = []
  storage.clear()
  respond = () => { throw new Error('An unmocked request was blocked') }
})

after(async () => {
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  await server?.close()
})

test('questionnaire accepts both a PDF and structured errors, retaining bearer authentication', async () => {
  respond = () => new Response('%PDF-1.7\nsynthetic', { headers: { 'Content-Type': 'application/pdf' } })
  const blob = await api.downloadTestQuestionnairePdfV3(12, 'Bearer synthetic-token')
  assert.equal(await blob.text(), '%PDF-1.7\nsynthetic')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, `${baseUrl}/api/v3/assessments/12/questionnaire/pdf`)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer synthetic-token')
  assert.equal(requests[0].options.headers.get('Accept'), 'application/pdf, application/json')
  assert.deepEqual(authEvents, [])
})

test('a missing questionnaire route keeps its JSON 404 instead of becoming a PDF-negotiation 401', async () => {
  respond = (_url, { headers }) => headers.get('Accept').includes('application/json')
    ? json(404, { message: 'The requested resource was not found.' })
    : json(401, { message: 'Authentication is required.', errors: { code: 'AUTHENTICATION_REQUIRED' } })
  await assert.rejects(api.downloadTestQuestionnairePdfV3(12, 'synthetic-token'), (error) => {
    assert.equal(error.status, 404)
    assert.equal(error.message, 'The requested resource was not found.')
    assert.equal(error.isAuthenticationFailure, false)
    return true
  })
  assert.deepEqual(authEvents, [])
})

test('questionnaire authorization, validation and rendering failures do not expire a session', async () => {
  for (const [status, code] of [[403, 'ACCESS_DENIED'], [409, 'ASSESSMENT_HAS_NO_QUESTIONS'], [500, 'QUESTIONNAIRE_PDF_GENERATION_FAILED']]) {
    respond = () => json(status, { message: 'Synthetic export error', errors: { code } })
    await assert.rejects(api.downloadTestQuestionnairePdfV3(12, 'synthetic-token'), (error) => {
      assert.equal(error.status, status)
      assert.equal(error.code, code)
      assert.equal(error.isAuthenticationFailure, false)
      return true
    })
  }
  assert.deepEqual(authEvents, [])
})

test('genuine authentication failures still expire the matching session', async () => {
  respond = () => json(401, { message: 'Authentication is required.', errors: { code: 'AUTHENTICATION_REQUIRED' } })
  await assert.rejects(api.downloadTestQuestionnairePdfV3(12, 'expired-synthetic-token'), (error) => {
    assert.equal(error.status, 401)
    assert.equal(error.isAuthenticationFailure, true)
    return true
  })
  assert.deepEqual(authEvents, [{
    token: 'expired-synthetic-token',
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication is required.',
  }])
})

test('missing tokens still fail closed and never issue an unauthenticated export request', async () => {
  await assert.rejects(api.downloadTestQuestionnairePdfV3(12), { code: 'AUTHENTICATION_REQUIRED' })
  assert.equal(requests.length, 0)
  assert.deepEqual(authEvents, [{ token: '', code: '', message: '' }])
})

test('questionnaire uses the established stored session when no explicit token is passed', async () => {
  storage.set('assessment-auth-session', JSON.stringify({ token: 'stored-synthetic-token' }))
  respond = () => new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } })
  await api.downloadTestQuestionnairePdfV3(12)
  assert.equal(requests[0].options.headers.get('Authorization'), 'Bearer stored-synthetic-token')
  assert.deepEqual(authEvents, [])
})

test('rejects JSON, HTML and invalid bodies returned with HTTP 200 instead of opening a broken PDF', async () => {
  for (const [body, contentType] of [['{}', 'application/json'], ['<html>Login</html>', 'text/html'], ['not a PDF', 'application/pdf']]) {
    respond = () => new Response(body, { headers: { 'Content-Type': contentType } })
    await assert.rejects(api.downloadTestQuestionnairePdfV3(12, 'synthetic-token'), { code: 'QUESTIONNAIRE_PDF_INVALID_RESPONSE' })
  }
  assert.deepEqual(authEvents, [])
})

test('connection failures surface as network errors without clearing a session', async () => {
  respond = () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(api.downloadTestQuestionnairePdfV3(12, 'synthetic-token'), { code: 'V3_NETWORK_ERROR' })
  assert.deepEqual(authEvents, [])
})

test('answer-sheet download behavior remains unchanged', async () => {
  respond = () => new Response('%PDF-1.7\nanswer sheet', { headers: { 'Content-Type': 'application/pdf' } })
  const blob = await api.downloadAnswerSheetPdfV3(34, 'synthetic-token')
  assert.equal(await blob.text(), '%PDF-1.7\nanswer sheet')
  assert.equal(requests[0].url, `${baseUrl}/api/v3/answer-sheet-versions/34/pdf`)
  assert.equal(requests[0].options.headers.get('Accept'), 'application/pdf')
  assert.deepEqual(authEvents, [])
})

test('active assessment edit eligibility preserves ASM-7 content and pending-result rules', async () => {
  respond = () => json(200, {
    success: true,
    data: {
      canEditContent: true,
      canEditDetails: true,
      canCorrectAnswerKey: false,
      contentEditMode: 'same_layout',
      canEditSchedule: true,
      pendingResultCount: 3,
      resultCount: 12,
    },
  })

  const eligibility = await api.getAssessmentEditEligibilityV3(42, 'synthetic-token')

  assert.equal(requests[0].url, `${baseUrl}/api/v3/assessments/42/edit-eligibility`)
  assert.equal(eligibility.contentEditMode, 'same_layout')
  assert.equal(eligibility.canEditSchedule, true)
  assert.equal(eligibility.canCorrectAnswerKey, false)
  assert.equal(eligibility.pendingResultCount, 3)
  assert.equal(eligibility.resultCount, 12)
})

test('ASM-7 update conflicts retain their field and pending-count details', async () => {
  for (const [code, errors] of [
    ['ASSESSMENT_STRUCTURE_LOCKED', { field: 'parts[0].questionTypeCode' }],
    ['ASSESSMENT_RESULTS_PENDING', { pendingCount: 2 }],
  ]) {
    respond = () => json(409, { message: 'Synthetic ASM-7 conflict', errors: { code, ...errors } })
    await assert.rejects(
      api.updateAssessmentV3(42, { testName: 'Updated assessment' }, 'synthetic-token'),
      (error) => {
        assert.equal(error.status, 409)
        assert.equal(error.code, code)
        Object.entries(errors).forEach(([field, value]) => {
          assert.equal(error.errors[field], value)
        })
        return true
      },
    )
  }
  assert.deepEqual(authEvents, [])
})
