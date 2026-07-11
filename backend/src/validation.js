export function validateQuiz(body) {
  if (!body.title?.trim()) return 'Укажите название квиза'
  if (!Array.isArray(body.questions) || body.questions.length === 0) return 'Добавьте хотя бы один вопрос'
  for (const [index, q] of body.questions.entries()) {
    if (!q.prompt?.trim()) return `Вопрос ${index + 1}: заполните текст`
    if (!['single', 'multiple'].includes(q.answerType)) return `Вопрос ${index + 1}: неизвестный тип ответа`
    if (!Array.isArray(q.options) || q.options.length < 2) return `Вопрос ${index + 1}: нужно минимум два варианта`
    const correct = q.options.filter((o) => o.correct).length
    if (correct === 0 || (q.answerType === 'single' && correct !== 1)) return `Вопрос ${index + 1}: проверьте правильные ответы`
  }
  return null
}
