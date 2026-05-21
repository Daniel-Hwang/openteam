import type { ExternalModelConfig, ExternalModelFormat, OpenTeamStore } from '../group/types'
import { normalizeLanguage, translateUi } from '../shared/i18n'

export interface ExternalModelsViewDependencies {
  getStore(): OpenTeamStore
  settingsButtonEl: HTMLButtonElement
  settingsMenuEl: HTMLElement
  openExternalModelsEl: HTMLButtonElement
  closeExternalModelsEl: HTMLButtonElement
  externalModelsModalEl: HTMLElement
  externalModelsListEl: HTMLElement
  externalModelFormEl: HTMLFormElement
  externalModelIdEl: HTMLInputElement
  externalModelNameEl: HTMLInputElement
  externalModelFormatEl: HTMLSelectElement
  externalModelBaseUrlEl: HTMLInputElement
  externalModelApiKeyEl: HTMLInputElement
  externalModelModelNameEl: HTMLInputElement
  resetExternalModelFormEl: HTMLButtonElement
  runCommand(type: string, payload?: Record<string, unknown>): Promise<void>
  testExternalModel(modelId: string): Promise<void>
  showError(message: string): void
}

export interface ExternalModelsView {
  openExternalModels(): void
  closeExternalModels(): void
  registerExternalModelsEvents(): void
  renderExternalModels(): void
}

export function createExternalModelsView(deps: ExternalModelsViewDependencies): ExternalModelsView {
  function registerExternalModelsEvents(): void {
    deps.openExternalModelsEl.addEventListener('click', openExternalModels)
    deps.closeExternalModelsEl.addEventListener('click', closeExternalModels)
    deps.resetExternalModelFormEl.addEventListener('click', resetForm)
    deps.externalModelFormEl.addEventListener('submit', event => {
      event.preventDefault()
      saveModel().catch(error => deps.showError(error instanceof Error ? error.message : String(error)))
    })
  }

  function renderExternalModels(): void {
    deps.externalModelsListEl.replaceChildren()
    const models = listModels()
    if (models.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'empty-card'
      empty.textContent = ui('暂无外部模型')
      deps.externalModelsListEl.append(empty)
      return
    }

    for (const model of models) deps.externalModelsListEl.append(modelCard(model))
  }

  function modelCard(model: ExternalModelConfig): HTMLElement {
    const card = document.createElement('section')
    card.className = 'template-card'
    const body = document.createElement('div')
    body.className = 'template-card-body'
    const name = document.createElement('div')
    name.className = 'role-name'
    name.textContent = model.name
    const description = document.createElement('div')
    description.className = 'template-description'
    description.textContent = `${model.format === 'anthropic' ? 'Anthropic' : 'OpenAI'} · ${model.modelName}`
    const baseUrl = document.createElement('div')
    baseUrl.className = 'template-description'
    baseUrl.textContent = model.baseUrl
    body.append(name, description, baseUrl)

    const actions = document.createElement('div')
    actions.className = 'template-card-actions'
    const edit = document.createElement('button')
    edit.type = 'button'
    edit.className = 'btn btn-ghost'
    edit.textContent = ui('编辑')
    edit.addEventListener('click', () => fillForm(model))
    const test = document.createElement('button')
    test.type = 'button'
    test.className = 'btn btn-ghost'
    test.textContent = ui('测试')
    test.addEventListener('click', () => testModel(model, test))
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'btn btn-danger'
    remove.textContent = ui('删除')
    remove.addEventListener('click', () => deleteModel(model))
    actions.append(test, edit, remove)
    card.append(body, actions)
    return card
  }

  async function saveModel(): Promise<void> {
    const modelId = deps.externalModelIdEl.value.trim()
    const payload = {
      name: deps.externalModelNameEl.value.trim(),
      format: readFormat(),
      baseUrl: deps.externalModelBaseUrlEl.value.trim(),
      apiKey: deps.externalModelApiKeyEl.value.trim(),
      modelName: deps.externalModelModelNameEl.value.trim(),
    }
    await deps.runCommand(modelId ? 'EXTERNAL_MODEL_UPDATE' : 'EXTERNAL_MODEL_CREATE', modelId ? { modelId, ...payload } : payload)
    resetForm()
    renderExternalModels()
  }

  function deleteModel(model: ExternalModelConfig): void {
    const message = language() === 'en' ? `Delete external model "${model.name}"?` : `确定删除外部模型「${model.name}」吗？`
    if (!window.confirm(message)) return
    deps.runCommand('EXTERNAL_MODEL_DELETE', { modelId: model.id })
      .then(() => {
        resetForm()
        renderExternalModels()
      })
      .catch(error => deps.showError(error instanceof Error ? error.message : String(error)))
  }

  async function testModel(model: ExternalModelConfig, button: HTMLButtonElement): Promise<void> {
    const originalText = button.textContent ?? ui('测试')
    button.disabled = true
    button.textContent = ui('测试中')
    try {
      await deps.testExternalModel(model.id)
      button.textContent = ui('测试通过')
    } catch (error: any) {
      button.textContent = originalText
      const message = error?.friendlyMessage ?? (error instanceof Error ? error.message : String(error))
      deps.showError(message)
    } finally {
      window.setTimeout(() => {
        button.disabled = false
        button.textContent = originalText
      }, 1200)
    }
  }

  function fillForm(model: ExternalModelConfig): void {
    deps.externalModelIdEl.value = model.id
    deps.externalModelNameEl.value = model.name
    deps.externalModelFormatEl.value = model.format
    deps.externalModelBaseUrlEl.value = model.baseUrl
    deps.externalModelApiKeyEl.value = model.apiKey
    deps.externalModelModelNameEl.value = model.modelName
  }

  function resetForm(): void {
    deps.externalModelIdEl.value = ''
    deps.externalModelNameEl.value = ''
    deps.externalModelFormatEl.value = 'openai'
    deps.externalModelBaseUrlEl.value = ''
    deps.externalModelApiKeyEl.value = ''
    deps.externalModelModelNameEl.value = ''
  }

  function openExternalModels(): void {
    deps.settingsMenuEl.hidden = true
    deps.settingsButtonEl.setAttribute('aria-expanded', 'false')
    deps.externalModelsModalEl.hidden = false
    resetForm()
    renderExternalModels()
    deps.externalModelNameEl.focus()
  }

  function closeExternalModels(): void {
    deps.externalModelsModalEl.hidden = true
  }

  function listModels(): ExternalModelConfig[] {
    const store = deps.getStore()
    return store.settings.externalModelOrder
      .map(modelId => store.settings.externalModelsById[modelId])
      .filter((model): model is ExternalModelConfig => Boolean(model))
  }

  function readFormat(): ExternalModelFormat {
    return deps.externalModelFormatEl.value === 'anthropic' ? 'anthropic' : 'openai'
  }

  function language() {
    return normalizeLanguage(deps.getStore().settings.language)
  }

  function ui(source: string): string {
    return translateUi(source, language())
  }

  return { openExternalModels, closeExternalModels, registerExternalModelsEvents, renderExternalModels }
}
