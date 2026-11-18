<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createAudio } from './audio'
import { readHistory, saveHistory, type Entry } from './history'
import { validSeconds, type Interval, type Settings } from './intervals'
import { createTimer } from './timer'

interface Draft {
  id: number
  name: string
  defaultName?: 'work' | 'rest'
  type: Interval['type']
  seconds: number | string
  minSeconds: number | string
  maxSeconds: number | string
}

let nextId = 0
function makeDraft(interval: Interval, defaultName?: Draft['defaultName']): Draft {
  return {
    id: nextId++,
    name: interval.name,
    defaultName,
    type: interval.type,
    seconds: interval.type === 'fixed' ? interval.seconds : 10,
    minSeconds: interval.type === 'random' ? interval.minSeconds : 5,
    maxSeconds: interval.type === 'random' ? interval.maxSeconds : 10,
  }
}

const { locale, t } = useI18n({ useScope: 'global' })
const drafts = ref([
  makeDraft({ name: '', type: 'fixed', seconds: 10 }, 'work'),
  makeDraft({ name: '', type: 'fixed', seconds: 4 }, 'rest'),
])
const sound = ref(true)
const voiceKey = computed(() => locale.value === 'en' ? 'training-timer:voice:en' : 'training-timer:voice')
const speechLanguage = computed(() => locale.value === 'en' ? 'en-US' : 'ru-RU')
const voiceURI = ref('')
const browserVoices = shallowRef<SpeechSynthesisVoice[]>([])
const voices = computed(() => browserVoices.value.filter(voice =>
  voice.lang.toLowerCase().split('-')[0] === locale.value,
))
const selectedVoice = computed(() => voices.value.find(voice => voice.voiceURI === voiceURI.value))
const voiceChoice = computed({
  get: () => selectedVoice.value?.voiceURI ?? '',
  set(uri: string) {
    voiceURI.value = uri
    try {
      localStorage.setItem(voiceKey.value, uri)
    } catch {
      // The choice still applies for this session.
    }
  },
})
const screen = ref<'setup' | 'workout' | 'history'>('setup')
const heading = ref<HTMLElement>()
const entries = ref<Entry[]>([])
const readError = ref(false)
const writeError = ref(false)
const audioError = ref(false)
const audio = createAudio(() => { audioError.value = true })
let timer: ReturnType<typeof createTimer> | undefined
let screenLock: WakeLockSentinel | undefined
let requestingScreenLock = false
let frame = 0
const display = ref<ReturnType<ReturnType<typeof createTimer>['read']>>()

function validate(draft: Draft) {
  if (draft.type === 'fixed') return validSeconds(draft.seconds) ? '' : t('invalidFixed')
  if (!validSeconds(draft.minSeconds) || !validSeconds(draft.maxSeconds)) return t('invalidRandom')
  return draft.minSeconds > draft.maxSeconds ? t('invalidRange') : ''
}

const canStart = computed(() => drafts.value.every(draft => !validate(draft)))
const clock = computed(() => {
  const seconds = Math.ceil((display.value?.remaining ?? 0) / 1000)
  return [Math.floor(seconds / 60), seconds % 60].map(part => String(part).padStart(2, '0')).join(':')
})
const progress = computed(() => {
  const state = display.value
  return state ? Math.min(100, (state.remaining / state.length) * 100) : 0
})
const dateFormat = computed(() => new Intl.DateTimeFormat(speechLanguage.value, { dateStyle: 'medium', timeStyle: 'short' }))

function describe(interval: Interval) {
  const value = interval.type === 'fixed' ? interval.seconds : `${interval.minSeconds}–${interval.maxSeconds}`
  return t('duration', { value })
}

function navigate(target: typeof screen.value) {
  if (target === 'history' && screen.value === 'setup') {
    audio.stop()
    audioError.value = false
  }
  screen.value = target
  void nextTick(() => heading.value?.focus())
}

function draftName(draft: Draft) {
  return draft.defaultName ? t(draft.defaultName) : draft.name
}

function editName(draft: Draft, event: Event) {
  draft.name = (event.target as HTMLInputElement).value
  draft.defaultName = undefined
}

function intervalName(draft: Draft, index: number) {
  return draftName(draft).trim() || t('interval', { number: index + 1 })
}

function updateVoices() {
  browserVoices.value = window.speechSynthesis?.getVoices() ?? []
}

function previewVoice() {
  if (!sound.value) return
  audioError.value = false
  audio.preview(intervalName(drafts.value[0], 0), speechLanguage.value, selectedVoice.value)
}

watch(voiceKey, key => {
  audio.stop()
  audioError.value = false
  try {
    voiceURI.value = localStorage.getItem(key) ?? ''
  } catch {
    voiceURI.value = ''
  }
}, { immediate: true })

watch(sound, enabled => {
  if (!enabled) {
    audio.stop()
    audioError.value = false
  }
})

