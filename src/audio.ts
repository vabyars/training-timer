export function createAudio(onError: () => void) {
  let current: SpeechSynthesisUtterance | undefined
  let enabled = false

  function cancel() {
    if (!current) return
    current = undefined
    window.speechSynthesis.cancel()
  }

  function speak(name: string, language: string, voice?: SpeechSynthesisVoice) {
    if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      enabled = false
      onError()
      return
    }

    cancel()
    const utterance = new SpeechSynthesisUtterance(name)
    utterance.lang = language
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    utterance.onend = () => {
      if (current === utterance) current = undefined
    }
    utterance.onerror = () => {
      if (current !== utterance) return
      current = undefined
      onError()
    }
    current = utterance
    window.speechSynthesis.speak(utterance)
  }

  return {
    start(name: string, language: string, voice?: SpeechSynthesisVoice) {
      enabled = true
      speak(name, language, voice)
    },
    play(name: string, language: string, voice?: SpeechSynthesisVoice) {
      if (enabled) speak(name, language, voice)
    },
    preview: speak,
    stop() {
      enabled = false
      cancel()
    },
  }
}
