import { watch } from 'vue'
import { createI18n } from 'vue-i18n'

const languageKey = 'training-timer:language'
const messages = {
  ru: {
    title: 'Интервальный таймер',
    description: 'Настраиваемый интервальный таймер для тренировок',
    navigation: 'Разделы приложения',
    setup: 'Настройка',
    history: 'История',
    language: 'Язык',
    plan: 'План тренировки',
    intervalCount: 'Интервалов: {count}',
    audioSettings: 'Звук и язык',
    sound: 'Звук',
    voice: 'Голос',
    defaultVoice: 'По умолчанию',
    preview: 'Прослушать',
    audioError: 'Звук недоступен.',
    workoutAudioError: 'Звук недоступен. Отсчёт продолжается.',
    interval: 'Интервал {number}',
    name: 'Название',
    type: 'Тип',
    fixed: 'Фиксированный',
    random: 'Случайный',
    seconds: 'Секунды',
    minSeconds: 'Мин., с',
    maxSeconds: 'Макс., с',
    moveUp: 'Переместить интервал {number} вверх',
    moveDown: 'Переместить интервал {number} вниз',
    removeInterval: 'Удалить интервал {number}',
    remove: 'Удалить',
    add: '+ Интервал',
    start: 'Начать тренировку',
    cycle: 'Цикл {number}',
    paused: 'На паузе',
    countdown: 'До смены интервала',
    next: 'Далее · {name}, {duration}',
    stop: 'Завершить',
    resume: 'Продолжить',
    pause: 'Пауза',
    readError: 'Не удалось прочитать сохранённую историю.',
    writeError: 'Не удалось сохранить историю в браузере.',
    emptyHistory: 'Тренировок пока нет.',
    use: 'Использовать',
    work: 'Работа',
    rest: 'Отдых',
    invalidFixed: 'Введите целое число от 1 до 3 600.',
    invalidRandom: 'Введите целые числа от 1 до 3 600.',
    invalidRange: 'Минимум должен быть не больше максимума.',
    duration: '{value} с',
  },
  en: {
    title: 'Interval Timer',
    description: 'Customizable interval timer for workouts',
    navigation: 'App sections',
    setup: 'Setup',
    history: 'History',
    language: 'Language',
    plan: 'Workout plan',
    intervalCount: 'Intervals: {count}',
    audioSettings: 'Sound and language',
    sound: 'Sound',
    voice: 'Voice',
    defaultVoice: 'Default',
    preview: 'Preview',
    audioError: 'Audio is unavailable.',
    workoutAudioError: 'Audio is unavailable. The timer is still running.',
    interval: 'Interval {number}',
    name: 'Name',
    type: 'Type',
    fixed: 'Fixed',
    random: 'Random',
    seconds: 'Seconds',
    minSeconds: 'Min. (s)',
    maxSeconds: 'Max. (s)',
    moveUp: 'Move interval {number} up',
    moveDown: 'Move interval {number} down',
    removeInterval: 'Remove interval {number}',
    remove: 'Remove',
    add: '+ Interval',
    start: 'Start workout',
    cycle: 'Cycle {number}',
    paused: 'Paused',
    countdown: 'Until next interval',
    next: 'Next · {name}, {duration}',
    stop: 'End workout',
    resume: 'Resume',
    pause: 'Pause',
    readError: 'Could not read saved workout history.',
    writeError: 'Could not save workout history in this browser.',
    emptyHistory: 'No workouts yet.',
    use: 'Use workout',
    work: 'Work',
    rest: 'Rest',
    invalidFixed: 'Enter a whole number from 1 to 3,600.',
    invalidRandom: 'Enter whole numbers from 1 to 3,600.',
    invalidRange: 'The minimum must be less than or equal to the maximum.',
    duration: '{value} s',
  },
}

function readLanguage() {
  try {
    return localStorage.getItem(languageKey) === 'en' ? 'en' : 'ru'
  } catch {
    return 'ru'
  }
}

export const i18n = createI18n({
  legacy: false,
  locale: readLanguage(),
  fallbackLocale: 'ru',
  messages,
})

const { locale, t } = i18n.global
watch(locale, language => {
  document.documentElement.lang = language
  document.title = t('title')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'))
  try {
    localStorage.setItem(languageKey, language)
  } catch {
    // The language still applies for this session.
  }
}, { immediate: true })