function addInterval() {
  drafts.value.push(makeDraft({ name: '', type: 'fixed', seconds: 10 }))
  void nextTick(() => document.getElementById(`interval-${drafts.value.at(-1)?.id}`)?.focus())
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction
  const items = drafts.value
  if (target < 0 || target >= items.length) return
  const [draft] = items.splice(index, 1)
  items.splice(target, 0, draft)
  void nextTick(() => document.getElementById(`interval-${draft.id}`)?.focus())
}

function loadHistory() {
  try {
    entries.value = readHistory()
    readError.value = false
  } catch {
    readError.value = true
  }
}

function record(settings: Settings) {
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join('')
  const entry = { id, startedAt: new Date().toISOString(), settings }
  loadHistory()
  entries.value = [entry, ...entries.value].slice(0, 50)
  try {
    saveHistory(entries.value)
    writeError.value = false
  } catch {
    writeError.value = true
  }
}

function useEntry(entry: Entry) {
  drafts.value = entry.settings.intervals.map(interval => makeDraft(interval))
  sound.value = entry.settings.sound
  navigate('setup')
}

function tick() {
  if (!timer) return
  const now = performance.now()
  const advanced = timer.advance(now)
  const state = timer.read(now)
  if (advanced) audio.play(state.current.name, speechLanguage.value, selectedVoice.value)
  display.value = state
  frame = requestAnimationFrame(tick)
}

function needsScreenLock() {
  return Boolean(timer && display.value && !display.value.paused && document.visibilityState === 'visible')
}

async function keepScreenOn() {
  if (!navigator.wakeLock || !needsScreenLock() || requestingScreenLock || screenLock?.released === false) return

  requestingScreenLock = true
  try {
    const lock = await navigator.wakeLock.request('screen')
    if (needsScreenLock()) screenLock = lock
    else void lock.release().catch(() => {})
  } catch {
    // The browser may deny the request, for example in low-power mode.
  } finally {
    requestingScreenLock = false
  }
}

function releaseScreenLock() {
  const lock = screenLock
  screenLock = undefined
  void lock?.release().catch(() => {})
}

function updateScreenLock() {
  if (needsScreenLock()) void keepScreenOn()
  else releaseScreenLock()
}

function start() {
  if (!canStart.value || timer) return

  const intervals = drafts.value.map((draft, index): Interval => {
    const name = intervalName(draft, index)
    return draft.type === 'fixed'
      ? { name, type: 'fixed', seconds: Number(draft.seconds) }
      : { name, type: 'random', minSeconds: Number(draft.minSeconds), maxSeconds: Number(draft.maxSeconds) }
  })
  const settings = { sound: sound.value, intervals }
  timer = createTimer(intervals, performance.now())
  audioError.value = false
  audio.stop()
  if (settings.sound) audio.start(intervals[0].name, speechLanguage.value, selectedVoice.value)
  tick()
  void keepScreenOn()
  navigate('workout')
  record(settings)
}

function togglePause() {
  if (!timer || !display.value) return
  const now = performance.now()
  if (display.value.paused) {
    timer.resume(now)
    tick()
    void keepScreenOn()
    return
  }

  const advanced = timer.advance(now)
  timer.pause(now)
  const state = timer.read(now)
  if (advanced) audio.play(state.current.name, speechLanguage.value, selectedVoice.value)
  display.value = state
  cancelAnimationFrame(frame)
  releaseScreenLock()
}

function stop() {
  timer = undefined
  releaseScreenLock()
  cancelAnimationFrame(frame)
  audio.stop()
  audioError.value = false
  navigate('setup')
}

onMounted(() => {
  loadHistory()
  document.addEventListener('visibilitychange', updateScreenLock)
  window.speechSynthesis?.addEventListener('voiceschanged', updateVoices)
  updateVoices()
})
onUnmounted(() => {
  document.removeEventListener('visibilitychange', updateScreenLock)
  window.speechSynthesis?.removeEventListener('voiceschanged', updateVoices)
  timer = undefined
  releaseScreenLock()
  cancelAnimationFrame(frame)
  audio.stop()
})
</script>

<template>
  <main class="shell">
    <header class="masthead">
      <span class="mark" aria-hidden="true">◴</span>
      <h1>{{ t('title') }}</h1>
    </header>

    <nav v-if="screen !== 'workout'" :aria-label="t('navigation')">
      <button type="button" :aria-current="screen === 'setup' ? 'page' : undefined" @click="navigate('setup')">{{ t('setup') }}</button>
      <button type="button" :aria-current="screen === 'history' ? 'page' : undefined" @click="navigate('history')">{{ t('history') }}</button>
    </nav>

    <form v-if="screen === 'setup'" class="content" novalidate @submit.prevent="start">
      <div class="section-heading">
        <h2 ref="heading" tabindex="-1">{{ t('intervals') }}</h2>
        <label class="sound"><input v-model="sound" type="checkbox"> {{ t('sound') }}</label>
      </div>
      <div class="fields voice-settings">
        <label>{{ t('language') }}
          <select v-model="locale">
            <option value="ru" lang="ru">Русский</option>
            <option value="en" lang="en">English</option>
          </select>
        </label>
        <label>{{ t('voice') }}
          <select v-model="voiceChoice" :disabled="!sound">
            <option value="">{{ t('defaultVoice') }}</option>
            <option v-for="voice in voices" :key="voice.voiceURI" :value="voice.voiceURI">{{ voice.name }}</option>
          </select>
        </label>
        <button type="button" :disabled="!sound" @click="previewVoice">{{ t('preview') }}</button>
      </div>
      <p v-if="audioError" class="error" role="alert">{{ t('audioError') }}</p>
      <fieldset v-for="(draft, index) in drafts" :key="draft.id" class="card">
        <legend>{{ t('interval', { number: index + 1 }) }}</legend>
        <label>{{ t('name') }}<input :id="`interval-${draft.id}`" :value="draftName(draft)" :placeholder="t('interval', { number: index + 1 })" @input="editName(draft, $event)"></label>
        <div class="fields">
          <label>{{ t('type') }}<select v-model="draft.type"><option value="fixed">{{ t('fixed') }}</option><option value="random">{{ t('random') }}</option></select></label>
          <label v-if="draft.type === 'fixed'">{{ t('seconds') }}
            <input v-model.number="draft.seconds" type="number" min="1" max="3600" step="1" inputmode="numeric"
              :aria-invalid="Boolean(validate(draft))" :aria-describedby="validate(draft) ? `error-${draft.id}` : undefined">
          </label>
          <template v-else>
            <label>{{ t('minSeconds') }}<input v-model.number="draft.minSeconds" type="number" min="1" max="3600" step="1" inputmode="numeric"
              :aria-invalid="Boolean(validate(draft))" :aria-describedby="validate(draft) ? `error-${draft.id}` : undefined"></label>
            <label>{{ t('maxSeconds') }}<input v-model.number="draft.maxSeconds" type="number" min="1" max="3600" step="1" inputmode="numeric"
              :aria-invalid="Boolean(validate(draft))" :aria-describedby="validate(draft) ? `error-${draft.id}` : undefined"></label>
          </template>
        </div>
        <p v-if="validate(draft)" :id="`error-${draft.id}`" class="error" role="alert">{{ validate(draft) }}</p>
        <div class="row-actions">
          <button type="button" :disabled="index === 0" :aria-label="t('moveUp', { number: index + 1 })" @click="move(index, -1)">↑</button>
          <button type="button" :disabled="index === drafts.length - 1" :aria-label="t('moveDown', { number: index + 1 })" @click="move(index, 1)">↓</button>
          <button type="button" :disabled="drafts.length === 1" :aria-label="t('removeInterval', { number: index + 1 })" @click="drafts.splice(index, 1)">{{ t('remove') }}</button>
        </div>
      </fieldset>
      <div class="actions">
        <button type="button" @click="addInterval">{{ t('add') }}</button>
        <button class="primary" type="submit" :disabled="!canStart">{{ t('start') }}</button>
      </div>
    </form>

    <section v-else-if="screen === 'workout' && display" class="content">
      <div class="training">
        <div aria-live="polite" aria-atomic="true">
          <p class="muted">{{ t('cycle', { number: display.cycle }) }}</p>
          <h2 ref="heading" tabindex="-1">{{ display.current.name }}</h2>
        </div>
        <div class="dial" :style="{ '--remaining': progress + '%' }">
          <div>
            <strong role="timer">{{ clock }}</strong>
            <span class="muted">{{ t(display.paused ? 'paused' : 'countdown') }}</span>
          </div>
        </div>
        <p>{{ t('next', { name: display.next.name, duration: describe(display.next) }) }}</p>
        <p v-if="audioError" class="error" role="alert">{{ t('workoutAudioError') }}</p>
      </div>
      <div class="actions">
        <button type="button" @click="stop">{{ t('stop') }}</button>
        <button type="button" class="primary" @click="togglePause">{{ t(display.paused ? 'resume' : 'pause') }}</button>
      </div>
    </section>

    <section v-else class="content">
      <h2 ref="heading" tabindex="-1">{{ t('history') }}</h2>
      <p v-if="readError" class="error" role="alert">{{ t('readError') }}</p>
      <p v-if="writeError" class="error" role="alert">{{ t('writeError') }}</p>
      <p v-if="entries.length === 0" class="muted">{{ t('emptyHistory') }}</p>
      <article v-for="entry in entries" :key="entry.id" class="card history-entry">
        <time class="muted" :datetime="entry.startedAt">{{ dateFormat.format(new Date(entry.startedAt)) }}</time>
        <p>{{ entry.settings.intervals.map(interval => interval.name + ' ' + describe(interval)).join(' → ') }}</p>
        <button type="button" @click="useEntry(entry)">{{ t('use') }}</button>
      </article>
    </section>
  </main>
</template>
